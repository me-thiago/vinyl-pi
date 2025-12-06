/**
 * Schema de validação para Settings
 *
 * Define as regras de validação para o endpoint PATCH /api/settings.
 * Os campos correspondem às SETTINGS_DEFINITIONS do SettingsService.
 */

import { z } from 'zod';

/**
 * Schema para atualização de settings (PATCH)
 *
 * Todos os campos são opcionais pois é uma atualização parcial.
 * Os ranges são baseados em SETTINGS_DEFINITIONS.
 */
export const settingsUpdateSchema = z
  .object({
    // Silence detection
    'silence.threshold': z
      .number({ message: 'silence.threshold deve ser um número' })
      .min(-80, { message: 'silence.threshold deve ser >= -80 dB' })
      .max(0, { message: 'silence.threshold deve ser <= 0 dB' })
      .optional(),

    'silence.duration': z
      .number({ message: 'silence.duration deve ser um número' })
      .int({ message: 'silence.duration deve ser um número inteiro' })
      .min(1, { message: 'silence.duration deve ser >= 1 segundo' })
      .max(60, { message: 'silence.duration deve ser <= 60 segundos' })
      .optional(),

    // Clipping detection
    'clipping.threshold': z
      .number({ message: 'clipping.threshold deve ser um número' })
      .min(-10, { message: 'clipping.threshold deve ser >= -10 dB' })
      .max(0, { message: 'clipping.threshold deve ser <= 0 dB' })
      .optional(),

    'clipping.cooldown': z
      .number({ message: 'clipping.cooldown deve ser um número' })
      .int({ message: 'clipping.cooldown deve ser um número inteiro' })
      .min(100, { message: 'clipping.cooldown deve ser >= 100 ms' })
      .max(10000, { message: 'clipping.cooldown deve ser <= 10000 ms' })
      .optional(),

    // Session management
    'session.timeout': z
      .number({ message: 'session.timeout deve ser um número' })
      .int({ message: 'session.timeout deve ser um número inteiro' })
      .min(60, { message: 'session.timeout deve ser >= 60 segundos' })
      .max(7200, { message: 'session.timeout deve ser <= 7200 segundos' })
      .optional(),

    // Player configuration
    'player.buffer_ms': z
      .number({ message: 'player.buffer_ms deve ser um número' })
      .int({ message: 'player.buffer_ms deve ser um número inteiro' })
      .min(100, { message: 'player.buffer_ms deve ser >= 100 ms' })
      .max(300, { message: 'player.buffer_ms deve ser <= 300 ms' })
      .optional(),

    // Stream configuration
    'stream.bitrate': z
      .number({ message: 'stream.bitrate deve ser um número' })
      .int({ message: 'stream.bitrate deve ser um número inteiro' })
      .min(128, { message: 'stream.bitrate deve ser >= 128 kbps' })
      .max(256, { message: 'stream.bitrate deve ser <= 256 kbps' })
      .optional(),

    // Recognition settings (V2-12)
    'recognition.sampleDuration': z
      .number({ message: 'recognition.sampleDuration deve ser um número' })
      .int({ message: 'recognition.sampleDuration deve ser um número inteiro' })
      .min(5, { message: 'recognition.sampleDuration deve ser >= 5 segundos' })
      .max(15, { message: 'recognition.sampleDuration deve ser <= 15 segundos' })
      .optional(),

    'recognition.preferredService': z
      .enum(['acrcloud', 'audd', 'auto'], {
        message: "recognition.preferredService deve ser 'acrcloud', 'audd' ou 'auto'",
      })
      .optional(),

    'recognition.autoOnSessionStart': z
      .boolean({ message: 'recognition.autoOnSessionStart deve ser um booleano' })
      .optional(),

    'recognition.autoDelay': z
      .number({ message: 'recognition.autoDelay deve ser um número' })
      .int({ message: 'recognition.autoDelay deve ser um número inteiro' })
      .min(10, { message: 'recognition.autoDelay deve ser >= 10 segundos' })
      .max(60, { message: 'recognition.autoDelay deve ser <= 60 segundos' })
      .optional(),
  })
  .strict();

/**
 * Schema para reset de setting específica
 */
export const settingKeyParamSchema = z.object({
  key: z
    .string()
    .min(1, { message: 'Chave da configuração é obrigatória' }),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
export type SettingKeyParam = z.infer<typeof settingKeyParamSchema>;
