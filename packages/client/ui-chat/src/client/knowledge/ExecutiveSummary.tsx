/** Always-available executive summary for the current Knowledge Workspace. */

import {
  IconCheckOutline16, IconChecklistOutline14, IconSparkle16, IconWarningOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { DetailsSlotProps } from '../contract/slots.ts'
import type { KnowledgeCard, KnowledgeDocument } from './model.ts'
import css from './ExecutiveSummary.module.css'

function SummarySection({ title, items, icon }: {
  title: string
  items: readonly string[]
  icon: 'finding' | 'decision' | 'action' | 'risk' | 'bookmark'
}) {
  const Icon = icon === 'finding'
    ? IconSparkle16
    : icon === 'decision'
      ? IconCheckOutline16
      : icon === 'action' || icon === 'bookmark'
        ? IconChecklistOutline14
        : IconWarningOutline16
  if (items.length === 0) return null
  return (
    <section className={css.section} data-kind={icon}>
      <h3><Icon size={14} />{title}</h3>
      <ul>{items.map((item, index) => <li key={`${String(index)}:${item}`}>{item}</li>)}</ul>
    </section>
  )
}

/**
 * Render the summary, selected card, and fast-scan action/risk groups.
 * @param props - Projected document, selected card, bookmark state, and locale seat.
 * @returns the right-column summary body.
 */
export function ExecutiveSummary({ document, selected, bookmarks, onToggleBookmark, t }: {
  document: KnowledgeDocument
  selected: KnowledgeCard | undefined
  bookmarks: readonly string[]
  onToggleBookmark: () => void
  t: DetailsSlotProps['t']
}) {
  const bookmarked = selected !== undefined && bookmarks.includes(selected.id)
  const bookmarkLabels = bookmarks.flatMap((id) => {
    const card = document.cards.find(candidate => candidate.id === id)
    return card === undefined ? [] : [card.title || t(`knowledge.kind.${card.kind}`)]
  })
  return (
    <div className={css.root}>
      {selected !== undefined && (
        <section className={css.focus}>
          <div className={css.focusMeta}>{t(`knowledge.kind.${selected.kind}`)}</div>
          <h3>{selected.title || t(`knowledge.kind.${selected.kind}`)}</h3>
          <p>{selected.summary}</p>
          <button type="button" aria-pressed={bookmarked} onClick={onToggleBookmark}>
            {bookmarked ? t('knowledge.bookmarked') : t('knowledge.bookmark')}
          </button>
        </section>
      )}
      <SummarySection title={t('knowledge.summary.findings')} items={document.findings} icon="finding" />
      <SummarySection title={t('knowledge.summary.decisions')} items={document.decisions} icon="decision" />
      <SummarySection title={t('knowledge.summary.actions')} items={document.actions} icon="action" />
      <SummarySection title={t('knowledge.summary.risks')} items={document.risks} icon="risk" />
      <SummarySection title={t('knowledge.summary.bookmarks')} items={bookmarkLabels} icon="bookmark" />
      {document.findings.length === 0 && selected === undefined && (
        <div className={css.empty}>{t('knowledge.summary.empty')}</div>
      )}
    </div>
  )
}
