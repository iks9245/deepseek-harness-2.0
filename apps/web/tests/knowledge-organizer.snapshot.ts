import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchWebScaffold, parseSeedFixture, renderSeedFixture, seedSession,
  captureStableAria, compareOrRefreshGolden, webSnapshotMode, watchConsole, type WebScaffold } from './scaffold.ts'
import { newEnglishPage } from './support.ts'

const DIR = fileURLToPath(new URL('../../../snapshots/web/knowledge-organizer', import.meta.url))
const FIXTURE = join(DIR, 'session.v2.jsonl')

describe('manual LLM knowledge organization', () => {
  let scaffold: WebScaffold | undefined
  let browser: Browser | undefined
  let page: Page | undefined
  beforeAll(async () => {
    scaffold = await launchWebScaffold({ replayFixture: FIXTURE, compareReplaySession: true })
    const decoded = parseSeedFixture(await readFile(FIXTURE, 'utf8'))
    const lastSource = decoded.events.findIndex(event => event.type === 'turn/end')
    await seedSession(scaffold, renderSeedFixture(decoded.headerLine, decoded.events.slice(0, lastSource + 1)), 'knowledge-organizer', 'minimal')
    browser = await chromium.launch()
    page = await newEnglishPage(browser, 1000, 'product-default')
  })
  afterAll(async () => {
    const failures: unknown[] = []
    await page?.close().catch((error: unknown) => failures.push(error))
    await browser?.close().catch((error: unknown) => failures.push(error))
    await scaffold?.close().catch((error: unknown) => failures.push(error))
    if (failures.length > 0) throw new AggregateError(failures, 'knowledge organizer teardown failed')
  })

  it('organizes on demand, persists the map, and returns to exact original evidence', async () => {
    if (scaffold === undefined || page === undefined) throw new Error('the browser scaffold must be initialized')
    const errors = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    const open = async () => {
      const search = page!.getByRole('button', { name: 'Search sessions', exact: true })
      if (await search.getAttribute('aria-expanded') !== 'true') await search.click()
      await page!.getByRole('textbox', { name: 'Search sessions...', exact: true }).fill('KNOWLEDGE_ORGANIZER_REQUEST')
      const rows = page!.getByRole('tree', { name: 'Search results' }).getByRole('treeitem')
      await expect.poll(() => rows.count()).toBe(1)
      await rows.click()
    }
    await open()
    const center = page.locator('[class*="centerCol"]')
    const action = center.getByRole('button', { name: 'Organize map with LLM', exact: true })
    await action.waitFor()
    expect(await center.locator('[data-organized-knowledge]').count()).toBe(0)
    await action.click()
    const organized = center.locator('[data-organized-knowledge]')
    await organized.waitFor({ timeout: 30_000 })
    await expect.poll(() => organized.locator('[data-organized-node]').count()).toBe(2)
    await compareOrRefreshGolden(join(DIR, 'ui.expected.md'),
      await captureStableAria(page, '[data-organized-knowledge]', scaffold.workspaceCwd), webSnapshotMode())
    if (process.env.DSH_KNOWLEDGE_SCREENSHOT_DIR !== undefined) await page.screenshot({ path: join(process.env.DSH_KNOWLEDGE_SCREENSHOT_DIR, 'knowledge-organizer-desktop.png') })
    await page.setViewportSize({ width: 650, height: 900 })
    await expect.poll(() => organized.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    if (process.env.DSH_KNOWLEDGE_SCREENSHOT_DIR !== undefined) await page.screenshot({ path: join(process.env.DSH_KNOWLEDGE_SCREENSHOT_DIR, 'knowledge-organizer-narrow.png') })
    await organized.locator('[data-organized-node="n2"]').click()
    await organized.getByText('Overload reduces recall.', { exact: true }).waitFor()
    await page.reload({ waitUntil: 'load' })
    await open()
    await organized.waitFor()
    await organized.getByRole('button', { name: 'View turn 1 source', exact: true }).first().click()
    await center.getByRole('heading', { name: 'Memory and attention', exact: true }).waitFor()
    expect(errors.pageErrors).toEqual([])
    expect(errors.warnings).toEqual([])
  }, 60_000)
})
