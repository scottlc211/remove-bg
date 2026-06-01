# Logging Guidelines

> 本项目后端**当前没有任何显式日志调用**（`api/` 下零 `console.*`）。本文件记录这一现实，以及一旦需要加日志时**必须遵守的安全红线**。

---

## Overview

后端是 Vercel Functions，**没有引入任何日志库**（no winston / pino / bunyan），代码里也**没有 `console.log` / `console.error`**。当前的可观测性完全依赖：

1. **Vercel 平台自动捕获** function 的 stdout / stderr（在 Vercel Dashboard 的 Function Logs 查看）。
2. **面向客户端的 JSON 错误**（`{ message }`）——但这是给用户看的，**不是日志**。

> 设计取向：这是个小工具，错误要么对用户透明（key 故障切换），要么以友好中文 message 返回。没有为"运维排查"沉淀结构化日志的需求。**不要为了"完整性"凭空加一套日志框架。**

---

## Log Levels

当前不适用（无日志调用）。

如果将来确实要加诊断日志，**用原生 `console.*` 即可**（Vercel 会自动收集），不要引入日志库：

| 方法 | 用途 | Vercel 归类 |
|------|------|-------------|
| `console.error` | 真正的异常 / 不可恢复错误 | stderr |
| `console.warn` | 可恢复的异常路径（如某 key 故障切换） | stdout |
| `console.log` | 临时调试——**合并前删除** | stdout |

---

## Structured Logging

当前不适用。若引入，保持简单：单行文本即可，不必上 JSON 结构化日志（Vercel Hobby 无日志查询/告警需求）。

---

## What to Log

当前：什么都不主动记。

若引入，**只在边界记可恢复的异常**，例如"所有 key 耗尽（`QuotaExhaustedError`）"这类值得运维关注的事件。**正常成功路径不记日志**。

---

## What NOT to Log（安全红线，最重要）

无论现在还是将来，**以下内容绝对禁止出现在任何日志 / 错误响应 / stdout / stderr 中**：

| 禁止记录 | 原因 |
|----------|------|
| 具体的 remove.bg API key 字符串（或其任何片段） | key 泄露即配额被盗刷；这是 key 池设计的核心安全约束 |
| `ACCESS_PASSWORD` 或客户端提交的密码 | 鉴权凭据泄露 |
| 密码长度、密码哈希、key 的前几位等"提示性"信息 | 间接泄露，同样禁止 |
| 用户上传的图片原始数据（base64 body） | 体积大且涉及用户隐私 |

> **Warning**: 故障切换逻辑只用布尔标记（`error.exhausted` / `error.transient`）传递语义，**从不**把携带 key 的原始 error 透传或打印。`markExhausted(key)` 接收 key 但只存进 module-level `Set`，绝不输出。对外永远只返回 `QuotaExhaustedError` 的固定中文 message。详见 [error-handling.md](./error-handling.md)。

---

## Common Mistakes

### Common Mistake: 调试时 `console.log(key)` 并忘记删除

**Symptom**: 排查 key 池问题时打印了 `console.log('trying key', key)`，留到了线上。

**Cause**: 临时调试代码未清理。

**Fix**: 任何打印都**禁止**带 key/密码。要确认轮到哪个 key，打印 `index` 或 `available.length`，绝不打印 key 本身。

**Prevention**: `key-pool.test.js` 已有断言"抛出的错误信息不包含任意 key 字符串"——加日志后若不慎泄露，至少错误路径的测试会兜底。Review 时 grep `console.` 确认无密钥相关打印。
