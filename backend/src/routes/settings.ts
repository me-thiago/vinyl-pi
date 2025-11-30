import { Router, Request, Response } from 'express';
import { SettingsService } from '../services/settings-service';

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
      console.error('Error fetching settings:', errorMsg);
      res.status(500).json({ error: errorMsg });
    }
  });

  /**
   * PATCH /api/settings
   * Atualiza uma ou mais settings
   *
   * Body: { "silence.threshold": -45, "silence.duration": 15 }
   */
  router.patch('/settings', async (req: Request, res: Response) => {
    try {
      const updates = req.body;

      if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'Body must be an object with settings to update' });
        return;
      }

      await settingsService.update(updates);

      // Retornar settings atualizadas
      const settings = await settingsService.getAll();
      res.json({
        success: true,
        message: 'Settings updated',
        settings
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error updating settings:', errorMsg);
      res.status(400).json({ error: errorMsg });
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
        message: 'All settings reset to defaults',
        settings
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error resetting settings:', errorMsg);
      res.status(500).json({ error: errorMsg });
    }
  });

  /**
   * POST /api/settings/:key/reset
   * Reseta uma setting específica para o valor default
   */
  router.post('/settings/:key/reset', async (req: Request, res: Response) => {
    try {
      const { key } = req.params;

      await settingsService.reset(key);

      const settings = await settingsService.getAll();
      res.json({
        success: true,
        message: `Setting ${key} reset to default`,
        settings
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error resetting setting:', errorMsg);
      res.status(400).json({ error: errorMsg });
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
        version: 'v1.18',
        icecastUrl: `http://${process.env.ICECAST_HOST || 'localhost'}:${process.env.ICECAST_PORT || '8000'}${process.env.ICECAST_MOUNT_POINT || '/stream'}`
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching system info:', errorMsg);
      res.status(500).json({ error: errorMsg });
    }
  });

  return router;
}
