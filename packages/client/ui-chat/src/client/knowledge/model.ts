/** Deterministic Knowledge Workspace projection from the existing Chat read models. */

import type { TurnOutlineEntry } from '@deepseek-ai/dsh-session-turn-outline/client'
import type { ChatConversationViewNode } from '../contract/chat-nodes.ts'

/** Semantic role of one Knowledge Card. */
export type KnowledgeCardKind = 'topic' | 'question' | 'answer' | 'tool' | 'reference'

/** One navigable unit shared by map, reading, and summary surfaces. */
export interface KnowledgeCard {
  readonly id: string
  readonly kind: KnowledgeCardKind
  readonly title: string
  readonly summary: string
  readonly details: string
  readonly turn?: number
}

/** Directed relationship rendered by the Conversation Graph. */
export interface KnowledgeEdge {
  readonly from: string
  readonly to: string
}

/** Complete client-facing Knowledge Workspace document. */
export interface KnowledgeDocument {
  readonly title: string
  readonly cards: readonly KnowledgeCard[]
  readonly edges: readonly KnowledgeEdge[]
  readonly findings: readonly string[]
  readonly decisions: readonly string[]
  readonly actions: readonly string[]
  readonly risks: readonly string[]
}

const EMPTY_DOCUMENT: KnowledgeDocument = {
  title: '', cards: [], edges: [], findings: [], decisions: [], actions: [], risks: [],
}

function compact(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`#>*_~|[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function preview(text: string, limit = 150): string {
  const value = compact(text)
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function firstSentence(text: string): string {
  const value = compact(text)
  const end = value.search(/[。！？.!?](?:\s|$)/)
  return preview(end < 0 ? value : value.slice(0, end + 1))
}

function candidateLines(text: string): readonly string[] {
  return text
    .split(/\r?\n/)
    .map(line => compact(line.replace(/^\s*(?:[-*+] |\d+[.)]\s+|\[[ xX]\]\s*)/, '')))
    .filter(line => line.length >= 8)
}

function matchingLines(responses: readonly string[], pattern: RegExp): readonly string[] {
  const unique = new Set<string>()
  for (const response of responses) {
    for (const line of candidateLines(response)) {
      if (pattern.test(line)) unique.add(preview(line, 180))
      if (unique.size >= 4) return [...unique]
    }
  }
  return [...unique]
}

function references(text: string): readonly { title: string; url: string }[] {
  const found = new Map<string, string>()
  for (const match of text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
    const [, label = '', url = ''] = match
    if (url !== '') found.set(url, compact(label) || url)
  }
  for (const match of text.matchAll(/https?:\/\/[^\s)>\]]+/g)) {
    const url = match[0].replace(/[.,;:!?]+$/, '')
    if (url !== '' && !found.has(url)) found.set(url, url)
  }
  return [...found].slice(0, 6).map(([url, referenceTitle]) => ({ title: referenceTitle, url }))
}

function toolName(node: ChatConversationViewNode): string | undefined {
  if (node.kind !== 'tool-call') return undefined
  const data = node.data as { readonly root?: { readonly name?: string; readonly call?: { readonly name?: string } } }
  return data.root?.name ?? data.root?.call?.name
}

function assistantText(node: ChatConversationViewNode): { turn: number; text: string } | undefined {
  if (node.kind !== 'assistant') return undefined
  const data = node.data as {
    readonly turn?: number
    readonly blocks?: readonly { readonly kind?: string; readonly text?: string }[]
  }
  if (data.turn === undefined) return undefined
  const text = data.blocks
    ?.filter(block => block.kind === 'text' && block.text !== undefined)
    .map(block => block.text ?? '')
    .join('\n\n')
    .trim() ?? ''
  return text === '' ? undefined : { turn: data.turn, text }
}

/**
 * Project a navigable document from the full-session turn outline and loaded tool nodes.
 * @param outline - Host-computed whole-session prompts and final-response previews.
 * @param nodes - Currently loaded Chat nodes, used for tool and reference cards.
 * @returns a stable-id document suitable for all Knowledge Workspace surfaces.
 */
export function deriveKnowledgeDocument(
  outline: readonly TurnOutlineEntry[] | undefined,
  nodes: readonly ChatConversationViewNode[],
): KnowledgeDocument {
  if ((outline?.length ?? 0) === 0 && nodes.length === 0) return EMPTY_DOCUMENT

  const loadedResponses = new Map<number, string>()
  for (const node of nodes) {
    const assistant = assistantText(node)
    if (assistant !== undefined) loadedResponses.set(assistant.turn, assistant.text)
  }
  const turns = (outline ?? []).map(turn => ({
    ...turn,
    response: loadedResponses.get(turn.turn) ?? turn.response,
  }))
  const title = preview(turns[0]?.prompt ?? '', 72)
  const cards: KnowledgeCard[] = []
  const edges: KnowledgeEdge[] = []
  const topicId = 'topic:session'
  cards.push({
    id: topicId,
    kind: 'topic',
    title,
    summary: preview(turns.at(-1)?.response ?? turns[0]?.prompt ?? '', 180),
    details: turns.map(turn => turn.response).filter(Boolean).join('\n\n'),
  })

  for (const turn of turns) {
    const questionId = `turn:${String(turn.turn)}:question`
    const answerId = `turn:${String(turn.turn)}:answer`
    cards.push({
      id: questionId,
      kind: 'question',
      title: preview(turn.prompt, 64),
      summary: preview(turn.prompt),
      details: turn.prompt,
      turn: turn.turn,
    })
    cards.push({
      id: answerId,
      kind: 'answer',
      title: firstSentence(turn.response),
      summary: preview(turn.response),
      details: turn.response,
      turn: turn.turn,
    })
    edges.push({ from: topicId, to: questionId }, { from: questionId, to: answerId })
    for (const [index, reference] of references(turn.response).entries()) {
      const referenceId = `reference:${String(turn.turn)}:${String(index)}`
      cards.push({
        id: referenceId,
        kind: 'reference',
        title: reference.title,
        summary: reference.url,
        details: reference.url,
        turn: turn.turn,
      })
      edges.push({ from: answerId, to: referenceId })
    }
  }

  let toolIndex = 0
  for (const node of nodes) {
    const name = toolName(node)
    if (name === undefined) continue
    const id = `tool:${node.key}`
    cards.push({
      id,
      kind: 'tool',
      title: name,
      summary: name,
      details: node.key,
    })
    const owner = turns[toolIndex % Math.max(1, turns.length)]
    edges.push({ from: owner === undefined ? topicId : `turn:${String(owner.turn)}:answer`, to: id })
    toolIndex += 1
    if (toolIndex >= 6) break
  }

  const responses = turns.map(turn => turn.response).filter(Boolean)
  const findings = responses.map(firstSentence).filter(Boolean).slice(-4).reverse()
  const decisions = matchingLines(responses, /\b(?:decid(?:e|ed|ing)|decision|chosen|selected)\b|決定|採用|选择|選擇/i)
  const actions = matchingLines(responses, /\b(?:todo|next|action|implement|create|update|fix|ship)\b|下一步|接著|需要|實作|实现|建立|修正/i)
  const risks = matchingLines(responses, /\b(?:risk|warning|blocked|failure|caution|breaking)\b|風險|风险|警告|注意|阻塞|失敗|失败/i)

  return { title, cards, edges, findings, decisions, actions, risks }
}
