import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { removeBackground as removeLocalBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';
import {
  getAvailableKeys,
  loadKeys,
  markExhausted,
  QuotaExhaustedError
} from './key-pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 8787);
const maxFileSize = 20 * 1024 * 1024;

loadDotEnv(path.join(rootDir, '.env'));

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize },
  fileFilter: (_request, file, callback) => {
    if (['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error('请上传 PNG、JPG 或 WebP 图片。'));
  }
});

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    provider: loadKeys().length > 0 ? 'remove.bg' : 'local'
  });
});

app.post('/api/remove-bg', upload.single('image'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ message: '请先上传一张图片。' });
      return;
    }

    const targetType = normalizeTargetType(request.body.targetType);
    const quality = normalizeQuality(request.body.quality);
    const result = loadKeys().length > 0
      ? await removeWithOfficialApi(request.file, targetType)
      : await removeWithLocalModel(request.file.buffer, quality);
    const transparentPng = await normalizeTransparentPng(result.buffer);

    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Remove-Bg-Provider', result.provider);
    response.setHeader('X-Image-Format', 'png-alpha');
    response.send(transparentPng);
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path.startsWith('/api')) {
      next();
      return;
    }

    response.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((error, _request, response, _next) => {
  if (error instanceof QuotaExhaustedError) {
    response.status(503).json({ message: error.message });
    return;
  }

  const message = error instanceof Error ? error.message : '背景移除失败，请换一张图片重试。';
  response.status(500).json({ message });
});

app.listen(port, () => {
  console.log(`remove-bg api listening on http://localhost:${port}`);
});

function normalizeTargetType(value) {
  if (value === 'product' || value === 'person') {
    return value;
  }

  return 'auto';
}

function normalizeQuality(value) {
  return value === 'fast' ? 'fast' : 'best';
}

async function removeWithOfficialApi(file, targetType) {
  const available = getAvailableKeys();
  if (available.length === 0) {
    throw new QuotaExhaustedError('所有 API 配额已用完，请稍后重试');
  }

  const size = process.env.REMOVE_BG_SIZE || 'auto';

  // 粘性 + 故障切换：始终从第一个可用 key 开始尝试；遇到 402/429
  // 标记 exhausted 后切换到下一个；网络错误不标记但仍切下一个重试。
  // 注意：所有错误信息中都不能包含具体的 key 字符串。
  for (const key of available) {
    let apiResponse;
    try {
      const formData = new FormData();
      formData.append(
        'image_file',
        new Blob([file.buffer], { type: file.mimetype }),
        file.originalname
      );
      formData.append('size', size);
      formData.append('format', 'png');
      formData.append('type', targetType);

      apiResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': key
        },
        body: formData
      });
    } catch (networkError) {
      // 网络错误：本 key 暂时不可用但不一定耗尽，跳到下一个重试。
      // 不 markExhausted，避免误伤暂时性抖动。
      continue;
    }

    if (apiResponse.ok) {
      return {
        provider: 'remove.bg',
        buffer: Buffer.from(await apiResponse.arrayBuffer())
      };
    }

    // 402 Payment Required / 429 Too Many Requests：当前 key 配额耗尽或被限流。
    // 标记后继续尝试下一个 key。
    if (apiResponse.status === 402 || apiResponse.status === 429) {
      markExhausted(key);
      continue;
    }

    // 其他错误（4xx 客户端错误、5xx 服务端错误）跟具体 key 无关，
    // 直接抛出让上层 500 处理，不切换 key。
    const detail = await apiResponse.text();
    throw new Error(`remove.bg API 处理失败：${detail || apiResponse.statusText}`);
  }

  // 走完所有 key 都没成功：要么全部 402/429，要么全部网络错误。
  throw new QuotaExhaustedError('所有 API key 都已耗尽或不可用');
}

async function removeWithLocalModel(buffer, quality) {
  const model = quality === 'fast' ? 'small' : 'medium';
  const normalized = await normalizeToSquare(buffer);
  const normalizedBlob = new Blob([normalized.buffer], { type: 'image/png' });
  const resultBlob = await removeLocalBackground(normalizedBlob, {
    model,
    output: {
      format: 'image/png',
      quality: 1
    }
  });
  const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());
  const cropped = await sharp(resultBuffer)
    .extract({
      left: normalized.left,
      top: normalized.top,
      width: normalized.width,
      height: normalized.height
    })
    .png()
    .toBuffer();

  return {
    provider: `local-${model}`,
    buffer: cropped
  };
}

async function normalizeTransparentPng(buffer) {
  return sharp(buffer)
    .ensureAlpha()
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      force: true
    })
    .toBuffer();
}

async function normalizeToSquare(buffer) {
  const metadata = await sharp(buffer).rotate().metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error('无法读取图片尺寸，请换一张图片重试。');
  }

  const size = Math.max(width, height);
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);

  const squareBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width,
      height,
      fit: 'fill'
    })
    .extend({
      top,
      bottom: size - height - top,
      left,
      right: size - width - left,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  return {
    buffer: squareBuffer,
    width,
    height,
    left,
    top
  };
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const rows = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const row of rows) {
    const line = row.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const index = line.indexOf('=');
    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
