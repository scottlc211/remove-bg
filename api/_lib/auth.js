// 鉴权工具：基于预共享密码的轻量认证。
//
// 客户端在请求头 X-Access-Password 中携带密码；服务端比对
// process.env.ACCESS_PASSWORD。错误一律返回 401，避免泄露内部细节。
//
// 注意：模块加载时若环境变量未设置则立即抛错，防止上线后"裸奔"。

if (!process.env.ACCESS_PASSWORD || process.env.ACCESS_PASSWORD.length === 0) {
  throw new Error(
    'ACCESS_PASSWORD 未配置：拒绝以无密码方式启动 API。请在环境变量中设置 ACCESS_PASSWORD。'
  );
}

const EXPECTED_PASSWORD = process.env.ACCESS_PASSWORD;

/**
 * 检查请求的访问密码。
 *
 * 通过则返回 true；不通过则向 response 写 401 并返回 false。
 * 调用方应在 false 时立即 return，避免继续处理。
 *
 * 错误响应不包含具体密码或提示密码长度等敏感信息。
 *
 * @param {import('http').IncomingMessage & { headers: Record<string, string | string[] | undefined> }} req
 * @param {import('http').ServerResponse & { status?: (n: number) => any, json?: (b: unknown) => any }} res
 * @returns {boolean}
 */
export function assertAccessPassword(req, res) {
  const provided = req.headers['x-access-password'];
  const value = Array.isArray(provided) ? provided[0] : provided;

  if (typeof value !== 'string' || value !== EXPECTED_PASSWORD) {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      res.status(401).json({ message: '访问密码错误' });
    } else {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ message: '访问密码错误' }));
    }
    return false;
  }

  return true;
}
