# Agent Note: Manual knowledge organization

Status: implemented

English | [中文](2026-09-05-manual-knowledge-organization.zh.md)

## Problem

A structural chapter map repeats headings and scatters related claims across answers. Semantic organization requires a model request, but silent summarization can omit evidence and make unverified relationships look authoritative.

## Decision

A human command starts one bounded auxiliary request under agent maintenance ownership. It reads completed answer text from the complete durable log, records and flushes exact model input before dispatch, and stores only validated results. The main conversation stays unchanged. Every node and proposed relation cites an existing answer seq and an exact quotation. Duplicate IDs, invalid endpoints, unsupported quotations, excessive input/output, cancellation, and unsuccessful model termination prevent replacement of the previous successful map.

The whole-session projection supplies grouped knowledge and durable source targets independently of browser pagination. Later conversation messages mark the saved map stale. Raw model JSON stays in the result event for keyless replay. The client exposes manual generation, cancellation, source quotations, original-conversation navigation, and a switch to the structural chapter map. Quote matching establishes provenance; semantic support and relation labels still require review.

The [source-provenance decision](../architecture/2026-09-05-knowledge-source-provenance.md) remains authoritative for original material. This producer supplies the structured summary portion of the [workspace proposal](../../proposed/architecture/2026-09-05-knowledge-workspace-presentation.md); a complete chapter projection and research-quality evaluation remain separate work.

## Alternatives considered

Automatic regeneration increases cost and changes reading into a write operation. Reusing the conversational send path pollutes research history. Silently clipping long research hides omissions. These behaviors are excluded; oversized input fails explicitly and the existing chapter view remains available.

## Verification

Focused model fixtures cover invalid output, source validation, limits, cancellation, and command disposal. GUI checks cover explicit dispatch, retry, old-result preservation, stale state, and source navigation. The shipped Web profile replays a recorded auxiliary call, compares the persisted Session, and restores its organized map after browser reload. These checks establish provenance and lifecycle behavior, not research quality.

## Consequences

Organization adds explicit model cost and a durable result without modifying research history. Large Sessions require a later hierarchical producer; the current request refuses to hide omitted sources.
