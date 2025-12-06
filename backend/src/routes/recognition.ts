import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import {
  recognizeSchema,
  recognizeConfirmSchema,
  tracksQuerySchema,
  recognitionTestSchema,
  recognitionConfigSchema,
  RecognizeInput,
  RecognizeConfirmInput,
  TracksQueryInput,
  RecognitionTestInput,
  RecognitionConfigInput,
} from '../schemas';
import { SettingsService } from '../services/settings-service';
import {
  recognize,
  confirmTrackAlbum,
  isConfigured,
  RecognitionError,
  NoSessionError,
  CaptureError,
  ACRCloudError,
  NotConfiguredError,
} from '../services/recognition';
import { SessionManager } from '../services/session-manager';
import { AudioManager } from '../services/audio-manager';
import { Prisma } from '@prisma/client';

const logger = createLogger('RecognitionRouter');

/**
 * Dependências para o router de reconhecimento
 */
export interface RecognitionRouterDeps {
  sessionManager: SessionManager;
  audioManager: AudioManager;
  settingsService: SettingsService;
}

/**
 * Resposta de track para API
 */
interface TrackResponse {
  id: string;
  sessionId: string;
  albumId: string | null;
  title: string;
  artist: string;
  albumName: string | null;
  albumArtUrl: string | null;
  year: number | null;
  durationSeconds: number | null;
  confidence: number;
  recognitionSource: string;
  recognizedAt: string;
}

/**
 * Formata track do Prisma para response
 */
function formatTrackResponse(track: {
  id: string;
  sessionId: string;
  albumId: string | null;
  title: string;
  artist: string;
  albumName: string | null;
  albumArtUrl: string | null;
  year: number | null;
  durationSeconds: number | null;
  confidence: number;
  recognitionSource: string;
  recognizedAt: Date;
}): TrackResponse {
  return {
    id: track.id,
    sessionId: track.sessionId,
    albumId: track.albumId,
    title: track.title,
    artist: track.artist,
    albumName: track.albumName,
    albumArtUrl: track.albumArtUrl,
    year: track.year,
    durationSeconds: track.durationSeconds,
    confidence: track.confidence,
    recognitionSource: track.recognitionSource,
    recognizedAt: track.recognizedAt.toISOString(),
  };
}

/**
 * Cria router para endpoints de reconhecimento musical (V2-05)
 *
 * Endpoints:
 * - POST /api/recognize - Inicia reconhecimento musical
 * - POST /api/recognize/confirm - Confirma vínculo track/álbum
 * - GET /api/tracks - Lista histórico de tracks reconhecidos
 */
/**
 * Cache para resultados de teste de API (evitar muitas requisições)
 */
interface ApiTestCache {
  acrcloud?: { result: 'success' | 'error'; error?: string; testAt: Date };
  audd?: { result: 'success' | 'error'; error?: string; testAt: Date };
}

const apiTestCache: ApiTestCache = {};

export function createRecognitionRouter(deps: RecognitionRouterDeps): Router {
  const router = Router();
  const { sessionManager, audioManager, settingsService } = deps;

  /**
   * @openapi
   * /api/recognize:
   *   post:
   *     summary: Inicia reconhecimento musical
   *     description: Captura sample de áudio e identifica via ACRCloud
   *     tags:
   *       - Recognition
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               trigger:
   *                 type: string
   *                 enum: [manual, automatic]
   *                 default: manual
   *               sampleDuration:
   *                 type: integer
   *                 minimum: 5
   *                 maximum: 15
   *                 default: 10
   *     responses:
   *       200:
   *         description: Reconhecimento bem-sucedido
   *       400:
   *         description: Nenhuma sessão ativa ou serviço não configurado
   *       500:
   *         description: Erro no reconhecimento
   */
  router.post(
    '/recognize',
    validate(recognizeSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        // Verificar se serviço está configurado
        if (!isConfigured()) {
          res.status(400).json({
            error: {
              message:
                'Reconhecimento musical não configurado. Configure AUDD_API_KEY no arquivo .env.',
              code: 'RECOGNITION_NOT_CONFIGURED',
            },
          });
          return;
        }

        // Verificar se há sessão ativa
        const activeSession = sessionManager.getActiveSession();
        if (!activeSession) {
          res.status(400).json({
            error: {
              message: 'Nenhuma sessão ativa',
              code: 'NO_ACTIVE_SESSION',
            },
          });
          return;
        }

        const input = req.body as RecognizeInput;

        logger.info('Reconhecimento solicitado', {
          trigger: input.trigger,
          sampleDuration: input.sampleDuration,
          sessionId: activeSession.id,
        });

        // Executar reconhecimento
        const result = await recognize({
          trigger: input.trigger,
          sampleDuration: input.sampleDuration,
          sessionId: activeSession.id,
          audioManager,
        });

        if (result.success) {
          res.json({
            success: true,
            track: result.track,
            nextRecognitionIn: result.nextRecognitionIn,
          });
        } else {
          // Reconhecimento falhou mas não é erro de servidor
          res.json({
            success: false,
            error: result.error,
            errorCode: result.errorCode,
          });
        }
      } catch (error) {
        // Erros conhecidos
        if (error instanceof NotConfiguredError) {
          res.status(400).json({
            error: {
              message: error.message,
              code: error.code,
            },
          });
          return;
        }

        if (error instanceof NoSessionError) {
          res.status(400).json({
            error: {
              message: error.message,
              code: error.code,
            },
          });
          return;
        }

        if (error instanceof CaptureError) {
          res.status(500).json({
            error: {
              message: error.message,
              code: error.code,
              details: error.details,
            },
          });
          return;
        }

        if (error instanceof ACRCloudError) {
          // Timeout = 504 (ACRCloudError é alias para AudDError)
          if (error.code === 'AUDD_TIMEOUT') {
            res.status(504).json({
              error: {
                message: error.message,
                code: error.code,
              },
            });
            return;
          }

          res.status(500).json({
            error: {
              message: error.message,
              code: error.code,
            },
          });
          return;
        }

        // Erro inesperado
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro inesperado no reconhecimento', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro interno no reconhecimento',
            code: 'RECOGNITION_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/recognize/confirm:
   *   post:
   *     summary: Confirma vínculo de track com álbum
   *     description: Vincula um track reconhecido a um álbum da coleção
   *     tags:
   *       - Recognition
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - trackId
   *             properties:
   *               trackId:
   *                 type: string
   *                 format: uuid
   *               albumId:
   *                 type: string
   *                 format: uuid
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Vínculo confirmado
   *       404:
   *         description: Track ou álbum não encontrado
   */
  router.post(
    '/recognize/confirm',
    validate(recognizeConfirmSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const { trackId, albumId } = req.body as RecognizeConfirmInput;

        logger.info('Confirmação de vínculo solicitada', { trackId, albumId });

        const result = await confirmTrackAlbum(trackId, albumId);

        res.json({
          data: result,
        });
      } catch (error) {
        if (error instanceof RecognitionError) {
          if (error.code === 'TRACK_NOT_FOUND' || error.code === 'ALBUM_NOT_FOUND') {
            res.status(404).json({
              error: {
                message: error.message,
                code: error.code,
              },
            });
            return;
          }
        }

        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao confirmar vínculo', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao confirmar vínculo',
            code: 'CONFIRM_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/tracks:
   *   get:
   *     summary: Lista histórico de tracks reconhecidos
   *     description: Retorna tracks reconhecidos com filtros e paginação
   *     tags:
   *       - Recognition
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *       - in: query
   *         name: sessionId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: albumId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: dateFrom
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: dateTo
   *         schema:
   *           type: string
   *           format: date-time
   *     responses:
   *       200:
   *         description: Lista de tracks
   */
  router.get(
    '/tracks',
    validate(tracksQuerySchema, 'query'),
    async (req: Request, res: Response) => {
      try {
        const query = req.query as unknown as TracksQueryInput;
        const { limit, offset, sessionId, albumId, dateFrom, dateTo } = query;

        // Construir filtro where
        const where: Prisma.TrackWhereInput = {};

        if (sessionId) {
          where.sessionId = sessionId;
        }

        if (albumId) {
          where.albumId = albumId;
        }

        if (dateFrom || dateTo) {
          where.recognizedAt = {};
          if (dateFrom) {
            where.recognizedAt.gte = new Date(dateFrom);
          }
          if (dateTo) {
            where.recognizedAt.lte = new Date(dateTo);
          }
        }

        // Buscar tracks e total em paralelo
        const [tracks, total] = await Promise.all([
          prisma.track.findMany({
            where,
            orderBy: { recognizedAt: 'desc' },
            take: limit,
            skip: offset,
          }),
          prisma.track.count({ where }),
        ]);

        res.json({
          data: tracks.map(formatTrackResponse),
          meta: {
            total,
            limit,
            offset,
          },
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao buscar tracks', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao buscar tracks',
            code: 'TRACKS_FETCH_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/recognize/buffer-status:
   *   get:
   *     summary: Status do Ring Buffer de reconhecimento
   *     description: Retorna estatísticas do buffer circular usado para captura de áudio
   *     tags:
   *       - Recognition
   *     responses:
   *       200:
   *         description: Status do buffer
   */
  router.get('/recognize/buffer-status', (_req: Request, res: Response) => {
    try {
      const stats = audioManager.getRecognitionBufferStats();
      const availableSeconds = audioManager.getAvailableAudioSeconds();
      const streamingStatus = audioManager.getStreamingStatus();

      res.json({
        buffer: {
          capacityBytes: stats.capacity,
          filledBytes: stats.filled,
          fillPercent: stats.fillPercent.toFixed(1) + '%',
          availableSeconds: availableSeconds.toFixed(1),
          totalWrittenMB: (stats.totalWritten / 1024 / 1024).toFixed(2),
          totalReadMB: (stats.totalRead / 1024 / 1024).toFixed(2),
        },
        streaming: {
          active: streamingStatus.active,
        },
        ready: availableSeconds >= 5, // Pronto para captura se tiver pelo menos 5s
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao obter status do buffer', { error: errorMsg });
      res.status(500).json({
        error: {
          message: 'Erro ao obter status do buffer',
          code: 'BUFFER_STATUS_ERROR',
        },
      });
    }
  });

  /**
   * @openapi
   * /api/recognition/status:
   *   get:
   *     summary: Status das APIs de reconhecimento (V2-12)
   *     description: Retorna status de configuração e último teste das APIs
   *     tags:
   *       - Recognition
   *     responses:
   *       200:
   *         description: Status das APIs
   */
  router.get('/recognition/status', async (_req: Request, res: Response) => {
    try {
      // Verificar configuração das APIs
      const auddConfigured = !!process.env.AUDD_API_KEY;
      const acrcloudConfigured = !!(
        process.env.ACRCLOUD_ACCESS_KEY &&
        process.env.ACRCLOUD_ACCESS_SECRET &&
        process.env.ACRCLOUD_HOST
      );

      // Buscar settings de reconhecimento
      const preferredService = settingsService.get<string>('recognition.preferredService');
      const sampleDuration = settingsService.get<number>('recognition.sampleDuration');
      const autoOnSessionStart = settingsService.get<boolean>('recognition.autoOnSessionStart');
      const autoDelay = settingsService.get<number>('recognition.autoDelay');

      res.json({
        services: {
          acrcloud: {
            configured: acrcloudConfigured,
            lastTestAt: apiTestCache.acrcloud?.testAt?.toISOString() || null,
            lastTestResult: apiTestCache.acrcloud?.result || null,
            lastTestError: apiTestCache.acrcloud?.error || null,
          },
          audd: {
            configured: auddConfigured,
            lastTestAt: apiTestCache.audd?.testAt?.toISOString() || null,
            lastTestResult: apiTestCache.audd?.result || null,
            lastTestError: apiTestCache.audd?.error || null,
          },
        },
        settings: {
          preferredService,
          sampleDuration,
          autoOnSessionStart,
          autoDelay,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao obter status de reconhecimento', { error: errorMsg });
      res.status(500).json({
        error: {
          message: 'Erro ao obter status de reconhecimento',
          code: 'RECOGNITION_STATUS_ERROR',
        },
      });
    }
  });

  /**
   * @openapi
   * /api/recognition/test:
   *   post:
   *     summary: Testa conexão com API de reconhecimento (V2-12)
   *     description: Testa se a API está acessível e as credenciais são válidas
   *     tags:
   *       - Recognition
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - service
   *             properties:
   *               service:
   *                 type: string
   *                 enum: [acrcloud, audd]
   *     responses:
   *       200:
   *         description: Resultado do teste
   *       400:
   *         description: Serviço não configurado
   */
  router.post(
    '/recognition/test',
    validate(recognitionTestSchema, 'body'),
    async (req: Request, res: Response) => {
      const { service } = req.body as RecognitionTestInput;
      const startTime = Date.now();

      try {
        if (service === 'audd') {
          const apiKey = process.env.AUDD_API_KEY;
          if (!apiKey) {
            res.status(400).json({
              success: false,
              message: 'AudD não configurado. Configure AUDD_API_KEY no .env',
            });
            return;
          }

          // Testar AudD com uma requisição simples (sem áudio, apenas verifica credenciais)
          // AudD retorna erro específico se a chave for inválida
          const axios = await import('axios');
          const FormData = await import('form-data');
          const form = new FormData.default();
          form.append('api_token', apiKey);
          form.append('return', 'spotify');

          // Enviar requisição sem arquivo - AudD vai retornar erro, mas valida a key
          const response = await axios.default.post('https://api.audd.io/', form, {
            headers: form.getHeaders(),
            timeout: 10000,
          });

          const responseTime = Date.now() - startTime;

          // AudD retorna status: 'success' mesmo sem áudio (result será null)
          // ou status: 'error' com código de erro
          if (response.data.status === 'error' && response.data.error?.error_code === 901) {
            // Error 901 = Invalid api_token
            apiTestCache.audd = {
              result: 'error',
              error: 'API key inválida',
              testAt: new Date(),
            };
            res.json({
              success: false,
              message: 'API key inválida',
              responseTime,
            });
            return;
          }

          // Qualquer outra resposta significa que a key é válida
          apiTestCache.audd = {
            result: 'success',
            testAt: new Date(),
          };

          res.json({
            success: true,
            message: 'Conexão OK',
            responseTime,
          });
        } else if (service === 'acrcloud') {
          // ACRCloud não está implementado no momento
          const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
          if (!accessKey) {
            res.status(400).json({
              success: false,
              message: 'ACRCloud não configurado',
            });
            return;
          }

          // ACRCloud requer autenticação HMAC-SHA1, teste simplificado
          apiTestCache.acrcloud = {
            result: 'error',
            error: 'Teste de ACRCloud não implementado (usando AudD)',
            testAt: new Date(),
          };

          res.json({
            success: false,
            message: 'ACRCloud não suportado atualmente. Use AudD.',
            responseTime: Date.now() - startTime,
          });
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : String(error);

        logger.error('Erro ao testar API de reconhecimento', { service, error: errorMsg });

        // Atualizar cache com erro
        if (service === 'audd') {
          apiTestCache.audd = {
            result: 'error',
            error: errorMsg,
            testAt: new Date(),
          };
        } else {
          apiTestCache.acrcloud = {
            result: 'error',
            error: errorMsg,
            testAt: new Date(),
          };
        }

        res.json({
          success: false,
          message: errorMsg,
          responseTime,
        });
      }
    }
  );

  /**
   * @openapi
   * /api/recognition/config:
   *   put:
   *     summary: Atualiza configurações de reconhecimento (V2-12)
   *     description: Atualiza preferências de reconhecimento
   *     tags:
   *       - Recognition
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               preferredService:
   *                 type: string
   *                 enum: [acrcloud, audd, auto]
   *               sampleDuration:
   *                 type: integer
   *                 minimum: 5
   *                 maximum: 15
   *               autoOnSessionStart:
   *                 type: boolean
   *               autoDelay:
   *                 type: integer
   *                 minimum: 10
   *                 maximum: 60
   *     responses:
   *       200:
   *         description: Configurações atualizadas
   */
  router.put(
    '/recognition/config',
    validate(recognitionConfigSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const config = req.body as RecognitionConfigInput;
        const updates: Record<string, string | number | boolean> = {};

        if (config.preferredService !== undefined) {
          updates['recognition.preferredService'] = config.preferredService;
        }
        if (config.sampleDuration !== undefined) {
          updates['recognition.sampleDuration'] = config.sampleDuration;
        }
        if (config.autoOnSessionStart !== undefined) {
          updates['recognition.autoOnSessionStart'] = config.autoOnSessionStart;
        }
        if (config.autoDelay !== undefined) {
          updates['recognition.autoDelay'] = config.autoDelay;
        }

        if (Object.keys(updates).length > 0) {
          await settingsService.update(updates);
        }

        // Retornar configurações atualizadas
        res.json({
          settings: {
            preferredService: settingsService.get<string>('recognition.preferredService'),
            sampleDuration: settingsService.get<number>('recognition.sampleDuration'),
            autoOnSessionStart: settingsService.get<boolean>('recognition.autoOnSessionStart'),
            autoDelay: settingsService.get<number>('recognition.autoDelay'),
          },
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao atualizar config de reconhecimento', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao atualizar configurações',
            code: 'CONFIG_UPDATE_ERROR',
          },
        });
      }
    }
  );

  return router;
}
