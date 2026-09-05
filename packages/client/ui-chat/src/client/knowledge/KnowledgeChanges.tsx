/** Before/after source review and an editable question staged through normal conversation input. */
import { useMemo, useState } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { markdownLabels } from '../markdown-labels.ts'
import { deriveKnowledgeEvolution } from './evolution.ts'
import type { KnowledgeWorkspaceProps } from './workspace-props.ts'
import type { KnowledgeCard } from './model.ts'
import css from './KnowledgeWorkspace.module.css'

/**
 * Compare durable excerpts without classifying a textual difference as a semantic correction.
 * @param props - Complete loaded sources and user-controlled draft actions.
 * @returns change disclosure, paired original text, and a question draft that is never sent automatically.
 */
export function KnowledgeChanges({ document, selectedId, readCard, openSource, canDraft, stageDraft, t }: Pick<KnowledgeWorkspaceProps,
  'document' | 'selectedId' | 'readCard' | 'openSource' | 'canDraft' | 'stageDraft' | 't'>) {
  const evolution = useMemo(() => deriveKnowledgeEvolution(document), [document])
  const [open, setOpen] = useState(false)
  const [beforeId, setBeforeId] = useState('')
  const [afterId, setAfterId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [staged, setStaged] = useState(false)
  const labels = useMemo(() => markdownLabels(t), [t])
  const before = document.excerpts.find(card => card.id === beforeId)
  const after = document.excerpts.find(card => card.id === (afterId === null ? selectedId : afterId))
  const changed = evolution.changes.filter(change => change.kind !== 'unchanged')
  const questionFor = (kind: 'verify' | 'refute' | 'revise' | 'gap'): void => {
    const sources = [before, after].filter((card): card is KnowledgeCard => card !== undefined)
    const citations = sources.map(card => `${t('knowledge.turn', { turn: card.turn ?? 0 })} · ${card.title}\n${card.details}`).join('\n\n')
    setQuestion(`${t(`knowledge.question.${kind}`)}\n\n${citations}`)
    setStaged(false)
  }
  return (
    <section className={css.changes}>
      <button type="button" aria-expanded={open} onClick={() => { setOpen(value => !value) }}>{t('knowledge.changes.title')}{evolution.state === 'available' && ` · ${t('knowledge.changes.count', { count: changed.length })}`}</button>
      {open && <>
        <p className={css.hint}>{t('knowledge.changes.method')}</p>
        {evolution.state !== 'available' ? <p>{t(`knowledge.changes.${evolution.state}`)}</p> : (
          <>
            <p>{t('knowledge.changes.between', { before: evolution.beforeTurn ?? 0, after: evolution.afterTurn ?? 0 })}</p>
            {changed.length === 0 && <p>{t('knowledge.changes.none')}</p>}
            <ul className={css.changeList}>
              {changed.map((change) => {
                const card = change.after ?? change.before
                if (card === undefined) return null
                return <li key={card.id}>
                  <span>{t(change.kind === 'unchanged' ? 'knowledge.changes.none' : `knowledge.changes.${change.kind}`)}</span>
                  <button type="button" onClick={() => { setBeforeId(change.before?.id ?? ''); setAfterId(change.after?.id ?? ''); setQuestion('') }}>{card.title}</button>
                </li>
              })}
            </ul>
          </>
        )}
        <p>{t('knowledge.changes.review')}</p>
        <div className={css.comparison}>
          {(['before', 'after'] as const).map((side) => {
            const card = side === 'before' ? before : after
            return <section key={side}>
              <label>{t(`knowledge.changes.${side}`)}
                <select aria-label={t(`knowledge.changes.${side}`)} value={card?.id ?? ''} onChange={(event) => { (side === 'before' ? setBeforeId : setAfterId)(event.target.value); setQuestion('') }}>
                  <option value="">{t('knowledge.changes.choose')}</option>
                  {document.excerpts.map(item => <option value={item.id} key={item.id}>{t('knowledge.turn', { turn: item.turn ?? 0 })} · {item.title}</option>)}
                </select>
              </label>
              {card !== undefined && <>
                <div className={css.comparisonText}><MarkdownText text={card.details} labels={labels}
                  referenceText={document.cards.find(item => item.kind === 'answer' && item.source?.seq === card.source?.seq)?.details} /></div>
                <button type="button" onClick={() => { readCard(card.id) }}>{t('knowledge.source.readSection')}</button>
                {card.source !== undefined && <button type="button" onClick={() => { if (card.source !== undefined) openSource(card.source) }}>{t('knowledge.source.open')}</button>}
              </>}
            </section>
          })}
        </div>
        <div className={css.question}>
          <h4>{t('knowledge.question.title')}</h4>
          <div className={css.questionActions}>
            {(['verify', 'refute', 'revise', 'gap'] as const).map(kind => <button type="button" key={kind} disabled={before === undefined && after === undefined} onClick={() => { questionFor(kind) }}>{t(`knowledge.question.intent.${kind}`)}</button>)}
          </div>
          {question !== '' && <>
            <label>{t('knowledge.question.draft')}<textarea rows={8} value={question} onChange={(event) => { setQuestion(event.target.value); setStaged(false) }} /></label>
            <button type="button" disabled={!canDraft || question.trim() === ''} onClick={() => { stageDraft(question); setStaged(true) }}>{t('knowledge.question.stage')}</button>
            <p role="status">{t(staged ? 'knowledge.question.staged' : canDraft ? 'knowledge.question.hint' : 'knowledge.question.occupied')}</p>
          </>}
        </div>
      </>}
    </section>
  )
}
