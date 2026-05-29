// /api/health
//
// 健康检查端点，同时承担前端密码校验探活。
// 客户端在登录界面提交密码后，先发一次 GET /api/health 带 X-Access-Password
// 头，根据 200 / 401 判断密码是否正确。

import { assertAccessPassword } from './_lib/auth.js';
import { loadKeys } from './_lib/key-pool.js';

export default function handler(req, res) {
  if (!assertAccessPassword(req, res)) {
    return;
  }

  res.status(200).json({
    ok: true,
    provider: loadKeys().length > 0 ? 'remove.bg' : 'none'
  });
}
