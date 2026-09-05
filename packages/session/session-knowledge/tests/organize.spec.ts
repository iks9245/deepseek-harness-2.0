import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter, ToolCallId, createAssistantMessage, createUserMessage, type ContentBlock, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId, type Session } from '@deepseek-ai/dsh-session'
import { CommandId, type CommandInvocation } from '@deepseek-ai/dsh-commands'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import Commands from '@deepseek-ai/dsh-commands'
import Projections from '@deepseek-ai/dsh-session-projection'
import * as plugin from '../src/index.ts'
import { organizeKnowledge, parseOrganizedKnowledge, ORGANIZE_PROMPT } from '../src/organize.ts'
import { collectKnowledgeSources } from '../src/sources.ts'
import { knowledgeProjection } from '../src/projection.ts'

const config = {
  maxInputBytes: 20000, maxOutputBytes: 10000, maxOutputTokens: 2000, maxGroups: 3, maxNodes: 6, maxRelations: 6, timeoutMs: 1000,
}
const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })

function source(session: Session, turn = 1, reason: 'completed' | 'error' = 'completed', logRoute = true) {
  session.append('turn/start', { turn })
  session.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'How do memory and attention interact?' }] }), { surfaceOp: 'append' })
  if (logRoute) session.append('request/header', { header: { config: { provider: 'mock', model: 'research-model' } }, reason: 'initial' })
  const answer = session.append('assistant/message', { turn, step: 1, stream: [], message: createAssistantMessage({ source: { provider: 'mock', model: 'research-model' },
    content: [{ type: 'text', text: '## Memory\n\nAttention helps memory.\n\n## Limits\n\nOverload reduces recall.' }] }) }, { surfaceOp: 'append' })
  session.append('turn/end', { turn, reason: reason === 'completed' ? { kind: 'completed' } : { kind: 'error', error: { code: 'UNKNOWN', message: 'Failed' } } })
  return answer.seq
}

function output(seq: number) {
  const sources = [{ seq, quote: 'Attention helps memory.' }]
  return { title: 'Memory and attention', summary: 'Attention helps recall within capacity limits.',
    nodes: [{ id: 'n1', group: 'Cognition', kind: 'claim', title: 'Attention supports memory', summary: 'Attention helps recall.', sources },
      { id: 'n2', group: 'Cognition', kind: 'limitation', title: 'Capacity matters', summary: 'Overload limits recall.', sources: [{ seq, quote: 'Overload reduces recall.' }] }],
    relations: [{ from: 'n1', to: 'n2', kind: 'related', explanation: 'Both describe conditions for recall.', sources }] }
}

class Adapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  constructor(private readonly run: (options: GenerateOptions) => AsyncIterable<StreamChunk>) { super() }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> { this.requests.push(options); yield * this.run(options) }
}

async function world() {
  const ctx = new Context(); contexts.push(ctx)
  await ctx.plugin(SessionStore); await ctx.plugin(LlmRuntime)
  const session = ctx.sessions.create(SessionId('research'))
  const seq = source(session)
  // This unit isolates model generation; the shipped-profile browser test owns real Agent maintenance admission.
  const agent = { id: session.id, session, options: { provider: 'mock', model: 'selected-model' } } as Agent
  const invocation: CommandInvocation = { agent, commandId: CommandId('organize'), rawInput: '', attachments: [], signal: new AbortController().signal }
  return { ctx, session, seq, invocation }
}

describe('manual knowledge organization', () => {
  it('logs exact input before dispatch and publishes a traceable map without adding a conversational turn', async () => {
    const { ctx, session, seq, invocation } = await world()
    const before = session.snapshotEvents()
    const adapter = new Adapter(async function* (options) {
      const request = session.snapshotEvents().findLast(event => event.type === 'knowledge/request')!
      expect(request.data).toMatchObject({ messages: options.messages, system: options.system, provider: 'mock', model: 'selected-model', maxTokens: 2000 })
      yield { type: 'text-delta', index: 0, text: JSON.stringify(output(seq)) }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })
    ctx.llm.registerAdapter(['mock'], adapter)
    expect(adapter.requests).toHaveLength(0)
    const result = await organizeKnowledge(ctx, invocation, config, invocation.signal)
    expect(result.kind).toBe('success')
    expect(session.snapshotEvents().slice(0, before.length)).toEqual(before)
    expect(session.snapshotEvents().slice(before.length).map(event => event.type)).toEqual(['knowledge/request', 'knowledge/document'])
    const record = session.snapshotEvents().findLast(event => event.type === 'knowledge/document')!
    expect(record.data.document.map.nodes).toHaveLength(2)
    const projection = session.snapshotEvents().reduce(knowledgeProjection.apply, knowledgeProjection.init())
    expect(projection).toEqual({ document: record.data.document, stale: false })
    source(session, 2)
    expect(session.snapshotEvents().reduce(knowledgeProjection.apply, knowledgeProjection.init()).stale).toBe(true)
    expect(adapter.requests[0]?.system).toBe(ORGANIZE_PROMPT)
  })

  it.each(['bad-json', 'invented-quote', 'truncated', 'oversized', 'tools'])('keeps an unsuccessful %s response out of the saved map', async (failure) => {
    const { ctx, session, seq, invocation } = await world()
    const response = output(seq)
    if (failure === 'invented-quote') response.nodes[0]!.sources[0]!.quote = 'Invented evidence.'
    const adapter = new Adapter(async function* () {
      if (failure === 'tools') yield { type: 'tool-call-delta', index: 0, id: ToolCallId('unexpected'), name: 'write', argumentsDelta: '{}' }
      else yield { type: 'text-delta', index: 0, text: failure === 'bad-json' ? '{' : failure === 'oversized' ? 'x'.repeat(10001) : JSON.stringify(response) }
      yield { type: 'finish', reason: failure === 'truncated' ? { kind: 'max-tokens' } : { kind: 'stop' } }
    })
    ctx.llm.registerAdapter(['mock'], adapter)
    await expect(organizeKnowledge(ctx, invocation, config, invocation.signal)).rejects.toThrow()
    expect(session.snapshotEvents().some(event => event.type === 'knowledge/document')).toBe(false)
  })

  it('rejects oversized inputs before any request and drains deadline cancellation without a late result', async () => {
    const { ctx, session, invocation } = await world()
    const adapter = new Adapter(async function* (options) {
      const signal = options.signal!
      await new Promise<void>((resolve) => {
        if (signal.aborted) resolve()
        else signal.addEventListener('abort', () => { resolve() }, { once: true })
      })
      yield { type: 'text-delta', index: 0, text: '{}' }
    })
    ctx.llm.registerAdapter(['mock'], adapter)
    await expect(organizeKnowledge(ctx, invocation, { ...config, maxInputBytes: 1 }, invocation.signal)).rejects.toThrow('input limit')
    expect(adapter.requests).toHaveLength(0)
    await expect(organizeKnowledge(ctx, invocation, { ...config, timeoutMs: 10 }, invocation.signal)).rejects.toThrow()
    expect(session.snapshotEvents().some(event => event.type === 'knowledge/document')).toBe(false)
  })

  it('excludes failed and open answers and rejects a map without available research', async () => {
    const { ctx, session, invocation } = await world()
    source(session, 2, 'error')
    session.append('turn/start', { turn: 3 })
    expect(collectKnowledgeSources(session.snapshotEvents())).toHaveLength(1)
    const empty = ctx.sessions.create(SessionId('empty'))
    await expect(organizeKnowledge(ctx, { ...invocation, agent: { ...invocation.agent, session: empty } }, config, invocation.signal)).rejects.toThrow('No completed')
  })

  it('uses the logged model when no selection exists, preserves reasoning exclusion, and bounds the saved envelope', async () => {
    const { ctx, session, seq, invocation } = await world()
    const fallback = { ...invocation, agent: { ...invocation.agent, options: {} } }
    ctx.llm.registerAdapter(['mock'], new Adapter(async function* (options) {
      expect(options.model).toBe('research-model')
      yield { type: 'reasoning-delta', index: 0, text: 'internal reasoning' }
      yield { type: 'text-delta', index: 1, text: JSON.stringify(output(seq)) }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }))
    await expect(organizeKnowledge(ctx, fallback, { ...config, maxOutputBytes: 1000 }, invocation.signal)).rejects.toThrow('document exceeds')
    await organizeKnowledge(ctx, fallback, config, invocation.signal)
    const projected = session.snapshotEvents().reduce(knowledgeProjection.apply, knowledgeProjection.init())
    expect(knowledgeProjection.wire.view(projected)).toBe(projected)
    expect(JSON.stringify(projected)).not.toContain('internal reasoning')
    const missing = ctx.sessions.create(SessionId('missing-route'))
    source(missing, 1, 'completed', false)
    await expect(organizeKnowledge(ctx, { ...fallback, agent: { ...fallback.agent, session: missing } }, config, invocation.signal)).rejects.toThrow('Select a model')
  })

  it('omits nontext questions, reasoning-only answers, and final tool calls from research sources', async () => {
    const { session } = await world()
    session.append('turn/start', { turn: 2 })
    session.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'image',
      attachment: { attachmentId: 'fixture-image' as Extract<ContentBlock, { type: 'image' }>['attachment']['attachmentId'],
        mediaType: 'image/png', bytes: 1, width: 1, height: 1 } }] }), { surfaceOp: 'append' })
    session.append('user/message', createUserMessage({ source: { kind: 'plugin', plugin: 'test' }, content: [{ type: 'text', text: 'Not a human question' }] }), { surfaceOp: 'append' })
    session.append('assistant/message', { turn: 2, step: 1, stream: [], message: createAssistantMessage({ source: { provider: 'mock', model: 'mock' }, content: [{ type: 'reasoning', text: 'private' }] }) }, { surfaceOp: 'append' })
    session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
    session.append('turn/start', { turn: 3 })
    session.append('assistant/message', { turn: 3, step: 1, stream: [], message: createAssistantMessage({ source: { provider: 'mock', model: 'mock' }, content: [{ type: 'tool-call', id: ToolCallId('unfinished'), name: 'read', arguments: '{}' }] }) }, { surfaceOp: 'append' })
    session.append('turn/end', { turn: 3, reason: { kind: 'completed' } })
    expect(collectKnowledgeSources(session.snapshotEvents())).toHaveLength(1)
  })

  it('rejects ambiguous identities, dangling edges, graph limits, and unknown source references', async () => {
    const { session, seq } = await world()
    const sources = collectKnowledgeSources(session.snapshotEvents())
    const valid = output(seq)
    expect(parseOrganizedKnowledge(JSON.stringify(valid), sources, config).nodes).toHaveLength(2)
    for (const response of [
      { ...valid, nodes: [valid.nodes[0], valid.nodes[0]] },
      { ...valid, relations: [{ ...valid.relations[0], to: 'missing' }] },
      { ...valid, relations: [{ ...valid.relations[0], to: 'n1' }] },
      { ...valid, nodes: [{ ...valid.nodes[0], sources: [{ seq: 999, quote: 'Attention helps memory.' }] }] },
    ]) expect(() => parseOrganizedKnowledge(JSON.stringify(response), sources, config)).toThrow()
    expect(() => parseOrganizedKnowledge(JSON.stringify(valid), sources, { ...config, maxNodes: 1 })).toThrow('limits')
  })
})


describe('organizer command lifecycle', () => {
  it('rejects overlap, cancels only its request, and drains plugin disposal before returning', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(SessionStore); await ctx.plugin(LlmRuntime); await ctx.plugin(Projections)
    await ctx.plugin(SystemPrompt, { persona: '' }); await ctx.plugin(ToolRuntime)
    await ctx.plugin(AgentRegistry); await ctx.plugin(AgentLoop, { agents: [] }); await ctx.plugin(Commands)
    const fork = ctx.plugin(plugin, config); await fork
    const agent = await ctx.agentLoop.create(SessionId('lifecycle'), { provider: 'mock', model: 'mock' })
    source(agent.session)
    let startedResolve!: () => void
    let startedPromise = new Promise<void>((resolve) => { startedResolve = resolve })
    let drained = 0
    ctx.llm.registerAdapter(['mock'], new Adapter(async function* (options) {
      startedResolve()
      try {
        await new Promise<void>((resolve) => {
          if (options.signal!.aborted) resolve()
          else options.signal!.addEventListener('abort', () => { resolve() }, { once: true })
        })
        options.signal!.throwIfAborted()
      } finally { drained++ }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }))
    const execute = (line: string) => ctx.commands.execute(agent, line, [], new AbortController().signal)
    expect((await execute('/knowledge-organize extra'))?.result.kind).toBe('error')
    const first = execute('/knowledge-organize')
    const firstOutcome = first.catch((error: unknown) => error)
    await startedPromise
    await expect(execute('/knowledge-organize')).rejects.toThrow('already has active work')
    await execute('/knowledge-cancel')
    expect(await firstOutcome).toBeInstanceOf(Error)
    expect(drained).toBe(1)
    expect(agent.session.snapshotEvents().some(event => event.type === 'knowledge/document')).toBe(false)
    await execute('/knowledge-cancel')
    startedPromise = new Promise<void>((resolve) => { startedResolve = resolve })
    const second = execute('/knowledge-organize').catch((error: unknown) => error)
    await startedPromise
    await fork.dispose()
    expect(await second).toBeInstanceOf(Error)
    expect(drained).toBe(2)
    expect(ctx.commands.find(agent, 'knowledge-organize')).toBeUndefined()
    expect(ctx.commands.find(agent, 'knowledge-cancel')).toBeUndefined()
  })
})
