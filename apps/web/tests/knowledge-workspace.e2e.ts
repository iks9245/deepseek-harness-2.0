/** Browser contracts for complete source navigation and user-controlled comparison questions. */
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session, SessionId, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-title'
import { launchWebScaffold, seedSession, watchConsole, type WebScaffold } from './scaffold.ts'
import { createChatScrollFixture } from './chat-scroll-fixture.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

function fixture(chapters: number): string {
  const session = Session.create(SessionId(`knowledge-${String(chapters)}`))
  for (const turn of [1, 2]) {
    session.append('turn/start', { turn })
    const user = session.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [
      { type: 'text', text: `KNOWLEDGE_${String(chapters)} Evaluate memory and attention, turn ${String(turn)}.` },
    ] }), { surfaceOp: 'append' })
    if (turn === 1) session.append('session/title', { title: `Knowledge ${String(chapters)}`, messageSeqs: [user.seq], source: { kind: 'fallback' } })
    session.append('step/start', { turn, step: 1 })
    session.append('request/header', { header: { config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' }, system: 'Compare source text.' }, reason: turn === 1 ? 'initial' : 'change' })
    const sections = Array.from({ length: chapters }, (_, index) => `## Chapter ${String(index)}\n\nRecorded evidence ${String(index)}.`).join('\n\n')
    const memory = turn === 1 ? 'Positive effects under all conditions.' : 'Correction: negative effects under overload.'
    const longText = Array.from({ length: 35 }, (_, index) => `Paragraph ${String(index)}. ${'Original source material. '.repeat(12)}`).join('\n\n')
    const text = `# Research\n\n## Memory\n\n${memory}\n\n| Condition | Result |\n| --- | --- |\n| Overload | Review needed |\n\n${longText}\n\n## Attention\n\nUnchanged evidence.\n\n${sections}`
    session.append('assistant/message', { turn, step: 1, stream: [], message: createAssistantMessage({
      source: { provider: 'deepseek-official', model: 'deepseek-v4-flash' }, content: [{ type: 'text', text }],
    }) }, { surfaceOp: 'append' })
    session.append('step/end', { turn, step: 1 })
    session.append('turn/end', { turn, reason: { kind: 'completed' } })
  }
  return [JSON.stringify({ type: 'session', version: SESSION_FORMAT_VERSION, id: '{{sessionId}}', createdAt: Date.now(),
    cwd: '{{cwd}}', isSeeded: false, delegationDepth: 0 }), ...session.snapshotEvents().map(event => JSON.stringify(event)), ''].join('\n')
}

describe('knowledge reading and evolution', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let consoleState: ReturnType<typeof watchConsole>
  beforeAll(async () => {
    scaffold = await launchWebScaffold()
    for (const size of [10, 50, 200]) await seedSession(scaffold, fixture(size), `knowledge-${String(size)}`)
    const history = createChatScrollFixture({ markerPrefix: 'KNOWLEDGE_HISTORY', title: 'Knowledge history' })
    await seedSession(scaffold, history.log, 'knowledge-history')
    browser = await chromium.launch()
    page = await newEnglishPage(browser, 1000, 'product-default')
    page.setDefaultTimeout(15_000)
    consoleState = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.getByText('Ungrouped', { exact: true }).waitFor()
  })
  afterAll(async () => {
    const failures: unknown[] = []
    await page?.close().catch((error: unknown) => failures.push(error))
    await browser?.close().catch((error: unknown) => failures.push(error))
    await scaffold?.close().catch((error: unknown) => failures.push(error))
    if (failures.length > 0) throw new AggregateError(failures, 'knowledge browser teardown failed')
  })

  async function open(marker: string): Promise<void> {
    const button = page.getByRole('button', { name: 'Search sessions', exact: true })
    if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
    await page.getByRole('textbox', { name: 'Search sessions...', exact: true }).fill(marker)
    const result = page.getByRole('tree', { name: 'Search results' }).getByRole('treeitem')
    await expect.poll(() => result.count()).toBe(1)
    await result.click()
  }

  it.each([10, 50, 200])('keeps all %i chapters reachable at desktop and narrow widths', async (size) => {
    onTestFailed(() => saveFailureShot(page, `knowledge-${String(size)}`))
    await open(`KNOWLEDGE_${String(size)}`)
    const center = page.locator('[class*="centerCol"]')
    await center.getByRole('tab', { name: 'Map', exact: true }).click()
    const list = center.locator('[data-knowledge-list]')
    await expect.poll(() => list.count()).toBe((size + 5) * 2 + 1)
    const nodes = center.locator('[data-knowledge-node]')
    await expect.poll(() => nodes.count()).toBe((size + 5) * 2 + 1)
    const rectangles = await nodes.evaluateAll(elements => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    }))
    for (let index = 1; index < rectangles.length; index++) {
      expect(rectangles[index]!.top).toBeGreaterThanOrEqual(rectangles[index - 1]!.bottom)
    }
    await page.setViewportSize({ width: 640, height: 800 })
    await center.getByRole('searchbox', { name: 'Search chapters and sources' }).fill(`Chapter ${String(size - 1)}`)
    await center.getByLabel('Scope', { exact: true }).selectOption('2')
    await expect.poll(() => list.count()).toBe(1)
    await list.press('Enter')
    await center.locator('article').getByRole('heading', { name: `Chapter ${String(size - 1)}`, exact: true, level: 3 }).waitFor()
    const width = await center.evaluate(element => ({ visible: element.clientWidth, content: element.scrollWidth }))
    expect(width.content).toBeLessThanOrEqual(width.visible + 2)
    await page.setViewportSize({ width: 1680, height: 1000 })
  })

  it('restores reader position and stages a comparison question without sending it', async () => {
    onTestFailed(() => saveFailureShot(page, 'knowledge-comparison'))
    await open('KNOWLEDGE_10')
    const center = page.locator('[class*="centerCol"]')
    await center.getByRole('searchbox', { name: 'Search chapters and sources' }).fill('')
    await center.getByLabel('Scope', { exact: true }).selectOption('2')
    await center.locator('[data-knowledge-list]').filter({ hasText: /^Section · Turn 2Memory$/ }).click()
    const reader = center.locator('[data-knowledge-reader]')
    await reader.getByRole('table').waitFor()
    await reader.evaluate((element) => { element.scrollTop = 400 })
    const offset = await reader.evaluate(element => element.scrollTop)
    expect(offset).toBeGreaterThan(100)
    await center.getByRole('tab', { name: 'Map', exact: true }).click()
    await center.getByRole('tab', { name: 'Reading', exact: true }).click()
    await expect.poll(() => reader.evaluate(element => element.scrollTop)).toBe(offset)
    await center.getByRole('button', { name: /^Knowledge changes and open questions/ }).click()
    await center.getByRole('button', { name: 'Memory', exact: true }).click()
    await center.getByRole('button', { name: 'Investigate contradiction', exact: true }).click()
    const draft = center.getByRole('textbox', { name: 'Follow-up draft', exact: true })
    expect(await draft.inputValue()).toContain('Positive effects under all conditions.')
    expect(await draft.inputValue()).toContain('Correction: negative effects under overload.')
    await center.getByRole('button', { name: 'Place in composer', exact: true }).click()
    await center.getByText('Placed in the composer; not sent.', { exact: true }).waitFor()
    const composer = center.locator('[contenteditable="true"]').first()
    expect(await composer.innerText()).toContain('Do these source excerpts contradict each other?')
    expect(await center.getByRole('button', { name: 'Place in composer', exact: true }).isDisabled()).toBe(true)
    expect(consoleState.pageErrors).toEqual([])
  })

  it('loads the complete history before classifying changes', async () => {
    onTestFailed(() => saveFailureShot(page, 'knowledge-history'))
    await open('CHAT_SCROLL_KNOWLEDGE_HISTORY_USER')
    const center = page.locator('[class*="centerCol"]')
    await center.getByRole('tab', { name: 'Map', exact: true }).click()
    await center.getByRole('button', { name: /^Knowledge changes and open questions/ }).click()
    await center.getByText('Load the complete history before classifying additions or changes.', { exact: true }).waitFor()
    await center.getByRole('button', { name: 'Load complete conversation', exact: true }).click()
    await center.getByText('Turn 87 → turn 88', { exact: true }).waitFor()
    expect(await center.getByRole('button', { name: 'Load complete conversation', exact: true }).count()).toBe(0)
    expect(consoleState.pageErrors).toEqual([])
  })
})
