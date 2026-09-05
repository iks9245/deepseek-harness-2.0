import { describe, expect, it } from 'vitest'
import { ConversationNodeAssembler } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import { SessionSeq, type SessionEvent } from '@deepseek-ai/dsh-session/types'
import { deriveKnowledgeDocument } from '../src/client/knowledge/model.ts'
import type { ChatSnapshot } from '../src/client/contract/snapshot.ts'
import { assistantDefinition } from '../src/client/conversation-nodes/assistant.ts'
import { messageDefinition } from '../src/client/conversation-nodes/message.ts'
import { toolDefinition } from '../src/client/conversation-nodes/tool.ts'
import { chatViewDefinition } from '../src/client/conversation-nodes/chat-snapshot-builder.ts'
import { deliverablesDefinition } from '../../ui-deliverables/src/client/turn-deliverables.ts'

function eventsFor(turn: number, reason = 'completed', answer = '## Research\n\nA recorded conclusion.\n\n[Source](https://example.test/source)'): SessionEventLikeEntry[] {
  const base = turn * 20
  const callId = `call-${turn}`
  const data: [string, unknown][] = [
    ['turn/start', { turn }],
    ['user/message', { id: `user-${turn}`, role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: `Research question ${turn}` }] }],
    ['step/start', { turn, step: 1 }],
    ['tool/call', { turn, step: 1, callId, name: 'write', arguments: '{"file_path":"report.md","content":"Recorded report"}' }],
    ['tool/result', { turn, step: 1, message: { id: `result-${turn}`, role: 'user', source: { kind: 'tool', callId }, content: [{ type: 'tool-result', toolCallId: callId, content: [{ type: 'text', text: 'Written' }], isError: false }] } }],
    ['step/end', { turn, step: 1 }],
    ['step/start', { turn, step: 2 }],
    ['assistant/message', { turn, step: 2, stream: [], message: { id: `answer-${turn}`, role: 'assistant', source: { kind: 'model', provider: 'fake', model: 'fake' }, content: [{ type: 'text', text: answer }] } }],
    ['step/end', { turn, step: 2 }],
    ['turn/end', { turn, reason: { kind: reason, ...reason === 'error' ? { error: { code: 'UNKNOWN', message: 'Write failed' } } : {} } }],
  ]
  return data.map(([type, payload], index) => ({
    type: 'event', event: { type, data: payload, seq: base + index, time: base + index, ...['user/message', 'assistant/message', 'tool/result'].includes(type) ? { surfaceOp: 'append' } : {} } as unknown as SessionEvent,
  }))
}

function assemble(entries: readonly SessionEventLikeEntry[], incomplete = false) {
  const assembler = new ConversationNodeAssembler({
    entries: () => [messageDefinition, assistantDefinition, toolDefinition, deliverablesDefinition],
    fallbackEntry: () => undefined,
  }, { entries: () => [chatViewDefinition] })
  assembler.replaceWindow(entries, incomplete)
  assembler.activateTarget('chat')
  const read = () => {
    const snapshot = assembler.snapshot('chat') as ChatSnapshot
    return deriveKnowledgeDocument([
      { turn: 1, seq: SessionSeq(20), prompt: 'Research question 1', response: 'A misleading truncated preview' },
      ...entries.some(entry => entry.event.seq >= 40)
        ? [{ turn: 2, seq: SessionSeq(40), prompt: 'Research question 2', response: 'Other preview' }] : [],
    ], snapshot.nodes.values(), snapshot.timeline, turn => turn.data.get('deliverables')?.produced ?? [], false)
  }
  return { assembler, read }
}

describe('knowledge sources from assembled Session events', () => {
  it('maps rendered reference-style links without treating literal code as a source', () => {
    const text = '## Evidence\n\n[Source][ref]\n\n`[Literal](https://example.test/code)`\n\n[ref]: https://example.test/source'
    const document = assemble(eventsFor(1, 'completed', text)).read()
    expect(document.cards.filter(card => card.kind === 'reference').map(card => card.url)).toEqual(['https://example.test/source'])
    expect(document.edges).toContainEqual({ from: 'answer:27', to: 'reference:27:https://example.test/source' })
  })

  it('uses the actual assistant-step payload and preserves complete source text', () => {
    const text = `## Research\n\n${'Detailed evidence. '.repeat(30)}\n\nFinal paragraph.\n\n[Source](https://example.test/source)`
    const document = assemble(eventsFor(1, 'completed', text)).read()
    expect(document.excerpts).toHaveLength(1)
    expect(document.cards.find(card => card.kind === 'answer')).toMatchObject({ id: 'answer:27', details: text, source: { turn: 1, turnSeq: 20, seq: 27 } })
    expect(document.excerpts[0]?.source?.nodeKey).toContain('assistant-step')
    expect(document.cards.find(card => card.kind === 'reference')).toMatchObject({ url: 'https://example.test/source', source: { seq: 27 } })
    expect(document.cards.find(card => card.kind === 'artifact')).toMatchObject({ path: 'report.md', source: { seq: 24 }, tool: { callId: 'call-1' } })
    expect(JSON.stringify(document)).not.toContain('misleading truncated preview')
  })

  it.each(['error', 'aborted', 'blocked', 'interrupted', 'max-tokens'])('keeps %s and successful artifacts without turning process prose into findings', (reason) => {
    const document = assemble(eventsFor(1, reason, 'Let me rewrite the truncated report.')).read()
    expect(document.turns[0]?.status).toBe(reason)
    expect(document.excerpts).toEqual([])
    expect(document.cards.filter(card => card.kind === 'answer')).toEqual([])
    expect(document.cards.filter(card => card.kind === 'artifact')).toHaveLength(1)
  })

  it('does not excerpt an open turn, an empty final answer, or a tool-using final message', () => {
    expect(assemble(eventsFor(1).slice(0, -1)).read().excerpts).toEqual([])
    expect(assemble(eventsFor(1, 'completed', '')).read().excerpts).toEqual([])
    const entries = eventsFor(1)
    const message = entries[7]!.event as SessionEvent<'assistant/message'>
    message.data.message.content.push({ type: 'tool-call', id: 'pending', name: 'write', arguments: '{}'  } as never)
    expect(assemble(entries).read().excerpts).toEqual([])
  })

  it('associates tool activity with its recorded turn, without claiming it supports an answer', () => {
    const document = assemble([...eventsFor(1), ...eventsFor(2)]).read()
    expect(document.cards.filter(card => card.kind === 'tool').map(card => [card.turn, card.tool?.callId])).toEqual([[1, 'call-1'], [2, 'call-2']])
    expect(document.edges).toContainEqual({ from: 'turn:2:question', to: 'tool:call-2' })
    expect(document.edges.some(edge => edge.from.startsWith('answer:') && edge.to.startsWith('tool:'))).toBe(false)
  })

  it('does not invent excerpts from an unloaded turn and reconstructs identical sources after history loads', () => {
    const full = eventsFor(1)
    const partial = assemble(full.slice(-2), true)
    expect(partial.read().excerpts).toEqual([])
    expect(partial.read().incomplete).toBe(true)
    partial.assembler.replaceWindow(full, false)
    partial.assembler.flush()
    expect(partial.read()).toEqual(assemble(full).read())
  })

  it('marks partial coverage even before the whole-session outline arrives', () => {
    const { assembler } = assemble(eventsFor(1), true)
    const snapshot = assembler.snapshot('chat') as ChatSnapshot
    const document = deriveKnowledgeDocument(undefined, snapshot.nodes.values(), snapshot.timeline, () => [], true)
    expect(document.incomplete).toBe(true)
    expect(document.excerpts).toHaveLength(1)
  })

  it('provides source-addressed chapter excerpts and retains each recorded file version', () => {
    const answer = '# Research\n\n## 記憶 Memory\n\nFirst evidence.\n\n## Attention\n\nSecond evidence.'
    const first = assemble(eventsFor(1, 'completed', answer)).read()
    expect(first.excerpts.map(card => card.title)).toEqual(['記憶 Memory', 'Attention'])
    expect(first.excerpts[1]).toMatchObject({ details: '## Attention\n\nSecond evidence.', source: { seq: 27 } })
    const next = assemble([...eventsFor(1, 'completed', answer), ...eventsFor(2)]).read()
    expect(next.cards.filter(card => card.kind === 'artifact').map(card => card.source?.seq)).toEqual([24, 44])
    expect(next.cards.find(card => card.id === first.excerpts[1]?.id)).toEqual(first.excerpts[1])
    expect(assemble(eventsFor(1, 'completed', 'A mixed 中英 answer without headings.')).read().excerpts[0]?.kind).toBe('answer')
  })

  it('records failed tool calls as failures and excludes their files from artifacts', () => {
    const entries = eventsFor(1, 'error')
    const result = entries[4]!.event as SessionEvent<'tool/result'>
    result.data.message.content[0].isError = true
    const document = assemble(entries).read()
    expect(document.cards.find(card => card.kind === 'tool')?.status).toBe('error')
    expect(document.cards.filter(card => card.kind === 'artifact')).toEqual([])
  })
})
