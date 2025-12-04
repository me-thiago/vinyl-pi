import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { EventType } from '@prisma/client';
import { EventPersistence } from '../services/event-persistence';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import { eventsQuerySchema, EventsQueryInput } from '../schemas';

const logger = createLogger('EventsRouter');

/**
 * Dependências para o router de eventos
 */
export interface EventsRouterDependencies {
  eventPersistence?: EventPersistence;
}

// Query params são validados via Zod schema (EventsQueryInput)

/**
 * Resposta do endpoint GET /api/events
 */
interface EventsResponse {
  events: {
    id: string;
    sessionId: string | null;
    eventType: string;
    timestamp: string;
    metadata: object | null;
  }[];
  total: number;
  hasMore: boolean;
}

/**
 * Cria router para endpoints de eventos
 *
 * Endpoints:
 * - GET /api/events - Lista eventos com filtros e paginação
 * - GET /api/events/stats - Estatísticas do serviço de persistência
 */
export function createEventsRouter(deps?: EventsRouterDependencies): Router {
  const router = Router();
  const { eventPersistence } = deps || {};

  /**
   * GET /api/events
   *
   * Query params (validados via Zod):
   * - session_id: Filtrar por sessão
   * - event_type: Filtrar por tipo de evento
   * - limit: Limite de resultados (default: 100, max: 1000)
   * - offset: Offset para paginação (default: 0)
   * - date_from: Data início (ISO string)
   * - date_to: Data fim (ISO string)
   */
  router.get('/events', validate(eventsQuerySchema, 'query'), async (req: Request, res: Response) => {
    try {
      // Query já validada e tipada pelo Zod
      const {
        session_id,
        event_type,
        limit: queryLimit,
        offset: queryOffset,
        date_from,
        date_to
      } = req.query as EventsQueryInput;

      // Aplicar defaults
      const limit = Math.min(queryLimit ?? 100, 1000);
      const offset = queryOffset ?? 0;

      // Construir filtro where
      const where: {
        sessionId?: string;
        eventType?: EventType;
        timestamp?: {
          gte?: Date;
          lte?: Date;
        };
      } = {};

      if (session_id) {
        where.sessionId = session_id;
      }

      if (event_type) {
        // Validar que o event_type é um valor válido do enum
        where.eventType = event_type as EventType;
      }

      // Filtro de data
      if (date_from || date_to) {
        where.timestamp = {};
        if (date_from) {
          where.timestamp.gte = new Date(date_from);
        }
        if (date_to) {
          where.timestamp.lte = new Date(date_to);
        }
      }

      // Buscar eventos e total em paralelo
      const [events, total] = await Promise.all([
        prisma.audioEvent.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            sessionId: true,
            eventType: true,
            timestamp: true,
            metadata: true
          }
        }),
        prisma.audioEvent.count({ where })
      ]);

      // Formatar resposta
      const response: EventsResponse = {
        events: events.map(event => ({
          id: event.id,
          sessionId: event.sessionId,
          eventType: event.eventType,
          timestamp: event.timestamp.toISOString(),
          metadata: event.metadata as object | null
        })),
        total,
        hasMore: offset + events.length < total
      };

      res.json(response);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao buscar eventos', { error: errorMsg });
      res.status(500).json({
        error: { message: 'Erro ao buscar eventos', code: 'EVENTS_FETCH_ERROR' }
      });
    }
  });

  /**
   * GET /api/events/stats
   *
   * Retorna estatísticas do serviço de persistência
   */
  router.get('/events/stats', (req: Request, res: Response) => {
    if (!eventPersistence) {
      res.status(503).json({
        error: { message: 'Serviço indisponível: EventPersistence não está configurado', code: 'SERVICE_UNAVAILABLE' }
      });
      return;
    }

    const stats = eventPersistence.getStats();
    res.json(stats);
  });

  return router;
}
