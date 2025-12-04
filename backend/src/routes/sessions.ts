import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { SessionManager } from '../services/session-manager';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import { sessionsQuerySchema, sessionIdParamSchema, SessionsQueryInput } from '../schemas';

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
  }[];
  total: number;
  hasMore: boolean;
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
}

/**
 * Cria router para endpoints de sessões
 *
 * Endpoints:
 * - GET /api/sessions - Lista sessões com filtros e paginação
 * - GET /api/sessions/:id - Detalhes de uma sessão com eventos
 * - GET /api/sessions/active - Retorna sessão ativa (se houver)
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
            eventCount: true
          }
        }),
        prisma.session.count({ where })
      ]);

      // Formatar resposta
      const response: SessionsResponse = {
        sessions: sessions.map(session => ({
          id: session.id,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt?.toISOString() || null,
          durationSeconds: session.durationSeconds,
          eventCount: session.eventCount
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
   * Retorna detalhes de uma sessão específica com seus eventos
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
          }
        }
      });

      if (!session) {
        res.status(404).json({
          error: { message: `Sessão não encontrada: nenhuma sessão com id '${id}'`, code: 'SESSION_NOT_FOUND' }
        });
        return;
      }

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
        }))
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

  return router;
}
