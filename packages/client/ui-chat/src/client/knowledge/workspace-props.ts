/** Shared data and actions for the knowledge reader, map, and comparisons. */
import type { ChatViewSlotProps } from '../contract/slots.ts'
import type { ChatSourceTarget, KnowledgeReadingPosition } from '../contract/store.ts'
import type { KnowledgeCard, KnowledgeDocument } from './model.ts'
import type { KnowledgeProjection } from '@deepseek-ai/dsh-session-knowledge/client'

/** Browser-local navigation stays separate from reconstructed source material. */
export interface KnowledgeWorkspaceProps {
  readonly organization: KnowledgeProjection | undefined
  readonly organizeKnowledge: (cancel: boolean) => Promise<string | null>
  readonly running: boolean
  readonly document: KnowledgeDocument
  readonly mode: 'map' | 'reading'
  readonly selectedId: string | null
  readonly bookmarks: readonly string[]
  readonly readingPosition?: KnowledgeReadingPosition | undefined
  readonly saveReadingPosition: (position: KnowledgeReadingPosition) => void
  readonly setMode: (mode: 'map' | 'reading') => void
  readonly openTranscript?: () => void
  readonly openSource: (source: ChatSourceTarget) => void
  readonly inspectTool: (card: KnowledgeCard) => void
  readonly openFile: (path: string) => void
  readonly readCard: (id: string) => void
  readonly toggleBookmark: (id: string) => void
  readonly loadHistory: () => void
  readonly loadingHistory: boolean
  readonly canDraft: boolean
  readonly stageDraft: (text: string) => void
  readonly t: ChatViewSlotProps['t']
}
