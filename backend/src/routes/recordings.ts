import { Router, Request, Response } from 'express';
import { createReadStream, statSync, existsSync } from 'fs';
import { join } from 'path';
import { RecordingManager } from '../services/recording-manager';
import { SessionManager } from '../services/session-manager';
import prisma from '../prisma/client';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import {
  startRecordingSchema,
  stopRecordingSchema,
  updateRecordingSchema,
  listRecordingsSchema,
  trimRecordingSchema,
  waveformQuerySchema,
  createMarkerSchema,
  updateMarkerSchema,
} from '../schemas/recordings.schema';
import {
  generateWaveformWithCache,
  trim as trimFlac,
  getDuration,
  invalidateWaveformCache,
} from '../utils/flac-editor';

const logger = createLogger('RecordingsRouter');

/**
 * Dependências necessárias para o router de recordings
 */
interface RecordingsRouterDeps {
  recordingManager: RecordingManager;
  sessionManager: SessionManager;
}

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

  // ============================================
  // Endpoints de Editor (V3-06)
  // ============================================

  const recordingsPath = process.env.RECORDINGS_PATH || './data/recordings';

  /**
   * Helper para obter caminho absoluto do arquivo FLAC
   */
  const getAbsoluteFilePath = (filePath: string): string => {
    return join(recordingsPath, filePath);
  };

  /**
   * GET /api/recordings/:id/waveform - Dados para visualização de waveform
   */
  router.get('/recordings/:id/waveform', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const query = waveformQuerySchema.parse(req.query);

      // Buscar gravação
      const recording = await prisma.recording.findUnique({
        where: { id },
      });

      if (!recording) {
        res.status(404).json({
          error: { message: 'Gravação não encontrada', code: 'RECORDING_NOT_FOUND' },
        });
        return;
      }

      // Verificar se arquivo existe
      const absolutePath = getAbsoluteFilePath(recording.filePath);
      if (!existsSync(absolutePath)) {
        res.status(404).json({
          error: { message: 'Arquivo de áudio não encontrado', code: 'FILE_NOT_FOUND' },
        });
        return;
      }

      // Gerar/recuperar waveform (com cache)
      const waveformData = await generateWaveformWithCache(absolutePath, query.resolution);

      res.json({
        data: {
          peaks: waveformData.peaks,
          duration: waveformData.duration,
          sampleRate: waveformData.sampleRate,
        },
      });
    } catch (error) {
      logger.error('Erro ao gerar waveform', { error });
      res.status(500).json({
        error: { message: 'Erro ao gerar waveform', code: 'WAVEFORM_ERROR' },
      });
    }
  });

  /**
   * GET /api/recordings/:id/stream - Stream do arquivo FLAC para playback
   * Suporta Range requests para seeking
   */
  router.get('/recordings/:id/stream', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Buscar gravação
      const recording = await prisma.recording.findUnique({
        where: { id },
      });

      if (!recording) {
        res.status(404).json({
          error: { message: 'Gravação não encontrada', code: 'RECORDING_NOT_FOUND' },
        });
        return;
      }

      // Verificar se arquivo existe
      const absolutePath = getAbsoluteFilePath(recording.filePath);
      if (!existsSync(absolutePath)) {
        res.status(404).json({
          error: { message: 'Arquivo de áudio não encontrado', code: 'FILE_NOT_FOUND' },
        });
        return;
      }

      // Obter tamanho do arquivo
      const stat = statSync(absolutePath);
      const fileSize = stat.size;

      // Configurar headers comuns
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'audio/flac');

      // Verificar se é Range request
      const range = req.headers.range;

      if (range) {
        // Parse range header (ex: "bytes=0-1024")
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);

        const stream = createReadStream(absolutePath, { start, end });
        stream.pipe(res);
      } else {
        // Full file
        res.setHeader('Content-Length', fileSize);
        const stream = createReadStream(absolutePath);
        stream.pipe(res);
      }
    } catch (error) {
      logger.error('Erro ao fazer stream', { error });
      res.status(500).json({
        error: { message: 'Erro ao fazer stream', code: 'STREAM_ERROR' },
      });
    }
  });

  /**
   * POST /api/recordings/:id/trim - Aplicar corte no arquivo FLAC
   */
  router.post(
    '/recordings/:id/trim',
    validate(trimRecordingSchema),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { startOffset, endOffset } = req.body;

        // Buscar gravação
        const recording = await prisma.recording.findUnique({
          where: { id },
          include: { trackMarkers: true },
        });

        if (!recording) {
          res.status(404).json({
            error: { message: 'Gravação não encontrada', code: 'RECORDING_NOT_FOUND' },
          });
          return;
        }

        // Não permitir trim em gravação em andamento
        if (recording.status === 'recording') {
          res.status(400).json({
            error: { message: 'Não é possível editar gravação em andamento', code: 'RECORDING_IN_PROGRESS' },
          });
          return;
        }

        const absolutePath = getAbsoluteFilePath(recording.filePath);
        if (!existsSync(absolutePath)) {
          res.status(404).json({
            error: { message: 'Arquivo de áudio não encontrado', code: 'FILE_NOT_FOUND' },
          });
          return;
        }

        // Aplicar trim (sobrescreve o arquivo original)
        const result = await trimFlac(absolutePath, absolutePath, startOffset, endOffset);

        // Invalidar cache de waveform
        await invalidateWaveformCache(absolutePath);

        // Atualizar duração no banco
        const newDuration = Math.round(result.newDuration);
        await prisma.recording.update({
          where: { id },
          data: {
            durationSeconds: newDuration,
            // Atualizar tamanho do arquivo
            fileSizeBytes: statSync(absolutePath).size,
          },
        });

        // Ajustar marcadores:
        // 1. Subtrair startOffset de todos
        // 2. Remover os que ficam fora do novo range
        const newEndOffset = endOffset - startOffset;

        // Deletar marcadores fora do range
        await prisma.trackMarker.deleteMany({
          where: {
            recordingId: id,
            OR: [
              { startOffset: { lt: startOffset } },
              { startOffset: { gte: endOffset } },
            ],
          },
        });

        // Ajustar offsets dos marcadores restantes
        await prisma.trackMarker.updateMany({
          where: { recordingId: id },
          data: {
            startOffset: { decrement: startOffset },
            endOffset: { decrement: startOffset },
          },
        });

        // Corrigir endOffsets que excedem nova duração
        await prisma.trackMarker.updateMany({
          where: {
            recordingId: id,
            endOffset: { gt: newEndOffset },
          },
          data: {
            endOffset: newEndOffset,
          },
        });

        // Buscar gravação atualizada
        const updatedRecording = await prisma.recording.findUnique({
          where: { id },
          include: {
            album: {
              select: { id: true, title: true, artist: true, coverUrl: true },
            },
            trackMarkers: {
              orderBy: { trackNumber: 'asc' },
            },
          },
        });

        res.json({
          data: updatedRecording,
          previousDuration: Math.round(result.previousDuration),
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao aplicar trim', { error: errorMsg });
        res.status(500).json({
          error: { message: `Erro ao aplicar trim: ${errorMsg}`, code: 'TRIM_ERROR' },
        });
      }
    }
  );

  // ============================================
  // CRUD de Markers (V3-06)
  // ============================================

  /**
   * GET /api/recordings/:id/markers - Listar marcadores
   */
  router.get('/recordings/:id/markers', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Verificar se gravação existe
      const recording = await prisma.recording.findUnique({
        where: { id },
      });

      if (!recording) {
        res.status(404).json({
          error: { message: 'Gravação não encontrada', code: 'RECORDING_NOT_FOUND' },
        });
        return;
      }

      const markers = await prisma.trackMarker.findMany({
        where: { recordingId: id },
        orderBy: { trackNumber: 'asc' },
      });

      res.json({ data: markers });
    } catch (error) {
      logger.error('Erro ao listar marcadores', { error });
      res.status(500).json({
        error: { message: 'Erro ao listar marcadores', code: 'MARKERS_LIST_ERROR' },
      });
    }
  });

  /**
   * POST /api/recordings/:id/markers - Criar marcador
   */
  router.post(
    '/recordings/:id/markers',
    validate(createMarkerSchema),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { trackNumber, title, startOffset, endOffset } = req.body;

        // Verificar se gravação existe
        const recording = await prisma.recording.findUnique({
          where: { id },
        });

        if (!recording) {
          res.status(404).json({
            error: { message: 'Gravação não encontrada', code: 'RECORDING_NOT_FOUND' },
          });
          return;
        }

        // Verificar se trackNumber já existe
        const existing = await prisma.trackMarker.findUnique({
          where: {
            recordingId_trackNumber: { recordingId: id, trackNumber },
          },
        });

        if (existing) {
          res.status(409).json({
            error: { message: `Marcador #${trackNumber} já existe`, code: 'MARKER_EXISTS' },
          });
          return;
        }

        const marker = await prisma.trackMarker.create({
          data: {
            recordingId: id,
            trackNumber,
            title,
            startOffset,
            endOffset,
          },
        });

        res.status(201).json({ data: marker });
      } catch (error) {
        logger.error('Erro ao criar marcador', { error });
        res.status(500).json({
          error: { message: 'Erro ao criar marcador', code: 'MARKER_CREATE_ERROR' },
        });
      }
    }
  );

  /**
   * PUT /api/recordings/:id/markers/:markerId - Atualizar marcador
   */
  router.put(
    '/recordings/:id/markers/:markerId',
    validate(updateMarkerSchema),
    async (req: Request, res: Response) => {
      try {
        const { id, markerId } = req.params;
        const { trackNumber, title, startOffset, endOffset } = req.body;

        // Verificar se marcador existe
        const existing = await prisma.trackMarker.findFirst({
          where: { id: markerId, recordingId: id },
        });

        if (!existing) {
          res.status(404).json({
            error: { message: 'Marcador não encontrado', code: 'MARKER_NOT_FOUND' },
          });
          return;
        }

        // Se mudou trackNumber, verificar se já existe
        if (trackNumber && trackNumber !== existing.trackNumber) {
          const conflict = await prisma.trackMarker.findUnique({
            where: {
              recordingId_trackNumber: { recordingId: id, trackNumber },
            },
          });

          if (conflict) {
            res.status(409).json({
              error: { message: `Marcador #${trackNumber} já existe`, code: 'MARKER_EXISTS' },
            });
            return;
          }
        }

        const marker = await prisma.trackMarker.update({
          where: { id: markerId },
          data: {
            ...(trackNumber !== undefined && { trackNumber }),
            ...(title !== undefined && { title }),
            ...(startOffset !== undefined && { startOffset }),
            ...(endOffset !== undefined && { endOffset }),
          },
        });

        res.json({ data: marker });
      } catch (error) {
        logger.error('Erro ao atualizar marcador', { error });
        res.status(500).json({
          error: { message: 'Erro ao atualizar marcador', code: 'MARKER_UPDATE_ERROR' },
        });
      }
    }
  );

  /**
   * DELETE /api/recordings/:id/markers/:markerId - Deletar marcador
   */
  router.delete('/recordings/:id/markers/:markerId', async (req: Request, res: Response) => {
    try {
      const { id, markerId } = req.params;

      // Verificar se marcador existe
      const existing = await prisma.trackMarker.findFirst({
        where: { id: markerId, recordingId: id },
      });

      if (!existing) {
        res.status(404).json({
          error: { message: 'Marcador não encontrado', code: 'MARKER_NOT_FOUND' },
        });
        return;
      }

      await prisma.trackMarker.delete({
        where: { id: markerId },
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Erro ao deletar marcador', { error });
      res.status(500).json({
        error: { message: 'Erro ao deletar marcador', code: 'MARKER_DELETE_ERROR' },
      });
    }
  });

  return router;
}
