/** Recorded turn outcomes and explicitly labelled original excerpts. */

import type { DetailsSlotProps } from '../contract/slots.ts'
import type { ChatSourceTarget } from '../contract/store.ts'
import type { KnowledgeCard, KnowledgeDocument } from './model.ts'
import { KnowledgeActions } from './KnowledgeActions.tsx'
import css from './ExecutiveSummary.module.css'

/**
 * Render completion state independently from available text and produced files.
 * @param props - Loaded document, exact source navigation, and locale seat.
 * @returns the latest recorded outcome and explicit summary/coverage limitations.
 */
export function KnowledgeStatusSummary({ document, openSource, t }: {
  document: KnowledgeDocument
  openSource: (source: ChatSourceTarget) => void
  t: DetailsSlotProps['t']
}) {
  const latest = document.turns.at(-1)
  return (
    <section className={css.section} aria-label={t('knowledge.status.label')}>
      {latest !== undefined && (
        <p>
          {t('knowledge.turn', { turn: latest.turn })} · {t(`knowledge.status.${latest.status}`)}{' '}
          <button type="button" onClick={() => { openSource(latest.source) }}>{t('knowledge.source.open')}</button>
        </p>
      )}
      {document.incomplete && <p>{t('knowledge.coverage.partial')}</p>}
      {document.excerpts.length === 0 && <p>{t('knowledge.summary.empty')}</p>}
      {document.cards.some(card => card.kind === 'artifact') && latest?.status !== 'completed' && (
        <p>{t('knowledge.artifacts.partial')}</p>
      )}
    </section>
  )
}

/**
 * Render source-labelled excerpts, recorded outcomes, selection, and navigable bookmarks.
 * @param props - Source document and shared reader/inspector actions.
 * @returns the right-column source overview without inferred findings or decisions.
 */
export function ExecutiveSummary({ document, selected, bookmarks, onToggleBookmark, openSource, inspectTool, readCard, t }: {
  document: KnowledgeDocument
  selected: KnowledgeCard | undefined
  bookmarks: readonly string[]
  onToggleBookmark: () => void
  openSource: (source: ChatSourceTarget) => void
  inspectTool: (card: KnowledgeCard) => void
  readCard: (id: string) => void
  t: DetailsSlotProps['t']
}) {
  const bookmarked = selected !== undefined && bookmarks.includes(selected.id)
  const saved = document.cards.filter(card => bookmarks.includes(card.id))
  const artifacts = document.cards.filter(card => card.kind === 'artifact')
  return (
    <div className={css.root}>
      <KnowledgeStatusSummary document={document} openSource={openSource} t={t} />
      {selected !== undefined && (
        <section className={css.focus}>
          <div className={css.focusMeta}>{t(`knowledge.kind.${selected.kind}`)}</div>
          <h3>{selected.title || t(`knowledge.kind.${selected.kind}`)}</h3>
          {selected.summary !== '' && <p>{selected.summary}</p>}
          {selected.status !== undefined && <p>{t(`knowledge.status.${selected.status}`)}</p>}
          <KnowledgeActions card={selected} openSource={openSource} inspectTool={inspectTool} readCard={readCard} t={t} />
          <button type="button" aria-pressed={bookmarked} onClick={onToggleBookmark}>
            {bookmarked ? t('knowledge.bookmarked') : t('knowledge.bookmark')}
          </button>
        </section>
      )}
      {[
        { title: t('knowledge.summary.findings'), cards: document.excerpts },
        { title: t('knowledge.kind.artifact'), cards: artifacts },
        { title: t('knowledge.summary.bookmarks'), cards: saved },
      ].map(group => group.cards.length === 0 ? null : (
        <section className={css.section} key={group.title}>
          <h3>{group.title}</h3>
          {group.cards.map(card => (
            <div key={card.id}>
              {card.kind === 'section' && <h4>{card.title}</h4>}
              <p>{card.kind === 'answer' || card.kind === 'section' ? card.summary : card.title}</p>
              <KnowledgeActions card={card} openSource={openSource} inspectTool={inspectTool} readCard={readCard} t={t} />
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
