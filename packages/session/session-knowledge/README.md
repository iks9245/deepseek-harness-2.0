---
description: "Manually organize completed research answers into a saved, cited knowledge map with bounded LLM usage."
kind: "package-reference"
---

# @deepseek-ai/dsh-session-knowledge

English | [中文](README.zh.md)

## Summary

Organize a research conversation into concise subjects, claims, open questions, and limitations. Each point and proposed relationship includes a quotation from a recorded answer. Organization requires an explicit command, consumes an auxiliary model request, and preserves the original conversation and last successful map when generation fails.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Web bundle mounts this plugin alongside the command, LLM, Session, and projection services. The knowledge workspace dispatches `/knowledge-organize`; `/knowledge-cancel` aborts and drains that Session's active organization. Organization requires an idle agent and uses its selected provider/model, falling back to the last logged request route. It does not enqueue a research turn.

### Configuration

All fields are required; the Web bundle supplies deployment values in its [patch](../../bundle/web-app/cordis.patch.yml).

| Field | Default | Meaning |
|---|---|---|
| `maxInputBytes` | required | UTF-8 ceiling for the complete logged request; excess rejects without dropping sources |
| `maxOutputBytes` | required | UTF-8 ceilings for accumulated text/reasoning and the complete saved result |
| `maxOutputTokens` | required | Provider output-token limit |
| `maxGroups` | required | Maximum distinct subjects |
| `maxNodes` | required | Maximum knowledge points |
| `maxRelations` | required | Maximum proposed relationships; zero forbids relationships |
| `timeoutMs` | required | Cooperative request deadline in milliseconds |

The [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-session-knowledge) owns Loader validation details.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The source collector reads each completed turn's last tool-free answer from the full Session log. Maintenance ownership excludes concurrent agent work. Exact input is appended and flushed before model dispatch; successful JSON is checked for graph bounds, unique node IDs, valid relation endpoints, and exact source quotations before publication. Failure publishes no replacement. Disposal aborts and drains active operations.

The `knowledge` projection exposes the latest validated document and a stale flag after later user or assistant messages. Source targets retain answer seq, turn number, and turn/start seq; browser pagination cannot alter them. Raw model JSON remains in the durable result for replay and is excluded from the wire projection. [Shared types](src/types.ts) own the stored document and citation fields; the [decision](../../../.agents/notes/implemented/feature/2026-09-05-manual-knowledge-organization.md) owns the evidence policy.

</details>

-----

<a id="model-experience"></a>
## Model Experience

### Auxiliary knowledge request

#### What the model sees

The fixed [organizer instruction](src/organize.ts) requests concise JSON in the research language, treats sources as data, and requires verbatim evidence. One user message contains configured graph limits and every eligible answer's exact text, human question, and source identities. No tools are supplied.

#### Token effect

Each explicit organization sends the complete eligible source set and consumes output tokens up to `maxOutputTokens`. Byte limits reject excess input or output; they do not silently clip research. The auxiliary result is excluded from normal conversational model history.

#### KV Cache effect

The main conversation prompt is unchanged. Auxiliary cache reuse depends on the provider; the fixed instruction can remain reusable while source JSON changes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits distinguish readable organization from verified research.

- **Quotations do not prove interpretation** — exact quotation matching verifies provenance, not entailment, completeness, or the truth of a proposed relationship. The UI labels relationships for review.
- **Completed text answers only** — open or failed turns, reasoning, tool outputs, files, and images are excluded.
- **One bounded request** — oversized research fails explicitly; hierarchical multi-request processing is not provided.
- **Manual refresh** — later conversation input marks the saved map stale; generation never runs automatically.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. One validated result owns the map; source and relationship checks run before publication, and the projection registry validates saved and wire values. Agent maintenance owns admission and cancellation; this plugin's operation registry only addresses cancellation and drains owned requests.
