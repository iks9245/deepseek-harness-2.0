/** Complete Markdown excerpts with a browser-local place and equivalent source actions. */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { markdownLabels } from '../markdown-labels.ts'
import { KnowledgeActions } from './KnowledgeActions.tsx'
import type { KnowledgeWorkspaceProps } from './workspace-props.ts'
import css from './KnowledgeWorkspace.module.css'

/**
 * Read one complete card, preserving references from its original answer.
 * @param props - Shared source document, reader state, and navigation actions.
 * @returns semantic Markdown and previous/next navigation over every card.
 */
export function KnowledgeReader(props: KnowledgeWorkspaceProps) {
  const { document, selectedId, readCard, bookmarks, toggleBookmark, readingPosition, saveReadingPosition, t } = props
  const cards = document.cards.filter(card => card.kind !== 'topic')
  const card = cards.find(item => item.id === selectedId) ?? document.excerpts.at(-1) ?? cards[0]
  const index = cards.findIndex(item => item.id === card?.id)
  const scroll = useRef<HTMLDivElement>(null)
  const labels = useMemo(() => markdownLabels(t), [t])
  const storedPosition = useRef(readingPosition)
  storedPosition.current = readingPosition
  useLayoutEffect(() => {
    const element = scroll.current
    if (element === null || card === undefined) return
    const position = storedPosition.current
    element.scrollTop = position?.cardId === card.id ? position.scrollTop : 0
    return () => { saveReadingPosition({ cardId: card.id, scrollTop: element.scrollTop }) }
  }, [card?.id, saveReadingPosition])
  if (card === undefined) return <p>{t('knowledge.summary.empty')}</p>
  const original = document.cards.find(item => item.kind === 'answer' && item.source?.seq === card.source?.seq)
  return (
    <div className={css.reader}>
      <div className={css.readerNavigation}>
        <button type="button" disabled={index <= 0} onClick={() => { const previous = cards[index - 1]; if (previous !== undefined) readCard(previous.id) }}>{t('knowledge.reader.previous')}</button>
        <span>{t('knowledge.reading.progress', { current: index + 1, total: cards.length })}</span>
        <button type="button" disabled={index >= cards.length - 1} onClick={() => { const next = cards[index + 1]; if (next !== undefined) readCard(next.id) }}>{t('knowledge.reader.next')}</button>
      </div>
      <div className={css.readerScroll} ref={scroll} data-knowledge-reader="">
        <article data-knowledge-card={card.id} aria-current="true" className={css.knowledgeCard}>
          <header className={css.readerHeader}>
            <span>{t(`knowledge.kind.${card.kind}`)}{card.turn !== undefined && ` · ${t('knowledge.turn', { turn: card.turn })}`}</span>
            <h3>{card.title || t(`knowledge.kind.${card.kind}`)}</h3>
            {card.status !== undefined && <p>{t(`knowledge.status.${card.status}`)}</p>}
            <KnowledgeActions card={card} openSource={props.openSource} inspectTool={props.inspectTool} openFile={props.openFile} t={t} />
            <button type="button" aria-pressed={bookmarks.includes(card.id)} onClick={() => { toggleBookmark(card.id) }}>
              {t(bookmarks.includes(card.id) ? 'knowledge.bookmarked' : 'knowledge.bookmark')}
            </button>
          </header>
          <div className={css.cardDetails}>
            {card.details !== ''
              ? <MarkdownText text={card.details} referenceText={original?.details} labels={labels} />
              : <p>{card.summary || t('knowledge.reader.sourceOnly')}</p>}
          </div>
        </article>
      </div>
    </div>
  )
}
