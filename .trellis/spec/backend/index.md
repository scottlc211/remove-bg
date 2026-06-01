# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

This directory contains guidelines for backend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Vercel Functions 布局、`_lib` 路由约定、迁移 gotcha | Filled |
| [Database Guidelines](./database-guidelines.md) | 无数据库：无状态现实、唯一的 module-level Set、禁止凭空引入持久层 | Filled |
| [Error Handling](./error-handling.md) | key 池故障切换、错误矩阵、状态码契约 | Filled |
| [Quality Guidelines](./quality-guidelines.md) | tsc + node:test 双闸门、禁止/必须 pattern、测试约定、Review 清单 | Filled |
| [Logging Guidelines](./logging-guidelines.md) | 当前零日志现实、Vercel 自动捕获、绝不记 key/密码的安全红线 | Filled |

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
