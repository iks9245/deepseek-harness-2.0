/** Complete settled answers selected from durable turns, never from browser previews. */
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { KnowledgeSourceTarget } from './types.ts'

/** Exact research material supplied to the organizer. */
export interface KnowledgeSource extends KnowledgeSourceTarget { readonly question: string; readonly text: string }

/**
 * Select each completed turn's last tool-free answer and its human question.
 * @param events - Complete chronological Session events.
 * @returns source texts with durable answer and turn identities; open, failed, and empty answers are excluded.
 */
export function collectKnowledgeSources(events: readonly SessionEvent[]): readonly KnowledgeSource[] {
  const sources: KnowledgeSource[] = []
  let start: SessionEvent<'turn/start'> | undefined
  let answer: SessionEvent<'assistant/message'> | undefined
  let question = ''
  for (const event of events) {
    if (event.type === 'turn/start') { start = event; answer = undefined; question = '' }
    else if (event.type === 'user/message' && event.data.source.kind === 'user' && start !== undefined) {
      question += event.data.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')
    } else if (event.type === 'assistant/message') answer = event
    else if (event.type === 'turn/end' && start !== undefined) {
      if (event.data.reason.kind === 'completed' && answer !== undefined
        && !answer.data.message.content.some(block => block.type === 'tool-call')) {
        const text = answer.data.message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n\n').trim()
        if (text !== '') sources.push({ seq: answer.seq, turn: start.data.turn, turnSeq: start.seq, question, text })
      }
      start = undefined
      answer = undefined
    }
  }
  return sources
}
