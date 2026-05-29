// 前端图片压缩工具。
//
// 用 Canvas 在浏览器侧把上传图片压缩到 4.5MB 以下，绕过 Vercel Hobby
// 计划对 Function body 的 4.5MB 限制。
//
// 策略：
//   - 长边超过 2000px 时按比例缩放到 2000px
//   - 含 alpha 的图片（PNG）继续输出 PNG（避免毁掉透明度）
//   - 其他图片输出 JPEG quality 0.85
//
// 仅依赖浏览器原生 API（HTMLImageElement、Canvas）。

export type CompressResult = {
  dataUrl: string;
  width: number;
  height: number;
};

const MAX_LONG_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export async function compressImage(file: File): Promise<CompressResult> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const { width: targetWidth, height: targetHeight } = computeTargetSize(
      image.naturalWidth,
      image.naturalHeight
    );

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('当前浏览器不支持图片压缩，请更换浏览器后重试。');
    }

    // PNG 需要保留透明背景；非 PNG 直接绘制即可。
    const hasAlpha = file.type === 'image/png';
    if (!hasAlpha) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const outputType = hasAlpha ? 'image/png' : 'image/jpeg';
    const quality = hasAlpha ? undefined : JPEG_QUALITY;
    const dataUrl = canvas.toDataURL(outputType, quality);

    return {
      dataUrl,
      width: targetWidth,
      height: targetHeight
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function computeTargetSize(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    throw new Error('无法读取图片尺寸，请换一张图片重试。');
  }

  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_LONG_EDGE) {
    return { width, height };
  }

  const scale = MAX_LONG_EDGE / longEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败，请换一张图片重试。'));
    img.src = src;
  });
}
