/**
 * Schema de validação para Recognition (V2-05)
 *
 * Define as regras de validação para endpoints de reconhecimento musical.
 * Mensagens de erro em português BR conforme padrão do projeto.
 */

import { z } from 'zod';

/**
 * Enum de trigger de reconhecimento
 */
export const RecognitionTriggerEnum = z.enum(['manual', 'automatic'], {
  message: 'Trigger deve ser: manual ou automatic',
});

/**
 * Schema para POST /api/recognize
 * Inicia um reconhecimento musical
 */
export const recognizeSchema = z.object({
  trigger: RecognitionTriggerEnum.default('manual'),
  sampleDuration: z.coerce
    .number()
    .int({ message: 'Duração do sample deve ser um número inteiro' })
    .min(5, { message: 'Duração mínima do sample é 5 segundos' })
    .max(15, { message: 'Duração máxima do sample é 15 segundos' })
    .optional()
    .default(10),
});

/**
 * Schema para POST /api/recognize/confirm
 * Confirma o vínculo de um track a um álbum
 */
export const recognizeConfirmSchema = z.object({
  trackId: z
    .string({ message: 'ID do track é obrigatório' })
    .uuid({ message: 'ID do track deve ser um UUID válido' }),
  albumId: z
    .string()
    .uuid({ message: 'ID do álbum deve ser um UUID válido' })
    .nullable(),
});

/**
 * Schema para GET /api/tracks (histórico)
 */
export const tracksQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int({ message: 'limit deve ser um número inteiro' })
    .min(1, { message: 'limit deve ser pelo menos 1' })
    .max(100, { message: 'limit deve ser no máximo 100' })
    .optional()
    .default(20),
  offset: z.coerce
    .number()
    .int({ message: 'offset deve ser um número inteiro' })
    .min(0, { message: 'offset deve ser pelo menos 0' })
    .optional()
    .default(0),
  sessionId: z
    .string()
    .uuid({ message: 'sessionId deve ser um UUID válido' })
    .optional(),
  albumId: z
    .string()
    .uuid({ message: 'albumId deve ser um UUID válido' })
    .optional(),
  dateFrom: z
    .string()
    .datetime({ message: 'dateFrom deve ser uma data ISO válida' })
    .optional(),
  dateTo: z
    .string()
    .datetime({ message: 'dateTo deve ser uma data ISO válida' })
    .optional(),
});

/**
 * Enum de serviços de reconhecimento disponíveis (V2-12)
 */
export const RecognitionServiceEnum = z.enum(['acrcloud', 'audd', 'auto'], {
  message: 'Serviço deve ser: acrcloud, audd ou auto',
});

/**
 * Schema para POST /api/recognition/test (V2-12)
 * Testa conexão com um serviço de reconhecimento
 */
export const recognitionTestSchema = z.object({
  service: z.enum(['acrcloud', 'audd'], {
    message: 'Serviço deve ser: acrcloud ou audd',
  }),
});

/**
 * Schema para PUT /api/recognition/config (V2-12)
 * Atualiza configurações de reconhecimento
 */
export const recognitionConfigSchema = z.object({
  preferredService: RecognitionServiceEnum.optional(),
  sampleDuration: z.coerce
    .number()
    .int({ message: 'Duração do sample deve ser um número inteiro' })
    .min(5, { message: 'Duração mínima é 5 segundos' })
    .max(15, { message: 'Duração máxima é 15 segundos' })
    .optional(),
  autoOnSessionStart: z.boolean().optional(),
  autoDelay: z.coerce
    .number()
    .int({ message: 'Delay deve ser um número inteiro' })
    .min(10, { message: 'Delay mínimo é 10 segundos' })
    .max(60, { message: 'Delay máximo é 60 segundos' })
    .optional(),
});

// Types exportados
export type RecognizeTrigger = z.infer<typeof RecognitionTriggerEnum>;
export type RecognizeInput = z.infer<typeof recognizeSchema>;
export type RecognizeConfirmInput = z.infer<typeof recognizeConfirmSchema>;
export type TracksQueryInput = z.infer<typeof tracksQuerySchema>;
export type RecognitionService = z.infer<typeof RecognitionServiceEnum>;
export type RecognitionTestInput = z.infer<typeof recognitionTestSchema>;
export type RecognitionConfigInput = z.infer<typeof recognitionConfigSchema>;
