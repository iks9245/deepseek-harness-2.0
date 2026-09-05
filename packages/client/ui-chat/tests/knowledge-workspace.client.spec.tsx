// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import { zhTW as commonZhTW } from '@deepseek-ai/dsh-client-locale/src/locales/zh-TW.ts'
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

describe('KnowledgeWorkspace', () => {
  it('selects a graph card and exposes every primary view switch', () => {
    const select = vi.fn()
    const setMode = vi.fn()
    const openTranscript = vi.fn()
    render(
      <KnowledgeWorkspace
        openSource={vi.fn()}
        inspectTool={vi.fn()}
        openFile={vi.fn()}
        document={document}
        mode="map"
        selectedId={null}
        bookmarks={[]}
        expandedCards={[]}
        setMode={setMode}
        openTranscript={openTranscript}
        select={select}
        toggleBookmark={vi.fn()}
        toggleCard={vi.fn()}
        t={t}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /採用知識地圖/ }))
    fireEvent.click(screen.getByRole('tab', { name: '閱讀' }))
    fireEvent.click(screen.getByRole('tab', { name: '原始對話' }))
    expect(select).toHaveBeenCalledWith('turn:1:answer')
    expect(setMode).toHaveBeenCalledWith('reading')
    expect(openTranscript).toHaveBeenCalledOnce()
  })

  it('advances reading progress and wires disclosure and bookmark actions', () => {
    const select = vi.fn()
    const toggleBookmark = vi.fn()
    const toggleCard = vi.fn()
    render(
      <KnowledgeWorkspace
        openSource={vi.fn()}
        inspectTool={vi.fn()}
        openFile={vi.fn()}
        document={document}
        mode="reading"
        selectedId="turn:1:answer"
        bookmarks={[]}
        expandedCards={[]}
        setMode={vi.fn()}
        select={select}
        toggleBookmark={toggleBookmark}
        toggleCard={toggleCard}
        t={t}
      />,
    )

    expect(screen.getByText('目前位置 2/2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /採用知識地圖/ }))
    fireEvent.click(screen.getAllByRole('button', { name: '加入書籤' })[1]!)
    expect(select).toHaveBeenCalledWith('turn:1:answer')
    expect(toggleCard).toHaveBeenCalledWith('turn:1:answer')
    expect(toggleBookmark).toHaveBeenCalledWith('turn:1:answer')
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
