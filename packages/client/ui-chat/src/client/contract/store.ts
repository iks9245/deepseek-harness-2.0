/** Chat-owned selection state shared by the transcript and details panel. */

import type { SessionSeq } from '@deepseek-ai/dsh-session/types'

/** Recorded source reached through the transcript's existing history pager. */
export interface ChatSourceTarget {
  readonly turn: number
  readonly turnSeq: SessionSeq
  readonly seq: SessionSeq
  readonly nodeKey?: string
}

/** Tool call identity as carried by Chat nodes. */
export type ToolCallId = string

/** Selection target for the Chat details linkage channel. */
export interface SelectionTarget {
  turnSeq: number
  stepSeq?: number
  callId?: ToolCallId
  toolName?: string
}

/** One manually expanded Turn answer generation. */
export interface TurnProcessViewEntry {
  readonly turn: number
  readonly answerStep: number
}

/** Per-Session state shared only by the Chat view and details surface. */
export interface ChatStoreState {
  selection: SelectionTarget | null
  turnProcesses: TurnProcessViewEntry[]
  /** Primary Knowledge Workspace surface for this Session. */
  knowledgeMode: 'auto' | 'map' | 'reading' | 'transcript'
  /** Pending source navigation, absent in older browser preferences; cleared after paging starts. */
  knowledgeSource?: ChatSourceTarget | null
  /** Selected knowledge card shown in the map and source overview. */
  selectedKnowledgeId: string | null
  /** Browser-local reading bookmarks, addressed by stable knowledge-card ids. */
  knowledgeBookmarks: string[]
  /** Browser-local disclosure state for Knowledge Cards. */
  expandedKnowledgeCards: string[]
}
