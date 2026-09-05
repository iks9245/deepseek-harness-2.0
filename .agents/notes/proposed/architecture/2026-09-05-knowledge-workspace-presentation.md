# Agent Note: Knowledge Workspace presentation

Status: proposed

English | [中文](2026-09-05-knowledge-workspace-presentation.zh.md)

## Problem

The Web client gives a Session one linear Chat view. `ChatSnapshot` orders nodes for scrolling, `AppFrame` gives the user a global sidebar, center column, and tool-details column, and the right column has no useful default when no tool call is selected.

Large assistant answers therefore make their structure discoverable only by reading. A user cannot first see the answer's main claims, decisions, actions, risks, or references; return to one section without losing context; or compare a tool result with the claim that used it.

## Proposal

The loaded-window implementation follows the [source-provenance decision](../../implemented/architecture/2026-09-05-knowledge-source-provenance.md). The full-history projection and structured summaries below remain proposed.

The Web client gains a Knowledge Workspace Conversation View. It projects a Session into a `KnowledgeDocument` whose sections, cards, relationships, summaries, actions, risks, and references have stable opaque identifiers.

The presentation consumes this model in three coordinated regions: a `sidebar.knowledge` navigator lists the expandable section tree and jumps to card identifiers; the center renders summary-first cards with detail disclosure and reading progress; and a general details host renders the executive summary, selected-card context, and saved bookmarks. The current tool inspector becomes one details-host contributor instead of owning the entire right column, while [Client Tool presentation ownership](../../implemented/architecture/2026-08-08-client-tool-presentation-ownership.md) continues to own its Tool-specific rendering.

The Conversation View roster also includes a graph view. It renders questions, answer sections, tool calls, artifacts, and references as linked nodes, while selection routes back to the same card identifier in the workspace. The graph is navigation, not a second transcript.

`KnowledgeDocument` is host-derived and transported through the existing Session projection mechanism. A deterministic first extractor reads durable assistant Markdown headings, lists, links, tool references, and turn boundaries. It produces an outline immediately, does not request another model call, and marks unavailable fields as absent. A later structured summarizer records a versioned `knowledge/document` Session event after an assistant message settles; it supplies concise executive findings, decisions, action items, risks, and card abstracts without replacing the original answer.

Reading state stays browser-local: expanded cards, focused section, scroll progress, and bookmarks are keyed by the durable card identifier. The view restores a reader's place without making private reading gestures Session facts. A bookmark label may later become an explicit durable user artifact, but it is not implied by the first implementation.

Every workspace control, empty state, disclosure label, and presentation-owned error follows [locale-owned client UI copy](../../implemented/architecture/2026-08-23-locale-owned-client-ui-copy.md). Provider and tool payloads remain factual detail beneath localized product chrome.

## Component topology

`dsh-knowledge-presentation` defines the projection DTO, markdown extractor, graph links, and client type outlet. Its host provider registers the Session projection; its Web consumer owns the `KnowledgeDocument` selector and never folds Session events in the browser.

`dsh-client-ui-knowledge-workspace` registers the Conversation Views, the navigator slot, and the details-host contributors. `ui-layout` owns the neutral details host and selection state; `ui-chat` supplies the current tool inspector as one contributor. `ui-sidebar` declares `sidebar.knowledge` so the workspace navigator composes beside workspace/session browsing instead of replacing it.

## Delivery plan

1. Introduce the typed `KnowledgeDocument` projection and deterministic extractor with fixture-driven host and client tests.
2. Generalize the right column into a details host, preserve the tool inspector, and add the localized executive summary contributor.
3. Add the navigator and card reader as the Knowledge Workspace Conversation View, including jump, collapse, focus, progress, and local bookmark behavior.
4. Add the graph Conversation View using the same identifiers and navigation callbacks.
5. Add the structured summary producer, its durable event, version migration policy, and snapshots that prove a reopened Session reconstructs the same knowledge map.

## Alternatives considered

**A CSS-only restyle of ChatView** — rejected: narrower bubbles and collapsible Markdown do not create a shared identifier model, a navigator, an executive summary, or a graph, so the user still has to discover the answer by scrolling.

**Browser-only DOM parsing** — rejected: mounted rows are paged and virtualized, refresh loses the result, and the graph would disagree with a compact transcript. The host projection supplies one replayable model to every client region.

**A second model request for every response from the first release** — rejected: it adds latency, cost, and another failure path before the workspace can offer basic navigation. The deterministic extractor gives headings and references immediately; structured summaries remain an explicit later producer.

**Replacing the chat transcript** — rejected: the original message, live streaming behavior, and tool chronology remain essential evidence. The workspace is a selected Conversation View over the same Session, not a lossy conversion.

**Persisting every reader interaction** — rejected: scroll position and disclosure state are private, high-frequency preferences. Only a deliberate future bookmark artifact merits durable collaboration semantics.

## Acceptance criteria

- A Session with a long Markdown answer opens a Knowledge Workspace view that exposes a topic tree, executive summary area, cards, references, and a graph entry point before the reader traverses the full transcript.
- Selecting a navigator item or graph node focuses the same card in the center column without replacing the Session or losing the original transcript.
- Tool inspectors, summary context, and bookmarks coexist in the right column through independently registered contributors.
- A reload reconstructs the same projected document from durable Session material; browser-local reading preferences restore only for the current browser user.
- The Web profile has localized English, Simplified Chinese, and Traditional Chinese copy for every new product string.
- Focused projection, client GUI, recorded-session, and accessibility tests prove the normal, empty, unavailable-summary, and long-answer paths.

## Risks

- Markdown headings are absent or inconsistent in some answers. The first extractor must produce a single untitled card and clearly mark unavailable summary fields rather than inventing structure.
- A structured summary can be stale if an assistant answer is edited or retried. Its event must name the source assistant settlement and the consumer must reject a mismatched source identifier.
- A graph can become dense. It must default to section-level nodes, collapse tool-call groups, and provide the same navigator focus route instead of asking users to pan through every event.
- Moving the details host changes a shared slot contract. The migration must keep the current tool-details behavior rendered and covered before the knowledge contributor is enabled.
