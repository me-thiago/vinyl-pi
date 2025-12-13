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

/**
 * V3a-09: Schema para adicionar álbum à sessão
 * POST /api/sessions/:id/albums
 */
export const addSessionAlbumSchema = z.object({
  albumId: z.string().uuid('ID do álbum inválido'),
  notes: z.string().max(200, 'Notas devem ter no máximo 200 caracteres').optional(),
});

/**
 * V3a-09: Schema para parâmetros de rota de álbum da sessão
 * DELETE /api/sessions/:id/albums/:albumId
 */
export const sessionAlbumParamSchema = z.object({
  id: z.string().min(1, 'ID da sessão é obrigatório'),
  albumId: z.string().uuid('ID do álbum inválido'),
});

export type AddSessionAlbumInput = z.infer<typeof addSessionAlbumSchema>;
export type SessionAlbumParam = z.infer<typeof sessionAlbumParamSchema>;
