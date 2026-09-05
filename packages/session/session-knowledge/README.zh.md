---
description: "手动将已完成的研究回答整理为带来源的持久知识地图，并限制 LLM 用量。"
kind: "package-reference"
---

# @deepseek-ai/dsh-session-knowledge

[English](README.md) | 中文

## 概述

将研究对话整理为精简的主题、主张、待解问题和限制。每个要点及建议关系都附有已记录回答的原文引用。整理需要明确命令，会消耗一次辅助模型请求；生成失败时保留原始对话和上一份成功地图。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

Web bundle 将此插件与命令、LLM、Session 和投影服务共同挂载。知识工作区调用 `/knowledge-organize`；`/knowledge-cancel` 中止并等待该 Session 的活动整理结束。整理要求 agent 空闲，并采用当前选择的提供者和模型；未选择时使用最后记录的请求路由。整理不会排入研究轮次。

### 配置

所有字段均为必填；Web bundle 在其[补丁](../../bundle/web-app/cordis.patch.yml)中提供部署值。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `maxInputBytes` | 必填 | 完整记录请求的 UTF-8 上限；超限直接拒绝，不丢弃来源 |
| `maxOutputBytes` | 必填 | 累计文本及推理、完整保存结果的 UTF-8 上限 |
| `maxOutputTokens` | 必填 | 提供者的输出 token 上限 |
| `maxGroups` | 必填 | 不同主题的最大数量 |
| `maxNodes` | 必填 | 知识要点的最大数量 |
| `maxRelations` | 必填 | 建议关系的最大数量；零表示禁止关系 |
| `timeoutMs` | 必填 | 协作式请求截止时间，单位毫秒 |

[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-session-knowledge)规定 Loader 验证细节。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

来源收集器读取完整 Session 日志中每个已完成轮次的最后一份无工具调用回答。维护操作的所有权排除并发 agent 工作。模型调用前先追加并刷盘精确输入；成功 JSON 在发布前检查图谱数量限制、节点标识唯一性、关系端点及精确原文引用。失败不发布替代结果。卸载会中止并等待所有活动操作结束。

`knowledge` 投影公开最新验证文档，并在后续用户或助手消息出现时标记过期。来源目标保留回答 seq、轮次和 turn/start seq；浏览器分页不会改变它们。原始模型 JSON 保存在持久结果中供重播使用，不进入传输投影。[共享类型](src/types.ts)规定文档和引用字段；[决策](../../../.agents/notes/implemented/feature/2026-09-05-manual-knowledge-organization.zh.md)规定证据策略。

</details>

-----

<a id="model-experience"></a>
## 模型体验

### 辅助知识请求

#### 模型看到什么

固定[整理指令](src/organize.ts)要求使用研究语言返回精简 JSON，将来源视为数据，并要求逐字证据。一条用户消息包含配置的图谱限制、每份合格回答的精确文本、人工提问及来源标识。不提供工具。

#### Token 影响

每次明确整理都发送完整的合格来源集，输出 token 不超过 `maxOutputTokens`。字节限制拒绝超限输入或输出，不会静默截断研究。辅助结果不进入正常对话模型历史。

#### KV Cache 影响

主对话提示保持不变。辅助请求的缓存复用取决于提供者；来源 JSON 改变时，固定指令仍可能复用。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

以下限制区分易读整理与已核查研究。

- **引用不证明解释** — 精确匹配只验证来源，不证明推论、完整性或建议关系的真实性。界面将关系标记为待核查。
- **只使用已完成文本回答** — 排除进行中或失败轮次、推理、工具输出、文件和图片。
- **一次有界请求** — 研究超限时明确失败，不提供分层多次请求处理。
- **手动更新** — 后续对话输入将已保存地图标记为过期，生成绝不自动执行。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景 — 点击展开</summary>

无。

</details>

**运行时不变量：** 不发布伴随插件。地图由单一验证结果持有，发布前执行来源和关系检查，投影注册表验证保存值和传输值。Agent 维护操作负责准入与取消；此插件的操作注册表只用于定位取消目标及等待自有请求结束。
