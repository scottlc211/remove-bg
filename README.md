# BG Remover

基于 [remove.bg](https://www.remove.bg/) 的在线抠图工具，支持多 API key 号池轮询与预共享密码访问控制，可一键部署到 Vercel。

## 特性

- **多 key 号池轮询**：通过 `REMOVE_BG_API_KEYS` 配置多个 key，单 key 配额耗尽（402）或被限流（429）时自动切换到下一个，绕过单账号每月 50 次的免费配额限制。
- **预共享密码**：通过 `ACCESS_PASSWORD` 守门，防止 URL 外泄后被滥用。
- **前端图片压缩**：上传前用 Canvas 压缩（长边 ≤ 2000px，JPEG 质量 0.85），绕过 Vercel Hobby 4.5MB body 限制。
- **零运维部署**：基于 Vercel Functions，HTTPS 自动可用。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ACCESS_PASSWORD` | 是 | 访问密码。未配置时 API 会拒绝启动（防止裸奔）。客户端在 `X-Access-Password` 请求头中携带，错误返回 401。 |
| `REMOVE_BG_API_KEYS` | 是 | remove.bg API key 池，逗号分隔，例如 `keyA,keyB,keyC`。号池始终从第一个可用 key 开始使用（粘性），耗尽后顺序切换。 |
| `REMOVE_BG_API_KEY` | 否 | 单 key 向后兼容；仅在未配置 `REMOVE_BG_API_KEYS` 时生效。 |
| `REMOVE_BG_SIZE` | 否 | 默认输出尺寸：`auto` / `preview` / `full` / `50MP`，缺省为 `auto`。 |

参考 `.env.example`。

## 本地开发

```bash
npm install
# 配置环境变量（复制 .env.example 为 .env 并填入真实值）
cp .env.example .env
npm run dev        # 启动 Vite 前端（默认代理 /api 到本地 Functions）
npm run test:api   # 运行号池轮询 / 故障切换 / 耗尽报错单元测试
npm run build      # 类型检查 + 构建产物到 dist/
```

> 注：API Routes 位于 `api/` 目录，部署到 Vercel 时自动映射为 Serverless Functions。本地完整联调建议使用 `vercel dev`。

## Vercel 部署步骤

1. 将仓库推送到 GitHub / GitLab。
2. 在 [Vercel](https://vercel.com/) 导入该仓库，框架预设会自动识别为 Vite（已在 `vercel.json` 中固定 `buildCommand` 与 `outputDirectory`）。
3. 在 Vercel 项目的 **Settings → Environment Variables** 中配置：
   - `ACCESS_PASSWORD`
   - `REMOVE_BG_API_KEYS`
   - （可选）`REMOVE_BG_SIZE`
4. 部署。之后 `git push` 即可触发自动部署，HTTPS 自动可用。

## 架构

```
src/                前端（Vite + React 19）
  components/PasswordGate.tsx   密码门
  lib/auth.ts                   密码 localStorage 存取
  lib/compress.ts              上传前 Canvas 压缩
api/                Vercel Serverless Functions
  remove-bg.js               抠图入口（号池轮询 + 故障切换）
  health.js                  健康检查 + 密码探活
  _lib/auth.js               预共享密码鉴权
  _lib/key-pool.js           号池：loadKeys / getAvailableKeys / markExhausted / runWithFailover
```

### 号池轮询与故障切换

- `getAvailableKeys()`：返回未被标记耗尽的 key（顺序与配置一致）。
- `runWithFailover(attempt)`：依次用每个可用 key 调用 `attempt`，成功即返回；遇到 402/429 标记耗尽并切下一个；网络抖动不标记但仍重试；其他错误立即抛出；全部失败抛 `QuotaExhaustedError`（HTTP 503）。
- 耗尽状态保存在 module-level `Set`，仅在 Function 实例热时有效，冷启动会重置。
