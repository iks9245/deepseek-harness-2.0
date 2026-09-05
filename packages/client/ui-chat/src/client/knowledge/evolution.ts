/** Source-text comparisons across completed turns; semantic relations require review. */
import type { KnowledgeCard, KnowledgeDocument } from './model.ts'

/** A comparison records both sources; missing text in a later answer does not imply retraction. */
export interface KnowledgeChange {
  readonly kind: 'added' | 'changed' | 'unchanged' | 'not-repeated'
  readonly before?: KnowledgeCard
  readonly after?: KnowledgeCard
}

/** Completed-answer comparison with explicit availability. */
export interface KnowledgeEvolution {
  readonly state: 'available' | 'partial' | 'baseline' | 'unfinished'
  readonly beforeTurn?: number
  readonly afterTurn?: number
  readonly changes: readonly KnowledgeChange[]
}

function comparable(document: KnowledgeDocument, turn: number): readonly KnowledgeCard[] {
  return document.excerpts.filter(card => card.turn === turn)
}

function identity(card: KnowledgeCard, cards: readonly KnowledgeCard[]): string {
  if (card.kind === 'answer') return 'answer'
  const parents: string[] = []
  let parent = cards.find(candidate => candidate.id === card.parentId)
  while (parent?.kind === 'section') {
    if (parent.depth !== 1) parents.unshift(parent.title.trim())
    parent = cards.find(candidate => candidate.id === parent?.parentId)
  }
  // The document title may change independently; nested section ancestry disambiguates repeated headings.
  return JSON.stringify([...parents, card.title.trim()])
}

/**
 * Compare the latest completed answer with its preceding completed answer by exact heading ancestry.
 * @param document - Source-addressed loaded material and whole-session outcome coverage.
 * @returns added, changed, identical, or omitted excerpts, never inferred agreement or refutation.
 */
export function deriveKnowledgeEvolution(document: KnowledgeDocument): KnowledgeEvolution {
  const latest = document.turns.at(-1)
  if (latest?.status !== 'completed') return { state: 'unfinished', changes: [] }
  if (document.incomplete) return { state: 'partial', changes: [] }
  const completed = document.turns.filter(turn => turn.status === 'completed' && comparable(document, turn.turn).length > 0)
  const afterTurn = completed.at(-1)?.turn
  const beforeTurn = completed.at(-2)?.turn
  if (afterTurn !== latest.turn || beforeTurn === undefined) return { state: 'baseline', changes: [] }
  const before = comparable(document, beforeTurn)
  const after = comparable(document, afterTurn)
  const candidates = new Map<string, KnowledgeCard[]>()
  for (const card of before) {
    const key = identity(card, document.cards)
    const group = candidates.get(key) ?? []
    group.push(card)
    candidates.set(key, group)
  }
  const used = new Set<string>()
  const changes: KnowledgeChange[] = after.map((card) => {
    const group = candidates.get(identity(card, document.cards)) ?? []
    // Repeated headings are ambiguous: preserve both sources as unmatched rather than guessing.
    const matches = after.filter(other => identity(other, document.cards) === identity(card, document.cards))
    const previous = group.length === 1 && matches.length === 1 ? group[0] : undefined
    if (previous === undefined) return { kind: 'added', after: card }
    used.add(previous.id)
    return { kind: previous.details === card.details ? 'unchanged' : 'changed', before: previous, after: card }
  })
  for (const card of before) if (!used.has(card.id)) changes.push({ kind: 'not-repeated', before: card })
  return { state: 'available', beforeTurn, afterTurn, changes }
}
