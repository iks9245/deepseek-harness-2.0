import { describe, expect, it } from 'vitest'
import { extractMarkdownSections } from '../src/markdown/sections.ts'

describe('Markdown section sources', () => {
  it('preserves offsets for ATX and setext headings while leaving fenced and quoted headings inside their section', () => {
    const text = 'Introduction\n\n# 記憶 Memory\n\nEvidence.\n\n```md\n# Code heading\n```\n\n> ## Quoted heading\n\nAttention\n---------\n\nFinal evidence.'
    const sections = extractMarkdownSections(text)
    expect(sections.map(section => section.title)).toEqual(['記憶 Memory', 'Attention'])
    expect(text.slice(sections[0]!.start, sections[0]!.end)).toContain('# Code heading')
    expect(text.slice(sections[1]!.bodyStart, sections[1]!.end).trim()).toBe('Final evidence.')
  })

  it('leaves untitled and empty text without invented sections', () => {
    expect(extractMarkdownSections('A complete answer without headings.')).toEqual([])
    expect(extractMarkdownSections('')).toEqual([])
  })
})
