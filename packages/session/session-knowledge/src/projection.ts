/** Saved organization is projected from the whole log, independently of transcript pagination. */
import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { KnowledgeProjection } from './types.ts'
import { documentSchema } from './schema.ts'

const schema: z.ZodType<KnowledgeProjection> = z.object({ document: documentSchema.nullable(), stale: z.boolean() })

/** Latest successful organized map; later user or assistant messages invalidate its source coverage. */
export const knowledgeProjection = {
  key: 'knowledge', stateVersion: 1, stateSchema: schema,
  init: () => ({ document: null, stale: false }),
  apply: (state, event) => {
    if (event.type === 'knowledge/document') return { document: event.data.document, stale: false }
    if (state.document !== null && (event.type === 'user/message' || event.type === 'assistant/message')) {
      return { ...state, stale: true }
    }
    return state
  },
  wire: { viewSchema: schema, view: state => state },
} satisfies ProjectionDefinition<'knowledge', KnowledgeProjection>
