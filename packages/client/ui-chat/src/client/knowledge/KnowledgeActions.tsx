/** Explicit routes from an excerpt or activity card to its recorded source. */

import type { ChatViewSlotProps } from '../contract/slots.ts'
import type { ChatSourceTarget } from '../contract/store.ts'
import type { KnowledgeCard } from './model.ts'
import css from './KnowledgeWorkspace.module.css'

/** Shared source navigation callbacks for the reader and details column. */
export interface KnowledgeActionsProps {
  readonly card: KnowledgeCard
  readonly openSource: (source: ChatSourceTarget) => void
  readonly inspectTool: (card: KnowledgeCard) => void
  readonly readCard?: (id: string) => void
  readonly openFile?: (path: string) => void
  readonly t: ChatViewSlotProps['t']
}

/**
 * Render only actions backed by recorded source identifiers.
 * @param props - Selected source and presentation-owned navigation callbacks.
 * @returns links to original text, tool material, and the explicitly labelled current file.
 */
export function KnowledgeActions({ card, openSource, inspectTool, readCard, openFile, t }: KnowledgeActionsProps) {
  return (
    <div className={css.cardActions}>
      {card.kind === 'section' && readCard !== undefined && (
        <button type="button" onClick={() => { readCard(card.id) }}>{t('knowledge.source.readSection')}</button>
      )}
      {card.source !== undefined && (
        <button type="button" onClick={() => { if (card.source !== undefined) openSource(card.source) }}>
          {t('knowledge.source.open')}
        </button>
      )}
      {card.tool !== undefined && (
        <button type="button" onClick={() => { inspectTool(card) }}>{t('knowledge.source.tool')}</button>
      )}
      {card.path !== undefined && openFile !== undefined && (
        <button type="button" onClick={() => { if (card.path !== undefined) openFile(card.path) }}>
          {t('knowledge.source.currentFile')}
        </button>
      )}
      {card.url !== undefined && <a href={card.url} target="_blank" rel="noreferrer">{t('knowledge.source.reference')}</a>}
    </div>
  )
}
