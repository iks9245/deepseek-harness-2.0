# Agent Note: Knowledge reading and source comparison

Status: implemented

English | [中文](2026-09-05-knowledge-reading-comparison.zh.md)

## Problem

A map that omits chapters and truncates evidence makes a long answer harder to retrieve than its original transcript. A textual difference between answers cannot establish a correction or contradiction, and a missing earlier page can make old content appear new.

## Decision

The workspace starts with the research question, original answer excerpts, recorded outcome limitations, and produced files. A searchable, Turn-filtered source list reaches every loaded card; heading ancestry retains empty parent sections. Reading renders complete Markdown blocks with reference definitions from the original answer and stores the selected card and reading offset only in browser preferences. The structural map uses common node rectangles and connector endpoints, a scrollable canvas, zoom, and counted tool disclosure. These controls remain reachable without a details column.

Automatic comparison requires complete loaded history and a complete latest answer. Matching uses exact heading text and ancestry between successive completed answers; duplicate candidates stay unmatched. The result distinguishes identical text, changed text, new excerpts, and excerpts not repeated. None of these observations proves a semantic relation. Paired original excerpts expose the evidence and let the user draft a question about a possible contradiction, revision, relationship, or limitation. Draft transfer requires an empty, idle composer and never sends a message; normal conversation submission records any model-visible input.

The [source-provenance decision](../architecture/2026-09-05-knowledge-source-provenance.md) continues to constrain trustworthy content and source identities. The [workspace proposal](../../proposed/architecture/2026-09-05-knowledge-workspace-presentation.md) retains a dedicated full-history projection and structured summary producer. Explicit history loading provides complete comparison inputs without adding another transport or model request.

## Verification

Source fixtures cover additions, contradictory and corrected prose, unchanged answers, repeated headings, and incomplete history. Graph fixtures exercise 10, 50, and 200 nodes with non-overlapping rectangles and attached endpoints. GUI and browser scenarios cover semantic Markdown, definitions outside an excerpt, keyboard/list navigation, narrow viewports, reader restoration, source actions, and draft staging. These checks establish behavior; they do not establish the proposed five-person comprehension and discovery targets.

## Alternatives considered

**Classify every text change as a corrected claim.** Rejected because wording, scope, and evidence can change independently; semantic judgments require explicit review against both sources.

**Silently select a few graph nodes.** Rejected because a sparse picture falsely suggests complete coverage. Counts, scope controls, and an exhaustive source list expose omission.

**Generate a model summary on every read.** Rejected because reading cannot create unrecorded authority or additional requests. A structured producer needs recorded sources and a separate lifecycle.

## Consequences

- Source navigation remains usable at narrow widths and independently of the right details column.
- Heading changes can leave related material unmatched; users can select originals manually instead of trusting a guessed relation.
- Loading an entire large Session costs browser memory and paging time. The dedicated projection remains a separate architectural decision.
