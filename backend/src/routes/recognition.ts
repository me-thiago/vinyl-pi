import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import {
  recognizeSchema,
  recognizeConfirmSchema,
  tracksQuerySchema,
  RecognizeInput,
  RecognizeConfirmInput,
  TracksQueryInput,
} from '../schemas';
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
import { Prisma } from '@prisma/client';

const logger = createLogger('RecognitionRouter');

/**
 * Dependências para o router de reconhecimento
 */
export interface RecognitionRouterDeps {
  sessionManager: SessionManager;
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
export function createRecognitionRouter(deps: RecognitionRouterDeps): Router {
  const router = Router();
  const { sessionManager } = deps;

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
                'Reconhecimento musical não configurado. Configure ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY e ACRCLOUD_ACCESS_SECRET.',
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
          // Timeout = 504
          if (error.code === 'ACRCLOUD_TIMEOUT') {
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

  return router;
}
