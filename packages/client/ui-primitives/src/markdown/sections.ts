/** Source ranges for real Markdown headings, using the renderer's grammar. */
import { parseGfm } from './parse.ts'
import { extractMarkdownPlainText } from './plain-text.ts'

/** One non-overlapping section, addressed by offsets in the original Markdown. */
export interface MarkdownSection {
  readonly title: string
  readonly start: number
  readonly bodyStart: number
  readonly end: number
}

/**
 * Locate top-level Markdown headings without interpreting code or quoted headings as sections.
 * @param text - Complete, settled Markdown source.
 * @returns heading ranges through the next heading or document end; untitled text remains outside sections.
 */
export function extractMarkdownSections(text: string): readonly MarkdownSection[] {
  const headings = parseGfm(text).children.flatMap((node) => {
    if (node.type !== 'heading') return []
    const start = node.position?.start.offset
    const bodyStart = node.position?.end.offset
    /* v8 ignore next 3 -- the renderer grammar stamps offsets on every heading. */
    if (start === undefined || bodyStart === undefined) {
      throw new Error('Markdown heading has no source offsets')
    }
    return [{ title: extractMarkdownPlainText(text.slice(start, bodyStart)), start, bodyStart }]
  })
  return headings.map((heading, index) => ({ ...heading, end: headings[index + 1]?.start ?? text.length }))
}
