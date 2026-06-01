# Component Guidelines

> 本项目（React 19 + TypeScript strict）的组件编写约定。

---

## Overview

约定来自现有代码（`src/App.tsx`、`src/components/PasswordGate.tsx`）：

- **只用函数组件**，函数声明式（`function Foo() {}`），不用 class、不用箭头函数赋值定义组件。
- **可复用组件命名导出**（`export function PasswordGate`）；根组件 `App` 是唯一的 `export default`。
- **文件私有的小展示型组件**（图标、纯展示卡片）直接内联在使用它的文件里，文件私有 `function`，不导出。
- **可访问性（a11y）是硬性要求**，不是可选项——见下方专节。

---

## Component Structure

一个组件文件的典型结构（以 `PasswordGate.tsx` 为参照）：

```tsx
import { FormEvent, useState } from 'react';
import { storePassword } from '../lib/auth';

type Props = {
  onAuth: () => void;
};

export function PasswordGate({ onAuth }: Props) {
  const [password, setPassword] = useState('');
  // ...hooks 在顶部
  async function handleSubmit(event: FormEvent<HTMLFormElement>) { /* ... */ }
  return ( /* JSX */ );
}
```

要点：import 在顶 → `type Props` → 组件函数（hooks 在最前，事件 handler 居中，`return` JSX 在尾）。

---

## Props Conventions

- 用**局部 `type Props = {...}`** 定义，在参数里解构：`function PasswordGate({ onAuth }: Props)`。
- 极小的展示型组件可用**内联对象类型**：`function FeatureIcon({ type }: { type: 'ai' | 'speed' | 'privacy' | 'hd' })`。
- 回调 prop 用动词/`on` 前缀命名并显式标类型：`onAuth: () => void`。
- 用 `type` 别名，不用 `interface`（与 [type-safety.md](./type-safety.md) 一致）。

---

## Styling Patterns

- **全局 CSS + className 字符串**，单一 `src/styles.css`。**没有** CSS Modules、styled-components、Tailwind、CSS-in-JS。
- 条件 className 用模板串或三元：

```tsx
className={`upload-card ${isDragging ? 'dragging' : ''}`}
className={targetType === option.value ? 'mode-chip active' : 'mode-chip'}
```

- 新增样式直接往 `styles.css` 加类，组件侧只引用类名。

---

## Accessibility

可访问性是**必须**遵守的约定，现有代码大量使用，新组件须保持同等水平：

| 场景 | 做法 | 代码出处 |
|------|------|----------|
| 装饰性 SVG | `aria-hidden="true"` | `App.tsx` 所有 `*Icon` |
| 有意义的图片 | 写 `alt` | `<img alt="移除背景后的透明图片" />` |
| 非 `<button>` 元素当按钮用 | `role="button"` + `tabIndex={0}` + `onKeyDown`（Enter/Space 触发） | `App.tsx` 上传区 `upload-card` |
| 表单输入错误 | `aria-invalid` + `aria-describedby` 指向错误节点 | `PasswordGate.tsx` |
| 异步状态 | 按钮 `aria-busy`；错误用 `role="alert"` `aria-live`；进度用 `role="status"` | `PasswordGate.tsx`、`App.tsx` |
| 区块/导航 | `aria-label` 标注语义 | `<nav aria-label="主导航">`、`<section aria-label="核心能力">` |

---

## Common Mistakes

### Common Mistake: 用 `<div onClick>` 而不补键盘可达性

**Symptom**: 可点击的 `div` 无法用键盘聚焦/触发。

**Fix**: 跟 `upload-card` 一样补齐 `role="button"` + `tabIndex={0}` + `onKeyDown`（Enter/Space `preventDefault` 后触发）。

### Common Mistake: 装饰性图标没加 `aria-hidden`

**Symptom**: 屏幕阅读器读出无意义的 SVG。

**Fix**: 纯装饰 SVG 一律 `aria-hidden="true"`；承载信息的图片才用 `alt`。
