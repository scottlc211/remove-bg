// /api/remove-bg
//
// 接收 JSON body：{ image: dataUrl, targetType, size }
// 调用 remove.bg API（带 key 池轮询和故障切换），返回 PNG buffer。
//
// 请求体上限放宽到 4.5MB（Vercel Hobby 上限）；前端需把图片压缩到该范围内。

import { assertAccessPassword } from './_lib/auth.js';
import { runWithFailover, QuotaExhaustedError } from './_lib/key-pool.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb'
    }
  }
};

export default async function handler(req, res) {
  if (!assertAccessPassword(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: '仅支持 POST 请求。' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const dataUrl = typeof body.image === 'string' ? body.image : '';
    if (!dataUrl) {
      res.status(400).json({ message: '请先上传一张图片。' });
      return;
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      res.status(400).json({ message: '图片数据格式错误，请重新上传。' });
      return;
    }

    const targetType = normalizeTargetType(body.targetType);
    const size = normalizeSize(body.size);

    const result = await removeWithOfficialApi(parsed, targetType, size);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Remove-Bg-Provider', 'remove.bg');
    res.setHeader('X-Image-Format', 'png-alpha');
    res.status(200).send(result);
  } catch (error) {
    if (error instanceof QuotaExhaustedError) {
      res.status(503).json({ message: error.message });
      return;
    }

    const message =
      error instanceof Error ? error.message : '背景移除失败，请换一张图片重试。';
    res.status(500).json({ message });
  }
}

function normalizeTargetType(value) {
  if (value === 'product' || value === 'person') {
    return value;
  }
  return 'auto';
}

function normalizeSize(value) {
  if (value === 'preview' || value === 'full' || value === '50MP') {
    return value;
  }
  if (value === 'auto') {
    return 'auto';
  }
  return process.env.REMOVE_BG_SIZE || 'auto';
}

/**
 * 解析 data URL，返回 { mimeType, buffer }。
 * 支持 `data:image/jpeg;base64,...` 形式。
 */
function parseDataUrl(dataUrl) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  const mimeType = match[1];
  try {
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) {
      return null;
    }
    return { mimeType, buffer };
  } catch {
    return null;
  }
}

/**
 * 兼容 Vercel handler 默认已 parse JSON body 的场景，
 * 也兜底处理 req 是裸 stream 的情况（如本地测试或非 Vercel 环境）。
 */
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  // 读取 stream
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function removeWithOfficialApi({ mimeType, buffer }, targetType, size) {
  // 粘性 + 故障切换：始终从第一个可用 key 开始尝试；遇到 402/429
  // 标记 exhausted 后切换到下一个；网络错误不标记但仍切下一个重试。
  // 注意：所有错误信息中都不能包含具体的 key 字符串。
  return runWithFailover(async (key) => {
    let apiResponse;
    try {
      const formData = new FormData();
      formData.append(
        'image_file',
        new Blob([buffer], { type: mimeType }),
        guessFileName(mimeType)
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
    } catch (_networkError) {
      // 网络错误：本 key 暂时不可用但不一定耗尽，跳到下一个重试。
      // 不 markExhausted，避免误伤暂时性抖动。
      const error = new Error('remove.bg 网络请求失败');
      error.transient = true;
      throw error;
    }

    if (apiResponse.ok) {
      return Buffer.from(await apiResponse.arrayBuffer());
    }

    // 402 Payment Required / 429 Too Many Requests：当前 key 配额耗尽或被限流。
    // 标记后继续尝试下一个 key。
    if (apiResponse.status === 402 || apiResponse.status === 429) {
      const error = new Error('remove.bg 配额耗尽或被限流');
      error.exhausted = true;
      throw error;
    }

    // 其他错误（4xx 客户端错误、5xx 服务端错误）跟具体 key 无关，
    // 直接抛出让上层 500 处理，不切换 key。
    const detail = await apiResponse.text();
    throw new Error(`remove.bg API 处理失败：${detail || apiResponse.statusText}`);
  });
}

function guessFileName(mimeType) {
  switch (mimeType) {
    case 'image/png':
      return 'image.png';
    case 'image/webp':
      return 'image.webp';
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return 'image.jpg';
  }
}
