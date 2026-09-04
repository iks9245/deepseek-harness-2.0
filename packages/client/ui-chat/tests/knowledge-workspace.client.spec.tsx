// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zhTW as commonZhTW } from '@deepseek-ai/dsh-client-locale/src/locales/zh-TW.ts'
import { KnowledgeWorkspace } from '../src/client/knowledge/KnowledgeWorkspace.tsx'
import { ExecutiveSummary } from '../src/client/knowledge/ExecutiveSummary.tsx'
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
  findings: ['地圖能降低長篇回答的閱讀成本。'],
  decisions: ['採用地圖優先版面。'],
  actions: [],
  risks: [],
}

describe('KnowledgeWorkspace', () => {
  it('selects a graph card and exposes every primary view switch', () => {
    const select = vi.fn()
    const setMode = vi.fn()
    const openTranscript = vi.fn()
    render(
      <KnowledgeWorkspace
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

    expect(screen.getByText('閱讀進度 2/2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /採用知識地圖/ }))
    fireEvent.click(screen.getAllByRole('button', { name: '加入書籤' })[1]!)
    expect(select).toHaveBeenCalledWith('turn:1:answer')
    expect(toggleCard).toHaveBeenCalledWith('turn:1:answer')
    expect(toggleBookmark).toHaveBeenCalledWith('turn:1:answer')
  })
})

describe('ExecutiveSummary', () => {
  it('shows selected context, extracted groups, and saved bookmarks together', () => {
    render(
      <ExecutiveSummary
        document={document}
        selected={document.cards[1]}
        bookmarks={['turn:1:answer']}
        onToggleBookmark={vi.fn()}
        t={t}
      />,
    )

    expect(screen.getByText('關鍵發現')).toBeTruthy()
    expect(screen.getByText('決策')).toBeTruthy()
    expect(screen.getByText('書籤')).toBeTruthy()
    expect(screen.getByRole('button', { name: '已加入書籤' }).getAttribute('aria-pressed')).toBe('true')
  })
})
