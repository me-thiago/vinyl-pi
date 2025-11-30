import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { EventPersistence } from '../services/event-persistence';

/**
 * Dependências para o router de eventos
 */
export interface EventsRouterDependencies {
  eventPersistence?: EventPersistence;
}

/**
 * Query parameters para GET /api/events
 */
interface EventsQueryParams {
  session_id?: string;
  event_type?: string;
  limit?: string;
  offset?: string;
  date_from?: string;
  date_to?: string;
}

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
   * Query params:
   * - session_id: Filtrar por sessão
   * - event_type: Filtrar por tipo de evento
   * - limit: Limite de resultados (default: 100, max: 1000)
   * - offset: Offset para paginação (default: 0)
   * - date_from: Data início (ISO string)
   * - date_to: Data fim (ISO string)
   */
  router.get('/events', async (req: Request<{}, {}, {}, EventsQueryParams>, res: Response) => {
    try {
      const {
        session_id,
        event_type,
        limit: limitStr,
        offset: offsetStr,
        date_from,
        date_to
      } = req.query;

      // Parse e validar limit/offset
      const limit = Math.min(parseInt(limitStr || '100', 10), 1000);
      const offset = parseInt(offsetStr || '0', 10);

      // Validar valores numéricos
      if (isNaN(limit) || limit < 1) {
        res.status(400).json({
          error: 'Parâmetro inválido',
          message: 'limit deve ser um número entre 1 e 1000'
        });
        return;
      }

      if (isNaN(offset) || offset < 0) {
        res.status(400).json({
          error: 'Parâmetro inválido',
          message: 'offset deve ser um número maior ou igual a 0'
        });
        return;
      }

      // Construir filtro where
      const where: {
        sessionId?: string;
        eventType?: string;
        timestamp?: {
          gte?: Date;
          lte?: Date;
        };
      } = {};

      if (session_id) {
        where.sessionId = session_id;
      }

      if (event_type) {
        where.eventType = event_type;
      }

      // Filtro de data
      if (date_from || date_to) {
        where.timestamp = {};

        if (date_from) {
          const dateFromParsed = new Date(date_from);
          if (isNaN(dateFromParsed.getTime())) {
            res.status(400).json({
              error: 'Parâmetro inválido',
              message: 'date_from deve ser uma data ISO válida'
            });
            return;
          }
          where.timestamp.gte = dateFromParsed;
        }

        if (date_to) {
          const dateToParsed = new Date(date_to);
          if (isNaN(dateToParsed.getTime())) {
            res.status(400).json({
              error: 'Parâmetro inválido',
              message: 'date_to deve ser uma data ISO válida'
            });
            return;
          }
          where.timestamp.lte = dateToParsed;
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
      res.status(500).json({
        error: 'Erro ao buscar eventos',
        message: errorMsg
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
        error: 'Serviço indisponível',
        message: 'EventPersistence não está configurado'
      });
      return;
    }

    const stats = eventPersistence.getStats();
    res.json(stats);
  });

  return router;
}
