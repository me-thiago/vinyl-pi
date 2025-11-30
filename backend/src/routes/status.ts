import { Router, Request, Response } from 'express';
import { AudioManager } from '../services/audio-manager';
import { AudioAnalyzer } from '../services/audio-analyzer';
import { EventDetector } from '../services/event-detector';
import { SessionManager } from '../services/session-manager';

/**
 * Dependências opcionais para status estendido
 */
export interface StatusRouterDependencies {
  audioManager: AudioManager;
  audioAnalyzer?: AudioAnalyzer;
  eventDetector?: EventDetector;
  sessionManager?: SessionManager;
}

export function createStatusRouter(deps: StatusRouterDependencies): Router;
export function createStatusRouter(audioManager: AudioManager): Router;
export function createStatusRouter(
  depsOrManager: StatusRouterDependencies | AudioManager
): Router {
  const router = Router();

  // Normalizar para sempre usar objeto de dependências
  const deps: StatusRouterDependencies = 
    depsOrManager instanceof AudioManager 
      ? { audioManager: depsOrManager }
      : depsOrManager;

  const { audioManager, audioAnalyzer, eventDetector, sessionManager } = deps;

  /**
   * GET /api/status
   *
   * Retorna status completo do sistema incluindo:
   * - Audio capture status
   * - Streaming status
   * - Audio analysis (level, silence)
   * - Session info (futuro)
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const audioStatus = audioManager.getStatus();
      const streamingStatus = audioManager.getStreamingStatus();

      // Obter dados de análise se disponíveis
      const levelDb = audioAnalyzer?.getCurrentLevelDb() ?? audioStatus.levelDb ?? null;
      const silenceDetected = eventDetector?.getSilenceStatus() ?? false;

      // Obter status de clipping se disponível
      const clippingCount = eventDetector?.getClippingCount() ?? 0;

      // Obter sessão ativa se disponível
      const activeSession = sessionManager?.getActiveSession();
      const sessionData = activeSession ? {
        id: activeSession.id,
        started_at: activeSession.startedAt.toISOString(),
        duration: activeSession.durationSeconds,
        event_count: activeSession.eventCount
      } : null;

      res.json({
        session: sessionData,
        streaming: {
          active: streamingStatus.active,
          listeners: streamingStatus.listeners ?? undefined,
          bitrate: streamingStatus.bitrate,
          mount_point: streamingStatus.mountPoint
        },
        audio: {
          level_db: levelDb,
          clipping_detected: clippingCount > 0,
          clipping_count: clippingCount,
          silence_detected: silenceDetected
        }
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to get status', message: errorMsg });
    }
  });

  /**
   * GET /api/status/audio
   *
   * Retorna status detalhado de análise de áudio
   */
  router.get('/status/audio', (req: Request, res: Response) => {
    try {
      const audioStatus = audioManager.getStatus();
      
      // Dados do AudioAnalyzer
      const analyzerData = audioAnalyzer ? {
        levelDb: audioAnalyzer.getCurrentLevelDb(),
        rms: audioAnalyzer.getCurrentRms(),
        isActive: audioAnalyzer.isActive(),
        config: audioAnalyzer.getConfig()
      } : null;

      // Dados do EventDetector
      const detectorData = eventDetector ? eventDetector.getStatus() : null;

      res.json({
        capture: audioStatus,
        analyzer: analyzerData,
        detector: detectorData
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to get audio status', message: errorMsg });
    }
  });

  return router;
}
