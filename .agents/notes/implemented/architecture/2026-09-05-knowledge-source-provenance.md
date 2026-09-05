# Agent Note: Knowledge source provenance

Status: implemented

English | [中文](2026-09-05-knowledge-source-provenance.zh.md)

## Problem

A bounded navigation preview cannot establish an answer's full text or completion. Tool names and chronological proximity cannot establish support for a research claim. Treating either as a finding makes failed runs appear successful and hides usable files behind a misleading summary.

## Decision

Knowledge Cards identify loaded original material by Turn start, event sequence, and Chat node key. Only the final settled, tool-free Assistant message of a completed Turn contributes an answer excerpt. The shared Markdown grammar identifies section ranges; a section card adds the heading offset to its source message identity and opens its complete original excerpt. Task outcomes remain independently visible. Successful file mutations remain artifacts even when the Turn later fails; the deliverables owner supplies their paths and result sequences. Structural graph edges express Turn membership or recorded production, never inferred evidential support.

Source actions use the existing transcript pager, process disclosure, and Tool inspector. Opening a current file is explicitly separate from inspecting its recorded mutation. Unloaded outline prompts supply navigation only, and partial history displays a coverage limit. No new Session event, model request, or durable format is introduced.

The [Knowledge Workspace proposal](../../proposed/architecture/2026-09-05-knowledge-workspace-presentation.md) retains the full-history projection, section navigation, and structured-summary design. This decision constrains source correctness in the loaded-window implementation; it does not complete that proposal. The [file-link decision](../feature/2026-07-31-web-workspace-file-links.md) continues to own native opening and mutation vocabulary.

## Verification

The assembled Conversation fixtures cover completed, failed, stopped, blocked, interrupted, output-limited, empty, running, and partial-history material. They verify full text, stable source sequences, actual Turn membership, and successful versus failed file mutations. The minimal Web preset replay covers the source-labelled map, original answer navigation, recorded Tool inspection, and revealing a folded Tool source.

## Alternatives considered

**Call the first sentence a finding.** Rejected because a process update or failure explanation can be the latest text. An original excerpt makes no claim of independent synthesis.

**Infer Tool support from display order.** Rejected because the order is chronology, not attribution. A future semantic relationship needs explicit source-backed production.

**Hide every artifact after failure.** Rejected because earlier successful writes remain useful. Task outcome and recorded file production answer different questions.

## Consequences

- Knowledge views remain useful for checking sources without adding model latency or changing Session storage.
- Current file contents can differ from the recorded mutation; users can inspect the original Tool record separately.
- Older details and artifacts require history loading. Full-history coverage and semantic summaries need the dedicated projection tracked by the proposal.
