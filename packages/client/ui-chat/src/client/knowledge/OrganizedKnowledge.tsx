/** Model-organized subjects with inspectable quotations and proposed relationships. */
import { useState } from 'react'
import type { KnowledgeCitation, KnowledgeDocumentRecord } from '@deepseek-ai/dsh-session-knowledge/client'
import type { KnowledgeWorkspaceProps } from './workspace-props.ts'
import css from './KnowledgeWorkspace.module.css'

/**
 * Present a concise subject map; selecting a claim reveals its exact supporting source quotations.
 * @param props - Saved model output and existing source navigation.
 * @returns grouped claims and the selected claim's proposed relationships and evidence.
 */
export function OrganizedKnowledge({ record, openSource, t }: {
  record: KnowledgeDocumentRecord
} & Pick<KnowledgeWorkspaceProps, 'openSource' | 't'>) {
  const [selected, setSelected] = useState(record.map.nodes[0]?.id)
  const node = record.map.nodes.find(item => item.id === selected)
  const groups = [...new Set(record.map.nodes.map(item => item.group))]
  const citations = (sources: readonly KnowledgeCitation[]) => sources.map((citation, index) => {
    const target = record.sources.find(item => item.seq === citation.seq)
    return <blockquote key={`${citation.seq}:${index}`} className={css.organizedQuote}>
      <p>{citation.quote}</p>
      {target !== undefined && <button type="button" onClick={() => { openSource(target) }}>
        {t('knowledge.organize.source', { turn: target.turn })}
      </button>}
    </blockquote>
  })
  return <div className={css.organized} data-organized-knowledge="">
    <header className={css.organizedIntro}>
      <span className={css.eyebrow}>{t('knowledge.organize.saved', { model: record.model.model, sources: record.sources.length })}</span>
      <h3>{record.map.title}</h3><p>{record.map.summary}</p>
      <p className={css.hint}>{t('knowledge.organize.review')}</p>
    </header>
    <div className={css.organizedBody}>
      <nav aria-label={t('knowledge.organize.topics')} className={css.organizedGroups}>
        {groups.map(group => <section key={group}>
          <h4>{group}</h4>
          <div className={css.organizedNodes}>
            {record.map.nodes.filter(item => item.group === group).map(item => <button type="button" key={item.id}
              data-organized-node={item.id} aria-current={item.id === selected || undefined}
              onClick={() => { setSelected(item.id) }}>
              <span className={css.eyebrow}>{t(`knowledge.organize.kind.${item.kind}`)}</span>
              <strong>{item.title}</strong>
            </button>)}
          </div>
        </section>)}
      </nav>
      {node !== undefined && <article className={css.organizedDetail}>
        <h4>{node.title}</h4><p>{node.summary}</p>
        <h4>{t('knowledge.organize.evidence')}</h4>{citations(node.sources)}
        <h4>{t('knowledge.organize.relations')}</h4>
        {record.map.relations.filter(relation => relation.from === node.id || relation.to === node.id).map((relation, index) => <section
          key={index} className={css.organizedRelation}>
          <p><strong>{record.map.nodes.find(item => item.id === relation.from)?.title}</strong>
            {' → '}{t(`knowledge.organize.relation.${relation.kind}`)}{' → '}
            <strong>{record.map.nodes.find(item => item.id === relation.to)?.title}</strong></p>
          <p>{relation.explanation}</p>{citations(relation.sources)}
        </section>)}
        {!record.map.relations.some(relation => relation.from === node.id || relation.to === node.id) && <p className={css.hint}>{t('knowledge.organize.noRelations')}</p>}
      </article>}
    </div>
  </div>
}
