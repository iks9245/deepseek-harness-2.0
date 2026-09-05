/** Validation at model-output and durable projection reads. */
import { z } from 'zod'
import type { SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { KnowledgeNodeId, KnowledgeDocumentRecord, OrganizedKnowledgeMap } from './types.ts'

const seq = z.number().int().nonnegative().transform(value => value as SessionSeq)
const id = z.string().min(1).transform(value => value as KnowledgeNodeId)
const citation = z.object({ seq, quote: z.string().trim().min(1) }).strict()

/** Structural model-output schema; source membership and global limits are validated after parsing. */
export const mapSchema: z.ZodType<OrganizedKnowledgeMap> = z.object({
  title: z.string().trim().min(1), summary: z.string().trim().min(1),
  nodes: z.array(z.object({
    id, group: z.string().trim().min(1), kind: z.enum(['claim', 'question', 'limitation']),
    title: z.string().trim().min(1), summary: z.string().trim().min(1), sources: z.array(citation).min(1),
  }).strict()).min(1),
  relations: z.array(z.object({
    from: id, to: id, kind: z.enum(['related', 'supports', 'contrasts', 'depends-on']),
    explanation: z.string().trim().min(1), sources: z.array(citation).min(1),
  }).strict()),
}).strict()

/** Saved document schema used by the projection cache and wire transport. */
export const documentSchema: z.ZodType<KnowledgeDocumentRecord> = z.object({
  requestSeq: seq, throughSeq: seq,
  model: z.object({ provider: z.string(), model: z.string() }),
  sources: z.array(z.object({ seq, turn: z.number().int(), turnSeq: seq })),
  map: mapSchema,
})
