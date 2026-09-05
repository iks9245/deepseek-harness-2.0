import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChatStore } from '../src/client/stores.ts'

afterEach(() => { vi.unstubAllGlobals() })

describe('createChatStore', () => {
  it('starts without a selected Chat target', () => {
    const store = createChatStore().create()
    expect(store.store.getSnapshot()).toEqual({
      selection: null,
      turnProcesses: [],
      knowledgeMode: 'map',
      selectedKnowledgeId: null,
      knowledgeBookmarks: [],
      expandedKnowledgeCards: [],
    })
  })

  it('selects and clears one Chat details target', () => {
    const store = createChatStore().create()
    store.actions.select({ turnSeq: 3, callId: 'c1', toolName: 'bash' })
    expect(store.store.getSnapshot().selection)
      .toEqual({ turnSeq: 3, callId: 'c1', toolName: 'bash' })
    store.actions.select(null)
    expect(store.store.getSnapshot().selection).toBeNull()
  })

  it('creates independent instances', () => {
    const handle = createChatStore()
    const first = handle.create()
    const second = handle.create()
    first.actions.select({ turnSeq: 1 })
    expect(second.store.getSnapshot().selection).toBeNull()
  })

  it('owns map, reading-card, selection, and bookmark state per Session', () => {
    const instance = createChatStore().create()
    instance.actions.setKnowledgeMode('reading')
    instance.actions.selectKnowledge('turn:1:answer')
    instance.actions.toggleKnowledgeBookmark('turn:1:answer')
    instance.actions.toggleKnowledgeCard('turn:1:answer')

    expect(instance.store.getSnapshot()).toMatchObject({
      knowledgeMode: 'reading',
      selectedKnowledgeId: 'turn:1:answer',
      knowledgeBookmarks: ['turn:1:answer'],
      expandedKnowledgeCards: ['turn:1:answer'],
    })

    instance.actions.toggleKnowledgeBookmark('turn:1:answer')
    instance.actions.toggleKnowledgeCard('turn:1:answer')
    expect(instance.store.getSnapshot().knowledgeBookmarks).toEqual([])
    expect(instance.store.getSnapshot().expandedKnowledgeCards).toEqual([])
  })

  it('restores Knowledge Workspace state only for the addressed Session', () => {
    const backing = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => { backing.set(key, value) },
      removeItem: (key: string) => { backing.delete(key) },
    })
    const handle = createChatStore()
    const first = handle.create('s1')
    first.actions.setKnowledgeMode('reading')
    first.actions.toggleKnowledgeBookmark('turn:1:answer')

    expect(handle.create('s1').store.getSnapshot()).toMatchObject({
      knowledgeMode: 'reading',
      knowledgeBookmarks: ['turn:1:answer'],
    })
    expect(handle.create('s2').store.getSnapshot()).toMatchObject({
      knowledgeMode: 'map',
      knowledgeBookmarks: [],
    })
  })

  it('stores only manually expanded Turn-process answers', () => {
    const store = createChatStore().create()
    store.actions.setTurnProcessOpen(2, 3, true)
    expect(store.store.getSnapshot().turnProcesses).toEqual([{ turn: 2, answerStep: 3 }])

    store.actions.setTurnProcessOpen(2, 4, true)
    expect(store.store.getSnapshot().turnProcesses).toEqual([{ turn: 2, answerStep: 4 }])

    store.actions.setTurnProcessOpen(2, 4, false)
    expect(store.store.getSnapshot().turnProcesses).toEqual([])
  })

  it('closes only the requested Turn-process entry', () => {
    const store = createChatStore().create()
    store.actions.setTurnProcessOpen(2, 3, true)
    store.actions.setTurnProcessOpen(3, 4, true)

    store.actions.setTurnProcessOpen(2, 3, false)
    store.actions.setTurnProcessOpen(9, 10, false)

    expect(store.store.getSnapshot().turnProcesses).toEqual([{ turn: 3, answerStep: 4 }])
  })
})
