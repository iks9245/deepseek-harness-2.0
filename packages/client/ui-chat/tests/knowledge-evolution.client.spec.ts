import { describe, expect, it } from 'vitest'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { KnowledgeCard, KnowledgeDocument } from '../src/client/knowledge/model.ts'
import { deriveKnowledgeEvolution } from '../src/client/knowledge/evolution.ts'
import { layoutKnowledgeGraph } from '../src/client/knowledge/graph.ts'

function card(turn: number, title: string, details: string): KnowledgeCard {
  return { id: `${String(turn)}:${title}`, kind: 'section', title, details, summary: details, turn,
    source: { turn, turnSeq: SessionSeq(turn * 100), seq: SessionSeq(turn * 100 + 20) } }
}
function document(cards: KnowledgeCard[]): KnowledgeDocument {
  return { title: 'Research', cards, edges: [], excerpts: cards, incomplete: false,
    turns: [1, 2].map(turn => ({ turn, status: 'completed', source: { turn, turnSeq: SessionSeq(turn * 100), seq: SessionSeq(turn * 100) } })) }
}

describe('source comparison', () => {
  it('pairs both sources of corrections and refutations without asserting their meaning', () => {
    const before = card(1, 'Memory', 'The effect is positive.')
    const after = card(2, 'Memory', 'Correction: the effect is negative under overload.')
    const result = deriveKnowledgeEvolution(document([before, card(1, 'Omitted', 'Not withdrawn.'), after, card(2, 'Attention', 'New evidence.')]))
    expect(result).toMatchObject({ state: 'available', beforeTurn: 1, afterTurn: 2 })
    expect(result.changes).toEqual([
      { kind: 'changed', before, after },
      { kind: 'added', after: card(2, 'Attention', 'New evidence.') },
      { kind: 'not-repeated', before: card(1, 'Omitted', 'Not withdrawn.') },
    ])
  })
  it('does not invent an insight for identical source text or incomplete history', () => {
    const source = document([card(1, 'Memory', 'Same text.'), card(2, 'Memory', 'Same text.')])
    expect(deriveKnowledgeEvolution(source).changes.map(change => change.kind)).toEqual(['unchanged'])
    expect(deriveKnowledgeEvolution({ ...source, incomplete: true })).toEqual({ state: 'partial', changes: [] })
    expect(deriveKnowledgeEvolution({ ...source, turns: [source.turns[0]!] }).state).toBe('baseline')
    expect(deriveKnowledgeEvolution({ ...source, turns: [] }).state).toBe('unfinished')
  })
  it('does not guess between duplicate headings and keeps distinct ancestry', () => {
    const parent = { ...card(1, 'Scope', ''), depth: 2 }
    const nested = { ...card(1, 'Memory', 'Earlier'), parentId: parent.id }
    const duplicate = { ...card(1, 'Memory', 'Other'), id: 'duplicate' }
    const source = document([parent, nested, duplicate, card(2, 'Memory', 'Other')])
    expect(deriveKnowledgeEvolution(source).changes[0]?.kind).toBe('unchanged')
    const ambiguous = document([nested, duplicate, card(2, 'Memory', 'Later')])
    expect(deriveKnowledgeEvolution(ambiguous).changes[0]?.kind).toBe('added')
  })
})

describe('complete graph layout', () => {
  it.each([10, 50, 200])('lays out %i cards without overlap or unaddressed endpoints', (count) => {
    const cards = Array.from({ length: count }, (_, index) => card(1, `Section ${String(index)}`, 'Evidence'))
    const source = { ...document(cards), edges: cards.slice(1).map(item => ({ from: cards[0]!.id, to: item.id })) }
    const graph = layoutKnowledgeGraph(source, false)
    expect(graph.nodes).toHaveLength(count)
    expect(graph.edges).toHaveLength(count - 1)
    for (const node of graph.nodes) {
      expect(node.x + node.width).toBeLessThanOrEqual(graph.width)
      expect(node.y + node.height).toBeLessThanOrEqual(graph.height)
      for (const other of graph.nodes) {
        if (node === other) continue
        expect(node.x + node.width <= other.x || other.x + other.width <= node.x
          || node.y + node.height <= other.y || other.y + other.height <= node.y).toBe(true)
      }
    }
    for (const { edge, path } of graph.edges) {
      const from = graph.nodes.find(node => node.card.id === edge.from)!
      const to = graph.nodes.find(node => node.card.id === edge.to)!
      expect(path.startsWith(`M ${String(from.x)} ${String(from.y + from.height / 2)}`)).toBe(true)
      expect(path.endsWith(`V ${String(to.y + to.height / 2)} H ${String(to.x)}`)).toBe(true)
    }
  })
  it('counts hidden tool activity and removes only its incident connectors', () => {
    const section = card(1, 'Memory', 'Evidence')
    const tool = { ...card(1, 'write', ''), kind: 'tool' as const }
    const source = { ...document([section, tool]), edges: [{ from: section.id, to: tool.id }] }
    expect(layoutKnowledgeGraph(source, false)).toMatchObject({ hiddenTools: 1, edges: [] })
    expect(layoutKnowledgeGraph(source, true)).toMatchObject({ hiddenTools: 0, nodes: [{ card: section }, { card: tool }] })
  })
})
