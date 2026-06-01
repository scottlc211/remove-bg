# Quality Guidelines

> 前端（React 19 + Vite + TypeScript）的代码质量标准与质量闸门。

---

## Overview

前端唯一的静态质量闸门是 **TypeScript strict 编译**——**没有 ESLint / Prettier**（仓库无 lint 配置）：

| 闸门 | 命令 | 说明 |
|------|------|------|
| 类型检查 + 构建 | `npm run build`（`tsc -b && vite build`） | `tsc` 在 strict + `noUnusedLocals`/`noUnusedParameters` 下兼当 linter |
| 本地预览 | `npm run dev` / `npm run preview` | 手动验证 UI |

> 前端**目前没有自动化测试**（`test:api` 只覆盖后端 `api/_lib`）。因此前端正确性靠"类型 + 手动验证 UI"保障——改动 UI 后应在浏览器里实际走一遍主流程。

---

## Forbidden Patterns

| 禁止 | 原因 |
|------|------|
| `any`、用 `as` 绕过类型错误 | 见 [type-safety.md](./type-safety.md)；类型是唯一静态闸门，不能逃逸 |
| 引入全局状态库 / CSS 方案（Redux、Tailwind、styled-components…） | 现状是 `useState` + 全局 `styles.css`，引入新范式需先讨论，见 [state-management.md](./state-management.md) |
| 把内部错误细节直接抛给用户 | 对用户只显示友好中文提示；后端已保证不泄露 key/密码 |
| `createObjectURL` 不配对 `revokeObjectURL` | 内存泄漏；清理与竞态丢弃分支都要释放 |
| 异步请求不做竞态防护 | 旧结果覆盖新结果，见 `jobIdRef` 模式 |
| 留未使用变量/参数 | `tsc` 直接报错、`build` 失败 |

---

## Required Patterns

| 必须 | 说明 |
|------|------|
| 提交前 `npm run build` 通过 | 类型错误/未使用变量会卡构建 |
| 资源清理 | object URL 在 `useEffect` cleanup + 竞态丢弃分支都 `revokeObjectURL`（见 `App.tsx`） |
| 竞态防护 | 并发异步用 `jobIdRef` 计数比对（见 [state-management.md](./state-management.md)） |
| 可访问性 | 新组件须达到现有 a11y 水平（见 [component-guidelines.md](./component-guidelines.md)） |
| 有限状态用联合类型 | 而非并行 boolean（见 [state-management.md](./state-management.md)） |
| 用户文案、注释用中文；技术标识用英文 | 中英混合策略，与全项目一致 |

---

## Code Style

来自现有代码的格式约定（无 Prettier 强制，靠人工保持一致）：

- 2 空格缩进；单引号；句末分号。
- 组件用函数声明（`function Foo()`），不用箭头赋值。
- import 在文件顶部，React 相关在前、本地模块在后。

---

## Testing Requirements

- 前端**当前无单测**——这是现状，不是建议你跳过验证。改 UI 后**必须手动在浏览器验证主流程**（上传 → 处理 → 下载、密码门、错误态）。
- 若未来引入前端测试，应与后端一致优先用轻量方案，并在此文件补充约定。
- 纯逻辑（`src/lib/`）因不依赖 React，是最值得优先补单测的部分。

---

## Code Review Checklist

- [ ] `npm run build` 通过（无类型错误、无未使用变量）
- [ ] 无 `any`、无用于绕错的 `as`
- [ ] 每个 `createObjectURL` 都有对应 `revokeObjectURL`
- [ ] 异步流程有 `jobIdRef` 竞态防护，且过期分支释放了资源
- [ ] 新增/改动组件满足 a11y（aria-*、键盘可达、alt/aria-hidden）
- [ ] 错误只对用户显示友好中文，不暴露内部细节
- [ ] 有限状态走联合类型，没有新增并行 boolean flag
- [ ] 已在浏览器手动验证受影响的 UI 流程
