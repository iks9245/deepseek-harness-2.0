/** Durable organized research and source identities shared by Host and Client. */
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { Message } from '@deepseek-ai/dsh-llm/types'
import type { SessionSeq } from '@deepseek-ai/dsh-session/types'

/** Model-local node identity validated within one organized document. */
export type KnowledgeNodeId = Branded<'KnowledgeNodeId'>

/** Verbatim evidence from one recorded assistant answer. */
export interface KnowledgeCitation { readonly seq: SessionSeq; readonly quote: string }

/** A concise, source-backed claim grouped by research subject. */
export interface OrganizedKnowledgeNode {
  readonly id: KnowledgeNodeId
  readonly group: string
  readonly kind: 'claim' | 'question' | 'limitation'
  readonly title: string
  readonly summary: string
  readonly sources: readonly KnowledgeCitation[]
}

/** A model-proposed relationship; citations allow review, not automatic certification. */
export interface OrganizedKnowledgeRelation {
  readonly from: KnowledgeNodeId
  readonly to: KnowledgeNodeId
  readonly kind: 'related' | 'supports' | 'contrasts' | 'depends-on'
  readonly explanation: string
  readonly sources: readonly KnowledgeCitation[]
}

/** Concise model output whose node identities and source quotations have been validated. */
export interface OrganizedKnowledgeMap {
  readonly title: string
  readonly summary: string
  readonly nodes: readonly OrganizedKnowledgeNode[]
  readonly relations: readonly OrganizedKnowledgeRelation[]
}

/** Original answer identity, independent of the browser's loaded event window. */
export interface KnowledgeSourceTarget {
  readonly seq: SessionSeq
  readonly turn: number
  readonly turnSeq: SessionSeq
}

/** Saved organized map and the exact source revision used to generate it. */
export interface KnowledgeDocumentRecord {
  readonly requestSeq: SessionSeq
  readonly throughSeq: SessionSeq
  readonly model: { readonly provider: string; readonly model: string }
  readonly sources: readonly KnowledgeSourceTarget[]
  readonly map: OrganizedKnowledgeMap
}

/** Whole-session saved organization; later conversation input marks its coverage stale. */
export interface KnowledgeProjection {
  readonly document: KnowledgeDocumentRecord | null
  readonly stale: boolean
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Exact auxiliary model input, appended before dispatch and excluded from conversational model history. */
    'knowledge/request': {
      readonly throughSeq: SessionSeq
      readonly provider: string
      readonly model: string
      readonly system: string
      readonly messages: Message[]
      readonly maxTokens: number
    }
    /** Validated organized map; original answers remain unchanged. */
    'knowledge/document': { readonly document: KnowledgeDocumentRecord; readonly rawOutput: string }
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap { knowledge: KnowledgeProjection }
  interface SessionProjectionStateMap { knowledge: KnowledgeProjection }
}
