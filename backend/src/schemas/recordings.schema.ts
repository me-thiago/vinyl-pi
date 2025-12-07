import { z } from 'zod';

/**
 * Schema para iniciar gravação
 *
 * Campos:
 * - albumId: UUID do álbum (opcional)
 * - fileName: Nome amigável para arquivo (opcional, default: timestamp)
 */
export const startRecordingSchema = z.object({
  albumId: z.string().uuid().optional(),
  fileName: z.string().max(255).optional(),
});

/**
 * Schema para parar gravação
 *
 * Campos:
 * - recordingId: UUID da gravação (opcional - inferido da gravação ativa)
 */
export const stopRecordingSchema = z.object({
  recordingId: z.string().uuid().optional(),
});

/**
 * Schema para atualizar gravação
 *
 * Campos:
 * - fileName: Novo nome amigável
 * - albumId: Vincular/desvincular álbum (null para desvincular)
 * - notes: Notas do usuário
 */
export const updateRecordingSchema = z.object({
  fileName: z.string().min(1).max(200).optional(),
  albumId: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Schema para query de listagem de gravações
 */
export const listRecordingsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  albumId: z.string().uuid().optional(),
  status: z.enum(['recording', 'completed', 'processing', 'error']).optional(),
  sort: z.enum(['startedAt', 'durationSeconds', 'fileSizeBytes']).default('startedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Type exports para TypeScript
export type StartRecordingInput = z.infer<typeof startRecordingSchema>;
export type StopRecordingInput = z.infer<typeof stopRecordingSchema>;
export type UpdateRecordingInput = z.infer<typeof updateRecordingSchema>;
export type ListRecordingsQuery = z.infer<typeof listRecordingsSchema>;
