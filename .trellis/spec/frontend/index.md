# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for frontend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | src 布局、components vs lib 二分、内联子组件约定 | Filled |
| [Component Guidelines](./component-guidelines.md) | 函数组件、Props type 约定、内联 SVG、a11y 硬性要求 | Filled |
| [Hook Guidelines](./hook-guidelines.md) | 零自定义 hook 现实、内置 hook 用法、何时才抽 hook | Filled |
| [State Management](./state-management.md) | 仅 useState、ProcessStatus 状态机、jobIdRef 竞态防护 | Filled |
| [Quality Guidelines](./quality-guidelines.md) | tsc 唯一闸门、无前端测试现实、资源清理/竞态/a11y 必守项 | Filled |
| [Type Safety](./type-safety.md) | strict 全开、联合字面量、type 而非 interface、禁 any | Filled |

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language（语言策略）**: 采用**中英混合**风格。
- **使用英文**: 代码示例、文件路径、API/函数名、类型名、错误码、命令、配置键名
- **使用中文**: 说明性文字、规范描述、原因解释、注释、设计决策、踩坑记录
- **目的**: 平衡 AI 可读性与团队沟通效率——技术标识保持精确，业务表达保持自然
