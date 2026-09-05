/** Manual research organization through a logged model request and whole-session projection. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { knowledgeProjection } from './projection.ts'
import { organizeKnowledge } from './organize.ts'

export type * from './types.ts'
export const name = 'session-knowledge'
export const inject = ['commands', 'llm', 'sessions', 'sessionProjections']

/** Required deployment bounds; no model request occurs until an explicit command. */
export interface Config {
  /** UTF-8 ceiling for the complete logged model request. */
  readonly maxInputBytes: number
  /** UTF-8 ceiling for streamed text/reasoning and the complete saved result. */
  readonly maxOutputBytes: number
  /** Provider output-token limit for one organization. */
  readonly maxOutputTokens: number
  /** Maximum distinct subjects in an accepted map. */
  readonly maxGroups: number
  /** Maximum knowledge points in an accepted map. */
  readonly maxNodes: number
  /** Maximum proposed relationships; zero forbids relationships. */
  readonly maxRelations: number
  /** Cooperative request deadline in milliseconds. */
  readonly timeoutMs: number
}

/** Loader validation of request, graph, and deadline bounds. */
export const Config: z<Config> = z.object({
  maxInputBytes: z.number().step(1).min(1).required(),
  maxOutputBytes: z.number().step(1).min(1).required(),
  maxOutputTokens: z.number().step(1).min(1).required(),
  maxGroups: z.number().step(1).min(1).required(),
  maxNodes: z.number().step(1).min(1).required(),
  maxRelations: z.number().step(1).min(0).required(),
  timeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).required(),
})

/**
 * Register manual organization and its projection; disposal aborts and drains every owned request.
 * @param ctx - LLM, command registry, and Session projection services.
 * @param config - Validated deployment bounds.
 */
export function apply(ctx: Context, config: Config): void {
  const lifetime = new AbortController()
  const active = new Map<SessionId, { controller: AbortController; done: Promise<CommandResult> }>()
  const handler = (invocation: CommandInvocation): Promise<CommandResult> => {
    if (invocation.rawInput.trim() !== '') return Promise.resolve({ kind: 'error', text: 'Usage: /knowledge-organize (no arguments)' })
    const controller = new AbortController()
    const operation = invocation.agent.runMaintenance(signal => organizeKnowledge(ctx, invocation, config,
      AbortSignal.any([signal, invocation.signal, lifetime.signal, controller.signal])))
    active.set(invocation.agent.id, { controller, done: operation })
    const retire = (): void => { active.delete(invocation.agent.id) }
    void operation.then(retire, retire)
    return operation
  }
  ctx.sessionProjections.register(knowledgeProjection)
  ctx.effect(function* () {
    yield async () => { lifetime.abort(new Error('Knowledge organizer disposed.')); await Promise.allSettled([...active.values()].map(item => item.done)) }
    yield ctx.commands.register({ name: 'knowledge-organize', description: 'Organize research into a source-backed knowledge map', handler })
    yield ctx.commands.register({ name: 'knowledge-cancel', description: 'Cancel the active knowledge organization', handler: async ({ agent }) => {
      const operation = active.get(agent.id)
      if (operation !== undefined) {
        operation.controller.abort(new Error('Knowledge organization cancelled.'))
        await Promise.allSettled([operation.done])
      }
      return { kind: 'success', text: 'Knowledge organization stopped.' }
    } })
  }, 'knowledge organizer lifecycle')
}
