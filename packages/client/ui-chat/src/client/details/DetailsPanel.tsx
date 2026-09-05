import { Fragment } from 'react'
import { CodeBlock, IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { shallowEqual } from '@deepseek-ai/dsh-client-store'
import type { DetailsSlotProps } from '../contract/slots.ts'
import type { ChatSnapshot, RunningToolCall, ToolCallBlock, ToolResultNode } from '../contract/snapshot.ts'
import { findToolCall } from './tool-node-reader.ts'
import { ExecutiveSummary } from '../knowledge/ExecutiveSummary.tsx'
import { deriveKnowledgeDocument } from '../knowledge/model.ts'
import css from './DetailsPanel.module.css'

export type DetailsPanelProps = DetailsSlotProps

/** The snapshot-owned block reference must remain stable across unrelated frames. */
interface CallMaterial {
  name: string
  argsRaw: string | null
  block: ToolCallBlock
}

function settledMaterial(node: ToolResultNode, callId: string): CallMaterial {
  return { name: node.call?.name ?? callId, argsRaw: node.call?.argsRaw ?? null, block: node }
}

function runningMaterial(call: RunningToolCall): CallMaterial {
  return { name: call.name, argsRaw: call.argsRaw, block: call }
}

function materialFor(s: ChatSnapshot, callId: string): CallMaterial | null {
  const found = findToolCall(s, callId)
  if (found === undefined) return null
  return 'kind' in found ? settledMaterial(found, callId) : runningMaterial(found)
}

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

/** Flatten a settled result for the no-ui-tool fallback. */
function rawResultText(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  const parts = block.content.map(item => item.type === 'text' ? item.text : JSON.stringify(item, null, 2))
  if (parts.length === 0 && block.error !== undefined) parts.push(`${block.error.name}: ${block.error.code}`)
  return parts.join('\n')
}

export function DetailsPanel({
  useChat, useSession, useSessions, useProjection, sessionId, useStore, actions, renderSlot, closeDetails, producedFiles, t,
}: DetailsPanelProps) {
  const selection = useStore(s => s.selection)
  const selectedKnowledgeId = useStore(s => s.selectedKnowledgeId)
  const bookmarks = useStore(s => s.knowledgeBookmarks)
  const nodeValues = useChat(s => s.nodes.values())
  const outline = useProjection('turnOutline')
  const timeline = useChat(s => s.timeline)
  const hasMore = useSession(s => s.hasMore)
  const document = deriveKnowledgeDocument(outline, nodeValues, timeline, producedFiles, hasMore)
  const selectedKnowledge = document.cards.find(card => card.id === selectedKnowledgeId)
  // Session workspace root: a card model resolves omitted or relative
  // tool paths against it without reading Session services.
  const sessionCwd = useSessions(list => list.byId[sessionId]?.cwd)
  const callId = selection?.callId
  // materialFor builds a fresh wrapper; shallowEqual short-circuits on its
  // stable members (result node reference rides the snapshot's structural sharing).
  const material = useChat(
    s => (callId === undefined ? null : materialFor(s, callId)),
    (a, b) => shallowEqual(a, b))
  return (
    <div className={css.root}>
      <div className={css.header}>
        <h2 className={css.title}>
          {selection === null ? t('knowledge.summary.title') : material?.name ?? selection.toolName ?? t('details.title')}
        </h2>
        <button
          type="button" className={css.close} aria-label={t('details.close')}
          onClick={() => { closeDetails() }}
        >
          <IconCloseOutline16 size={14} />
        </button>
      </div>
      <div className={css.body}>
        {selection === null || callId === undefined
          ? (
            <ExecutiveSummary
              document={document}
              selected={selectedKnowledge}
              bookmarks={bookmarks}
              onToggleBookmark={() => {
                if (selectedKnowledgeId !== null) actions.toggleKnowledgeBookmark(selectedKnowledgeId)
              }}
              openSource={actions.requestKnowledgeSource}
              readCard={actions.readKnowledgeCard}
              inspectTool={(card) => {
                if (card.tool !== undefined && card.source !== undefined) {
                  actions.select({ turnSeq: card.source.turnSeq, callId: card.tool.callId, toolName: card.tool.name })
                }
              }}
              t={t}
            />
          )
          : material === null
            ? <div className={css.empty}>{t('details.notInWindow')}</div>
            : (
              <>
                {material.argsRaw !== null && (
                  <section className={css.section}>
                    <div className={css.sectionLabel}>{t('details.input')}</div>
                    <CodeBlock code={pretty(material.argsRaw)} lang="json" copyLabel={t('copy')} copiedLabel={t('copied')} />
                  </section>
                )}
                <section className={css.section}>
                  <div className={css.sectionLabel}>{t('details.output')}</div>
                  {/* Keyed by the selected call: the body owns per-call view
                      state (the terminal card's expand and copy), which React
                      would otherwise carry into the next selection because the
                      panel does not unmount between calls. */}
                  <Fragment key={callId}>
                    {renderSlot('conversation.details.tool', { block: material.block, cwd: sessionCwd }, {
                      fallback: 'kind' in material.block
                        ? (
                          <pre className={css.code} data-error={material.block.isError || undefined}>
                            {rawResultText(material.block)}
                          </pre>
                        )
                        : <div className={css.empty}>{t('details.running')}</div>,
                    })}
                  </Fragment>
                </section>
              </>
            )}
      </div>
    </div>
  )
}
