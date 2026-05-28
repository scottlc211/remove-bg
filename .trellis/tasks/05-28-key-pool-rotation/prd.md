# API key 池轮询与上线部署

## Goal

将 remove-bg 工具从单 key 写死的本地玩具升级为可部署到 Vercel 的小圈子内部服务：通过维护多个 remove.bg API key 组成"号池"，单 key 配额耗尽（402）或被限流（429）时自动切换到下一个 key，绕过单账号每月 50 次的免费配额限制；通过预共享密码防止 URL 外泄后被滥用。

## What I already know

### 项目现状（来自代码调研）
- **技术栈**: Vite + React 19 前端，Node 22 + Express 5 后端
- **API 提供商**: [remove.bg](https://api.remove.bg/v1.0/removebg)（免费账号每月 50 次）
- **认证方式**: HTTP header `X-Api-Key`
- **当前 key**: 单个写死在 `.env` 的 `REMOVE_BG_API_KEY`
- **调用点**: `server/index.js:96-120` 的 `removeWithOfficialApi()` 函数
- **支持参数**: `targetType` (auto/product/person), `size` (auto/preview/full/50MP), `quality`(fast/best)

### remove.bg API 已知行为
- 配额耗尽 → HTTP `402 Payment Required`
- 速率限制 → HTTP `429 Too Many Requests`
- 配额按月重置（每月 1 号 UTC）
- 响应 header `X-Credits-Charged` 可推算用量

### 依赖体积调研
- `@imgly/background-removal-node`: 132 MB
- `onnxruntime-node`: 134 MB（native binary）
- `sharp`: 50 MB（Vercel 原生支持，保留）

## Requirements

### MVP 必做
1. **服务端 key 池**: 通过环境变量 `REMOVE_BG_API_KEYS` 配置多个 key（逗号分隔）
2. **故障切换**: 单次请求若当前 key 返回 402/429，自动顺序尝试下一个 key
3. **耗尽状态记忆**: 已知耗尽的 key 在 function 实例热的时候不再尝试（module-level Set，冷启动重置）
4. **耗尽报错**: 所有 key 都耗尽时返回明确的 HTTP 503 + 中文提示，**不泄露**是哪个 key 失败
5. **预共享密码**: 环境变量 `ACCESS_PASSWORD` 配置，前端首次输入存 localStorage，每次请求带 `X-Access-Password` header
6. **架构迁移**: Express → Vercel API Routes (`api/remove-bg.js`、`api/health.js`)
7. **删除本地模型**: 移除 `@imgly/background-removal-node`、`onnxruntime-node` 依赖
8. **前端图片压缩**: 上传前用 Canvas 压缩到 4MB 以下，长边超 2000px 缩放，质量 0.85（绕过 Vercel Hobby 4.5MB body 限制）

### 工程质量
- 部署到 Vercel 后 HTTPS 自动可用
- README 包含部署步骤和环境变量说明
- 单元测试覆盖 key 池轮询和故障切换逻辑

## Acceptance Criteria

- [ ] `REMOVE_BG_API_KEYS=keyA,keyB,keyC` 配置后，服务能正常工作
- [ ] 模拟 keyA 返回 402 时，自动切换到 keyB 完成抠图
- [ ] 所有 key 都返回 402 时，返回 HTTP 503 和提示信息 `所有 API 配额已用完，请稍后重试`
- [ ] 没配 `ACCESS_PASSWORD` 时启动失败（防止意外裸奔）
- [ ] 前端无密码时显示输入框，输入正确后存 localStorage 进入主界面
- [ ] 后端验证 `X-Access-Password` header，错误返回 401
- [ ] 上传 8MB 原图能正常处理（前端压缩到 4MB 以下后再 POST）
- [ ] `vercel.json` 配置正确，git push 即可触发部署
- [ ] 构建产物体积 < 50MB（删本地模型后）

## Definition of Done

- 单元测试：key 池轮询、故障切换、耗尽报错三条核心路径
- Lint / typecheck 通过
- README 包含：环境变量列表、Vercel 部署步骤、本地开发说明
- 部署到 Vercel 后端到端走通一次（含密码验证、抠图、key 切换观察）
- `.env.example` 文件（不含真实 key）

## Technical Approach

### key 池模块（`api/lib/key-pool.js`）

```javascript
// 在 module-level 维护 exhausted 状态（function 实例热的时候有效）
const exhaustedKeys = new Set();

export function getNextKey() {
  const keys = process.env.REMOVE_BG_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  const available = keys.filter(k => !exhaustedKeys.has(k));
  if (available.length === 0) {
    throw new QuotaExhaustedError();
  }
  return available[0]; // 粘性使用：始终用第一个可用的
}

export function markExhausted(key) {
  exhaustedKeys.add(key);
}
```

### 故障切换逻辑（`api/remove-bg.js`）

```
for each available key:
  try remove.bg with this key
  if 200 OK → return result
  if 402 / 429 → markExhausted(key), try next
  if other error → throw immediately (不切换)
```

### 鉴权中间件

每个 API handler 头部：
```javascript
if (req.headers['x-access-password'] !== process.env.ACCESS_PASSWORD) {
  return res.status(401).json({ message: '访问密码错误' });
}
```

### Vercel 配置
- `vercel.json` 指定 build command 和 output dir
- 环境变量在 Vercel Dashboard 配置：`REMOVE_BG_API_KEYS`、`ACCESS_PASSWORD`
- 前端构建产物 `dist/` 作为静态资源
- API Routes 自动从 `api/` 目录映射

## Decision (ADR-lite)

**Context**: 单 key 每月 50 次配额不够小圈子使用；需要号池轮询绕开配额。

**Decision**:
1. 部署平台选 **Vercel Functions**（牺牲本地模型兜底换取部署简单）
2. key 状态用 **环境变量 + 内存 Set**（牺牲冷启动时的精确性换取零依赖）
3. 鉴权用 **预共享密码**（牺牲多用户追踪换取实现简单）
4. 轮询策略用 **粘性 + 故障切换**（始终用第一个可用 key，避免无故消耗其他 key）

**Consequences**:
- 优点：部署零运维、HTTPS 自动、依赖体积减 80%、实现简单可维护
- 缺点：失去本地模型兜底（所有 key 耗尽用户只能等月初）；冷启动后 exhausted 状态丢失会浪费 1-2 次试错调用；预共享密码不支持区分谁是谁
- 风险：URL + 密码泄露后所有人能用，需要用户保护好密码

## Out of Scope (explicit)

- 用户账号系统 / 多用户区分使用
- 支付功能 / 付费版接入
- 多 API provider 抽象（只接 remove.bg）
- 本地 ONNX 模型兜底（已确认放弃）
- key 自动月度重置定时器（依赖冷启动重置 + 用户重新部署）
- 管理后台 / key 添加/删除 UI（直接编辑环境变量即可）

## Technical Notes

### 关键文件改动
- `server/index.js` → 拆分为 `api/remove-bg.js`、`api/health.js`、`api/lib/key-pool.js`
- `package.json` → 删除 `@imgly/background-removal-node`、`onnxruntime-node`、`express`、`multer`、`concurrently`；scripts 简化
- `.env` → `.env.example` 模板（不带真实 key）
- 新增 `vercel.json`
- `src/App.tsx` → 加密码输入逻辑

### 限流（暂定不做，后续可加）
- Vercel Functions 本身有平台级限流（免费版每月 100K 次调用，远超号池配额）
- 应用层限流（如 `@upstash/ratelimit`）等真正出问题再加

### 隐藏的兼容性问题
- `multer` 在 Vercel Functions 上无法直接用，需要改用 Vercel 自带的 body parser 或 `formidable` 等
- 大文件（>4.5MB）在 Vercel Hobby 计划上会被截断，需要在前端做压缩或限制
