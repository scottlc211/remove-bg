# Add Gradient Blinds animated background

## Goal

为去背景工具（remove-bg）的**登录密码门**接入 React Bits 的 **Gradient Blinds** WebGL 动画渐变背景，做出有质感的登录首屏。居中白卡承载表单、保证可读性，背景为品牌蓝系的随鼠标 spotlight 渐变。

## Requirements

- 新增可复用组件 `src/components/GradientBlinds.tsx`（命名导出），忠实移植 React Bits Gradient Blinds（基于 `ogl` 的片元着色器 + 鼠标 spotlight）。
- 仅用于密码门：在 `PasswordGate` 的 `.gate-shell` 内、`.gate-card` 下方渲染为全铺背景层（低 z-index，不拦截表单交互）。
- 配色采用**品牌蓝系**（`#2468f2` / `#145ce9` 及邻近蓝紫），与现有 UI 协调。
- 安装运行时依赖 `ogl`。
- 资源清理：卸载时释放 WebGL context、取消 RAF、移除事件监听；StrictMode 双挂载安全。
- `prefers-reduced-motion: reduce` 下停止/降级动画。
- 主界面 `.app-shell` 维持现状，不改。

## Acceptance Criteria

- [x] `npm run build`（`tsc -b && vite build`）通过
- [x] 密码门背景显示 Gradient Blinds 蓝系动画，鼠标移动有 spotlight 反馈
- [x] 登录白卡 / 输入框 / 按钮 / 报错文案清晰可读，交互不被背景拦截
- [x] 组件卸载无 WebGL context 泄漏 / RAF 残留（StrictMode 下验证：~16 次重渲染后仍仅 1 个 canvas）
- [x] `prefers-reduced-motion: reduce` 下动画降级（按 `paused` 实现；浏览器媒体查询模拟未跑，逻辑上 paused→不渲染→透明→回落到 .gate-shell 渐变）

## Definition of Done

- tsc / 构建通过
- 浏览器实测：可读性、交互、动画、reduced-motion 降级
- 资源清理到位（WebGL/RAF/监听器卸载释放）

## Technical Approach

- `GradientBlinds.tsx`：以 React Bits 默认（非 Tailwind）TS 变体为蓝本，挂载 `ogl` Renderer + 全屏三角/平面 + 片元着色器；props 暴露 `gradientColors`、`angle`、`blindCount`、`spotlightRadius` 等（以官方源码为准，见 research）。`useEffect` 内初始化、ResizeObserver 适配、`mousemove` 驱动 spotlight、`requestAnimationFrame` 渲染循环；cleanup 释放全部资源。
- `PasswordGate.tsx`：在 `.gate-shell` 内、`.gate-card` 之前插入 `<GradientBlinds className="gate-bg" gradientColors={[...brand blue...]} />`，绝对定位铺满、`z-index:0`、`pointer-events:none`（卡片 `z-index:1` 之上可交互）。
- `styles.css`：`.gate-bg` 全铺定位；视效果可调暗/降低 `.gate-shell::before` 网格或 `.gate-card` 透明度以保证对比度。
- 依赖：`npm i ogl`（版本以 research 确认为准）。

## Decision (ADR-lite)

- **Context**: 浅色主题、正文近黑，炫彩背景铺到正文区会损可读性；需在视觉冲击与可读性间取舍。
- **Decision**: 背景**仅放密码门**（居中白卡天然保护可读性）；配色走**品牌蓝系**；实现**引入 `ogl` 忠实还原**官方效果。
- **Consequences**: 主工具页零风险、零改动；新增 `ogl` 依赖（轻量）；登录页获得高质感动效；后续若想扩到主界面，组件可直接复用，仅需额外做正文区可读性处理。

## Out of Scope

- 主界面 `.app-shell` / hero 背景改造
- 整体深色模式切换
- 其它 React Bits 组件

## Technical Notes

- 组件落点遵循 frontend/directory-structure：可复用 UI → `src/components/<PascalCase>.tsx` 命名导出。
- 资源清理为硬要求（frontend/quality-guidelines）。
- 仅 `tsc` 作闸门，无前端测试；以浏览器实测兜底。

## Research References

- `research/gradient-blinds-source.md` —— Gradient Blinds 官方源码 / props 默认值 / `ogl` 依赖（research 子代理产出）
