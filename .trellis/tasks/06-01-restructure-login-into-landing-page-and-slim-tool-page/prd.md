# Restructure login into landing page and slim tool page

## Goal

把应用拆成两种体验：**未登录＝官网式落地页**（承载功能介绍/卖点 + 登录入口），**已登录＝纯去背景工具页**（只留功能区）。让首屏更像官网、工具页更专注。

## Decisions (from brainstorm)

- **工具页**：保留 上传 + 模式/尺寸 + 对比结果 + 下载 + 最近处理；移除 功能介绍(feature-strip) 与 如何使用(how-section)；导航精简为 品牌 + 退出登录。
- **登录入口**：落地页 Hero 采用「左文案 + 右登录卡」（SaaS 官网式）。
- **背景**：Gradient Blinds **仅铺 Hero 区**（深色动画）；功能介绍/如何使用回到现有浅色主题。

## Requirements

- `App` 分流：未登录渲染落地页，已登录渲染精简后的工具页（`MainApp`）。
- **落地页（未登录）**：顶部导航（品牌 + 首页/使用方法 锚点）+ Hero（左：大标题/卖点；右：登录卡，复用现有 `PasswordGate` 鉴权逻辑与 a11y）+ 功能介绍(4 卖点) + 如何使用(3 步)。Hero 背景为 `GradientBlinds`（深色），Hero 内文案/登录卡需在深色上可读（浅色文字）。
- **工具页（已登录）**：精简导航（品牌 + 退出登录）+ 去背景功能区（上传/模式·尺寸/对比结果/下载/最近处理）。移除 feature-strip 与 how-section。
- 复用现有 `GradientBlinds`、品牌蓝、样式约定（单一 `styles.css`，className 驱动）；保持响应式（1180/760 断点）与 a11y。
- 鉴权逻辑、去背景 API、压缩等行为**不变**。

## Acceptance Criteria

- [x] 未登录：落地页显示 Hero(左文案+右登录卡，深色 Gradient Blinds 背景) + 功能介绍 + 如何使用（桌面/移动均已浏览器实测）。登录成功→工具页：经 localStorage 注入已存密码验证分流（vite dev 不跑 `/api/health`，真实登录请求本地无法测）。
- [x] 已登录：工具页仅功能区（上传/模式·尺寸/对比结果/下载/最近处理），无功能介绍/如何使用；导航仅品牌+退出登录（退出逻辑沿用未改，未点击实测）。
- [x] Hero 深色背景上文案/登录卡可读；功能介绍/如何使用在浅色主题可读（截图确认）。
- [x] `npm run build` 通过；浏览器实测桌面+移动两态；响应式 ≤1180px Hero 塌单栏（修复源序 bug 后 `grid` 计算为单列、登录卡不溢出）；reduced-motion 经 `paused` 实现（未模拟媒体查询）。

## Out of Scope

- 鉴权机制 / 去背景 API / 压缩逻辑改动
- 新增业务功能（仅信息架构重排 + 视觉设计）
- 深色模式整体切换

## Technical Approach

- 详见 `research/landing-design.md`（ui-ux-designer 产出的信息架构 + 布局 + CSS 方案）。
- 预期：`App.tsx` 分流落地页 / `MainApp`；可能新增 `src/components/LandingPage.tsx`（命名导出，复用 `PasswordGate` 鉴权逻辑或内嵌其表单）；`MainApp` 删除 feature-strip/how-section；`styles.css` 增 landing 相关类与 Hero 深色文案变体。

## Research References

- `research/landing-design.md` —— ui-ux-designer 的落地页 + 工具页设计规范（产出中）
