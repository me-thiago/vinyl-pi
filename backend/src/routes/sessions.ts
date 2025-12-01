import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { SessionManager } from '../services/session-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('SessionsRouter');

/**
 * Dependências para o router de sessões
 */
export interface SessionsRouterDependencies {
  sessionManager?: SessionManager;
}

/**
 * Query parameters para GET /api/sessions
 */
interface SessionsQueryParams {
  limit?: string;
  offset?: string;
  date_from?: string;
  date_to?: string;
}

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
   * Query params:
   * - limit: Limite de resultados (default: 20, max: 100)
   * - offset: Offset para paginação (default: 0)
   * - date_from: Data início (ISO string)
   * - date_to: Data fim (ISO string)
   */
  router.get('/sessions', async (req: Request<{}, {}, {}, SessionsQueryParams>, res: Response) => {
    try {
      const {
        limit: limitStr,
        offset: offsetStr,
        date_from,
        date_to
      } = req.query;

      // Parse e validar limit/offset
      const limit = Math.min(parseInt(limitStr || '20', 10), 100);
      const offset = parseInt(offsetStr || '0', 10);

      if (isNaN(limit) || limit < 1) {
        res.status(400).json({
          error: { message: 'Parâmetro inválido: limit deve ser um número entre 1 e 100', code: 'VALIDATION_ERROR' }
        });
        return;
      }

      if (isNaN(offset) || offset < 0) {
        res.status(400).json({
          error: { message: 'Parâmetro inválido: offset deve ser um número maior ou igual a 0', code: 'VALIDATION_ERROR' }
        });
        return;
      }

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
          const dateFromParsed = new Date(date_from);
          if (isNaN(dateFromParsed.getTime())) {
            res.status(400).json({
              error: { message: 'Parâmetro inválido: date_from deve ser uma data ISO válida', code: 'VALIDATION_ERROR' }
            });
            return;
          }
          where.startedAt.gte = dateFromParsed;
        }

        if (date_to) {
          const dateToParsed = new Date(date_to);
          if (isNaN(dateToParsed.getTime())) {
            res.status(400).json({
              error: { message: 'Parâmetro inválido: date_to deve ser uma data ISO válida', code: 'VALIDATION_ERROR' }
            });
            return;
          }
          where.startedAt.lte = dateToParsed;
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
  router.get('/sessions/:id', async (req: Request<{ id: string }>, res: Response) => {
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
