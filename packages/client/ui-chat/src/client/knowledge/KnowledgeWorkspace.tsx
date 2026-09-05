/** Map-first and reading-mode presentation for a Knowledge Workspace document. */

import { useEffect, useMemo, useRef } from 'react'
import {
  IconCheckOutline16, IconChevronDownOutline14, IconChevronRightOutline14,
  IconChecklistOutline14, IconListPenOutline16, IconSparkle16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import type { KnowledgeCard, KnowledgeCardKind, KnowledgeDocument } from './model.ts'
import type { ChatSourceTarget } from '../contract/store.ts'
import { KnowledgeActions } from './KnowledgeActions.tsx'
import { KnowledgeStatusSummary } from './ExecutiveSummary.tsx'
import css from './KnowledgeWorkspace.module.css'

interface KnowledgeWorkspaceProps {
  readonly document: KnowledgeDocument
  readonly mode: 'map' | 'reading'
  readonly selectedId: string | null
  readonly bookmarks: readonly string[]
  readonly expandedCards: readonly string[]
  readonly setMode: (mode: 'map' | 'reading') => void
  readonly openTranscript?: () => void
  readonly openSource: (source: ChatSourceTarget) => void
  readonly inspectTool: (card: KnowledgeCard) => void
  readonly openFile: (path: string) => void
  readonly select: (id: string) => void
  readonly toggleBookmark: (id: string) => void
  readonly toggleCard: (id: string) => void
  readonly t: ChatViewSlotProps['t']
}

const KIND_ICON = {
  topic: IconSparkle16,
  question: IconListPenOutline16,
  answer: IconCheckOutline16,
  section: IconListPenOutline16,
  tool: IconChecklistOutline14,
  reference: IconListPenOutline16,
  artifact: IconListPenOutline16,
} satisfies Record<KnowledgeCardKind, typeof IconSparkle16>

function cardTitle(card: KnowledgeCard, t: ChatViewSlotProps['t']): string {
  return card.title || t(`knowledge.kind.${card.kind}`)
}

function cardPosition(card: KnowledgeCard, index: number): { left: string; top: string } {
  if (card.kind === 'topic') return { left: '46%', top: '48%' }
  const lane = Math.max(0, index - 1) % 6
  const row = Math.floor(index / 6)
  const positions = [
    [20, 18], [72, 18], [16, 52], [76, 52], [28, 80], [64, 80],
  ] as const
  const [left, top] = positions[lane] ?? positions[0]
  const drift = Math.min(8, row * 3)
  return {
    left: `${String(Math.min(78, left + drift))}%`,
    top: `${String(Math.min(82, top + drift))}%`,
  }
}

function MapNode({ card, index, selected, bookmarked, onSelect, t }: {
  card: KnowledgeCard
  index: number
  selected: boolean
  bookmarked: boolean
  onSelect: () => void
  t: ChatViewSlotProps['t']
}) {
  const Icon = KIND_ICON[card.kind]
  return (
    <button
      type="button"
      className={[css.mapNode, css[`kind_${card.kind}`], selected ? css.selected : ''].join(' ')}
      style={cardPosition(card, index)}
      onClick={onSelect}
      aria-current={selected || undefined}
    >
      <span className={css.nodeMeta}><Icon size={14} />{t(`knowledge.kind.${card.kind}`)}</span>
      <strong>{cardTitle(card, t)}</strong>
      <span>{card.summary}</span>
      {card.status !== undefined && <span>{t(`knowledge.status.${card.status}`)}</span>}
      {bookmarked && <span className={css.bookmarkMark}>{t('knowledge.bookmarked')}</span>}
    </button>
  )
}

function Graph({ document, selectedId, bookmarks, select, t }: Pick<KnowledgeWorkspaceProps,
  'document' | 'selectedId' | 'bookmarks' | 'select' | 't'>) {
  const visible = useMemo(() => {
    const topic = document.cards.find(card => card.kind === 'topic')
    const references = document.cards.filter(card => card.kind === 'reference').slice(0, 1)
    const surrounding = [
      ...document.cards.filter(card => card.kind === 'question').slice(-2),
      ...document.cards.filter(card => card.kind === 'answer').slice(-2),
      ...document.cards.filter(card => card.kind === 'artifact').slice(-1),
      ...document.cards.filter(card => card.kind === 'tool').slice(-1),
      ...references,
    ]
    return topic === undefined ? surrounding : [topic, ...surrounding]
  }, [document.cards])
  const visiblePositions = new Map(visible.map((card, index) => [card.id, cardPosition(card, index)]))
  const visibleEdges = document.edges.flatMap((edge) => {
    const from = visiblePositions.get(edge.from)
    const to = visiblePositions.get(edge.to)
    return from === undefined || to === undefined ? [] : [{ edge, from, to }]
  })
  return (
    <div className={css.graph} aria-label={t('knowledge.map.label')}>
      <div className={css.grid} aria-hidden />
      <svg className={css.edges} viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden>
        {visibleEdges.map(({ edge, from, to }) => {
          return (
            <line
              key={`${edge.from}:${edge.to}`}
              x1={parseFloat(from.left) * 10 + 70}
              y1={parseFloat(from.top) * 7 + 35}
              x2={parseFloat(to.left) * 10 + 70}
              y2={parseFloat(to.top) * 7 + 35}
            />
          )
        })}
      </svg>
      {visible.map((card, index) => (
        <MapNode
          key={card.id}
          card={card}
          index={index}
          selected={card.id === selectedId}
          bookmarked={bookmarks.includes(card.id)}
          onSelect={() => { select(card.id) }}
          t={t}
        />
      ))}
      {visible.length === 1 && <div className={css.emptyMap}>{t('knowledge.map.empty')}</div>}
    </div>
  )
}

function ReadingCards(
  { document, selectedId, bookmarks, expandedCards, select, toggleBookmark, toggleCard, openSource, inspectTool, openFile, t }:
  Omit<KnowledgeWorkspaceProps, 'mode' | 'setMode'>,
) {
  const focusedCard = useRef<HTMLElement>(null)
  useEffect(() => {
    const card = focusedCard.current
    const scroll = card?.closest('[data-conversation-scroll]') ?? card?.parentElement
    if (card !== null && scroll instanceof HTMLElement) {
      const scrollTop = scroll.getBoundingClientRect().top
      const toolbarBottom = card.closest('section')?.querySelector('header')?.getBoundingClientRect().bottom ?? scrollTop
      scroll.scrollTop += card.getBoundingClientRect().top - Math.max(scrollTop, toolbarBottom)
    }
  }, [selectedId, expandedCards])
  const total = Math.max(1, document.cards.length)
  const selectedIndex = document.cards.findIndex(card => card.id === selectedId)
  const current = selectedIndex < 0 ? 1 : selectedIndex + 1
  return (
    <div className={css.reading}>
      <div className={css.readingIntro}>
        <span>{t('knowledge.reading.progress', { current, total })}</span>
        <div className={css.progress}><span style={{ width: `${String(Math.min(100, current / total * 100))}%` }} /></div>
      </div>
      {document.cards.map((card) => {
        const expanded = expandedCards.includes(card.id)
        const bookmarked = bookmarks.includes(card.id)
        const Icon = KIND_ICON[card.kind]
        return (
          <article
            key={card.id} ref={card.id === selectedId ? focusedCard : undefined}
            data-knowledge-card={card.id} aria-current={card.id === selectedId || undefined}
            className={[css.knowledgeCard, card.id === selectedId ? css.cardSelected : ''].join(' ')}
          >
            <button type="button" className={css.cardHeader} aria-expanded={expanded} onClick={() => { select(card.id); toggleCard(card.id) }}>
              <span className={css.cardKind}><Icon size={14} />{t(`knowledge.kind.${card.kind}`)}</span>
              <strong>{cardTitle(card, t)}</strong>
              {expanded ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
            </button>
            <p>{card.summary}</p>
            {card.status !== undefined && <p>{t(`knowledge.status.${card.status}`)}</p>}
            {expanded && card.details !== '' && <div className={css.cardDetails}>{card.details}</div>}
            <KnowledgeActions card={card} openSource={openSource} inspectTool={inspectTool} openFile={openFile} t={t} />
            <div className={css.cardActions}>
              <button type="button" onClick={() => { toggleBookmark(card.id) }} aria-pressed={bookmarked}>
                {bookmarked ? t('knowledge.bookmarked') : t('knowledge.bookmark')}
              </button>
              {card.turn !== undefined && <span>{t('knowledge.turn', { turn: card.turn })}</span>}
            </div>
          </article>
        )
      })}
    </div>
  )
}

/**
 * Render the selected Knowledge Workspace surface.
 * @param props - Document, browser-local reading state, and locale actions.
 * @returns the map-first workspace with a functional reading-mode switch.
 */
export function KnowledgeWorkspace(props: KnowledgeWorkspaceProps) {
  const { document, mode, setMode, openTranscript, t } = props
  return (
    <section className={css.root}>
      <header className={css.toolbar}>
        <div>
          <span className={css.eyebrow}>{t('knowledge.eyebrow')}</span>
          <h2>{t('knowledge.title')}</h2>
          {document.title !== '' && <p>{document.title}</p>}
        </div>
        <div className={css.modeSwitch} role="tablist" aria-label={t('knowledge.mode.label')}>
          <button type="button" role="tab" aria-selected={mode === 'map'} onClick={() => { setMode('map') }}>
            {t('knowledge.mode.map')}
          </button>
          <button type="button" role="tab" aria-selected={mode === 'reading'} onClick={() => { setMode('reading') }}>
            {t('knowledge.mode.reading')}
          </button>
          {openTranscript !== undefined && (
            <button type="button" role="tab" aria-selected={false} onClick={openTranscript}>
              {t('knowledge.mode.transcript')}
            </button>
          )}
        </div>
      </header>
      <KnowledgeStatusSummary document={document} openSource={props.openSource} t={t} />
      {mode === 'map'
        ? <Graph {...props} />
        : <ReadingCards {...props} />}
    </section>
  )
}
