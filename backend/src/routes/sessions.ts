import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { SessionManager } from '../services/session-manager';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import {
  sessionsQuerySchema,
  sessionIdParamSchema,
  SessionsQueryInput,
  addSessionAlbumSchema,
  sessionAlbumParamSchema,
  AddSessionAlbumInput,
  SessionAlbumParam,
} from '../schemas';

const logger = createLogger('SessionsRouter');

/**
 * Dependências para o router de sessões
 */
export interface SessionsRouterDependencies {
  sessionManager?: SessionManager;
}

// Query params são validados via Zod schema (SessionsQueryInput)

/**
 * Resposta do endpoint GET /api/sessions
 */
interface SessionsResponse {
  sessions: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number;
    eventCount: number;
    albumCount: number; // V2-09: Número de álbuns únicos tocados
  }[];
  total: number;
  hasMore: boolean;
}

/**
 * V3a-09: Álbum na sessão (via SessionAlbum)
 */
interface SessionAlbumResponse {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
  source: string;      // 'manual' | 'recognition'
  addedAt: string;
  notes: string | null;
}

/**
 * Resposta do endpoint GET /api/sessions/:id
 */
interface SessionDetailResponse {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  eventCount: number;
  events: {
    id: string;
    eventType: string;
    timestamp: string;
    metadata: object | null;
  }[];
  albums: SessionAlbumResponse[];  // V3a-09: Atualizado para usar SessionAlbum
}

/**
 * Cria router para endpoints de sessões
 *
 * Endpoints:
 * - GET /api/sessions - Lista sessões com filtros e paginação
 * - GET /api/sessions/:id - Detalhes de uma sessão com eventos
 * - GET /api/sessions/active - Retorna sessão ativa (se houver)
 * - POST /api/sessions/:id/albums - V3a-09: Adiciona álbum manualmente à sessão
 * - DELETE /api/sessions/:id/albums/:albumId - V3a-09: Remove álbum da sessão
 */
export function createSessionsRouter(deps?: SessionsRouterDependencies): Router {
  const router = Router();
  const { sessionManager } = deps || {};

  /**
   * GET /api/sessions
   *
   * Query params (validados via Zod):
   * - limit: Limite de resultados (default: 20, max: 100)
   * - offset: Offset para paginação (default: 0)
   * - date_from: Data início (ISO string)
   * - date_to: Data fim (ISO string)
   */
  router.get('/sessions', validate(sessionsQuerySchema, 'query'), async (req: Request, res: Response) => {
    try {
      // Query já validada e tipada pelo Zod
      const { limit: queryLimit, offset: queryOffset, date_from, date_to } = req.query as SessionsQueryInput;

      // Aplicar defaults
      const limit = Math.min(queryLimit ?? 20, 100);
      const offset = queryOffset ?? 0;

      // Construir filtro where
      const where: {
        startedAt?: {
          gte?: Date;
          lte?: Date;
        };
      } = {};

      if (date_from || date_to) {
        where.startedAt = {};
        if (date_from) {
          where.startedAt.gte = new Date(date_from);
        }
        if (date_to) {
          where.startedAt.lte = new Date(date_to);
        }
      }

      // Buscar sessões e total em paralelo
      // V3a-09: Usar _count de sessionAlbums para contar álbuns
      const [sessions, total] = await Promise.all([
        prisma.session.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
            durationSeconds: true,
            eventCount: true,
            _count: {
              select: { sessionAlbums: true }
            }
          }
        }),
        prisma.session.count({ where })
      ]);

      // Formatar resposta com albumCount
      const response: SessionsResponse = {
        sessions: sessions.map(session => ({
          id: session.id,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt?.toISOString() || null,
          durationSeconds: session.durationSeconds,
          eventCount: session.eventCount,
          albumCount: session._count.sessionAlbums  // V3a-09
        })),
        total,
        hasMore: offset + sessions.length < total
      };

      res.json(response);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao buscar sessões', { error: errorMsg });
      res.status(500).json({
        error: { message: 'Erro ao buscar sessões', code: 'SESSIONS_FETCH_ERROR' }
      });
    }
  });

  /**
   * GET /api/sessions/active
   *
   * Retorna a sessão ativa atual (se houver)
   */
  router.get('/sessions/active', (req: Request, res: Response) => {
    if (!sessionManager) {
      res.status(503).json({
        error: { message: 'Serviço indisponível: SessionManager não está configurado', code: 'SERVICE_UNAVAILABLE' }
      });
      return;
    }

    const activeSession = sessionManager.getActiveSession();

    if (!activeSession) {
      res.json({ active: false, session: null });
      return;
    }

    res.json({
      active: true,
      session: {
        id: activeSession.id,
        startedAt: activeSession.startedAt.toISOString(),
        durationSeconds: activeSession.durationSeconds,
        eventCount: activeSession.eventCount
      }
    });
  });

  /**
   * GET /api/sessions/:id
   *
   * Retorna detalhes de uma sessão específica com seus eventos e álbuns tocados
   */
  router.get('/sessions/:id', validate(sessionIdParamSchema, 'params'), async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;

      const session = await prisma.session.findUnique({
        where: { id },
        include: {
          audioEvents: {
            orderBy: { timestamp: 'asc' },
            select: {
              id: true,
              eventType: true,
              timestamp: true,
              metadata: true
            }
          },
          // V3a-09: Usar sessionAlbums em vez de tracks
          sessionAlbums: {
            orderBy: { addedAt: 'asc' },
            include: {
              album: {
                select: { id: true, title: true, artist: true, year: true, coverUrl: true }
              }
            }
          }
        }
      });

      if (!session) {
        res.status(404).json({
          error: { message: `Sessão não encontrada: nenhuma sessão com id '${id}'`, code: 'SESSION_NOT_FOUND' }
        });
        return;
      }

      // V3a-09: Mapear sessionAlbums para formato da resposta
      const albums: SessionAlbumResponse[] = session.sessionAlbums.map((sa) => ({
        id: sa.album.id,
        title: sa.album.title,
        artist: sa.album.artist,
        year: sa.album.year,
        coverUrl: sa.album.coverUrl,
        source: sa.source,
        addedAt: sa.addedAt.toISOString(),
        notes: sa.notes,
      }));

      const response: SessionDetailResponse = {
        id: session.id,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() || null,
        durationSeconds: session.durationSeconds,
        eventCount: session.eventCount,
        events: session.audioEvents.map(event => ({
          id: event.id,
          eventType: event.eventType,
          timestamp: event.timestamp.toISOString(),
          metadata: event.metadata as object | null
        })),
        albums
      };

      res.json(response);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao buscar sessão', { id: req.params.id, error: errorMsg });
      res.status(500).json({
        error: { message: 'Erro ao buscar sessão', code: 'SESSION_FETCH_ERROR' }
      });
    }
  });

  /**
   * POST /api/sessions/:id/albums
   * V3a-09: Adiciona um álbum manualmente à sessão
   */
  router.post(
    '/sessions/:id/albums',
    validate(sessionIdParamSchema, 'params'),
    validate(addSessionAlbumSchema, 'body'),
    async (req: Request<{ id: string }, unknown, AddSessionAlbumInput>, res: Response) => {
      try {
        const { id } = req.params;
        const { albumId, notes } = req.body;

        // Verificar se sessão existe
        const session = await prisma.session.findUnique({ where: { id } });
        if (!session) {
          res.status(404).json({
            error: { message: 'Sessão não encontrada', code: 'SESSION_NOT_FOUND' }
          });
          return;
        }

        // Verificar se álbum existe
        const album = await prisma.album.findUnique({ where: { id: albumId } });
        if (!album) {
          res.status(404).json({
            error: { message: 'Álbum não encontrado', code: 'ALBUM_NOT_FOUND' }
          });
          return;
        }

        // Verificar se já existe vínculo
        const existing = await prisma.sessionAlbum.findUnique({
          where: { sessionId_albumId: { sessionId: id, albumId } },
        });
        if (existing) {
          res.status(409).json({
            error: { message: 'Álbum já está nesta sessão', code: 'ALBUM_ALREADY_IN_SESSION' }
          });
          return;
        }

        // Criar vínculo
        const sessionAlbum = await prisma.sessionAlbum.create({
          data: {
            sessionId: id,
            albumId,
            source: 'manual',
            notes,
          },
          include: {
            album: {
              select: { id: true, title: true, artist: true, year: true, coverUrl: true },
            },
          },
        });

        logger.info(`Álbum adicionado manualmente à sessão: sessionId=${id}, albumId=${albumId}`);

        res.status(201).json({
          data: {
            id: sessionAlbum.album.id,
            title: sessionAlbum.album.title,
            artist: sessionAlbum.album.artist,
            year: sessionAlbum.album.year,
            coverUrl: sessionAlbum.album.coverUrl,
            source: sessionAlbum.source,
            addedAt: sessionAlbum.addedAt.toISOString(),
            notes: sessionAlbum.notes,
          }
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao adicionar álbum à sessão', { error: errorMsg });
        res.status(500).json({
          error: { message: 'Erro ao adicionar álbum', code: 'ADD_ALBUM_ERROR' }
        });
      }
    }
  );

  /**
   * DELETE /api/sessions/:id/albums/:albumId
   * V3a-09: Remove um álbum da sessão
   */
  router.delete(
    '/sessions/:id/albums/:albumId',
    validate(sessionAlbumParamSchema, 'params'),
    async (req: Request<SessionAlbumParam>, res: Response) => {
      try {
        const { id, albumId } = req.params;

        const deleted = await prisma.sessionAlbum.deleteMany({
          where: { sessionId: id, albumId },
        });

        if (deleted.count === 0) {
          res.status(404).json({
            error: { message: 'Álbum não encontrado nesta sessão', code: 'ALBUM_NOT_IN_SESSION' }
          });
          return;
        }

        logger.info(`Álbum removido da sessão: sessionId=${id}, albumId=${albumId}`);

        res.json({ data: { deleted: deleted.count } });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao remover álbum da sessão', { error: errorMsg });
        res.status(500).json({
          error: { message: 'Erro ao remover álbum', code: 'REMOVE_ALBUM_ERROR' }
        });
      }
    }
  );

  return router;
}
