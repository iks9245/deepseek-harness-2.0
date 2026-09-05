import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent-presets'
import type {} from '@deepseek-ai/dsh-system-prompt'
import {
  assertFixtureInventory,
  captureStableAria,
  compareOrRefreshGolden,
  launchWebScaffold,
  parseSeedFixture, renderSeedFixture, seedSession,
  watchConsole,
  webSnapshotMode,
  type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('../../../snapshots/web/minimal-preset', import.meta.url))
const FIXTURE = join(SNAPSHOT_DIR, 'session.v2.jsonl')
const UI_EXPECTED = join(SNAPSHOT_DIR, 'ui.expected.md')
const KNOWLEDGE_EXPECTED = join(SNAPSHOT_DIR, 'knowledge.expected.md')
const MODE = webSnapshotMode()
const PROMPT = "Use the bash tool to run exactly: printf 'MINIMAL_BASH_CARD_OK\\n'. Then reply exactly MINIMAL_PRESET_REQUEST_OK and stop."

const CHAPTER = '## Attention\n\nAttention evidence stays with its original section.'

async function seedChapterFixture(scaffold: WebScaffold): Promise<void> {
  const text = `# Report\n\n## 記憶 Memory\n\nMemory evidence.\n\n${CHAPTER}`
  const decoded = parseSeedFixture(await readFile(FIXTURE, 'utf8'))
  const events = decoded.events.map((event) => {
    if (event.type === 'session/title') return { ...event, data: { ...event.data, title: 'Knowledge sections fixture' } }
    if (event.type === 'user/message' && event.data.source.kind === 'user') {
      return { ...event, data: { ...event.data, content: [{ type: 'text' as const, text: 'KNOWLEDGE_SECTIONS_REQUEST' }] } }
    }
    if (event.type === 'assistant/message' && event.data.step === 2) {
      return { ...event, data: { ...event.data, stream: [], message: { ...event.data.message, content: [{ type: 'text' as const, text }] } } }
    }
    return event
  })
  await seedSession(scaffold, renderSeedFixture(decoded.headerLine, events), 'knowledge-sections-fixture')
}

async function openChapters(page: Page): Promise<void> {
  const searchButton = page.getByRole('button', { name: 'Search sessions', exact: true })
  if (await searchButton.getAttribute('aria-expanded') !== 'true') await searchButton.click()
  await page.getByRole('textbox', { name: 'Search sessions...', exact: true }).fill('KNOWLEDGE_SECTIONS_REQUEST')
  const results = page.getByRole('tree', { name: 'Search results' }).getByRole('treeitem')
  await expect.poll(() => results.count()).toBe(1)
  await results.click()
}

describe('minimal agent preset', () => {
  let scaffold: WebScaffold
  let agentHandle: AgentHandle
  let disposeInjectedPrompt: () => void
  let browser: Browser | undefined
  let page: Page | undefined
  let tripwire: ReturnType<typeof watchConsole> | undefined

  beforeAll(async () => {
    scaffold = await launchWebScaffold({ replayFixture: FIXTURE, compareReplaySession: true, paceMs: 10 })
    disposeInjectedPrompt = scaffold.ctx.systemPrompt.section({
      name: 'test:injected-prompt',
      order: 999,
      text: 'THIS TEXT MUST NOT REACH THE MODEL.',
    })
    agentHandle = await scaffold.ctx.agents.create({
      sessionId: SessionId('minimal-preset-smoke'),
      meta: { cwd: scaffold.workspaceCwd, agentPreset: 'minimal' },
      agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      setup: agentCtx => scaffold.ctx.agentPresets.mount(agentCtx, 'minimal').then(() => undefined),
    })
    agentHandle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: PROMPT }],
      source: { kind: 'user' },
    }))
    await agentHandle.agent.whenIdle()
    if (MODE !== 'record') await seedChapterFixture(scaffold)
  })

  afterAll(async () => {
    const failures: unknown[] = []
    await page?.close().catch((error: unknown) => failures.push(error))
    await browser?.close().catch((error: unknown) => failures.push(error))
    await agentHandle?.dispose().catch((error: unknown) => failures.push(error))
    try {
      disposeInjectedPrompt?.()
    } catch (error: unknown) {
      failures.push(error)
    }
    await scaffold?.close().catch((error: unknown) => failures.push(error))
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'minimal preset smoke teardown failed')
  })

  it('sends the exact RL prompt and schemas, then executes the persistent shell and editor', async () => {
    const requestHeader = agentHandle.agent.session.requestHeader()
    if (requestHeader === undefined) throw new Error('the minimal agent issued no model request')
    expect(agentHandle.agent.session.snapshotEvents().some(event => event.type === 'user/message'
      && event.data.source.kind === 'plugin'
      && event.data.source.plugin === '@deepseek-ai/dsh-system-prompt')).toBe(false)
    const presetFileSystem = scaffold.ctx.agentPresets.serviceFor(agentHandle.agent, 'fs')
    expect(presetFileSystem).toBeDefined()
    expect(presetFileSystem?.sandboxMode).toBeUndefined()
    expect(scaffold.ctx.agentPresets.serviceFor(agentHandle.agent, 'compaction')).toBeUndefined()

    const stateDir = join(scaffold.workspaceCwd, 'persistent-state')
    await mkdir(stateDir)
    const signal = new AbortController().signal
    await scaffold.ctx.tools.execute({
      signal,
      callId: ToolCallId('minimal-bash-state-setup'),
      name: 'bash',
      arguments: { command: `cd ${JSON.stringify(stateDir)} && export DSH_MINIMAL_STATE=PERSISTED` },
      agent: agentHandle.agent,
    })
    const bash = await scaffold.ctx.tools.execute({
      signal,
      callId: ToolCallId('minimal-bash-state-read'),
      name: 'bash',
      arguments: { command: 'printf \'%s:%s\n\' "$DSH_MINIMAL_STATE" "$PWD"' },
      agent: agentHandle.agent,
    })
    const seedPath = join(scaffold.workspaceCwd, 'preset-smoke.txt')
    await writeFile(seedPath, 'MINIMAL_EDITOR_OK\n')
    const editor = await scaffold.ctx.tools.execute({
      signal,
      callId: ToolCallId('minimal-editor-smoke'),
      name: 'str_replace_editor',
      arguments: { command: 'view', path: seedPath },
      agent: agentHandle.agent,
    })

    const text = (result: typeof bash): string => result.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
      .replaceAll(scaffold.workspaceCwd, '{{cwd}}')
      .trimEnd()

    expect({
      prompt: requestHeader.system,
      tools: requestHeader.tools?.map(tool => tool.name),
      goalCommand: scaffold.ctx.commands.find(agentHandle.agent, 'goal') !== undefined,
      bash: text(bash),
      editor: text(editor),
    }).toMatchInlineSnapshot(`
      {
        "bash": "PERSISTED:{{cwd}}/persistent-state",
        "editor": "Here's the content of {{cwd}}/preset-smoke.txt with line numbers (which has a total of 2 lines):
           1  MINIMAL_EDITOR_OK
           2",
        "goalCommand": false,
        "prompt": "You are a helpful software engineer assistant.",
        "tools": [
          "bash",
          "str_replace_editor",
        ],
      }
    `)
    expect(requestHeader.tools?.toSorted((left, right) => left.name.localeCompare(right.name)))
      .toEqual(scaffold.ctx.tools.schemas(agentHandle.agent).toSorted((left, right) => left.name.localeCompare(right.name)))
  })

  it.skipIf(MODE === 'record')('expands the completed persistent Bash call in the Web conversation', async () => {
    onTestFailed(() => { if (page !== undefined) void saveFailureShot(page, 'web-minimal-persistent-bash-card') })
    browser = await chromium.launch()
    page = await newEnglishPage(browser, 1000, 'product-default')
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })

    const groupRow = page.locator('[role="treeitem"]').first()
    await groupRow.waitFor({ timeout: 15_000 })
    await groupRow.click()
    const sessionRow = page.getByRole('treeitem').filter({ hasText: 'Use the bash tool to' })
    await sessionRow.waitFor({ timeout: 10_000 })
    await sessionRow.click()
    const center = page.locator('[class*="centerCol"]')
    await center.getByRole('tab', { name: 'Map', exact: true }).waitFor({ timeout: 15_000 })
    await compareOrRefreshGolden(KNOWLEDGE_EXPECTED,
      await captureStableAria(page, '[class*="centerCol"]', scaffold.workspaceCwd), MODE)
    await center.locator('[data-knowledge-node]').filter({ hasText: 'MINIMAL_PRESET_REQUEST_OK' }).click()
    const overview = center.locator('article[aria-current="true"]')
    await overview.getByRole('button', { name: 'View original conversation' }).click()
    await center.getByText('MINIMAL_PRESET_REQUEST_OK', { exact: true }).waitFor({ timeout: 15_000 })

    const process = page.locator('[data-turn-process]')
    await process.waitFor({ timeout: 15_000 })
    await expect.poll(() => process.getAttribute('aria-expanded')).toBe('false')
    await process.click()
    await expect.poll(() => process.getAttribute('aria-expanded')).toBe('true')

    const row = page.locator('[data-sample="bash"]').first()
    await row.waitFor({ timeout: 15_000 })
    await expect.poll(() => row.getAttribute('aria-expanded')).toBe('false')
    await row.click()

    await expect.poll(() => row.getAttribute('aria-expanded')).toBe('true')
    const call = row.locator('xpath=..')
    await call.getByText('IN', { exact: true }).waitFor()
    await call.getByText('OUT', { exact: true }).waitFor()
    await call.getByText('MINIMAL_BASH_CARD_OK', { exact: true }).waitFor()
    await call.getByText(/"command": "printf 'MINIMAL_BASH_CARD_OK/).waitFor()

    const snapshot = await captureStableAria(page, '[class*="centerCol"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(UI_EXPECTED, snapshot, MODE)

    await process.click()
    await center.getByRole('button', { name: 'Return to knowledge map' }).click()
    await center.getByRole('tab', { name: 'Reading', exact: true }).click()
    await center.locator('[data-knowledge-list]').filter({ hasText: 'Tool activity' }).click()
    const toolCard = center.locator('article[aria-current="true"]')
    await toolCard.getByRole('button', { name: 'View tool record' }).click()
    await page.getByRole('heading', { name: 'bash', exact: true, level: 2 }).waitFor()
    await toolCard.getByRole('button', { name: 'View original conversation' }).click()
    await expect.poll(() => process.getAttribute('aria-expanded')).toBe('true')
    await expect.poll(() => row.isVisible()).toBe(true)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  }, 60_000)

  it.skipIf(MODE === 'record')('opens an exact chapter excerpt and reconstructs its identity after reopening', async () => {
    if (page === undefined) throw new Error('the conversation browser must be initialized')
    await openChapters(page)
    const center = page.locator('[class*="centerCol"]')
    const section = page.getByRole('heading', { name: 'Attention', exact: true, level: 4 }).locator('..')
    await section.getByRole('button', { name: 'Read section' }).press('Enter')
    const selected = center.locator('article[aria-current="true"]')
    await selected.getByRole('heading', { name: 'Attention', exact: true, level: 3 }).waitFor()
    await selected.getByText('Attention evidence stays with its original section.', { exact: true }).waitFor()
    const id = await selected.getAttribute('data-knowledge-card')
    await compareOrRefreshGolden(join(SNAPSHOT_DIR, 'sections.expected.md'),
      await captureStableAria(page, 'article[aria-current="true"]', scaffold.workspaceCwd), MODE)
    await selected.getByRole('button', { name: 'View original conversation' }).click()
    await center.getByRole('heading', { name: 'Attention', exact: true }).waitFor()
    await page.reload({ waitUntil: 'load' })
    await openChapters(page)
    await center.getByRole('button', { name: 'Return to knowledge map' }).click()
    await section.getByRole('button', { name: 'Read section' }).click()
    await expect.poll(() => selected.getAttribute('data-knowledge-card')).toBe(id)
    expect(tripwire?.pageErrors).toEqual([])
  })

  it('keeps its snapshot inventory closed', async () => {
    await assertFixtureInventory(SNAPSHOT_DIR, [
      'session.v2.jsonl',
      'system-prompt.expected.md',
      'tool-schemas.expected.json',
      'ui.expected.md',
      'knowledge.expected.md',
      'sections.expected.md',
    ])
  })
})
