# Error Handling

> 本项目（Vercel Functions 后端）的错误处理契约。核心场景：remove.bg API key 池的"粘性 + 故障切换"轮询。

---

## Overview

后端是部署在 Vercel 上的无状态 serverless functions（`api/*.js`）。错误处理遵循三条原则：

1. **面向客户端的错误一律返回 JSON `{ message: string }`**（中文、可直接展示给用户），成功响应才是二进制（PNG）。
2. **错误信息绝不泄露内部敏感细节**——尤其是具体的 API key 字符串、密码、密码长度。
3. **区分"该 key 的问题"和"该请求的问题"**：前者切换 key 重试，后者立即向上抛。

---

## Error Types

| 类型 | 定义位置 | 用途 | 映射 HTTP |
|------|----------|------|-----------|
| `QuotaExhaustedError` | `api/_lib/key-pool.js` | 所有 key 都耗尽/不可用时抛出 | 503 |
| 普通 `Error` + `error.exhausted = true` | 调用方在 `attempt` 内构造 | 标记 402/429：当前 key 配额耗尽或被限流 | （内部信号，不直接返回） |
| 普通 `Error` + `error.transient = true` | 调用方在 `attempt` 内构造 | 标记网络抖动：本 key 暂时不可用但不一定耗尽 | （内部信号，不直接返回） |
| 普通 `Error`（无标记） | 任意 | 跟具体 key 无关的错误（remove.bg 4xx/5xx、解析失败等） | 500 |

> **Warning**: `QuotaExhaustedError` 的 message 默认为 `所有 API 配额已用完，请稍后重试`，**不得**拼接具体 key。`runWithFailover` 捕获 `attempt` 抛出的错误时，也只读 `error.exhausted` / `error.transient` 标记，不把原始 error 透传给客户端。

---

## 核心 Pattern: 粘性 + 故障切换（runWithFailover）

**Problem**: 单个 remove.bg key 每月 50 次配额，需要多 key 轮询绕开限制；轮询逻辑若埋在 handler 内部，最关键的故障切换路径无法单测。

**Solution**: 把轮询执行器抽成独立、可注入的 `runWithFailover(attempt)`（`api/_lib/key-pool.js`），handler 只负责构造 `attempt` 回调。

```javascript
// 签名
export async function runWithFailover(attempt /* (key: string) => Promise<T> */): Promise<T>

// 调用方（api/remove-bg.js）只关心"用一个 key 跑一次"，并用标记表达失败语义：
return runWithFailover(async (key) => {
  let apiResponse;
  try {
    apiResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': key }, body: formData
    });
  } catch {
    const e = new Error('remove.bg 网络请求失败'); e.transient = true; throw e; // 抖动：不标记耗尽
  }
  if (apiResponse.ok) return Buffer.from(await apiResponse.arrayBuffer());
  if (apiResponse.status === 402 || apiResponse.status === 429) {
    const e = new Error('remove.bg 配额耗尽或被限流'); e.exhausted = true; throw e; // 切下一个
  }
  throw new Error(`remove.bg API 处理失败：...`); // 跟 key 无关，立即上抛 → 500
});
```

**Why**: 业务回调用 `error.exhausted` / `error.transient` 标记表达失败类别，执行器据此决定"标记耗尽 + 切换" / "不标记 + 切换" / "立即抛出"。这样 `runWithFailover` 可以用 mock `attempt` 单测全部三条路径，handler 与远程调用解耦。

---

## Validation & Error Matrix

| 条件 | 行为 | 客户端可见结果 |
|------|------|----------------|
| 当前 key 返回 402 / 429 | `markExhausted(key)` 后切换到下一个可用 key | （对用户透明，成功则 200） |
| 当前 key 网络异常（fetch throw） | **不** markExhausted，切换到下一个 key 重试 | （对用户透明） |
| 当前 key 返回其他 4xx / 5xx | 立即向上抛，**不**切换 key | 500 `{ message }` |
| 所有可用 key 都失败（全 402/429 或全网络错误） | 抛 `QuotaExhaustedError` | 503 `{ message: '所有 API 配额已用完，请稍后重试' }` |
| 未配置任何 key（`getAvailableKeys()` 为空） | 直接抛 `QuotaExhaustedError`，**不**发起任何远程调用 | 503（同上，不泄露"没配 key"） |
| 请求头 `X-Access-Password` 缺失/错误 | `assertAccessPassword` 写 401 并返回 false，handler 立即 return | 401 `{ message: '访问密码错误' }` |
| `ACCESS_PASSWORD` 环境变量未设置 | **模块加载即 throw**（fail-fast，见下） | function 启动失败（5xx），杜绝裸奔 |
| body 缺少 `image` 或 data URL 非法 | 提前 return | 400 `{ message }` |
| 非 POST 方法 | 设置 `Allow: POST` 头后 return | 405 `{ message }` |

---

## Pattern: 缺失关键 env 时 fail-fast

**Problem**: 鉴权密码 `ACCESS_PASSWORD` 若忘配，服务会"裸奔"——任何人拿到 URL 即可消耗 key 池配额。

**Solution**: 在 `api/_lib/auth.js` **模块顶层**（import 时执行）校验，缺失即 throw：

```javascript
if (!process.env.ACCESS_PASSWORD || process.env.ACCESS_PASSWORD.length === 0) {
  throw new Error('ACCESS_PASSWORD 未配置：拒绝以无密码方式启动 API。...');
}
```

**Why**: 把"配置不完整"变成**部署时/冷启动时**就暴露的硬错误，而不是运行时的安全漏洞。任何 import 了 `auth.js` 的 handler（`remove-bg`、`health`）都自动受保护。

> **Gotcha（测试）**: 因为是模块顶层 throw，跑 API 单测时必须先注入 `ACCESS_PASSWORD`（见 `package.json` 的 `test:api`：`ACCESS_PASSWORD=dummy node --test`），否则 import 阶段就崩。

---

## Common Mistakes

### Common Mistake: 错误信息泄露具体 key

**Symptom**: 日志或 503 响应里出现 `key abc123 已耗尽`。

**Cause**: 把底层 error.message 直接透传，或在拼接消息时带上 key。

**Fix**: 故障切换只用布尔标记（`exhausted`/`transient`）传递语义；对外只返回 `QuotaExhaustedError` 的固定中文 message。`markExhausted` 接收 key 但只存进 module-level Set，不进任何对外输出。

**Prevention**: 单测断言"所有 key 都 402 时，抛出的错误信息不包含任意 key 字符串"（已在 `key-pool.test.js` 覆盖）。

### Common Mistake: 网络抖动误标记 key 耗尽

**Symptom**: 偶发网络超时后，明明还有配额的 key 被永久跳过，直到冷启动。

**Cause**: 把 `fetch` 抛出的网络异常也当成 402 去 `markExhausted`。

**Fix**: 网络异常打 `transient: true`，`runWithFailover` 见到只切换不标记。只有明确的 402/429 才 `markExhausted`。

---

## Tests Required（assertion points）

`api/_lib/key-pool.test.js`（`node:test`，run via `npm run test:api`）必须覆盖：

- **粘性**: 第一个 key 成功 → 直接返回，`attempt` 不会被第二个 key 调用。
- **故障切换**: keyA 抛 `exhausted` → 自动用 keyB 成功。
- **耗尽报错**: 全部 key 抛 `exhausted` → 抛 `QuotaExhaustedError`，且错误信息不含任何 key 字符串。
- **空池短路**: 无可用 key → 直接抛 `QuotaExhaustedError`，`attempt` 调用次数为 0。
- **transient 不标记**: 抛 `transient` → 切换下一个 key，但该 key 未进 exhausted Set。
- **非 402/429 立即抛**: 普通 Error → 不切换、原样上抛。

> 每条测试前调用 `_resetForTesting()` 清空 module-level exhausted Set，避免用例间状态串味。
