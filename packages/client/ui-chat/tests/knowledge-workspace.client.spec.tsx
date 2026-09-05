// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import { zhTW as commonZhTW } from '@deepseek-ai/dsh-client-locale/src/locales/zh-TW.ts'
import type { KnowledgeWorkspaceProps } from '../src/client/knowledge/workspace-props.ts'
import { KnowledgeChanges } from '../src/client/knowledge/KnowledgeChanges.tsx'
import { KnowledgeWorkspace } from '../src/client/knowledge/KnowledgeWorkspace.tsx'
import { ExecutiveSummary, KnowledgeStatusSummary } from '../src/client/knowledge/ExecutiveSummary.tsx'
import { KnowledgeActions } from '../src/client/knowledge/KnowledgeActions.tsx'
import type { KnowledgeDocument } from '../src/client/knowledge/model.ts'
import { zhTW } from '../src/client/locale.ts'

afterEach(cleanup)

const t = makeTranslate(zhTW, commonZhTW)
const document: KnowledgeDocument = {
  title: '如何讓長篇對話更容易理解？',
  cards: [
    { id: 'topic:session', kind: 'topic', title: '知識工作區', summary: '以地圖先掌握全貌。', details: '' },
    {
      id: 'turn:1:answer', kind: 'answer', title: '採用知識地圖', summary: '先呈現結論，再提供細節。',
      details: '完整答案內容。', turn: 1,
    },
  ],
  edges: [{ from: 'topic:session', to: 'turn:1:answer' }],
  excerpts: [],
  turns: [],
  incomplete: false,
}

function props(overrides: Partial<KnowledgeWorkspaceProps> = {}): KnowledgeWorkspaceProps {
  return { document, mode: 'map', selectedId: null, bookmarks: [],
    openSource: vi.fn(), inspectTool: vi.fn(), openFile: vi.fn(), setMode: vi.fn(),
    readCard: vi.fn(), toggleBookmark: vi.fn(), saveReadingPosition: vi.fn(),
    loadHistory: vi.fn(), loadingHistory: false, canDraft: true, stageDraft: vi.fn(), t, ...overrides }
}

describe('KnowledgeWorkspace', () => {
  it('opens a graph source in the reader and retains equivalent searchable list navigation', () => {
    const readCard = vi.fn()
    const setMode = vi.fn()
    const openTranscript = vi.fn()
    render(<KnowledgeWorkspace {...props({ readCard, setMode, openTranscript })} />)
    const graph = screen.getByRole('region', { name: zhTW['knowledge.map.label'] })
    fireEvent.click(within(graph).getByRole('button', { name: /採用知識地圖/ }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '採用' } })
    expect(screen.getByText('清單顯示 1/2 項')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /採用/ }))
    fireEvent.click(screen.getByRole('tab', { name: '閱讀' }))
    fireEvent.click(screen.getByRole('tab', { name: '原始對話' }))
    expect(readCard).toHaveBeenCalledWith('turn:1:answer')
    expect(readCard).toHaveBeenCalledTimes(2)
    expect(setMode).toHaveBeenCalledWith('reading')
    expect(openTranscript).toHaveBeenCalledOnce()
  })

  it('renders a complete Markdown section, resolves references outside it, and restores the reader offset', () => {
    const section = { id: 'section:27:4', kind: 'section' as const, title: 'Memory', summary: 'Excerpt',
      details: '## Memory\n\n| Condition | Result |\n| --- | --- |\n| Focus | Better |\n\n[Evidence][ref]', source: { turn: 1, turnSeq: SessionSeq(1), seq: SessionSeq(27) } }
    const answer = { ...section, id: 'answer:27', kind: 'answer' as const, details: section.details + '\n\n[ref]: https://example.test/evidence' }
    const source = { ...document, cards: [answer, section], excerpts: [section] }
    const saveReadingPosition = vi.fn()
    const toggleBookmark = vi.fn()
    const view = render(<KnowledgeWorkspace {...props({ document: source, mode: 'reading', selectedId: section.id,
      readingPosition: { cardId: section.id, scrollTop: 180 }, saveReadingPosition, toggleBookmark })} />)
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Evidence' }).getAttribute('href')).toBe('https://example.test/evidence')
    const reader = view.container.querySelector<HTMLElement>('[data-knowledge-reader]')!
    expect(reader.scrollTop).toBe(180)
    reader.scrollTop = 220
    fireEvent.click(screen.getByRole('button', { name: '加入書籤' }))
    expect(toggleBookmark).toHaveBeenCalledWith(section.id)
    view.unmount()
    expect(saveReadingPosition).toHaveBeenCalledWith({ cardId: section.id, scrollTop: 220 })
  })

  it('offers explicit full-history loading and never drops a source from the list', () => {
    const cards = Array.from({ length: 200 }, (_, index) => ({ ...document.cards[1]!, id: String(index), title: `Section ${String(index)}` }))
    const loadHistory = vi.fn()
    render(<KnowledgeWorkspace {...props({ document: { ...document, cards, incomplete: true }, loadHistory })} />)
    expect(within(screen.getByRole('navigation')).getAllByRole('button')).toHaveLength(200)
    fireEvent.click(screen.getByRole('button', { name: '載入完整對話' }))
    expect(loadHistory).toHaveBeenCalledOnce()
  })

  it('creates an editable source-backed question without sending or replacing an occupied composer', () => {
    const first = { ...document.cards[1]!, id: 'before', kind: 'section' as const, title: 'Memory', details: 'Positive effect.', turn: 1 }
    const second = { ...first, id: 'after', details: 'Negative effect under overload.', turn: 2 }
    const source = { ...document, cards: [first, second], excerpts: [first, second],
      turns: [1, 2].map(turn => ({ turn, status: 'completed' as const, source: { turn, seq: SessionSeq(turn), turnSeq: SessionSeq(turn) } })) }
    const stageDraft = vi.fn()
    const shared = props({ document: source, stageDraft, canDraft: false })
    const view = render(<KnowledgeChanges {...shared} />)
    fireEvent.click(screen.getByText(/知識變化與待解問題/))
    fireEvent.click(screen.getByRole('button', { name: 'Memory' }))
    expect(screen.getByText('Positive effect.')).toBeTruthy()
    expect(screen.getByText('Negative effect under overload.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '釐清矛盾' }))
    const draft = screen.getByRole('textbox', { name: '追問草稿' }) as HTMLTextAreaElement
    expect(draft.value).toContain('Positive effect.')
    expect(draft.value).toContain('Negative effect under overload.')
    expect(screen.getByRole('button', { name: '放入輸入框' }).hasAttribute('disabled')).toBe(true)
    expect(stageDraft).not.toHaveBeenCalled()
    view.rerender(<KnowledgeChanges {...shared} canDraft />)
    fireEvent.change(draft, { target: { value: 'Please verify both sources.' } })
    fireEvent.click(screen.getByRole('button', { name: '放入輸入框' }))
    expect(stageDraft).toHaveBeenCalledWith('Please verify both sources.')
    expect(screen.getByRole('status').textContent).toBe('已放入輸入框，尚未送出。')
  })
})

describe('ExecutiveSummary', () => {
  it('keeps a failed outcome explicit when successful files remain', () => {
    render(<KnowledgeStatusSummary
      document={{ ...document, turns: [{ turn: 1, status: 'error', source: { turn: 1, turnSeq: SessionSeq(1), seq: SessionSeq(1) } }],
        cards: [{ id: 'artifact:5', kind: 'artifact', title: 'report.md', path: '/report.md', summary: '', details: '' }], incomplete: true }}
      openSource={vi.fn()} t={t}
    />)
    expect(screen.getByText(/第 1 輪 · 失敗/)).toBeTruthy()
    expect(screen.getByText(zhTW['knowledge.artifacts.partial'])).toBeTruthy()
    expect(screen.getByText(zhTW['knowledge.coverage.partial'])).toBeTruthy()
    expect(screen.getByText(zhTW['knowledge.summary.empty'])).toBeTruthy()
  })

  it('routes the original record separately from the current file and external reference', () => {
    const source = { turn: 2, turnSeq: SessionSeq(10), seq: SessionSeq(15), nodeKey: 'tool:c2' }
    const card = { id: 'artifact:15', kind: 'artifact' as const, title: 'report.md', summary: '', details: '',
      path: '/report.md', source, tool: { name: 'write', callId: 'c2' }, url: 'https://example.com/source' }
    const openSource = vi.fn()
    const inspectTool = vi.fn()
    const openFile = vi.fn()
    render(<KnowledgeActions card={card} openSource={openSource} inspectTool={inspectTool} openFile={openFile} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: '查看原始對話' }))
    fireEvent.click(screen.getByRole('button', { name: '查看工具記錄' }))
    fireEvent.click(screen.getByRole('button', { name: '開啟目前檔案' }))
    expect(openSource).toHaveBeenCalledWith(source)
    expect(inspectTool).toHaveBeenCalledWith(card)
    expect(openFile).toHaveBeenCalledWith('/report.md')
    expect(screen.getByRole('link', { name: '開啟引用' }).getAttribute('href')).toBe('https://example.com/source')
  })

  it('labels source excerpts and keeps saved bookmarks visible', () => {
    render(
      <ExecutiveSummary
        readCard={vi.fn()}
        openSource={vi.fn()}
        inspectTool={vi.fn()}
        document={{ ...document, excerpts: [document.cards[1]!] }}
        selected={document.cards[1]}
        bookmarks={['turn:1:answer']}
        onToggleBookmark={vi.fn()}
        t={t}
      />,
    )

    expect(screen.getByText('原文摘錄')).toBeTruthy()
    expect(screen.queryByText('決策')).toBeNull()
    expect(screen.getByText('書籤')).toBeTruthy()
    expect(screen.getByRole('button', { name: '已加入書籤' }).getAttribute('aria-pressed')).toBe('true')
  })
})
