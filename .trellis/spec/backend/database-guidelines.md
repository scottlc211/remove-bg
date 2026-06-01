# Database Guidelines

> 本项目**没有数据库**。后端是无状态的 Vercel Functions，本文件记录这一现实及其约束，避免 AI 凭空引入持久层。

---

## Overview

remove-bg 后端是部署在 Vercel 上的 serverless functions（`api/*.js`），**不连接任何数据库**：没有 ORM、没有迁移、没有连接池、没有 SQL/NoSQL 客户端。

唯一的"状态"是 `api/_lib/key-pool.js` 里的一个 **module-level `Set`**（`exhaustedKeys`），用于记录本进程内已知耗尽的 key：

```javascript
// api/_lib/key-pool.js
const exhaustedKeys = new Set();
```

它是**进程内内存**，不是持久化存储——只在同一个热实例内有效，冷启动即重置。详见 [directory-structure.md](./directory-structure.md) 的"无持久状态"Gotcha。

---

## Query Patterns

不适用。后端不查询数据库。

真正的外部数据来源是 **remove.bg HTTP API**（`https://api.remove.bg/v1.0/removebg`），通过 `fetch` 调用，包在 `runWithFailover()` 的 key 池轮询里。它的"读写契约"在 [error-handling.md](./error-handling.md)，不是数据库语义。

---

## Migrations

不适用。没有 schema，因此没有迁移。

> 与之最接近的"结构变更"是**环境变量契约**（`REMOVE_BG_API_KEYS` / `ACCESS_PASSWORD` / `REMOVE_BG_SIZE`，见 `.env.example` 与 README）。新增/重命名环境变量时，必须同步更新 `.env.example` 与 README 的环境变量表——这是本项目唯一需要"迁移式同步"的契约。

---

## Naming Conventions

不适用（无表名/列名）。

---

## Common Mistakes

### Common Mistake: 凭空引入数据库或持久化层

**Symptom**: AI 为"保存历史记录""持久化耗尽状态""缓存结果"而引入 Prisma / SQLite / Redis / KV。

**Cause**: 把通用全栈项目的惯性套到这个刻意保持无状态的工具上。

**Fix**: 默认**不加任何持久层**。处理历史只存在前端内存（`MainApp` 的 `history` state，最多 3 条，刷新即丢，见 `src/App.tsx`）；key 耗尽状态接受冷启动重置的代价。

**Prevention**: 真要引入持久化（例如跨实例共享耗尽状态、落库历史），属于**架构级变更**，必须先开 brainstorm 任务讨论，不在常规实现里顺手添加。

### Common Mistake: 把 exhausted `Set` 当成可靠存储

**Symptom**: 假设某个 key 被标记耗尽后"永久"跳过，或假设不同请求共享同一份耗尽状态。

**Cause**: 误把 module-level `Set` 当成数据库。

**Fix**: 它仅在热实例内有效。冷启动会重置，代价是偶尔多一次试错调用（可接受）。不要围绕它的"持久性"设计逻辑。
