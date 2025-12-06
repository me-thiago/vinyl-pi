import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('StatsRouter');

/**
 * Estatísticas da coleção
 */
interface CollectionStats {
  totalAlbums: number;        // Excluindo archived
  archivedAlbums: number;
  uniqueArtists: number;
  byFormat: Record<string, number>;  // { LP: 45, EP: 12, SINGLE_7: 8, ... }
  byDecade: Record<string, number>;  // { "1970s": 15, "1980s": 22, ... }
  manuallyAdded: number;      // Álbuns sem discogsId
}

/**
 * Estatísticas de escuta
 */
interface ListeningStats {
  totalSessions: number;              // Total de sessões de escuta
  sessionsThisMonth: number;          // Sessões no mês atual
  uniqueAlbumsPlayed: number;         // Álbuns únicos tocados (all time)
  topAlbums: {                        // Top 5 mais tocados
    albumId: string;
    title: string;
    artist: string;
    coverUrl: string | null;
    sessionCount: number;             // Em quantas sessões apareceu
  }[];
  topArtists: {                       // Top 5 artistas
    artist: string;
    sessionCount: number;             // Sessões com álbuns deste artista
  }[];
}

/**
 * Cria router para endpoints de estatísticas (V2-10)
 *
 * Endpoints:
 * - GET /api/stats/collection - Estatísticas agregadas da coleção
 * - GET /api/stats/listening - Estatísticas de escuta
 */
export function createStatsRouter(): Router {
  const router = Router();

  /**
   * @openapi
   * /api/stats/collection:
   *   get:
   *     summary: Estatísticas da coleção
   *     description: Retorna estatísticas agregadas da coleção de álbuns
   *     tags:
   *       - Stats
   *     responses:
   *       200:
   *         description: Estatísticas da coleção
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalAlbums:
   *                   type: integer
   *                   description: Total de álbuns (excluindo arquivados)
   *                 archivedAlbums:
   *                   type: integer
   *                   description: Total de álbuns arquivados
   *                 uniqueArtists:
   *                   type: integer
   *                   description: Número de artistas únicos
   *                 byFormat:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                   description: Contagem por formato (LP, EP, etc)
   *                 byDecade:
   *                   type: object
   *                   additionalProperties:
   *                     type: integer
   *                   description: Contagem por década (1970s, 1980s, etc)
   *                 manuallyAdded:
   *                   type: integer
   *                   description: Álbuns sem vínculo com Discogs
   */
  router.get('/stats/collection', async (_req: Request, res: Response) => {
    try {
      const [
        totalAlbums,
        archivedAlbums,
        artistsRaw,
        byFormatRaw,
        manuallyAdded
      ] = await Promise.all([
        prisma.album.count({ where: { archived: false } }),
        prisma.album.count({ where: { archived: true } }),
        prisma.album.groupBy({ by: ['artist'], where: { archived: false } }),
        prisma.album.groupBy({
          by: ['format'],
          where: { archived: false },
          _count: { _all: true }
        }),
        prisma.album.count({ where: { discogsId: null, archived: false } })
      ]);

      // Processar por formato
      const byFormat: Record<string, number> = {};
      for (const f of byFormatRaw) {
        const formatName = f.format || 'Unknown';
        byFormat[formatName] = f._count._all;
      }

      // Processar por década
      const albumsWithYear = await prisma.album.findMany({
        where: { archived: false, year: { not: null } },
        select: { year: true }
      });

      const byDecade: Record<string, number> = {};
      for (const { year } of albumsWithYear) {
        if (year) {
          const decade = `${Math.floor(year / 10) * 10}s`;
          byDecade[decade] = (byDecade[decade] || 0) + 1;
        }
      }

      // Ordenar décadas cronologicamente
      const sortedByDecade: Record<string, number> = {};
      Object.keys(byDecade)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(key => {
          sortedByDecade[key] = byDecade[key];
        });

      const stats: CollectionStats = {
        totalAlbums,
        archivedAlbums,
        uniqueArtists: artistsRaw.length,
        byFormat,
        byDecade: sortedByDecade,
        manuallyAdded
      };

      logger.debug('Collection stats fetched', { totalAlbums, uniqueArtists: artistsRaw.length });

      res.json(stats);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao buscar estatísticas da coleção', { error: errorMsg });
      res.status(500).json({
        error: {
          message: 'Erro ao buscar estatísticas da coleção',
          code: 'STATS_COLLECTION_ERROR',
        },
      });
    }
  });

  /**
   * @openapi
   * /api/stats/listening:
   *   get:
   *     summary: Estatísticas de escuta
   *     description: Retorna estatísticas de escuta (sessões, álbuns mais tocados, etc)
   *     tags:
   *       - Stats
   *     responses:
   *       200:
   *         description: Estatísticas de escuta
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalSessions:
   *                   type: integer
   *                   description: Total de sessões de escuta
   *                 sessionsThisMonth:
   *                   type: integer
   *                   description: Sessões no mês atual
   *                 uniqueAlbumsPlayed:
   *                   type: integer
   *                   description: Álbuns únicos tocados
   *                 topAlbums:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       albumId:
   *                         type: string
   *                       title:
   *                         type: string
   *                       artist:
   *                         type: string
   *                       coverUrl:
   *                         type: string
   *                         nullable: true
   *                       sessionCount:
   *                         type: integer
   *                 topArtists:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       artist:
   *                         type: string
   *                       sessionCount:
   *                         type: integer
   */
  router.get('/stats/listening', async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [totalSessions, sessionsThisMonth] = await Promise.all([
        prisma.session.count(),
        prisma.session.count({ where: { startedAt: { gte: startOfMonth } } })
      ]);

      // Top álbuns (por contagem de sessões distintas)
      // Usando raw query porque Prisma não suporta COUNT(DISTINCT) em groupBy
      const topAlbumsRaw = await prisma.$queryRaw<{
        albumId: string;
        title: string;
        artist: string;
        coverUrl: string | null;
        sessionCount: bigint;
      }[]>`
        SELECT 
          a.id as "albumId",
          a.title,
          a.artist,
          a."coverUrl",
          COUNT(DISTINCT t."sessionId") as "sessionCount"
        FROM "Album" a
        JOIN "Track" t ON t."albumId" = a.id
        GROUP BY a.id, a.title, a.artist, a."coverUrl"
        ORDER BY "sessionCount" DESC
        LIMIT 5
      `;

      // Converter bigint para number
      const topAlbums = topAlbumsRaw.map(a => ({
        albumId: a.albumId,
        title: a.title,
        artist: a.artist,
        coverUrl: a.coverUrl,
        sessionCount: Number(a.sessionCount)
      }));

      // Top artistas (por contagem de sessões distintas)
      const topArtistsRaw = await prisma.$queryRaw<{
        artist: string;
        sessionCount: bigint;
      }[]>`
        SELECT 
          a.artist,
          COUNT(DISTINCT t."sessionId") as "sessionCount"
        FROM "Album" a
        JOIN "Track" t ON t."albumId" = a.id
        GROUP BY a.artist
        ORDER BY "sessionCount" DESC
        LIMIT 5
      `;

      // Converter bigint para number
      const topArtists = topArtistsRaw.map(a => ({
        artist: a.artist,
        sessionCount: Number(a.sessionCount)
      }));

      // Álbuns únicos tocados (via Track com albumId)
      const uniqueAlbumsPlayedRaw = await prisma.track.groupBy({
        by: ['albumId'],
        where: { albumId: { not: null } }
      });

      const stats: ListeningStats = {
        totalSessions,
        sessionsThisMonth,
        uniqueAlbumsPlayed: uniqueAlbumsPlayedRaw.length,
        topAlbums,
        topArtists
      };

      logger.debug('Listening stats fetched', { totalSessions, uniqueAlbumsPlayed: uniqueAlbumsPlayedRaw.length });

      res.json(stats);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao buscar estatísticas de escuta', { error: errorMsg });
      res.status(500).json({
        error: {
          message: 'Erro ao buscar estatísticas de escuta',
          code: 'STATS_LISTENING_ERROR',
        },
      });
    }
  });

  return router;
}

