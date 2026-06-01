# State Management

> 本项目的状态管理约定。**只用 React 内置能力**——没有 Redux / Zustand / Jotai / Recoil / Context。

---

## Overview

单屏应用，状态全部用 React 内置 hook 管理，**没有任何全局状态库，也没有用 Context**。所有 UI 状态集中在 `MainApp`（`src/App.tsx`）的一组 `useState` 里。

唯一的跨会话持久状态是**访问密码**，存在 `localStorage`（经 `src/lib/auth.ts` 读写），首屏 `App` 组件用它的存在与否决定是否显示登录门。

---

## State Categories

| 类别 | 工具 | 示例 |
|------|------|------|
| 组件本地状态 | `useState` | `status` / `sourceFile` / `error` / `history` 等 |
| 惰性初始状态 | `useState(() => ...)` | `useState<boolean>(() => getStoredPassword() !== null)`——避免每次渲染都读 localStorage |
| 非渲染可变值 | `useRef` | `inputRef`（DOM 引用）、`jobIdRef`（竞态计数器，变更不应触发渲染） |
| 派生值 | `useMemo` | `resultFileName`（由 `sourceFile` 推导文件名） |
| 副作用清理 | `useEffect`（仅做 cleanup） | `useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl])` |
| 服务端数据 | 原生 `fetch` + `status` 状态机 | `processImage` |
| 持久状态 | `localStorage`（封装在 `lib/auth.ts`） | 访问密码 |

---

## 核心 Pattern：用联合字面量类型做状态机

处理流程用一个 `ProcessStatus` 联合类型表达，而不是散落的多个 boolean：

```tsx
type ProcessStatus = 'idle' | 'ready' | 'processing' | 'done' | 'error';
const [status, setStatus] = useState<ProcessStatus>('idle');
```

UI 根据 `status` 单一来源决定渲染（如 `status === 'processing'` 显示遮罩、`disabled={status === 'processing'}`）。**新增流程态要扩这个联合类型，不要新增并行的 boolean flag**，避免出现 `isLoading && isError` 这类自相矛盾的组合。

---

## 核心 Pattern：jobIdRef 竞态防护

**Problem**: 用户连点"重新处理"或切换模式时会并发多个 `processImage`，旧请求晚返回会覆盖新结果。

**Solution**: 用 `useRef` 计数器给每次任务编号，`await` 后比对，过期即丢弃：

```tsx
const jobIdRef = useRef(0);

async function processImage(...) {
  const jobId = jobIdRef.current + 1;
  jobIdRef.current = jobId;
  // ...
  const compressed = await compressImage(file);
  if (jobIdRef.current !== jobId) return;            // 过期任务，丢弃
  // ...await fetch...
  if (jobIdRef.current !== jobId) {
    URL.revokeObjectURL(objectUrl);                  // 丢弃前先释放资源
    return;
  }
  setResultUrl(objectUrl);
}
```

**Why**: 用 `ref` 而非 `state` 计数，因为它只用于比对、不该触发渲染。所有异步路径（含 `catch`）都要做这个比对。

---

## When to Use Global State

目前**不需要**全局状态——单屏、状态都集中在 `MainApp`。

仅当出现"相距很远的组件需要共享同一份状态、且 props 透传成本明显过高"时，才考虑引入 Context；引入全局状态库需先开 brainstorm 讨论，不在常规实现里顺手加。

---

## Server State

- 用原生 `fetch`，**无缓存库**。结果存在组件 `useState`（`resultBlob` / `resultUrl`）。
- 按 HTTP 状态分流：`401` → 清密码并 `reload` 回登录；`503` → 抛"配额用完"中文提示；其他 `!ok` → 经 `readErrorMessage` 取后端 `{ message }`。
- 二进制结果转 `Blob` + `URL.createObjectURL`，并在清理/过期时 `revokeObjectURL`。

---

## Common Mistakes

### Common Mistake: 用多个 boolean 代替状态机

**Symptom**: `isProcessing` / `isDone` / `hasError` 并存，出现矛盾组合。

**Fix**: 统一进 `ProcessStatus` 联合类型，UI 从单一 `status` 派生。

### Common Mistake: object URL 不释放导致内存泄漏

**Symptom**: 反复处理图片后内存持续增长。

**Fix**: 每个 `createObjectURL` 都要有对应 `revokeObjectURL`——在 `useEffect` cleanup、以及竞态丢弃分支里都要释放（见 `App.tsx`）。

### Common Mistake: 把 `jobIdRef` 这类计数器放进 `useState`

**Symptom**: 每次自增都触发多余渲染。

**Fix**: 不参与渲染的可变值用 `useRef`。
