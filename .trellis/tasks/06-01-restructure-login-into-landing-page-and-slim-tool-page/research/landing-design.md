# 落地页 + 精简工具页 设计规范（landing-design.md）

> 输入文件参照：`src/App.tsx`、`src/styles.css`、`src/components/PasswordGate.tsx`、`src/components/GradientBlinds.tsx`、`src/lib/auth.ts`
> 约束：单一全局 `src/styles.css`，className 驱动，纯 CSS（无 Tailwind / CSS-in-JS / CSS Modules）。
> 本文档仅为设计规范，**不修改任何 `src/` 源文件**。

---

## 设计分析

### 当前状态

- `App` 二态分流：未登录 → `PasswordGate`（深色 `GradientBlinds` 全屏背景 + 居中浅色登录卡）；已登录 → `MainApp`。
- `MainApp` 是一个"全功能营销 + 工具"混合页：topbar（品牌 + 首页/使用方法 + 语言 + 退出登录）、hero-section（标题 + 上传卡 + 模式/尺寸 chip + 对比卡 + 下载）、feature-strip（4 卖点）、how-section（3 步）、history-section（最近处理）。
- 视觉语言已成熟：圆角卡片（`border-radius: 18–26px`）、柔和阴影（`var(--shadow)`）、品牌蓝渐变按钮（`linear-gradient(135deg, #2c74ff, #145ce9)`）、浅色底（`#f6f9ff` / 网格 `::before`）。
- `PasswordGate` 鉴权逻辑自包含且健壮：`GET /api/health` 校验密码 → `storePassword` → `onAuth()`；含完整 a11y（`aria-invalid` / `aria-describedby` / `aria-busy` / `role=alert`）与 reduced-motion 探测（`paused` prop）。

### 改进机会

1. **未登录态信息量过低**：当前登录页只有一张孤立卡片，缺少官网式的卖点叙述与信任建立。卖点（feature-strip）和步骤（how-section）目前被"藏"在登录后，对潜在用户不可见。
2. **已登录态过载**：工具页混入营销区块，干扰核心去背景工作流，纵向滚动过长。
3. **`GradientBlinds` 复用面窄**：深色动画背景只服务于登录页，价值未最大化。

### 结论

把"营销内容"前移到未登录落地页，把"工具内容"收敛到已登录工具页。`GradientBlinds` 从"全屏背景"降级为"仅 Hero 背景"。`PasswordGate` 的登录卡逻辑被抽取为可在两处复用的展示形态（独立 `PasswordGate` 居中态 vs 落地页 Hero 右栏嵌入态）。

---

## 一、信息架构（Information Architecture）

### 组件树对比

```
重构前
App
├─ (!authed) PasswordGate            ← 深色全屏 GradientBlinds + 居中登录卡
└─ (authed)  MainApp
             ├─ topbar (品牌 + 首页/使用方法 + 语言 + 退出登录)
             ├─ hero-section (标题 + 上传 + chips + 对比卡 + 下载)
             ├─ feature-strip (4 卖点)
             ├─ how-section (3 步)
             └─ history-section

重构后
App
├─ (!authed) LandingPage             ← 新增组件
│            ├─ landing-nav   (品牌 + 首页/使用方法 锚点 + 可选「登录」滚动按钮)
│            ├─ landing-hero  (深色 GradientBlinds 背景)
│            │   ├─ hero-copy-dark  (LEFT: 大标题 + lede + 2–4 卖点 bullet)
│            │   └─ AuthCard         (RIGHT: 登录卡，复用 PasswordGate 鉴权逻辑)
│            ├─ feature-strip (4 卖点)   ← 由 MainApp 迁入（浅色主题）
│            ├─ how-section   (3 步)     ← 由 MainApp 迁入（浅色主题）
│            └─ landing-footer (可选简单页脚)
└─ (authed)  MainApp (精简)
             ├─ topbar (品牌 + 退出登录)   ← 移除 首页/使用方法 链接
             ├─ tool-section (= 原 hero-section：上传 + chips + 对比卡 + 下载)
             └─ history-section
             ← 删除 feature-strip 与 how-section
```

### 鉴权逻辑复用策略（关键决策）

`PasswordGate` 内部把"鉴权逻辑"和"外壳布局"耦合在一个组件里（`gate-shell` + 全屏 `GradientBlinds` + 居中 `gate-card`）。落地页需要的是**同一套表单逻辑**但**不同的外壳**（嵌在 Hero 右栏，背景由 Hero 提供）。推荐方案：

**方案 A（推荐）— 抽取 `AuthCard` 表单为独立命名导出，二处共用**

- 新增 `src/components/AuthCard.tsx`：把 `PasswordGate` 中 `<form className="gate-card">…</form>` 的全部状态与逻辑（`password` / `error` / `submitting` / `reduceMotion` 仅作 reduced-motion 不需要、`handleSubmit` 调 `/api/health` + `storePassword` + `onAuth`）原样搬入，导出 `<AuthCard onAuth />`。**不含** `GradientBlinds` 与 `gate-shell`。
- `LandingPage` 在 Hero 右栏直接渲染 `<AuthCard onAuth={...} />`，背景由 Hero 的 `GradientBlinds` 提供。
- 现有 `PasswordGate` 是否保留：本重构后未登录态走 `LandingPage`，`PasswordGate` 不再被 `App` 引用。可二选一：(1) 删除 `PasswordGate.tsx`（推荐，减冗余）；或 (2) 保留并改为内部 `<AuthCard>` + 全屏 `GradientBlinds` 的薄封装（若想留独立登录页备用）。**MVP 建议直接删除**。

**方案 B（更省改动，不推荐长期）— 直接把 `PasswordGate` 的 form 逻辑内联进 `LandingPage`**

- 复制粘贴 form 逻辑到 `LandingPage`，存在重复代码与后续维护分叉风险。仅当不愿新增文件时使用。

> 采用方案 A。`onAuth` 仍由 `App` 注入（`() => setAuthed(true)`），鉴权/存储/`/api/health` 调用**完全不变**，符合 PRD "鉴权逻辑不变"。

---

## 二、布局线框图（Wireframes）

### 2.1 落地页 Hero — 桌面（> 1180px，两栏）

```
┌──────────────────────────────────────────────────────────────────────┐
│  landing-nav  (浅色玻璃条，z-index 在 Hero 之上)                        │
│  [◆ BG Remover]        首页  使用方法            [简体中文 ⌄] [登录 →] │
├══════════════════════════════════════════════════════════════════════┤
│  landing-hero  ▓▓▓▓▓ 深色 GradientBlinds 动画背景（蓝色斜百叶 + 光斑）▓▓ │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│   ┌─ hero-copy-dark (浅色文字) ─┐     ┌─ AuthCard (浅色玻璃卡) ──────┐ │
│   │ 免费在线                    │     │       BG Remover            │ │
│   │ 移除图片背景  ← 白色大标题   │     │   请输入访问密码进入        │ │
│   │                             │     │  ┌────────────────────────┐ │ │
│   │ 一键自动移除…透明 PNG ←lede  │     │  │ 访问密码 (password)     │ │ │
│   │                             │     │  └────────────────────────┘ │ │
│   │  ✓ AI 智能识别主体          │     │  ┌────────────────────────┐ │ │
│   │  ✓ 服务端处理，秒级出图      │     │  │        进入  →          │ │ │
│   │  ✓ 密码保护，私享访问        │     │  └────────────────────────┘ │ │
│   │  ✓ 高清透明 PNG 输出         │     │  (role=alert 错误占位)       │ │
│   └─────────────────────────────┘     └──────────────────────────────┘ │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└══════════════════════════════════════════════════════════════════════┘
       ↑ 深色区到此结束；下方回到浅色主题（#f6f9ff）
```

布局比例：左栏 `minmax(420px, 1.05fr)`，右栏 `minmax(360px, 0.95fr)`（登录卡不宜过宽，保持 `max-width: 420px` 同 `gate-card`）。左右垂直居中 `align-items: center`。

### 2.2 落地页 Hero — 移动（≤ 760px，堆叠）

```
┌──────────────────────────────┐
│ landing-nav (堆叠)            │
│ [◆ BG Remover]               │
│ 首页  使用方法                │
│ [简体中文 ⌄]        [登录 →] │
├══════════════════════════════┤
│ landing-hero ▓深色背景▓       │
│  免费在线                     │
│  移除图片背景  ←白色大标题     │
│  一键自动移除… ←lede           │
│  ✓ AI 智能识别                │
│  ✓ 服务端秒级出图             │
│  ✓ 密码保护私享              │
│  ✓ 高清透明 PNG              │
│                              │
│  ┌── AuthCard (堆在文案下) ─┐ │
│  │      BG Remover         │ │
│  │  [访问密码___________]   │ │
│  │  [      进入  →       ]  │ │
│  └─────────────────────────┘ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└══════════════════════════════┘
```

堆叠时 `grid-template-columns: 1fr`，登录卡 `width: min(420px, 100%)` 居中（`justify-self: center`）。

### 2.3 功能介绍 feature-strip（浅色主题，沿用现有）

```
┌──────────────────────────────────────────────────────────────┐  浅色底
│  [◎ai] AI 智能识别  │ [⚡speed] 快速处理 │ [🛡privacy] 密码保护 │ [▱hd] 高清输出 │
│       自动识别主体   │  服务端处理不阻塞  │  预共享密码守门      │  透明 PNG     │
└──────────────────────────────────────────────────────────────┘
  > 1180px: 4 列   |   ≤1180px: 2 列   |   ≤760px: 1 列   （现有规则不变）
```

### 2.4 如何使用 how-section（浅色主题，沿用现有）

```
        如何使用
   ①              ②              ③
 ┌────┐  ····· ┌────┐  ····· ┌────┐
 │ ⬆  │        │ ◎  │        │ ⬇  │
 └────┘        └────┘        └────┘
 上传图片       AI 自动处理     下载图片
 上传需移除…    自动识别移除…   下载透明 PNG
  > 760px: 3 列 + 虚线连接   |   ≤760px: 1 列、隐藏连接线（现有规则不变）
```

### 2.5 精简后工具页 MainApp（已登录，浅色主题）

```
┌──────────────────────────────────────────────────────────────────────┐
│  topbar  [◆ BG Remover]                                  [退出登录]    │  ← 无 首页/使用方法/语言（语言可保留，见 §7）
├──────────────────────────────────────────────────────────────────────┤
│  tool-section (= 原 hero-section)                                       │
│   ┌─ 左：上传/控制 ─────────────┐   ┌─ 右：对比结果 ─────────────────┐ │
│   │ 免费在线 移除图片背景        │   │ ┌──────────┬──────────┐        │ │
│   │ 一键自动移除…               │   │ │ 原图     │ 处理后    │        │ │
│   │ ┌─ upload-card (虚线) ────┐ │   │ │  🪴     ‹›  🪴      │        │ │
│   │ │   [⬆ 上传图片]          │ │   │ └──────────┴──────────┘        │ │
│   │ │  或拖拽图片到此处…       │ │   │ ┌ result-actions ───────────┐ │ │
│   │ └─────────────────────────┘ │   │ │ 当前文件 xxx  [⬇ 下载PNG] │ │ │
│   │ [人物][商品][自动] ←mode    │   │ └───────────────────────────┘ │ │
│   │ (自动尺寸)(预览)(原图) 重处理│   └────────────────────────────────┘ │
│   └─────────────────────────────┘                                       │
├──────────────────────────────────────────────────────────────────────┤
│  history-section  最近处理                                              │
│   • file-a.png   1.2 MB · remove.bg · 14:02                            │
└──────────────────────────────────────────────────────────────────────┘
  ← 已删除 feature-strip 与 how-section
```

> 注：工具页可沿用现有 `hero-section` 类名（无需改名，省 CSS 改动）；如要语义化可改名 `tool-section` 并复制现有 `.hero-section` 样式。**MVP 建议沿用 `hero-section`**，仅在 `MainApp` 里删掉 feature-strip/how-section JSX。

---

## 三、Hero 深色背景处理（Hero-on-dark Treatment）

`GradientBlinds` 渲染**深蓝斜百叶 + 鼠标光斑**（实测偏暗），Hero 内文案与登录卡必须在其上清晰可读。

### 3.1 背景层级与边界

- `landing-hero` 设 `position: relative; overflow: hidden;`，内部第一个子元素是 `<GradientBlinds className="hero-bg" … />`，绝对定位铺满（同现有 `.gate-bg`：`position:absolute; inset:0; z-index:0`）。
- Hero 内容容器 `z-index: 1`，位于背景之上。
- **深色仅限 Hero**：`feature-strip` / `how-section` 不含 `GradientBlinds`，继续用 `.app-shell`/页面浅色底（`#f6f9ff` + 网格）。落地页根容器用一个新的 `.landing-shell`（浅色），Hero 是其中一段深色区块，形成"深 Hero → 浅其余"的清晰分界。

### 3.2 文案对比度（左栏 hero-copy-dark）

GradientBlinds 亮度在不同位置波动（百叶条纹 + 光斑），纯靠文字色不稳妥，需叠一层"局部压暗 scrim"保证最差情况对比度：

- **scrim**：在 Hero 内、背景之上、内容之下加一层 `.hero-scrim`（`z-index: 0.5` 概念，用 DOM 顺序实现），左侧深一点的线性渐变压暗，确保白字 ≥ 4.5:1：
  `background: linear-gradient(100deg, rgba(8,24,64,0.62) 0%, rgba(8,24,64,0.30) 46%, rgba(8,24,64,0.10) 100%);`
  （右侧较透，让动画百叶仍可见；登录卡自带白底不依赖 scrim。）
- **标题 h1**：白色 `#ffffff`，第二行高亮色由原 `var(--blue)` 改为**浅亮蓝** `#9ec5ff`（在深底上保持品牌感且高对比）。加轻微投影增强分离：`text-shadow: 0 2px 18px rgba(4,16,46,0.45);`
- **lede**：`rgba(255,255,255,0.86)`。
- **卖点 bullet（`.hero-points`）**：文字 `rgba(255,255,255,0.92)`；勾选图标用浅亮蓝 `#9ec5ff` 描边圆形徽标（`background: rgba(158,197,255,0.16)`），与深底分离。

### 3.3 登录卡（AuthCard）样式

- 直接复用 `.gate-card` 视觉（白色玻璃卡 + `var(--shadow)` + `backdrop-filter: blur(18px)`）。它本就是浅色卡，置于深色 Hero 上对比天然成立——**无需改 `.gate-card` 内部**。
- 仅需新增定位/边距类把它放进 Hero 右栏（见 §4 `.hero-auth`）。
- 卡内 `gate-input`/`gate-submit`/`gate-error` 全部沿用，a11y 属性保持。
- 在深底上为卡片补一圈极淡高光描边增强悬浮感（可选）：`box-shadow: var(--shadow), 0 0 0 1px rgba(255,255,255,0.10);`

### 3.4 reduced-motion

沿用现有模式：`AuthCard`/`LandingPage` 用 `window.matchMedia('(prefers-reduced-motion: reduce)')` 探测，传 `paused` 给 `<GradientBlinds>`。`hero-scrim` 与文字不依赖动画，无需额外处理。`@media (prefers-reduced-motion: reduce)` 现有块继续生效。

---

## 四、CSS 类规划（Class Plan）

### 4.1 新增类（写入 `src/styles.css`，放在 PasswordGate 段之前或专设 `/* ===== Landing ===== */` 段）

| 类名 | 用途 | 关键声明 |
|---|---|---|
| `.landing-shell` | 落地页根容器（浅色，承载 Hero+下方区块） | `position:relative; min-height:100dvh; overflow:hidden; padding:0 clamp(14px,2.5vw,46px) 64px;` 背景同 `.app-shell`（径向蓝晕 + 浅渐变）；可复用 `.app-shell::before` 网格做法 |
| `.landing-nav` | 落地页顶部导航（玻璃条） | 复用 `.topbar` 全部声明（grid 三列、玻璃背景、阴影、`z-index:2`）。可直接给元素同时加 `topbar landing-nav`，`.landing-nav` 仅留作语义钩子，不重复声明 |
| `.landing-hero` | Hero 深色区块（含动画背景） | `position:relative; z-index:1; overflow:hidden; border-radius:24px; display:grid; grid-template-columns:minmax(420px,1.05fr) minmax(360px,0.95fr); align-items:center; gap:clamp(40px,7vw,110px); width:min(1560px,100%); margin:18px auto 64px; padding:clamp(48px,6vw,90px) clamp(28px,4vw,64px); min-height:560px;` |
| `.hero-bg` | Hero 内的 GradientBlinds 定位层 | `position:absolute; inset:0; z-index:0;`（等价现有 `.gate-bg`，可直接复用 `.gate-bg`） |
| `.hero-scrim` | 局部压暗层，保白字对比 | `position:absolute; inset:0; z-index:0; pointer-events:none; background:linear-gradient(100deg, rgba(8,24,64,0.62) 0%, rgba(8,24,64,0.30) 46%, rgba(8,24,64,0.10) 100%);` |
| `.hero-copy-dark` | Hero 左栏文案容器（浅色文字上下文） | `position:relative; z-index:1; display:grid; gap:22px;` |
| `.hero-copy-dark h1` | 深底大标题 | `color:#ffffff; text-shadow:0 2px 18px rgba(4,16,46,0.45);`（字号沿用全局 `h1` clamp） |
| `.hero-copy-dark h1 span` | 标题高亮第二行 | `color:#9ec5ff;`（覆盖全局 `h1 span{color:var(--blue)}`，因品牌蓝在深底对比不足） |
| `.hero-copy-dark .hero-lede` | 深底副文案 | `color:rgba(255,255,255,0.86);`（覆盖现有 `.hero-lede` 的深灰色） |
| `.hero-points` | 卖点 bullet 列表容器 | `display:grid; gap:14px; margin:6px 0 0; padding:0; list-style:none;` |
| `.hero-points li` | 单条卖点 | `display:flex; align-items:center; gap:12px; color:rgba(255,255,255,0.92); font-size:clamp(16px,1.2vw,19px); font-weight:640;` |
| `.hero-points li::before` | 勾选徽标 | `content:"✓"; display:grid; place-items:center; flex:0 0 auto; width:26px; height:26px; border-radius:999px; color:#9ec5ff; background:rgba(158,197,255,0.16); box-shadow:inset 0 0 0 1px rgba(158,197,255,0.45); font-weight:800; font-size:14px;` |
| `.hero-auth` | 登录卡在 Hero 右栏的定位包裹 | `position:relative; z-index:1; justify-self:center; width:min(420px,100%);` |
| `.landing-footer` | 可选简单页脚（浅色） | `position:relative; z-index:1; width:min(1560px,100%); margin:24px auto 0; padding:28px 0; border-top:1px solid var(--line); color:var(--muted); font-size:14px; text-align:center;` |
| `.nav-cta`（可选） | 导航右侧「登录 →」滚动锚（落地页用，区别于工具页的 `.login-button` 退出） | 复用 `.login-button` 渐变样式；`href="#auth"` 平滑滚动到登录卡 |

### 4.2 复用 / 沿用（不改声明）

| 现有类 | 在新结构中的角色 |
|---|---|
| `.gate-card` / `.gate-input` / `.gate-submit` / `.gate-error` | AuthCard 直接复用，视觉与 a11y 不变 |
| `.gate-bg` | 可直接作为 Hero 内 GradientBlinds 的定位类（与新 `.hero-bg` 二选一） |
| `.topbar` / `.brand` / `.logo-icon` / `.nav-links` / `.nav-actions` / `.language-button` / `.login-button` | 落地页导航与工具页导航共用 |
| `.feature-strip` 及其子规则 | 迁入 LandingPage，浅色主题，零改动 |
| `.how-section` / `.steps-row` / `.step-number` | 迁入 LandingPage，浅色主题，零改动 |
| `.hero-section` / `.hero-copy` / `.hero-visual` / `.upload-card` / `.control-row` / `.mode-chip` / `.quality-row` / `.comparison-card` / `.result-actions` 等 | 留在 MainApp 工具页，零改动（工具页继续用 `hero-section` 类名） |
| `.history-section` | 两处皆可，本重构留在工具页 |
| `.app-shell` / `.app-shell::before` | MainApp 工具页根容器，沿用 |

### 4.3 不建议改名

为降低改动面，**工具页继续沿用 `hero-section` 等类名**（仅删 feature-strip/how-section 的 JSX）。落地页用全新 `landing-*`/`hero-copy-dark`/`hero-points`/`hero-auth` 类，与工具页样式互不干扰。

### 4.4 背景边界小结

- **深色边界**：仅 `.landing-hero`（内含 `GradientBlinds` + `.hero-scrim`）。
- **浅色边界**：`.landing-shell` 整体浅底；`.landing-hero` 之外的 `feature-strip` / `how-section` / `landing-footer` 全部浅色主题、深色文字。

---

## 五、响应式行为（1180 / 760）

新增以下规则到对应 `@media` 块（现有断点内追加）：

### `@media (max-width: 1180px)`

```
.landing-hero {
  grid-template-columns: 1fr;     /* 两栏 → 单栏堆叠 */
  min-height: auto;
  gap: 34px;
  padding: clamp(40px,6vw,64px) clamp(20px,4vw,40px);
}
.hero-auth { justify-self: center; }   /* 登录卡居中落在文案下方 */
.hero-scrim {                          /* 堆叠后改为顶部到底的整体压暗，保证卡片上方文字可读 */
  background: linear-gradient(180deg, rgba(8,24,64,0.58) 0%, rgba(8,24,64,0.30) 70%, rgba(8,24,64,0.14) 100%);
}
/* feature-strip 4→2 列：现有规则已覆盖，无需重复 */
```

### `@media (max-width: 760px)`

```
.landing-shell { padding: 0 14px 42px; }
.landing-hero {
  border-radius: 18px;
  padding: 40px 18px;
}
.hero-points li { font-size: 16px; }
/* feature-strip 2→1 列、steps-row 3→1 列、隐藏步骤连接线：现有规则已覆盖 */
```

工具页（MainApp）响应式完全沿用现有 `hero-section`/`feature-strip`(已删)/`steps-row`(已删) 之外的现存规则，无新增。

---

## 六、可访问性（A11y）

保持并对齐现有水平：

- **导航**：`<nav className="topbar landing-nav" aria-label="主导航">`；锚点链接 `首页`/`使用方法` 指向 `#home`/`#how`，可键盘聚焦；可选「登录」CTA `href="#auth"` 指向登录卡区（给 `.hero-auth` 加 `id="auth"`）。
- **Hero 区块**：`<section className="landing-hero" id="home" aria-label="产品介绍与登录">`。
- **GradientBlinds**：组件自身已 `aria-hidden="true"`（装饰背景），`.hero-scrim` 也是装饰，加 `aria-hidden="true"`。
- **AuthCard 表单**：原样保留 `aria-label="访问密码"`、`input` 的 `aria-invalid={!!error}` + `aria-describedby={error?'gate-error':undefined}`、`button` 的 `aria-busy={submitting}`、错误 `role="alert" aria-live="assertive"`、`autoFocus`（落地页 Hero 中 `autoFocus` 可考虑保留，但注意会在加载时把焦点拉到表单——若担心打断阅读卖点，可移除 `autoFocus`，靠键盘 Tab 可达即可。**建议落地页移除 `autoFocus`**，工具页无此卡）。
- **对比度**：白字（`#ffffff` / `rgba(255,255,255,0.86–0.92)`）叠 `.hero-scrim`（最深处 `rgba(8,24,64,0.62)`）保证正文 ≥ 4.5:1、大标题 ≥ 3:1；高亮蓝 `#9ec5ff` 用于标题/图标而非小正文。登录卡为白底深字（沿用 `var(--ink)`），对比充足。
- **焦点指示**：`gate-input:focus-visible`/`gate-submit:focus-visible` 现有 4px 蓝环保留；落地页导航链接、CTA、卖点内若有链接均键盘可达。
- **语义结构**：`feature-strip`（`aria-label="核心能力"`）、`how-section`（`id="how" aria-label="如何使用"`）沿用现有 aria。
- **reduced-motion**：`paused` prop + 现有 `@media (prefers-reduced-motion: reduce)` 块继续生效；`.hero-copy-dark`/卖点无动画依赖。
- **键盘可达顺序**：DOM 顺序保持「导航 → Hero 左文案 → 登录卡 → features → how → footer」，符合视觉与阅读顺序。

---

## 七、实现说明（Implementation Notes，供实现者直接执行）

> 仅描述预期改动，本设计文档不修改源码。

### 7.1 新增 `src/components/AuthCard.tsx`（命名导出）

- 从 `PasswordGate.tsx` 抽出 `<form className="gate-card">…</form>` 及其状态/逻辑：`password`、`error`、`submitting`、`handleSubmit`（`GET /api/health` + `X-Access-Password` → `storePassword` + `onAuth`）。
- Props：`{ onAuth: () => void; autoFocus?: boolean }`（默认 `autoFocus=false`，落地页传 `false`）。
- **不含** `GradientBlinds` 与 `gate-shell`。a11y 属性逐字保留。

### 7.2 新增 `src/components/LandingPage.tsx`（命名导出）

- 结构：
  ```
  <main className="landing-shell">
    <nav className="topbar landing-nav" aria-label="主导航"> 品牌 + 首页/使用方法 + 语言 + (可选)登录CTA </nav>
    <section className="landing-hero" id="home" aria-label="产品介绍与登录">
      <GradientBlinds className="gate-bg" gradientColors={GATE_GRADIENT} mixBlendMode="normal" angle={20} noise={0.15} blindCount={14} spotlightRadius={0.6} paused={reduceMotion} />
      <div className="hero-scrim" aria-hidden="true" />
      <div className="hero-copy-dark"> h1(白) + lede + <ul className="hero-points"> 4 条卖点 </ul> </div>
      <div className="hero-auth" id="auth"> <AuthCard onAuth={onAuth} /> </div>
    </section>
    <section className="feature-strip" aria-label="核心能力"> …（从 MainApp 原样搬入 4 个 article + FeatureIcon）… </section>
    <section className="how-section" id="how" aria-label="如何使用"> …（从 MainApp 原样搬入 3 步 + UploadIcon/FeatureIcon/DownloadIcon）… </section>
    <footer className="landing-footer">（可选）</footer>
  </main>
  ```
- 复用现有图标组件：`LogoIcon`/`UploadIcon`/`DownloadIcon`/`GlobeIcon`/`FeatureIcon` 当前定义在 `App.tsx` 内部，函数级。建议把这些图标抽到 `src/components/icons.tsx`（命名导出）供 `LandingPage` 与 `MainApp` 共用；或最小改动：将所用图标 `export` 出来供导入。**推荐抽 `icons.tsx`**。
- `reduceMotion` 用与 `PasswordGate` 相同的 `useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)`。
- `GATE_GRADIENT` 常量（`['#0e4fd0', '#2468f2', '#66a5ff']`）模块级声明，稳定引用，避免 WebGL 重建。

### 7.3 修改 `src/App.tsx`

- `App`：`if (!authed) return <LandingPage onAuth={() => setAuthed(true)} />;`（替换原 `<PasswordGate>`）。
- `MainApp`：
  - topbar 内删除 `<div className="nav-links">`（首页/使用方法）。语言按钮可保留或删除（PRD 仅要求"品牌 + 退出登录"，**建议删除语言按钮**保持极简；若保留不影响验收）。
  - 删除 `feature-strip` `<section>` 整段。
  - 删除 `how-section` `<section>` 整段。
  - 保留 `hero-section`（工具区）、`history-section`、所有 handler 与处理逻辑不变。
  - 把内部图标组件改为从 `icons.tsx` 导入（若执行 7.2 的抽取）。

### 7.4 删除 / 调整 `src/components/PasswordGate.tsx`

- 逻辑迁入 `AuthCard` 后，`PasswordGate` 不再被引用 → 删除该文件（推荐）。
- 若想保留独立全屏登录页备用，可改写为 `<main className="gate-shell"><GradientBlinds className="gate-bg" …/><AuthCard onAuth autoFocus /></main>`（薄封装）。

### 7.5 修改 `src/styles.css`

- 新增 `/* ===== Landing ===== */` 段，加入 §4.1 全部新类。
- 在现有 `@media (max-width:1180px)` 与 `@media (max-width:760px)` 块内追加 §5 的落地页规则。
- 现有 `.hero-section` / `.feature-strip` / `.how-section` / `.steps-row` / `.gate-*` 规则**保持不变**（feature-strip/how-section 的 CSS 仍被 LandingPage 复用，不要删）。

### 7.6 验收对照（PRD Acceptance Criteria）

- 未登录 → LandingPage：Hero（左文案 + 右登录卡，深色 GradientBlinds）+ feature-strip + how-section；登录成功 → MainApp。✔
- 已登录 → MainApp：仅工具区 + 最近处理，无 feature-strip/how-section；退出登录可用。✔
- Hero 深底文案/登录卡可读（scrim + 白字/浅亮蓝 + 白卡）；features/how 浅色可读。✔
- `npm run build` 通过；1180/760 响应式与 a11y 保持；reduced-motion 经 `paused` 降级。✔

---

## 设计令牌速查（本设计新增/沿用）

- 品牌蓝：`--blue:#2468f2` / 深 `#145ce9`（按钮渐变 `135deg, #2c74ff → #145ce9` 沿用）。
- 深底文案高亮蓝（新）：`#9ec5ff`（替代深底上对比不足的 `--blue`）。
- Hero scrim：`rgba(8,24,64,.62 → .10)` 线性渐变。
- 浅色基底：`#f6f9ff`，文字 `--ink:#172033`，次要 `--muted:#64748b`，描边 `--line:#dce7fb`，阴影 `--shadow`。
- 圆角：登录卡/卡片 `18px`，Hero 区块 `24px`（≤760 降 `18px`），对比卡 `26px`（工具页沿用）。
- 字体：`"Satoshi","Geist","Segoe UI","Microsoft YaHei"`（全局，沿用）。
```
