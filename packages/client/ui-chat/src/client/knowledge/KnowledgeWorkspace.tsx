/** Summary, complete chapter navigation, structural map, and Markdown reading over shared sources. */
import { useMemo, useState } from 'react'
import { KnowledgeActions } from './KnowledgeActions.tsx'
import { KnowledgeStatusSummary } from './ExecutiveSummary.tsx'
import { KnowledgeReader } from './KnowledgeReader.tsx'
import { KnowledgeGraph } from './KnowledgeGraph.tsx'
import { KnowledgeChanges } from './KnowledgeChanges.tsx'
import { OrganizedKnowledge } from './OrganizedKnowledge.tsx'
import type { KnowledgeWorkspaceProps } from './workspace-props.ts'
import css from './KnowledgeWorkspace.module.css'

/**
 * Present a research overview before the map and keep every loaded card reachable in a searchable list.
 * @param props - Reconstructed source document, local reading preferences, and existing conversation actions.
 * @returns equivalent map/list/reader paths with explicit history and comparison coverage.
 */
export function KnowledgeWorkspace(props: KnowledgeWorkspaceProps) {
  const { document, mode, setMode, openTranscript, readCard, t } = props
  const [query, setQuery] = useState('')
  const [turn, setTurn] = useState<number | null>(null)
  const [sourceView, setSourceView] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const [organizeError, setOrganizeError] = useState<string | null>(null)
  const organized = props.organization?.document
  const showOrganized = mode === 'map' && organized != null && !sourceView
  const organize = async (cancel = false): Promise<void> => {
    if (!cancel) { setOrganizing(true); setOrganizeError(null) }
    try {
      const error = await props.organizeKnowledge(cancel)
      setOrganizeError(error)
      if (error === null && !cancel) { setSourceView(false); setMode('map') }
    } catch (error) {
      setOrganizeError(error instanceof Error ? error.message : String(error))
    } finally {
      if (!cancel) setOrganizing(false)
    }
  }
  const latest = document.turns.at(-1)
  const question = document.cards.find(card => card.kind === 'question' && card.turn === latest?.turn)
  const excerpts = document.excerpts.filter(card => card.turn === latest?.turn)
  const chapters = excerpts.filter(card => (card.depth ?? 2) > 1)
  const lead = (chapters.length > 0 ? chapters : excerpts).slice(0, 2)
  const artifacts = document.cards.filter(card => card.kind === 'artifact')
  const scoped = useMemo(() => ({ ...document, cards: document.cards.filter(card => turn === null || card.turn === turn || card.kind === 'topic') }), [document, turn])
  const found = scoped.cards.filter(card => `${card.title}\n${card.summary}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return (
    <section className={css.root}>
      <header className={css.toolbar}>
        <div><span className={css.eyebrow}>{t('knowledge.eyebrow')}</span><h2>{t(mode === 'reading' ? 'knowledge.mode.reading' : 'knowledge.title')}</h2></div>
        <div className={css.modeSwitch} role="tablist" aria-label={t('knowledge.mode.label')}>
          <button type="button" role="tab" aria-selected={mode === 'map'} onClick={() => { setMode('map') }}>{t('knowledge.mode.map')}</button>
          <button type="button" role="tab" aria-selected={mode === 'reading'} onClick={() => { setMode('reading') }}>{t('knowledge.mode.reading')}</button>
          {openTranscript !== undefined && <button type="button" role="tab" aria-selected={false} onClick={openTranscript}>{t('knowledge.mode.transcript')}</button>}
        </div>
      </header>
      <div className={css.organizeControls}>
        <div>
          <button type="button" disabled={organizing || props.running} onClick={() => { void organize() }}>
            {t(organizing ? 'knowledge.organize.busy' : organized == null ? 'knowledge.organize.action' : 'knowledge.organize.again')}
          </button>
          {organizing && <button type="button" onClick={() => { void organize(true) }}>{t('knowledge.organize.cancel')}</button>}
          {organized != null && <button type="button" aria-pressed={sourceView} onClick={() => { setSourceView(value => !value); setMode('map') }}>
            {t(sourceView ? 'knowledge.organize.showOrganized' : 'knowledge.organize.showSources')}
          </button>}
        </div>
        <p className={css.hint}>{t(props.running ? 'knowledge.organize.wait' : 'knowledge.organize.hint')}</p>
        {props.organization?.stale === true && <p role="status">{t('knowledge.organize.stale')}</p>}
        {organizeError !== null && <p role="alert">{organizeError}</p>}
      </div>
      {showOrganized && <OrganizedKnowledge key={organized.requestSeq} record={organized} openSource={props.openSource} t={t} />}
      {mode === 'map' && !showOrganized && <div className={css.overview}>
        <section className={css.researchQuestion}>
          <h3>{t('knowledge.overview.question')}</h3>
          <p>{question?.details || document.title}</p>
        </section>
        <div className={css.overviewGrid}>
          <section>
            <h3>{t('knowledge.overview.answer')}</h3>
            {lead.length === 0 ? <p>{t('knowledge.summary.empty')}</p> : lead.map(card => <div className={css.excerpt} key={card.id}>
              <button type="button" onClick={() => { readCard(card.id) }}>{card.title}</button><p>{card.summary}</p>
            </div>)}
            {excerpts.length > lead.length && <p className={css.hint}>{t('knowledge.overview.more', { count: excerpts.length - lead.length })}</p>}
          </section>
          <section>
            <h3>{t('knowledge.overview.limits')}</h3>
            <KnowledgeStatusSummary document={document} openSource={props.openSource} t={t} />
            <p className={css.hint}>{t('knowledge.overview.unverified')}</p>
            <h3>{t('knowledge.kind.artifact')}</h3>
            {artifacts.length === 0 ? <p className={css.hint}>{t('knowledge.overview.noArtifacts')}</p> : <details>
              <summary>{t('knowledge.overview.artifacts', { count: artifacts.length })}</summary>
              {artifacts.map(card => <div key={card.id}>
                <strong>{card.title}</strong>
                <KnowledgeActions card={card} openSource={props.openSource} inspectTool={props.inspectTool}
                  openFile={props.openFile} t={t} />
              </div>)}
            </details>}
          </section>
        </div>
      </div>}
      {!showOrganized && <><div className={css.coverage}>
        <span>{t('knowledge.coverage.count', { turns: document.turns.length, cards: document.cards.length })}</span>
        {document.incomplete && <><span>{t('knowledge.coverage.partial')}</span><button type="button" disabled={props.loadingHistory} onClick={props.loadHistory}>{t(props.loadingHistory ? 'loading' : 'knowledge.coverage.load')}</button></>}
      </div>
      <div className={css.workbench}>
        <details className={css.navigator} open>
          <summary>{t('knowledge.navigator.title')}</summary>
          <label>{t('knowledge.navigator.search')}<input type="search" value={query} onChange={(event) => { setQuery(event.target.value) }} /></label>
          <label>{t('knowledge.navigator.scope')}<select aria-label={t('knowledge.navigator.scope')} value={turn ?? ''} onChange={(event) => { setTurn(event.target.value === '' ? null : Number(event.target.value)) }}>
            <option value="">{t('knowledge.navigator.all')}</option>
            {document.turns.map(item => <option key={item.turn} value={item.turn}>{t('knowledge.turn', { turn: item.turn })}</option>)}
          </select></label>
          <p role="status">{t('knowledge.navigator.count', { shown: found.length, total: scoped.cards.length })}</p>
          <nav aria-label={t('knowledge.navigator.title')} className={css.navigatorList}>
            {found.map(card => <button type="button" key={card.id} aria-current={props.selectedId === card.id || undefined}
              data-knowledge-list={card.id} data-depth={card.depth ?? 0} onClick={() => { readCard(card.id) }}>
              <span>{t(`knowledge.kind.${card.kind}`)}{card.turn !== undefined && ` · ${t('knowledge.turn', { turn: card.turn })}`}</span>
              {card.title || t(`knowledge.kind.${card.kind}`)}
            </button>)}
            {found.length === 0 && <p>{t('knowledge.navigator.empty')}</p>}
          </nav>
        </details>
        {mode === 'map' ? <KnowledgeGraph document={scoped} selectedId={props.selectedId} readCard={readCard} t={t} /> : <KnowledgeReader {...props} />}
      </div>
      <KnowledgeChanges {...props} />
      </>}
    </section>
  )
}
