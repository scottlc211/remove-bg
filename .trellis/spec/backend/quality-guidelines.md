# Quality Guidelines

> 后端（Vercel Functions / ESM JavaScript）的代码质量标准与质量闸门。

---

## Overview

后端质量靠两道闸门把守，**没有 ESLint / Prettier**（仓库无任何 lint 配置）：

| 闸门 | 命令 | 覆盖范围 |
|------|------|----------|
| 类型检查 | `npm run build`（`tsc -b`） | 仅前端 `src/`（`tsconfig.app.json` `include: ["src"]`）——**`api/*.js` 不在类型检查内** |
| 单元测试 | `npm run test:api` | `api/_lib/key-pool.js` 的号池 + 故障切换逻辑 |

> 因为 `api/` 是纯 JS 且不被 `tsc` 检查，后端正确性**主要靠单元测试 + 显式防御性代码**保障。写后端代码时不能依赖类型系统兜底。

---

## Forbidden Patterns

| 禁止 | 原因 |
|------|------|
| 错误信息/日志泄露 key 或密码 | 见 [logging-guidelines.md](./logging-guidelines.md)、[error-handling.md](./error-handling.md)——核心安全约束 |
| `import` 省略 `.js` 扩展名 | 项目是 ESM（`"type": "module"`），运行时不补全扩展名，缺了会 `ERR_MODULE_NOT_FOUND` |
| 用 `multer` / 直接解析 multipart | Vercel Functions 上不可用；本项目走 data URL（base64 JSON body）方案，见 [directory-structure.md](./directory-structure.md) |
| 假设 function 实例间共享内存 | 无持久状态；module-level `Set` 仅热实例内有效 |
| 把网络抖动（fetch throw）当成配额耗尽去 `markExhausted` | 会误伤还有配额的 key，直到冷启动——必须用 `transient` 标记区分 |
| 鉴权检查之后才处理请求 | `assertAccessPassword(req, res)` 必须是 handler **第一步**，返回 false 立即 `return` |

---

## Required Patterns

| 必须 | 说明 |
|------|------|
| `export default async function handler(req, res)` | Vercel 路由入口约定 |
| handler 首行鉴权 | `if (!assertAccessPassword(req, res)) return;` |
| 缺关键 env 时模块加载即 fail-fast | `auth.js` 顶层校验 `ACCESS_PASSWORD`，缺失即 throw（杜绝裸奔） |
| 远程调用包在 `runWithFailover(attempt)` 里 | 失败语义用 `error.exhausted` / `error.transient` 标记表达，不在 handler 里写轮询 |
| 对外错误一律 `res.status(n).json({ message })` 中文 | 成功响应才是二进制 PNG |
| 输入防御性归一化 | 如 `normalizeTargetType` / `normalizeSize` / `parseDataUrl`：非法输入回退默认值或 400，不信任客户端 |

---

## Testing Requirements

测试框架：**Node 原生 `node:test` + `node:assert/strict`**（无 Jest/Vitest）。运行：`npm run test:api`（当前脚本：`node --test api/_lib/key-pool.test.js`）。

> **Gotcha（env 注入）**: 当前 `key-pool.test.js` 只 import `key-pool.js`（不碰 env），所以**现在不需要** `ACCESS_PASSWORD`。但 `auth.js` 模块加载即校验 `ACCESS_PASSWORD`，缺了就在 import 阶段 throw——**一旦新增测试 import 了 `auth.js`（或某个 import 它的 handler），必须在命令前注入** `ACCESS_PASSWORD=dummy node --test ...`。

约定（见 `api/_lib/key-pool.test.js`）：

- `describe` / `it` 分组，**每个分组 `beforeEach(() => _resetForTesting())`** 清空 module-level `exhaustedKeys`，避免用例间状态串味。
- 用 `setEnv()` 辅助函数注入/清除 `REMOVE_BG_API_KEYS` 等 env，保证每个用例环境干净。
- 故障切换逻辑（`runWithFailover`）通过注入 **mock `attempt` 回调**单测，不发真实网络请求。

`runWithFailover` 的六条核心路径**必须保持覆盖**：粘性成功、故障切换、全耗尽报错、空池短路（`attempt` 调用 0 次）、`transient` 不标记、非 402/429 立即抛。其中"耗尽报错"必须断言**错误信息不含任何 key 字符串**。

---

## Code Review Checklist

- [ ] 所有 `import` 带 `.js` 扩展名
- [ ] handler 第一步是 `assertAccessPassword`，false 即 return
- [ ] 错误信息/任何打印都不含 key、密码、密码长度
- [ ] 远程调用失败用 `exhausted` / `transient` 标记区分，没把网络抖动误判为耗尽
- [ ] 新增/改动 `key-pool.js` 行为时，对应 `key-pool.test.js` 用例同步更新且 `npm run test:api` 通过
- [ ] 新增环境变量时，`.env.example` 与 README 环境变量表同步更新
- [ ] 客户端输入经过归一化/校验，非法输入返回 4xx 而非崩溃
