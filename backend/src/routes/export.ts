import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import {
  exportCollectionQuerySchema,
  exportHistoryQuerySchema,
  type ExportCollectionQueryInput,
  type ExportHistoryQueryInput,
} from '../schemas';

const logger = createLogger('ExportRouter');

/**
 * Interface para álbum exportado
 */
interface ExportedAlbum {
  title: string;
  artist: string;
  year: number | null;
  label: string | null;
  format: string | null;
  condition: string | null;
  tags: string[];
  notes: string | null;
  discogsId: number | null;
  addedAt: string;
}

/**
 * Interface para sessão exportada
 */
interface ExportedSession {
  date: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  albumsPlayed: { title: string; artist: string }[];
}

/**
 * Converte array de álbuns para CSV
 */
function albumsToCSV(albums: ExportedAlbum[]): string {
  const headers = [
    'title',
    'artist',
    'year',
    'label',
    'format',
    'condition',
    'tags',
    'notes',
    'discogsId',
    'addedAt',
  ];

  const escapeCSV = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = albums.map((album) => {
    return [
      escapeCSV(album.title),
      escapeCSV(album.artist),
      album.year?.toString() || '',
      escapeCSV(album.label),
      escapeCSV(album.format),
      escapeCSV(album.condition),
      escapeCSV(album.tags.join(';')),
      escapeCSV(album.notes),
      album.discogsId?.toString() || '',
      album.addedAt.split('T')[0], // Apenas data YYYY-MM-DD
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Converte array de sessões para CSV (formato flat)
 * Cada álbum por sessão gera uma linha
 */
function historyToCSV(sessions: ExportedSession[]): string {
  const headers = [
    'date',
    'startedAt',
    'endedAt',
    'durationMinutes',
    'albumTitle',
    'albumArtist',
  ];

  const escapeCSV = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[] = [];

  for (const session of sessions) {
    // Se não há álbuns, ainda mostrar a sessão com campos vazios
    if (session.albumsPlayed.length === 0) {
      rows.push(
        [
          escapeCSV(session.date),
          escapeCSV(session.startedAt.split('T')[1]?.slice(0, 8) || ''),
          session.endedAt
            ? escapeCSV(session.endedAt.split('T')[1]?.slice(0, 8) || '')
            : '',
          session.durationMinutes.toString(),
          '',
          '',
        ].join(',')
      );
    } else {
      // Uma linha para cada álbum na sessão
      for (const album of session.albumsPlayed) {
        rows.push(
          [
            escapeCSV(session.date),
            escapeCSV(session.startedAt.split('T')[1]?.slice(0, 8) || ''),
            session.endedAt
              ? escapeCSV(session.endedAt.split('T')[1]?.slice(0, 8) || '')
              : '',
            session.durationMinutes.toString(),
            escapeCSV(album.title),
            escapeCSV(album.artist),
          ].join(',')
        );
      }
    }
  }

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Cria router para endpoints de export (V2-11)
 *
 * Endpoints:
 * - GET /api/export/collection - Exporta coleção em JSON ou CSV
 * - GET /api/export/history - Exporta histórico de escuta em JSON ou CSV
 */
export function createExportRouter(): Router {
  const router = Router();

  /**
   * @openapi
   * /api/export/collection:
   *   get:
   *     summary: Exportar coleção
   *     description: Exporta a coleção de álbuns em formato JSON ou CSV
   *     tags:
   *       - Export
   *     parameters:
   *       - in: query
   *         name: format
   *         schema:
   *           type: string
   *           enum: [json, csv]
   *           default: json
   *         description: Formato do arquivo (json ou csv)
   *       - in: query
   *         name: archived
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Incluir álbuns arquivados
   *     responses:
   *       200:
   *         description: Arquivo de export
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 exportedAt:
   *                   type: string
   *                   format: date-time
   *                 totalAlbums:
   *                   type: integer
   *                 albums:
   *                   type: array
   *                   items:
   *                     type: object
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get(
    '/export/collection',
    validate(exportCollectionQuerySchema, 'query'),
    async (req: Request, res: Response) => {
      try {
        // Query já validada e tipada pelo Zod
        const { format, archived } = req.query as unknown as ExportCollectionQueryInput;

        const albums = await prisma.album.findMany({
          where: archived ? {} : { archived: false },
          orderBy: { artist: 'asc' },
        });

        const exportedAlbums: ExportedAlbum[] = albums.map((album) => ({
          title: album.title,
          artist: album.artist,
          year: album.year,
          label: album.label,
          format: album.format,
          condition: album.condition,
          tags: Array.isArray(album.tags) ? (album.tags as string[]) : [],
          notes: album.notes,
          discogsId: album.discogsId,
          addedAt: album.createdAt.toISOString(),
        }));

        const timestamp = new Date().toISOString().split('T')[0];

        if (format === 'csv') {
          const csv = albumsToCSV(exportedAlbums);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="vinyl-os-collection-${timestamp}.csv"`
          );
          logger.info('Collection exported as CSV', {
            count: exportedAlbums.length,
          });
          return res.send(csv);
        }

        // JSON (default)
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="vinyl-os-collection-${timestamp}.json"`
        );

        const jsonExport = {
          exportedAt: new Date().toISOString(),
          totalAlbums: exportedAlbums.length,
          albums: exportedAlbums,
        };

        logger.info('Collection exported as JSON', {
          count: exportedAlbums.length,
        });
        return res.json(jsonExport);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao exportar coleção', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao exportar coleção',
            code: 'EXPORT_COLLECTION_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/export/history:
   *   get:
   *     summary: Exportar histórico de escuta
   *     description: Exporta o histórico de sessões de escuta em formato JSON ou CSV
   *     tags:
   *       - Export
   *     parameters:
   *       - in: query
   *         name: format
   *         schema:
   *           type: string
   *           enum: [json, csv]
   *           default: json
   *         description: Formato do arquivo (json ou csv)
   *       - in: query
   *         name: from
   *         schema:
   *           type: string
   *           format: date
   *         description: Data inicial (YYYY-MM-DD)
   *       - in: query
   *         name: to
   *         schema:
   *           type: string
   *           format: date
   *         description: Data final (YYYY-MM-DD)
   *     responses:
   *       200:
   *         description: Arquivo de export
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 exportedAt:
   *                   type: string
   *                   format: date-time
   *                 period:
   *                   type: object
   *                   properties:
   *                     from:
   *                       type: string
   *                       nullable: true
   *                     to:
   *                       type: string
   *                       nullable: true
   *                 totalSessions:
   *                   type: integer
   *                 sessions:
   *                   type: array
   *                   items:
   *                     type: object
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get(
    '/export/history',
    validate(exportHistoryQuerySchema, 'query'),
    async (req: Request, res: Response) => {
      try {
        // Query já validada e tipada pelo Zod
        const { format, from, to } = req.query as unknown as ExportHistoryQueryInput;

        // Construir filtro de data
        const dateFilter: { gte?: Date; lte?: Date } = {};

        if (from) {
          dateFilter.gte = new Date(`${from}T00:00:00Z`);
        }
        if (to) {
          dateFilter.lte = new Date(`${to}T23:59:59.999Z`);
        }

        const sessions = await prisma.session.findMany({
          where: dateFilter.gte || dateFilter.lte
            ? { startedAt: dateFilter }
            : {},
          orderBy: { startedAt: 'desc' },
          include: {
            tracks: {
              include: {
                album: {
                  select: {
                    title: true,
                    artist: true,
                  },
                },
              },
            },
          },
        });

        // Agrupar álbuns únicos por sessão
        const exportedSessions: ExportedSession[] = sessions.map((session) => {
          // Usar Map para eliminar duplicatas por albumId
          const albumsMap = new Map<
            string,
            { title: string; artist: string }
          >();

          for (const track of session.tracks) {
            if (track.album) {
              const key = track.album.title + '|' + track.album.artist;
              if (!albumsMap.has(key)) {
                albumsMap.set(key, {
                  title: track.album.title,
                  artist: track.album.artist,
                });
              }
            }
          }

          return {
            date: session.startedAt.toISOString().split('T')[0],
            startedAt: session.startedAt.toISOString(),
            endedAt: session.endedAt?.toISOString() || null,
            durationMinutes: Math.round(session.durationSeconds / 60),
            albumsPlayed: Array.from(albumsMap.values()),
          };
        });

        const timestamp = new Date().toISOString().split('T')[0];

        if (format === 'csv') {
          const csv = historyToCSV(exportedSessions);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="vinyl-os-history-${timestamp}.csv"`
          );
          logger.info('History exported as CSV', {
            count: exportedSessions.length,
          });
          return res.send(csv);
        }

        // JSON (default)
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="vinyl-os-history-${timestamp}.json"`
        );

        const jsonExport = {
          exportedAt: new Date().toISOString(),
          period: {
            from: from || null,
            to: to || null,
          },
          totalSessions: exportedSessions.length,
          sessions: exportedSessions,
        };

        logger.info('History exported as JSON', {
          count: exportedSessions.length,
        });
        return res.json(jsonExport);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao exportar histórico', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao exportar histórico',
            code: 'EXPORT_HISTORY_ERROR',
          },
        });
      }
    }
  );

  return router;
}

