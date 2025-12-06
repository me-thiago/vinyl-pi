/**
 * Schema de validação para Export endpoints
 *
 * Define as regras de validação para exportação de dados (coleção e histórico).
 */

import { z } from 'zod';

/**
 * Formatos de export suportados
 */
export const exportFormatSchema = z.enum(['json', 'csv']);

/**
 * Schema para query params de GET /api/export/collection
 *
 * - format: 'json' (default) ou 'csv'
 * - archived: incluir álbuns arquivados (default: false)
 */
export const exportCollectionQuerySchema = z.object({
  format: exportFormatSchema.default('json'),
  archived: z.coerce
    .boolean()
    .optional()
    .default(false),
});

/**
 * Schema para query params de GET /api/export/history
 *
 * - format: 'json' (default) ou 'csv'
 * - from: data inicial (YYYY-MM-DD)
 * - to: data final (YYYY-MM-DD)
 */
export const exportHistoryQuerySchema = z.object({
  format: exportFormatSchema.default('json'),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'from deve estar no formato YYYY-MM-DD' })
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'to deve estar no formato YYYY-MM-DD' })
    .optional(),
});

export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type ExportCollectionQueryInput = z.infer<typeof exportCollectionQuerySchema>;
export type ExportHistoryQueryInput = z.infer<typeof exportHistoryQuerySchema>;

