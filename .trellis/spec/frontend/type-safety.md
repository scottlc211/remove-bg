# Type Safety

> 本项目的 TypeScript 类型约定。配置见 `tsconfig.app.json`（**strict 全开**）。

---

## Overview

前端是 TypeScript **strict 模式**，并额外开启 `noUnusedLocals` / `noUnusedParameters`（`tsconfig.app.json`）。类型检查是前端唯一的静态质量闸门（无 ESLint），所以**充分利用类型、不留逃逸口**尤为重要。

关键编译选项：

```jsonc
// tsconfig.app.json
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"moduleResolution": "Bundler",
"jsx": "react-jsx"
```

---

## Type Organization

- 类型**就近定义**在使用它的文件里（`App.tsx` 顶部的 `ProcessStatus` / `TargetType` / `HistoryItem`，`compress.ts` 的 `CompressResult`）。当前没有集中的 `types.ts`——共享需求出现前不强行抽公共类型文件。
- 用 **`type` 别名**描述对象形状与联合，**不用 `interface`**（保持一致；现有代码零 `interface`）。

---

## Common Patterns

**1. 有限状态用联合字面量类型**，而非裸 `string`：

```tsx
type ProcessStatus = 'idle' | 'ready' | 'processing' | 'done' | 'error';
type TargetType = 'person' | 'product' | 'auto';
type SizeMode = 'auto' | 'preview' | 'full' | '50MP';
```

**2. DOM 事件显式标类型**（React 合成事件泛型）：

```tsx
function handleInputChange(event: ChangeEvent<HTMLInputElement>) {}
function handleDrop(event: DragEvent<HTMLDivElement>) {}
async function handleSubmit(event: FormEvent<HTMLFormElement>) {}
```

**3. 选项数组显式标注元素类型**，让 `value` 收窄到联合成员：

```tsx
const targetOptions: Array<{ value: TargetType; label: string; hint: string }> = [/* ... */];
```

**4. 函数返回类型靠推断**为主；导出的纯函数可显式标注（如 `compressImage(file: File): Promise<CompressResult>`）。

---

## Validation

- **没有运行时校验库**（无 Zod / Yup / io-ts）。前端信任自己的类型化状态。
- **跨边界的不可信数据**做两件事：
  - 后端响应体断言为最小形状再读：`(await response.json()) as { message?: string }`，并对缺字段give 中文兜底。
  - **真正的输入校验在后端做**（`normalizeTargetType` / `parseDataUrl` 等，见 backend [quality-guidelines.md](../backend/quality-guidelines.md)）。前端不重复实现服务端校验。

---

## Forbidden Patterns

| 禁止 | 说明 / 例外 |
|------|-------------|
| `any` | 一律不用；不确定的外部数据用最小 `as { ... }` 形状断言并做兜底 |
| 宽泛的 `as` 断言 | 仅在跨边界且无法推断处使用（如 `response.json() as {...}`），不用来绕过类型错误 |
| 滥用非空断言 `!` | 仅用于确定存在的场景，如 `document.getElementById('root')!`（`main.tsx`）；业务数据用显式判空 |
| 用 `interface` 定义对象类型 | 统一用 `type`，与现有代码保持一致 |
| 留下未使用的变量/参数 | `noUnusedLocals` / `noUnusedParameters` 会让 `tsc` 直接报错、`build` 失败 |

---

## Common Mistakes

### Common Mistake: 用裸 `string` 表示有限选项

**Symptom**: `size: string` 导致拼错值不报错。

**Fix**: 定义联合字面量类型（`SizeMode`），让编译器在赋非法值时报错。

### Common Mistake: 留下未使用的 import/变量

**Symptom**: 本地能跑，`npm run build` 却因 `noUnusedLocals` 失败。

**Fix**: 提交前跑 `npm run build`；删掉未使用的 import、变量、参数。确实需要保留的占位参数可用 `_` 前缀让 `noUnusedParameters` 放行（这是 TS 行为；目前前端代码里尚无此情况）。
