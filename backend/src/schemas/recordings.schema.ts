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

/**
 * Schema para trim de gravação
 *
 * Campos:
 * - startOffset: Início do corte em segundos
 * - endOffset: Fim do corte em segundos
 */
export const trimRecordingSchema = z.object({
  startOffset: z.number().min(0),
  endOffset: z.number().positive(),
}).refine((data) => data.endOffset > data.startOffset, {
  message: 'endOffset deve ser maior que startOffset',
  path: ['endOffset'],
});

/**
 * Schema para query de waveform
 *
 * Campos:
 * - resolution: Pontos por segundo (padrão: 10, max: 50)
 */
export const waveformQuerySchema = z.object({
  resolution: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Schema para criar marcador de faixa
 */
export const createMarkerSchema = z.object({
  trackNumber: z.number().int().min(1),
  title: z.string().max(200).optional(),
  startOffset: z.number().min(0),
  endOffset: z.number().positive(),
}).refine((data) => data.endOffset > data.startOffset, {
  message: 'endOffset deve ser maior que startOffset',
  path: ['endOffset'],
});

/**
 * Schema para atualizar marcador de faixa
 */
export const updateMarkerSchema = z.object({
  trackNumber: z.number().int().min(1).optional(),
  title: z.string().max(200).nullable().optional(),
  startOffset: z.number().min(0).optional(),
  endOffset: z.number().positive().optional(),
});

// Type exports para TypeScript
export type StartRecordingInput = z.infer<typeof startRecordingSchema>;
export type StopRecordingInput = z.infer<typeof stopRecordingSchema>;
export type UpdateRecordingInput = z.infer<typeof updateRecordingSchema>;
export type ListRecordingsQuery = z.infer<typeof listRecordingsSchema>;
export type TrimRecordingInput = z.infer<typeof trimRecordingSchema>;
export type WaveformQuery = z.infer<typeof waveformQuerySchema>;
export type CreateMarkerInput = z.infer<typeof createMarkerSchema>;
export type UpdateMarkerInput = z.infer<typeof updateMarkerSchema>;
