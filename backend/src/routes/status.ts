import { Router, Request, Response } from 'express';
import { AudioManager } from '../services/audio-manager';

export function createStatusRouter(audioManager: AudioManager): Router {
  const router = Router();

  /**
   * GET /api/status
   *
   * Retorna status completo do sistema incluindo:
   * - Audio capture status
   * - Streaming status
   * - Session info (futuro)
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const audioStatus = audioManager.getStatus();
      const streamingStatus = audioManager.getStreamingStatus();

      res.json({
        session: null, // TODO: Implementar session tracking em stories futuras
        streaming: {
          active: streamingStatus.active,
          listeners: streamingStatus.listeners ?? undefined,
          bitrate: streamingStatus.bitrate,
          mount_point: streamingStatus.mountPoint
        },
        audio: {
          level_db: audioStatus.levelDb ?? null,
          clipping_detected: false, // TODO: Implementar em V1.9
          silence_detected: false    // TODO: Implementar em V1.8
        }
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to get status', message: errorMsg });
    }
  });

  return router;
}
