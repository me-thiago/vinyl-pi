import { Router, Request, Response } from 'express';
import { SettingsService } from '../services/settings-service';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import { settingsUpdateSchema, settingKeyParamSchema } from '../schemas';

const logger = createLogger('SettingsRouter');

export interface SettingsRouterDependencies {
  settingsService: SettingsService;
}

/**
 * Cria router para endpoints de settings
 *
 * Endpoints:
 * - GET /api/settings - Lista todas as settings com valores e metadata
 * - PATCH /api/settings - Atualiza uma ou mais settings
 * - POST /api/settings/reset - Reseta todas as settings para default
 * - POST /api/settings/:key/reset - Reseta uma setting específica
 */
export function createSettingsRouter(deps: SettingsRouterDependencies): Router {
  const router = Router();
  const { settingsService } = deps;

  /**
   * GET /api/settings
   * Retorna todas as settings com valores atuais e metadata
   */
  router.get('/settings', async (_req: Request, res: Response) => {
    try {
      const settings = await settingsService.getAll();
      res.json({ settings });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao buscar configurações', { error: errorMsg });
      res.status(500).json({ error: { message: 'Erro ao buscar configurações', code: 'SETTINGS_FETCH_ERROR' } });
    }
  });

  /**
   * PATCH /api/settings
   * Atualiza uma ou mais settings
   *
   * Body: { "silence.threshold": -45, "silence.duration": 15 }
   */
  router.patch('/settings', validate(settingsUpdateSchema, 'body'), async (req: Request, res: Response) => {
    try {
      const updates = req.body;

      // Validação de objeto vazio (Zod permite objeto vazio se todos os campos são opcionais)
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: { message: 'O corpo da requisição deve conter pelo menos uma configuração para atualizar', code: 'VALIDATION_ERROR' } });
        return;
      }

      await settingsService.update(updates);

      // Retornar settings atualizadas
      const settings = await settingsService.getAll();
      res.json({
        success: true,
        message: 'Configurações atualizadas',
        settings
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao atualizar configurações', { error: errorMsg });
      res.status(400).json({ error: { message: 'Erro ao atualizar configurações', code: 'SETTINGS_UPDATE_ERROR' } });
    }
  });

  /**
   * POST /api/settings/reset
   * Reseta todas as settings para valores default
   */
  router.post('/settings/reset', async (_req: Request, res: Response) => {
    try {
      await settingsService.resetAll();

      const settings = await settingsService.getAll();
      res.json({
        success: true,
        message: 'Todas as configurações restauradas para valores padrão',
        settings
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao restaurar configurações', { error: errorMsg });
      res.status(500).json({ error: { message: 'Erro ao restaurar configurações', code: 'SETTINGS_RESET_ERROR' } });
    }
  });

  /**
   * POST /api/settings/:key/reset
   * Reseta uma setting específica para o valor default
   */
  router.post('/settings/:key/reset', validate(settingKeyParamSchema, 'params'), async (req: Request, res: Response) => {
    try {
      const { key } = req.params;

      await settingsService.reset(key);

      const settings = await settingsService.getAll();
      res.json({
        success: true,
        message: `Configuração ${key} restaurada para valor padrão`,
        settings
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao restaurar configuração', { key: req.params.key, error: errorMsg });
      res.status(400).json({ error: { message: 'Erro ao restaurar configuração', code: 'SETTING_RESET_ERROR' } });
    }
  });

  /**
   * GET /api/system/info
   * Retorna informações do sistema (read-only)
   */
  router.get('/system/info', async (_req: Request, res: Response) => {
    try {
      res.json({
        device: process.env.AUDIO_DEVICE || 'plughw:0,0',
        sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '44100'),
        version: 'v1.19',
        icecastUrl: `http://${process.env.ICECAST_HOST || 'localhost'}:${process.env.ICECAST_PORT || '8000'}${process.env.ICECAST_MOUNT_POINT || '/stream'}`
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao buscar informações do sistema', { error: errorMsg });
      res.status(500).json({ error: { message: 'Erro ao buscar informações do sistema', code: 'SYSTEM_INFO_ERROR' } });
    }
  });

  return router;
}
