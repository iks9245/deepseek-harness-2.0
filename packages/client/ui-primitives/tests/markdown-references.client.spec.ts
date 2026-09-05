import { describe, expect, it } from 'vitest'
import { extractMarkdownReferences } from '../src/markdown/references.ts'

describe('Markdown source references', () => {
  it('resolves inline, reference-style, and automatic links while excluding literal code and images', () => {
    const text = [
      '[**Evidence**][REF]', '[again](https://example.test/evidence)', '<https://example.test/auto>',
      '`[inline](https://example.test/inline)`', '```md\n[fenced](https://example.test/fenced)\n```',
      '![image](https://example.test/image)', '[mail](mailto:author@example.test)', '[unresolved][missing]',
      '[ref]: https://example.test/evidence', '[ref]: https://example.test/duplicate', '[unused]: https://example.test/unused',
    ].join('\n\n')
    expect(extractMarkdownReferences(text)).toEqual([
      { label: 'Evidence', url: 'https://example.test/evidence' },
      { label: 'https://example.test/auto', url: 'https://example.test/auto' },
    ])
  })

  it('keeps nested link labels and HTTP links without descriptive labels', () => {
    expect(extractMarkdownReferences('- [![figure](image.png)](https://example.test/figure)\n\n[](http://example.test)')).toEqual([
      { label: 'figure', url: 'https://example.test/figure' },
      { label: 'http://example.test', url: 'http://example.test' },
    ])
  })
})
