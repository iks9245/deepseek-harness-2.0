# Agent Note: Traditional Chinese in the Web locale catalog

Status: implemented

English | [中文](2026-09-05-traditional-chinese-web-locale.zh.md)

## Problem

The Web client shipped only Simplified Chinese under `zh` and English. A reader who uses Traditional Chinese could not choose a fully translated interface, and `zh-Hant` browser preferences resolved to Simplified Chinese through primary-subtag matching.

## Decision

**The built-in catalog contains `zh`, `zh-TW`, and `en`.** `zh` remains Simplified Chinese for stored preferences and browser matches. `zh-TW` supplies Taiwan-oriented Traditional Chinese dictionaries in every built-in namespace, appears as 繁體中文 in Settings, persists through the existing `locale.preference` field, and sets `<html lang="zh-TW">`.

**Chinese script matching recognizes Traditional Chinese.** Exact locale ids still win. A `zh-Hant` or `zh-TW` browser tag selects `zh-TW`; other Chinese tags retain the existing `zh` primary-subtag resolution.

**Product error chrome is translated while diagnostic data stays verbatim.** Dictionary-owned failure labels and actions render in the selected language. Provider, operating-system, and wire messages remain visible as details because translating them would alter evidence used for diagnosis.

This supersedes the two-language built-in-catalog fact in the [full client locale rollout](../architecture/2026-07-30-client-locale-full-rollout.md) and the Traditional-Chinese browser-match fact in the [browser-derived initial locale](2026-07-31-browser-derived-initial-locale.md).

## Alternatives considered

**Replace `zh` with Traditional Chinese.** Rejected because it changes existing explicit preferences and makes Simplified Chinese unavailable.

**Translate provider and wire error details.** Rejected because those strings are diagnostic data rather than product copy; surrounding UI wording supplies the localized context.

## Consequences

- Typed namespace registrations require dictionaries for all three built-in ids, so a missing Traditional Chinese namespace fails typechecking.
- Existing `zh` and `en` selections remain compatible; the new id is opt-in or chosen by an explicitly Traditional-Chinese browser tag.
- Locale tests pin catalog contents, document language, persistence, and Traditional-Chinese browser detection.
