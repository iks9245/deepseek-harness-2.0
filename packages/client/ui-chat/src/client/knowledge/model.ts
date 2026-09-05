/** Source-addressed excerpts and activity from resolved Chat turns; never inferred research findings. */

import type { ConversationTimelineSnapshot, TurnLocation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { extractMarkdownPlainText, extractMarkdownReferences, extractMarkdownSections, type MarkdownSection } from '@deepseek-ai/dsh-client-ui-primitives'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { TurnOutlineEntry } from '@deepseek-ai/dsh-session-turn-outline/client'
import type { AssistantChatData, ChatConversationViewNode, ChatNode } from '../contract/chat-nodes.ts'
import type { ChatSourceTarget } from '../contract/store.ts'
import type { ChatFileMentions } from '../contract/slots.ts'

/** Role of a source-backed Knowledge Card. Tool activity does not imply evidential support. */
export type KnowledgeCardKind = 'topic' | 'question' | 'answer' | 'section' | 'tool' | 'reference' | 'artifact'

/** Recorded turn outcome, or explicit absence of loaded boundary evidence. */
export type KnowledgeStatus = 'completed' | 'running' | 'error' | 'aborted' | 'blocked' | 'interrupted' | 'max-tokens' | 'unavailable'

/** One source shared by map, reading, and context surfaces. */
export interface KnowledgeCard {
  readonly id: string
  readonly kind: KnowledgeCardKind
  readonly title: string
  readonly summary: string
  readonly details: string
  readonly turn?: number
  readonly source?: ChatSourceTarget
  readonly status?: KnowledgeStatus
  readonly tool?: { readonly callId: string; readonly name: string }
  readonly path?: string
  readonly url?: string
  /** Source heading ancestry; an empty heading remains navigable. */
  readonly parentId?: string
  readonly depth?: number
}

const sectionCache = new WeakMap<object, readonly MarkdownSection[]>()

/** Structural association; no edge asserts that a tool supports a research claim. */
export interface KnowledgeEdge {
  readonly from: string
  readonly to: string
}

/** A turn's independently recorded outcome and source availability. */
export interface KnowledgeTurn {
  readonly turn: number
  readonly status: KnowledgeStatus
  readonly source: ChatSourceTarget
}

/** Loaded evidence plus whole-session navigation; unloaded previews are never summary material. */
export interface KnowledgeDocument {
  readonly title: string
  readonly cards: readonly KnowledgeCard[]
  readonly edges: readonly KnowledgeEdge[]
  readonly turns: readonly KnowledgeTurn[]
  readonly excerpts: readonly KnowledgeCard[]
  readonly incomplete: boolean
}

function preview(text: string, limit = 180): string {
  const value = text.replace(/\s+/g, ' ').trim()
  return value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`
}

function turnOf(node: ChatConversationViewNode): TurnLocation | undefined {
  const location = node.location
  return location.kind === 'turn' || location.kind === 'step' ? location.turn : undefined
}

function statusOf(turn: TurnLocation | undefined): KnowledgeStatus {
  if (turn === undefined) return 'unavailable'
  if (turn.status === 'open') return 'running'
  switch (turn.end?.data.reason.kind) {
    case 'completed': return 'completed'
    case 'error': return 'error'
    case 'aborted': return 'aborted'
    case 'blocked': return 'blocked'
    case 'interrupted': return 'interrupted'
    case 'max-tokens': return 'max-tokens'
    // TurnEndReason is merge-extensible; unknown outcomes cannot certify completion.
    default: return 'unavailable'
  }
}

function textOf(assistant: AssistantChatData): string {
  return assistant.blocks.flatMap(block => block.kind === 'text' ? [block.text] : []).join('\n\n').trim()
}

/**
 * Derive excerpts only from a completed turn's final settled, tool-free Assistant message.
 * @param outline - Whole-session navigation previews; never used as complete source text.
 * @param nodes - Loaded Chat nodes with engine-resolved Turn membership.
 * @param timeline - Loaded durable Turn boundaries and published business data.
 * @param producedFiles - Deliverables owner's successful mutation records.
 * @param historyIncomplete - Session pager still has earlier events available.
 * @returns source-addressed content, activity, outcomes, and explicit coverage limits.
 */
export function deriveKnowledgeDocument(
  outline: readonly TurnOutlineEntry[] | undefined,
  nodes: readonly ChatConversationViewNode[],
  timeline: ConversationTimelineSnapshot,
  producedFiles: ChatFileMentions['producedForTurn'],
  historyIncomplete: boolean,
): KnowledgeDocument {
  const starts = new Map((outline ?? []).map(turn => [turn.turn, turn.seq]))
  for (const turn of timeline.turns.values()) {
    if (turn.start !== undefined) starts.set(turn.turn, turn.start.seq)
  }
  const turns: KnowledgeTurn[] = [...starts].sort(([a], [b]) => a - b).map(([turn, seq]) => ({
    turn, status: statusOf(timeline.turns.get(turn)), source: { turn, turnSeq: seq, seq },
  }))
  const byTurn = new Map<number, ChatNode[]>()
  for (const node of nodes) {
    const turn = turnOf(node)?.turn
    if (turn === undefined) continue
    const entries = byTurn.get(turn) ?? []
    // The Chat registry owns the correlation between renderer kind and payload.
    entries.push(node as ChatNode)
    byTurn.set(turn, entries)
  }
  const cards: KnowledgeCard[] = []
  const edges: KnowledgeEdge[] = []
  const excerpts: KnowledgeCard[] = []
  const title = outline?.[0]?.prompt ?? ''
  if (turns.length > 0) cards.push({ id: 'topic:session', kind: 'topic', title, summary: '', details: '' })
  for (const turn of turns) {
    const entries = (byTurn.get(turn.turn) ?? []).sort((a, b) => a.anchorSeq - b.anchorSeq)
    const question = entries.find((node): node is ChatNode<'user'> => node.kind === 'user')
    const prompt = question?.data.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n\n') ?? ''
    const questionId = `turn:${String(turn.turn)}:question`
    cards.push({
      id: questionId, kind: 'question', turn: turn.turn,
      title: preview(prompt || outline?.find(item => item.turn === turn.turn)?.prompt || '', 72),
      summary: preview(prompt), details: prompt,
      source: question === undefined ? turn.source : {
        ...turn.source, seq: SessionSeq(question.data.seq), nodeKey: question.key,
      },
      status: turn.status,
    })
    edges.push({ from: 'topic:session', to: questionId })
    const assistant = entries.filter((node): node is ChatNode<'assistant-step'> => node.kind === 'assistant-step')
      .sort((a, b) => a.data.step - b.data.step).at(-1)
    const final = assistant?.data.finalNode
    const text = assistant === undefined ? '' : textOf(assistant.data)
    const lastStep = timeline.turns.get(turn.turn)?.steps.at(-1)?.step
    if (turn.status === 'completed' && assistant?.data.status === 'settled' && final !== undefined
      && assistant.data.step === lastStep && text !== ''
      && !assistant.data.blocks.some(block => block.kind === 'tool-call')) {
      const answer: KnowledgeCard = {
        id: `answer:${String(final.seq)}`, kind: 'answer', turn: turn.turn,
        title: preview(extractMarkdownPlainText(text, { mode: 'first-line' }), 72), summary: preview(extractMarkdownPlainText(text)), details: text,
        source: { ...turn.source, seq: SessionSeq(final.seq), nodeKey: assistant.key },
      }
      cards.push(answer)
      edges.push({ from: questionId, to: answer.id })
      let sections = sectionCache.get(final)
      if (sections === undefined) {
        sections = extractMarkdownSections(text)
        sectionCache.set(final, sections)
      }
      const parents: { depth: number; id: string }[] = []
      const sectionCards: KnowledgeCard[] = sections.map((section) => {
        while (parents.at(-1) !== undefined && (parents.at(-1)?.depth ?? 0) >= section.depth) parents.pop()
        const parentId = parents.at(-1)?.id ?? answer.id
        const id = `section:${String(final.seq)}:${String(section.start)}`
        parents.push({ depth: section.depth, id })
        const body = text.slice(section.bodyStart, section.end).trim()
        return {
          id, kind: 'section', turn: turn.turn, parentId, depth: section.depth,
          title: section.title, summary: preview(extractMarkdownPlainText(body)), details: text.slice(section.start, section.end).trim(),
          source: { ...turn.source, seq: SessionSeq(final.seq), nodeKey: assistant.key },
        }
      })
      cards.push(...sectionCards)
      const readable = sectionCards.filter(card => card.summary !== '')
      excerpts.push(...readable.length > 0 ? readable : [answer])
      edges.push(...sectionCards.map(card => ({ from: card.parentId ?? answer.id, to: card.id })))
      for (const { url, label } of extractMarkdownReferences(text)) {
        const id = `reference:${String(final.seq)}:${url}`
        cards.push({ id, kind: 'reference', title: label, summary: url, details: '', url, turn: turn.turn, source: { ...turn.source, seq: SessionSeq(final.seq), nodeKey: assistant.key } })
        edges.push({ from: answer.id, to: id })
      }
    }
    const tools = entries.filter((node): node is ChatNode<'tool-call'> => node.kind === 'tool-call')
    for (const node of tools) {
      const root = node.data.root
      const settled = 'kind' in root
      const name = settled ? root.call?.name ?? '' : root.name
      const card: KnowledgeCard = {
        id: `tool:${root.callId}`, kind: 'tool', title: name, summary: '', details: '', turn: turn.turn,
        status: settled ? root.isError ? 'error' : 'completed' : turn.status === 'running' ? 'running' : 'unavailable',
        tool: { callId: root.callId, name },
        source: { ...turn.source, seq: SessionSeq(node.anchorSeq), nodeKey: node.key },
      }
      cards.push(card)
      edges.push({ from: questionId, to: card.id })
    }
    const location = timeline.turns.get(turn.turn)
    for (const file of location === undefined ? [] : producedFiles(location)) {
      const owner = tools.find(node => 'kind' in node.data.root && node.data.root.seq === file.seq)
      const source = { ...turn.source, seq: SessionSeq(file.seq), ...owner === undefined ? {} : { nodeKey: owner.key } }
      const id = `artifact:${String(file.seq)}:${file.path}`
      cards.push({
        id, kind: 'artifact', title: file.path.split(/[/\\]/).at(-1) ?? file.path,
        summary: file.path, details: '', path: file.path, turn: turn.turn, source,
        ...owner === undefined ? {} : { tool: { callId: owner.data.root.callId, name: 'kind' in owner.data.root ? owner.data.root.call?.name ?? '' : owner.data.root.name } },
      })
      edges.push({ from: owner === undefined ? questionId : `tool:${owner.data.root.callId}`, to: id })
    }
  }
  return {
    title, cards, edges, turns, excerpts,
    incomplete: historyIncomplete || turns.some(turn => timeline.turns.get(turn.turn)?.start === undefined),
  }
}
