/** One coordinate system for knowledge cards and their structural connectors. */
import type { KnowledgeCard, KnowledgeDocument, KnowledgeEdge } from './model.ts'

/** Fixed card rectangles keep connectors on their recorded endpoints at every zoom. */
export interface KnowledgeGraphNode {
  readonly card: KnowledgeCard
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Complete layout of the selected source scope. */
export interface KnowledgeGraph {
  readonly nodes: readonly KnowledgeGraphNode[]
  readonly edges: readonly { readonly edge: KnowledgeEdge; readonly path: string }[]
  readonly width: number
  readonly height: number
  readonly hiddenTools: number
}

/**
 * Lay out every card in source order with indented, non-overlapping rows.
 * @param document - Source cards and structural associations.
 * @param showTools - Include individually recorded tool activity.
 * @returns shared rectangles and connector paths; omitted activity is counted explicitly.
 */
export function layoutKnowledgeGraph(document: KnowledgeDocument, showTools: boolean): KnowledgeGraph {
  const cards = document.cards.filter(card => showTools || card.kind !== 'tool')
  const visible = new Set(cards.map(card => card.id))
  const parent = new Map(document.edges.filter(edge => visible.has(edge.from) && visible.has(edge.to)).map(edge => [edge.to, edge.from]))
  const depth = new Map<string, number>()
  const nodes = cards.map((card, index) => {
    const level = (depth.get(parent.get(card.id) ?? '') ?? -1) + 1
    depth.set(card.id, level)
    return { card, x: 24 + level * 24, y: 24 + index * 144, width: 252, height: 112 }
  })
  const positions = new Map(nodes.map(node => [node.card.id, node]))
  const edges = document.edges.flatMap((edge) => {
    const from = positions.get(edge.from)
    const to = positions.get(edge.to)
    if (from === undefined || to === undefined) return []
    const x1 = from.x
    const y1 = from.y + from.height / 2
    const y2 = to.y + to.height / 2
    return [{ edge, path: `M ${x1} ${y1} H ${x1 - 12} V ${y2} H ${to.x}` }]
  })
  return {
    nodes, edges,
    width: Math.max(320, ...nodes.map(node => node.x + node.width + 24)),
    height: Math.max(160, nodes.length * 144 + 16),
    hiddenTools: document.cards.length - cards.length,
  }
}
