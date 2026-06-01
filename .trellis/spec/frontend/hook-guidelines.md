# Hook Guidelines

> React hooks 的使用约定。**本项目目前没有任何自定义 hook**——本文件记录这一现实，以及内置 hook 的用法与"何时才该抽 hook"。

---

## Overview

现状：**零自定义 hook**。有状态逻辑要么直接写在组件内（`MainApp` 在 `src/App.tsx`），要么作为**无 React 依赖的纯函数**放在 `src/lib/`（`auth.ts`、`compress.ts`）。

判断标准：逻辑需要 React state/生命周期吗？

- **不需要**（纯计算、I/O 封装）→ `src/lib/` 纯函数，不是 hook。这是当前主要的复用方式。
- **需要、且会被多处复用** → 才考虑抽自定义 hook（目前还没出现这种场景）。
- **需要、但只在一个组件用** → 留在组件内。

> **不要为了"看起来更 React"而过早把逻辑包成 `useXxx`。** 当前单屏应用的复杂度还不需要自定义 hook。

---

## Custom Hook Patterns

暂无实例。若将来要抽，遵循：

- 命名 `use` 前缀（React 规则，否则 ESLint/编译期 hook 规则无法识别）。
- 只在"同一段有状态逻辑被 ≥2 个组件复用"时抽，不为单点逻辑抽。
- 抽出后放 `src/hooks/`（届时新建该目录，见 [directory-structure.md](./directory-structure.md)）。

---

## Data Fetching

**用原生 `fetch`，没有 React Query / SWR / axios。**

数据请求写在 `async function` 里，由组件的状态机驱动（见 [state-management.md](./state-management.md) 的 `ProcessStatus`）：

```tsx
// src/App.tsx · processImage（节选）
const response = await fetch('/api/remove-bg', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Access-Password': password },
  body: JSON.stringify({ image: compressed.dataUrl, targetType, size })
});
```

异步请求**必须做竞态防护**：用 `useRef` 计数器（`jobIdRef`）标记每次任务，`await` 后比对 `jobIdRef.current !== jobId` 则丢弃过期结果。详见 [state-management.md](./state-management.md)。

---

## Naming Conventions

- 内置 hook 按 React 习惯调用：`useState` / `useRef` / `useMemo` / `useEffect`。
- 自定义 hook（若有）必须 `use` 前缀。
- 所有 hook 必须在组件**顶层**调用，不放进条件/循环（React 规则）。`App.tsx` 里 `App` 组件先 `useState` 再按 `authed` 分支 return，符合此规则。

---

## Common Mistakes

### Common Mistake: 把纯逻辑包成自定义 hook

**Symptom**: 给 `compressImage` 这种纯函数套一层 `useCompress()`。

**Cause**: 误以为前端逻辑都得是 hook。

**Fix**: 不依赖 React state 的逻辑放 `src/lib/` 当普通函数导出，组件内直接 `await` 调用即可。

### Common Mistake: 异步请求不做竞态防护

**Symptom**: 用户快速切换处理模式/连点，旧请求的结果覆盖了新请求。

**Fix**: 沿用 `jobIdRef` 模式——发起前自增并记下 `jobId`，每个 `await` 之后比对，过期任务直接 `return`（并 `URL.revokeObjectURL` 释放已创建的 object URL）。
