# Directory Structure

> 后端代码组织方式。本项目后端是 **Vercel Functions**（无 Express、无长驻 server）。

---

## Overview

后端从早期的 Express（`server/index.js`）迁移到了 **Vercel Serverless Functions**。核心约定：

- `api/` 下**每个 `.js` 文件**自动映射为一个路由：`api/foo.js` → `GET/POST /api/foo`。
- 共享/工具模块放在 `api/_lib/`——**下划线前缀让 Vercel 跳过路由映射**（否则 helper 会被误暴露成端点）。
- 不再有长驻进程；每个请求是一次独立的 function 调用，**进程级状态（如 key 池 exhausted Set）只在实例热时有效，冷启动重置**。

---

## Directory Layout

```
api/                    # Vercel Serverless Functions（后端）
├── remove-bg.js        # POST /api/remove-bg —— 抠图主端点
├── health.js           # GET  /api/health    —— 健康检查 + 密码探活
└── _lib/               # 共享模块；`_` 前缀 → 不被映射为路由
    ├── auth.js         #   预共享密码鉴权（模块加载即校验 env）
    └── key-pool.js     #   API key 池 + runWithFailover 故障切换

src/                    # Vite + React 前端
├── components/         # UI 组件（如 PasswordGate.tsx）
├── lib/                # 纯逻辑工具（auth.ts、compress.ts）
├── App.tsx
└── main.tsx

vercel.json             # 构建 + 路由配置
.env.example            # 环境变量模板（不含真实值）
```

---

## Naming Conventions

| 规则 | 说明 | 原因 |
|------|------|------|
| `api/<name>.js` = 路由 | 文件名即 URL 路径段 | Vercel 文件系统路由约定 |
| `api/_lib/`、`_`-前缀 | 任何以 `_` 开头的文件/目录不参与路由 | 避免把 helper 误暴露成公开端点 |
| handler `export default` | 每个路由文件默认导出 `function handler(req, res)` | Vercel 入口约定 |
| ESM `import` 必须带 `.js` 扩展名 | `import { x } from './_lib/auth.js'` | 项目是 ESM（`package.json` `"type": "module"`），运行时不省略扩展名 |

---

## Gotchas

> **Warning（multer 不可用）**: Express 时代用 `multer` 解析 multipart 上传。Vercel Functions 上 multer 无法直接用——本项目改为前端把图片转 **data URL（base64 JSON body）** 上传，后端用 `Buffer.from(base64)` 解析。相应地，远程调用 remove.bg 时在后端重新组装 `FormData`。

> **Warning（4.5MB body 上限）**: Vercel Hobby 计划请求体上限约 4.5MB。`api/remove-bg.js` 用 `export const config.api.bodyParser.sizeLimit = '4.5mb'`，且**前端必须先压缩**（见 `src/lib/compress.ts`：长边 ≤2000px、JPEG q0.85）再上传，否则大图直接被截断。

> **Warning（无持久状态）**: 不要假设 function 实例之间共享内存。key 池的 exhausted 状态用 module-level `Set`，仅在同一热实例内有效；冷启动会重置（可接受，代价是偶尔多一次试错调用）。需要真正持久的状态要接外部存储（本项目 out of scope）。

---

## Examples

- 路由 + 鉴权 + 故障切换的完整范例：`api/remove-bg.js`
- 最小路由（健康检查）：`api/health.js`
- 共享模块写法（含模块加载期 fail-fast）：`api/_lib/auth.js`
- 错误处理契约详见 [Error Handling](./error-handling.md)
