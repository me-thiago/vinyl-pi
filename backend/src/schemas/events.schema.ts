/**
 * Schema de validação para Events
 *
 * Define as regras de validação para endpoints de eventos.
 */

import { z } from 'zod';
import { paginationSchema, dateFilterSchema } from './pagination.schema';

/**
 * Schema para query params de GET /api/events
 *
 * Combina paginação com filtros de sessão, tipo e data.
 * Limite máximo: 1000 resultados.
 */
export const eventsQuerySchema = paginationSchema
  .extend({
    limit: z.coerce
      .number()
      .int({ message: 'limit deve ser um número inteiro' })
      .min(1, { message: 'limit deve ser pelo menos 1' })
      .max(1000, { message: 'limit deve ser no máximo 1000' })
      .optional(),
    session_id: z
      .string()
      .optional(),
    event_type: z
      .string()
      .optional(),
  })
  .merge(dateFilterSchema);

export type EventsQueryInput = z.infer<typeof eventsQuerySchema>;
