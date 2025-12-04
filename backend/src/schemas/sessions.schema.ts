/**
 * Schema de validação para Sessions
 *
 * Define as regras de validação para endpoints de sessões.
 */

import { z } from 'zod';
import { paginationSchema, dateFilterSchema } from './pagination.schema';

/**
 * Schema para query params de GET /api/sessions
 *
 * Combina paginação com filtros de data.
 * Limite máximo: 100 resultados.
 */
export const sessionsQuerySchema = paginationSchema
  .extend({
    limit: z.coerce
      .number()
      .int({ message: 'limit deve ser um número inteiro' })
      .min(1, { message: 'limit deve ser pelo menos 1' })
      .max(100, { message: 'limit deve ser no máximo 100' })
      .optional(),
  })
  .merge(dateFilterSchema);

/**
 * Schema para parâmetro de rota :id
 */
export const sessionIdParamSchema = z.object({
  id: z
    .string()
    .min(1, { message: 'ID da sessão é obrigatório' }),
});

export type SessionsQueryInput = z.infer<typeof sessionsQuerySchema>;
export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;
