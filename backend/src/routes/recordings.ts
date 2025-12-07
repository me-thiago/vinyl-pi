import { Router, Request, Response } from 'express';
import { RecordingManager } from '../services/recording-manager';
import { SessionManager } from '../services/session-manager';
import prisma from '../prisma/client';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const logger = createLogger('RecordingsRouter');

/**
 * Dependências necessárias para o router de recordings
 */
interface RecordingsRouterDeps {
  recordingManager: RecordingManager;
  sessionManager: SessionManager;
}

/**
 * Schema para iniciar gravação
 */
const startRecordingSchema = z.object({
  albumId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(200).optional(),
});

/**
 * Schema para parar gravação
 */
const stopRecordingSchema = z.object({
  recordingId: z.string().uuid().optional(), // Opcional pois pode inferir da gravação ativa
});

/**
 * Schema para atualizar gravação
 */
const updateRecordingSchema = z.object({
  fileName: z.string().min(1).max(200).optional(),
  albumId: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Schema para query de listagem
 */
const listRecordingsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  albumId: z.string().uuid().optional(),
  status: z.enum(['recording', 'completed', 'processing', 'error']).optional(),
  sort: z.enum(['startedAt', 'durationSeconds', 'fileSizeBytes']).default('startedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Cria router para endpoints de recordings (V3a)
 */
export function createRecordingsRouter(deps: RecordingsRouterDeps): Router {
  const router = Router();
  const { recordingManager, sessionManager } = deps;

  /**
   * GET /api/recordings - Listar gravações
   */
  router.get('/recordings', async (req: Request, res: Response) => {
    try {
      const query = listRecordingsSchema.parse(req.query);

      const where: any = {};
      if (query.albumId) {
        where.albumId = query.albumId;
      }
      if (query.status) {
        where.status = query.status;
      }

      const [recordings, total] = await Promise.all([
        prisma.recording.findMany({
          where,
          orderBy: { [query.sort]: query.order },
          skip: query.offset,
          take: query.limit,
          include: {
            album: {
              select: { id: true, title: true, artist: true, coverUrl: true },
            },
            _count: { select: { trackMarkers: true } },
          },
        }),
        prisma.recording.count({ where }),
      ]);

      res.json({
        data: recordings,
        meta: {
          total,
          limit: query.limit,
          offset: query.offset,
        },
      });
    } catch (error) {
      logger.error('Erro ao listar gravações', { error });
      res.status(500).json({
        error: { message: 'Erro ao listar gravações', code: 'RECORDINGS_LIST_ERROR' },
      });
    }
  });

  /**
   * GET /api/recordings/status - Status atual da gravação
   */
  router.get('/recordings/status', (req: Request, res: Response) => {
    try {
      const status = recordingManager.getStatus();
      res.json({ data: status });
    } catch (error) {
      logger.error('Erro ao obter status de gravação', { error });
      res.status(500).json({
        error: { message: 'Erro ao obter status', code: 'RECORDING_STATUS_ERROR' },
      });
    }
  });

  /**
   * POST /api/recordings/start - Iniciar gravação
   */
  router.post(
    '/recordings/start',
    validate(startRecordingSchema),
    async (req: Request, res: Response) => {
      try {
        const { albumId, fileName } = req.body;

        // Obter sessão ativa (se houver)
        const sessionId = sessionManager.getCurrentSessionId() || undefined;

        const recording = await recordingManager.startRecording({
          albumId,
          fileName,
          sessionId,
        });

        res.json({ data: recording });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao iniciar gravação', { error: errorMsg });

        // Verificar se é erro de "já gravando"
        if (errorMsg.includes('já em andamento')) {
          res.status(409).json({
            error: { message: errorMsg, code: 'RECORDING_ALREADY_ACTIVE' },
          });
          return;
        }

        res.status(500).json({
          error: { message: 'Erro ao iniciar gravação', code: 'RECORDING_START_ERROR' },
        });
      }
    }
  );

  /**
   * POST /api/recordings/stop - Parar gravação
   */
  router.post(
    '/recordings/stop',
    validate(stopRecordingSchema),
    async (req: Request, res: Response) => {
      try {
        const recording = await recordingManager.stopRecording();
        res.json({ data: recording });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao parar gravação', { error: errorMsg });

        // Verificar se é erro de "nenhuma gravação"
        if (errorMsg.includes('Nenhuma gravação')) {
          res.status(400).json({
            error: { message: errorMsg, code: 'NO_ACTIVE_RECORDING' },
          });
          return;
        }

        res.status(500).json({
          error: { message: 'Erro ao parar gravação', code: 'RECORDING_STOP_ERROR' },
        });
      }
    }
  );

  /**
   * GET /api/recordings/:id - Buscar gravação por ID
   */
  router.get('/recordings/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const recording = await prisma.recording.findUnique({
        where: { id },
        include: {
          album: {
            select: { id: true, title: true, artist: true, coverUrl: true },
          },
          session: {
            select: { id: true, startedAt: true, endedAt: true },
          },
          trackMarkers: {
            orderBy: { trackNumber: 'asc' },
          },
        },
      });

      if (!recording) {
        res.status(404).json({
          error: { message: 'Gravação não encontrada', code: 'RECORDING_NOT_FOUND' },
        });
        return;
      }

      res.json({ data: recording });
    } catch (error) {
      logger.error('Erro ao buscar gravação', { error });
      res.status(500).json({
        error: { message: 'Erro ao buscar gravação', code: 'RECORDING_GET_ERROR' },
      });
    }
  });

  /**
   * PUT /api/recordings/:id - Atualizar gravação
   */
  router.put(
    '/recordings/:id',
    validate(updateRecordingSchema),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { fileName, albumId, notes } = req.body;

        // Verificar se existe
        const existing = await prisma.recording.findUnique({
          where: { id },
        });

        if (!existing) {
          res.status(404).json({
            error: { message: 'Gravação não encontrada', code: 'RECORDING_NOT_FOUND' },
          });
          return;
        }

        // Atualizar
        const recording = await prisma.recording.update({
          where: { id },
          data: {
            ...(fileName !== undefined && { fileName }),
            ...(albumId !== undefined && { albumId }),
            ...(notes !== undefined && { notes }),
          },
          include: {
            album: {
              select: { id: true, title: true, artist: true, coverUrl: true },
            },
          },
        });

        res.json({ data: recording });
      } catch (error) {
        logger.error('Erro ao atualizar gravação', { error });
        res.status(500).json({
          error: { message: 'Erro ao atualizar gravação', code: 'RECORDING_UPDATE_ERROR' },
        });
      }
    }
  );

  /**
   * DELETE /api/recordings/:id - Deletar gravação
   */
  router.delete('/recordings/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Verificar se existe
      const existing = await prisma.recording.findUnique({
        where: { id },
      });

      if (!existing) {
        res.status(404).json({
          error: { message: 'Gravação não encontrada', code: 'RECORDING_NOT_FOUND' },
        });
        return;
      }

      // Não permitir deletar gravação em andamento
      if (existing.status === 'recording') {
        res.status(400).json({
          error: { message: 'Não é possível deletar gravação em andamento', code: 'RECORDING_IN_PROGRESS' },
        });
        return;
      }

      // Deletar arquivo do filesystem
      // TODO: Implementar deleção do arquivo FLAC
      // const absolutePath = path.join(process.env.RECORDINGS_PATH || './data/recordings', existing.filePath);
      // await unlink(absolutePath).catch(() => {});

      // Deletar do banco (cascadeia para trackMarkers)
      await prisma.recording.delete({
        where: { id },
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Erro ao deletar gravação', { error });
      res.status(500).json({
        error: { message: 'Erro ao deletar gravação', code: 'RECORDING_DELETE_ERROR' },
      });
    }
  });

  return router;
}
