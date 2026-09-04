import { describe, expect, it } from 'vitest'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { ChatConversationViewNode } from '../src/client/contract/chat-nodes.ts'
import { deriveKnowledgeDocument } from '../src/client/knowledge/model.ts'

describe('deriveKnowledgeDocument', () => {
  it('projects stable question, answer, tool, and summary facts', () => {
    const nodes = [
      {
        key: 'assistant:1', kind: 'assistant', data: {
          turn: 1,
          blocks: [{ kind: 'text', text: 'Decision: adopt the map-first layout.\nNext: implement reading cards.\nRisk: dense graphs can overwhelm readers.\nSee [implementation notes](https://example.test/notes).' }],
        },
      },
      {
        key: 'tool:1', kind: 'tool-call', data: { root: { name: 'read' } },
      },
    ] as unknown as readonly ChatConversationViewNode[]

    const document = deriveKnowledgeDocument([
      { turn: 1, seq: SessionSeq(1), prompt: 'How should the workspace work?', response: 'bounded preview' },
    ], nodes)

    expect(document.cards.map(card => [card.id, card.kind])).toEqual([
      ['topic:session', 'topic'],
      ['turn:1:question', 'question'],
      ['turn:1:answer', 'answer'],
      ['reference:1:0', 'reference'],
      ['tool:tool:1', 'tool'],
    ])
    expect(document.cards[2]?.details).toContain('map-first layout')
    expect(document.edges).toContainEqual({ from: 'turn:1:answer', to: 'tool:tool:1' })
    expect(document.edges).toContainEqual({ from: 'turn:1:answer', to: 'reference:1:0' })
    expect(document.cards[3]).toMatchObject({ title: 'implementation notes', summary: 'https://example.test/notes' })
    expect(document.decisions).toEqual(['Decision: adopt the map-first layout.'])
    expect(document.actions).toEqual(['Next: implement reading cards.'])
    expect(document.risks).toEqual(['Risk: dense graphs can overwhelm readers.'])
  })

  it('returns the shared empty document without an outline or loaded nodes', () => {
    expect(deriveKnowledgeDocument(undefined, []).cards).toEqual([])
  })
})
