/** Per-Session Chat selection store shared by the transcript and details panel. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { ChatSourceTarget, ChatStoreState, KnowledgeReadingPosition, SelectionTarget, TurnProcessViewEntry } from './contract/store.ts'

type ChatActions = {
  select: (draft: ChatStoreState, target: SelectionTarget | null) => void
  setKnowledgeMode: (draft: ChatStoreState, mode: ChatStoreState['knowledgeMode']) => void
  selectKnowledge: (draft: ChatStoreState, id: string | null) => void
  saveKnowledgeReadingPosition: (draft: ChatStoreState, position: KnowledgeReadingPosition) => void
  readKnowledgeCard: (draft: ChatStoreState, id: string) => void
  requestKnowledgeSource: (draft: ChatStoreState, source: ChatSourceTarget | null) => void
  toggleKnowledgeBookmark: (draft: ChatStoreState, id: string) => void
  toggleKnowledgeCard: (draft: ChatStoreState, id: string) => void
  setTurnProcessOpen: (
    draft: ChatStoreState,
    turn: number,
    answerStep: number,
    open: boolean,
  ) => void
}

/**
 * Resolve the manually expanded answer for one Turn.
 * @param state - Chat store snapshot.
 * @param turn - owning Turn.
 * @returns the Turn's stored entry, when present.
 */
export function storedTurnProcessEntry(
  state: Readonly<ChatStoreState>,
  turn: number,
): Readonly<TurnProcessViewEntry> | undefined {
  return state.turnProcesses.find(entry => entry.turn === turn)
}

/**
 * Create the Chat selection store handle.
 * @returns a handle instantiated once per rendered Session scope.
 */
export function createChatStore(): EngineStoreHandle<ChatStoreState, ChatActions> {
  return defineStore({
    persist: 'dsh.chat.v1',
    init: (): ChatStoreState => ({
      selection: null,
      turnProcesses: [],
      knowledgeMode: 'auto',
      knowledgeSource: null,
      selectedKnowledgeId: null,
      knowledgeBookmarks: [],
      expandedKnowledgeCards: [],
    }),
    actions: {
      select: (draft, target: SelectionTarget | null) => { draft.selection = target },
      setKnowledgeMode: (draft, mode) => { draft.knowledgeMode = mode },
      selectKnowledge: (draft, id) => { draft.selectedKnowledgeId = id },
      saveKnowledgeReadingPosition: (draft, position) => { draft.knowledgeReadingPosition = position },
      readKnowledgeCard: (draft, id) => {
        draft.knowledgeMode = 'reading'
        draft.selectedKnowledgeId = id
        if (!draft.expandedKnowledgeCards.includes(id)) draft.expandedKnowledgeCards.push(id)
      },
      requestKnowledgeSource: (draft, source) => {
        draft.knowledgeSource = source
        if (source !== null) draft.knowledgeMode = 'transcript'
      },
      toggleKnowledgeBookmark: (draft, id) => {
        const index = draft.knowledgeBookmarks.indexOf(id)
        if (index < 0) draft.knowledgeBookmarks.push(id)
        else draft.knowledgeBookmarks.splice(index, 1)
      },
      toggleKnowledgeCard: (draft, id) => {
        const index = draft.expandedKnowledgeCards.indexOf(id)
        if (index < 0) draft.expandedKnowledgeCards.push(id)
        else draft.expandedKnowledgeCards.splice(index, 1)
      },
      setTurnProcessOpen: (draft, turn, answerStep, open) => {
        const index = draft.turnProcesses.findIndex(entry => entry.turn === turn)
        if (!open) {
          if (index >= 0) draft.turnProcesses.splice(index, 1)
          return
        }
        const next = { turn, answerStep } satisfies TurnProcessViewEntry
        if (index < 0) draft.turnProcesses.push(next)
        else draft.turnProcesses[index] = next
      },
    },
  })
}
