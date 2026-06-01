# Directory Structure

> 前端代码组织方式。本项目前端是 **Vite + React 19 + TypeScript**（strict 模式），单页应用。

---

## Overview

前端代码全部在 `src/` 下，核心约定是 **`components/`（带 React 的 UI） vs `lib/`（无 React 的纯逻辑）** 的二分：

- `src/components/` —— 可复用 UI 组件，依赖 React。
- `src/lib/` —— 框架无关的纯函数工具（localStorage 存取、Canvas 压缩），**不 import React**，理论上可独立单测。
- 体量小、只服务单一文件的展示型子组件，**就近内联**在使用它的文件里（如 `App.tsx` 内的各种 `*Icon`、`ComparisonCard`），不强行拆文件。

---

## Directory Layout

```
src/
├── components/        # 可复用 UI 组件（依赖 React），PascalCase.tsx
│   └── PasswordGate.tsx   #   访问密码登录门
├── lib/               # 纯逻辑工具（不依赖 React），camelCase.ts
│   ├── auth.ts            #   密码的 localStorage 存取（getStoredPassword / storePassword / clearPassword）
│   └── compress.ts        #   上传前 Canvas 压缩（compressImage）
├── App.tsx            # 根组件：鉴权门控 App + 主界面 MainApp + 内联展示型子组件
├── main.tsx           # 入口：createRoot + StrictMode + 引入 styles.css
├── styles.css         # 全局样式（单文件，className 驱动）
└── vite-env.d.ts      # Vite 客户端类型引用
```

---

## Module Organization

- **新增可复用组件** → `src/components/<PascalCase>.tsx`，命名导出（`export function Foo`）。
- **新增纯逻辑/工具**（无 React、可独立测试）→ `src/lib/<camelCase>.ts`。判断标准：它 import React 吗？是 → `components/`；否 → `lib/`。
- **新增仅在单个文件内使用的小展示型组件** → 直接内联在该文件，不开新文件（参考 `App.tsx` 把所有图标和 `ComparisonCard` 内联）。
- 当前**没有** `hooks/` 目录——项目尚无自定义 hook，逻辑要么在组件内，要么在 `lib/` 纯函数里。详见 [hook-guidelines.md](./hook-guidelines.md)。

---

## Naming Conventions

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件文件 | PascalCase `.tsx` | `PasswordGate.tsx` |
| 纯逻辑文件 | camelCase `.ts` | `auth.ts`、`compress.ts` |
| 组件 | 命名导出 `export function` | `export function PasswordGate()` |
| 根组件 | 唯一的默认导出 | `export default App`（`App.tsx`） |
| 内联子组件 | 文件私有 `function`（不导出） | `function LogoIcon()` |

---

## Examples

- 可复用组件 + 表单 + 鉴权交互：`src/components/PasswordGate.tsx`
- 纯逻辑工具（无 React，含降级处理）：`src/lib/auth.ts`、`src/lib/compress.ts`
- 内联子组件 + 主状态机：`src/App.tsx`（`MainApp` + 内联 `*Icon` / `ComparisonCard`）
