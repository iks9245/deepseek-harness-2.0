/** Chat-owned selection state shared by the transcript and details panel. */

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
  knowledgeMode: 'map' | 'reading' | 'transcript'
  /** Selected knowledge card shown in the map and executive-summary panel. */
  selectedKnowledgeId: string | null
  /** Browser-local reading bookmarks, addressed by stable knowledge-card ids. */
  knowledgeBookmarks: string[]
  /** Browser-local disclosure state for Knowledge Cards. */
  expandedKnowledgeCards: string[]
}
