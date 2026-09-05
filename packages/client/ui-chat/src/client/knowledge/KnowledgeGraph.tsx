/** Zoomable structural map with measured focus and an explicit tool disclosure. */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import clsx from 'clsx'
import { layoutKnowledgeGraph } from './graph.ts'
import type { KnowledgeWorkspaceProps } from './workspace-props.ts'
import css from './KnowledgeWorkspace.module.css'

/**
 * Render every node in the chosen scope, with cards and paths sharing one scaled canvas.
 * @param props - Filtered source document and shared card navigation.
 * @returns scrollable map, zoom controls, and explicit disclosure counts.
 */
export function KnowledgeGraph({ document, selectedId, readCard, t }: Pick<KnowledgeWorkspaceProps, 'document' | 'selectedId' | 'readCard' | 't'>) {
  const [tools, setTools] = useState(false)
  const [zoom, setZoom] = useState(1)
  const viewport = useRef<HTMLDivElement>(null)
  const graph = useMemo(() => layoutKnowledgeGraph(document, tools), [document, tools])
  const focus = (): void => {
    const node = graph.nodes.find(item => item.card.id === selectedId) ?? graph.nodes[0]
    const element = viewport.current
    if (node !== undefined && element !== null) {
      element.scrollLeft = Math.max(0, (node.x + node.width / 2) * zoom - element.clientWidth / 2)
      element.scrollTop = Math.max(0, (node.y + node.height / 2) * zoom - element.clientHeight / 2)
    }
  }
  useLayoutEffect(focus, [selectedId])
  const toolCount = document.cards.filter(card => card.kind === 'tool').length
  return (
    <section className={css.mapPanel} aria-label={t('knowledge.map.label')}>
      <div className={css.graphControls}>
        <p>{t('knowledge.map.count', { shown: graph.nodes.length, total: document.cards.length })}</p>
        <div>
          <button type="button" disabled={zoom <= 0.4} onClick={() => { setZoom(value => Math.max(0.4, value - 0.2)) }}>{t('knowledge.map.zoomOut')}</button>
          <span>{t('knowledge.map.zoom', { percent: Math.round(zoom * 100) })}</span>
          <button type="button" disabled={zoom >= 1.8} onClick={() => { setZoom(value => Math.min(1.8, value + 0.2)) }}>{t('knowledge.map.zoomIn')}</button>
          <button type="button" onClick={() => { const element = viewport.current; if (element !== null) setZoom(Math.max(0.4, Math.min(1, element.clientWidth / graph.width))) }}>{t('knowledge.map.fit')}</button>
          <button type="button" onClick={focus}>{t('knowledge.map.focus')}</button>
        </div>
      </div>
      {toolCount > 0 && <button type="button" aria-expanded={tools} onClick={() => { setTools(value => !value) }}>{t(tools ? 'knowledge.map.hideTools' : 'knowledge.map.showTools', { count: toolCount })}</button>}
      <p className={css.hint}>{t('knowledge.map.structural')}</p>
      <div className={css.graphViewport} ref={viewport} tabIndex={0} aria-label={t('knowledge.map.canvas')}>
        <div className={css.graphExtent} style={{ '--graph-width': `${String(graph.width * zoom)}px`, '--graph-height': `${String(graph.height * zoom)}px` } as CSSProperties}>
          <div className={css.graphCanvas} style={{ '--graph-width': `${String(graph.width)}px`, '--graph-height': `${String(graph.height)}px`, '--graph-zoom': zoom } as CSSProperties}>
            <svg className={css.edges} width={graph.width} height={graph.height} aria-hidden>
              {graph.edges.map(({ edge, path }) => <path key={`${edge.from}:${edge.to}`} d={path} />)}
            </svg>
            {graph.nodes.map(({ card, x, y, width, height }) => (
              <button type="button" key={card.id} data-knowledge-node={card.id}
                className={clsx(css.mapNode, card.id === selectedId && css.selected)}
                style={{ '--node-x': `${String(x)}px`, '--node-y': `${String(y)}px`, '--node-width': `${String(width)}px`, '--node-height': `${String(height)}px` } as CSSProperties}
                title={card.title} aria-current={card.id === selectedId || undefined}
                onClick={() => { readCard(card.id) }}>
                <span>{t(`knowledge.kind.${card.kind}`)}{card.status !== undefined && ` · ${t(`knowledge.status.${card.status}`)}`}</span>
                <strong>{card.title || t(`knowledge.kind.${card.kind}`)}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
