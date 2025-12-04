/**
 * Schema de paginação reutilizável
 *
 * Usado em rotas que suportam limit/offset para paginação.
 * Query params vêm como strings, então usamos z.coerce para converter.
 */

import { z } from 'zod';

/**
 * Schema base de paginação
 * - limit: número de resultados (convertido de string)
 * - offset: posição inicial (convertido de string)
 */
export const paginationSchema = z.object({
  limit: z.coerce
    .number()
    .int({ message: 'limit deve ser um número inteiro' })
    .min(1, { message: 'limit deve ser pelo menos 1' })
    .optional(),
  offset: z.coerce
    .number()
    .int({ message: 'offset deve ser um número inteiro' })
    .min(0, { message: 'offset deve ser maior ou igual a 0' })
    .optional(),
});

/**
 * Schema de filtro por data
 * - date_from: data inicial (ISO string)
 * - date_to: data final (ISO string)
 */
export const dateFilterSchema = z.object({
  date_from: z
    .string()
    .datetime({ message: 'date_from deve ser uma data ISO válida' })
    .optional(),
  date_to: z
    .string()
    .datetime({ message: 'date_to deve ser uma data ISO válida' })
    .optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateFilterInput = z.infer<typeof dateFilterSchema>;
