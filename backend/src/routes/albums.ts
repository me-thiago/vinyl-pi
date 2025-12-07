import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { createLogger } from '../utils/logger';
import { validate } from '../middleware/validate';
import {
  albumCreateSchema,
  albumUpdateSchema,
  albumArchiveSchema,
  albumQuerySchema,
  albumIdParamSchema,
  discogsImportSchema,
  discogsSelectSchema,
  AlbumCreateInput,
  AlbumUpdateInput,
  AlbumArchiveInput,
  AlbumQueryInput,
  AlbumIdParam,
  DiscogsImportInput,
  DiscogsSelectInput,
} from '../schemas';
import {
  importAlbum,
  getRelease,
  releaseToAlbumData,
  getCollectionReleases,
  isConfigured as isDiscogsConfigured,
  isUsernameConfigured,
  getConfiguredUsername,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsTimeoutError,
  DiscogsSearchResult,
} from '../services/discogs';
import { Prisma } from '@prisma/client';

const logger = createLogger('AlbumsRouter');

/**
 * Resposta de álbum individual
 */
interface AlbumResponse {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  label: string | null;
  format: string | null;
  coverUrl: string | null;
  discogsId: number | null;
  discogsAvailable: boolean;
  condition: string | null;
  tags: string[] | null;
  notes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Resposta de listagem de álbuns
 */
interface AlbumsListResponse {
  data: AlbumResponse[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Formata álbum do Prisma para response
 */
function formatAlbumResponse(album: {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  label: string | null;
  format: string | null;
  coverUrl: string | null;
  discogsId: number | null;
  discogsAvailable: boolean;
  condition: string | null;
  tags: Prisma.JsonValue;
  notes: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  recordings?: any[]; // V3-05: Gravações vinculadas ao álbum
}): AlbumResponse {
  return {
    id: album.id,
    title: album.title,
    artist: album.artist,
    year: album.year,
    label: album.label,
    format: album.format,
    coverUrl: album.coverUrl,
    discogsId: album.discogsId,
    discogsAvailable: album.discogsAvailable,
    condition: album.condition,
    tags: album.tags as string[] | null,
    notes: album.notes,
    archived: album.archived,
    createdAt: album.createdAt.toISOString(),
    updatedAt: album.updatedAt.toISOString(),
    ...(album.recordings !== undefined && { recordings: album.recordings }), // V3-05: Incluir se presente
  };
}

/**
 * Cria router para endpoints de álbuns (V2)
 *
 * Endpoints:
 * - GET /api/albums - Lista álbuns com filtros e paginação
 * - POST /api/albums - Cria novo álbum
 * - POST /api/albums/import-discogs - Importa álbum do Discogs
 * - POST /api/albums/import-discogs/select - Seleciona release para importar
 * - POST /api/albums/import-collection - Importa coleção completa do Discogs
 * - GET /api/albums/:id - Busca álbum por ID
 * - GET /api/albums/:id/sessions - Lista sessões do álbum
 * - PUT /api/albums/:id - Atualiza álbum
 * - DELETE /api/albums/:id - Deleta álbum
 * - PATCH /api/albums/:id/archive - Arquiva/desarquiva álbum
 * - POST /api/albums/:id/sync-discogs - Re-sincroniza álbum com Discogs
 *
 * NOTA sobre ordem das rotas:
 * As rotas estáticas (import-discogs, import-collection) estão definidas após as
 * rotas parametrizadas (:id) no código. Isso NÃO causa conflito porque:
 * - Rotas estáticas são POST
 * - Rotas parametrizadas que vêm antes são GET/PUT/DELETE
 * - Express diferencia por método HTTP antes de comparar paths
 *
 * Se no futuro adicionar rotas GET estáticas, elas DEVEM vir antes de GET /:id.
 */
export function createAlbumsRouter(): Router {
  const router = Router();

  /**
   * @openapi
   * /api/albums:
   *   get:
   *     summary: Lista álbuns da coleção
   *     description: Retorna lista de álbuns com suporte a paginação, busca e filtros
   *     tags:
   *       - Albums
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Limite de resultados
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Offset para paginação
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Busca em título e artista
   *       - in: query
   *         name: artist
   *         schema:
   *           type: string
   *         description: Filtro exato por artista
   *       - in: query
   *         name: year
   *         schema:
   *           type: integer
   *         description: Filtro exato por ano
   *       - in: query
   *         name: format
   *         schema:
   *           type: string
   *           enum: [LP, EP, SINGLE_7, SINGLE_12, DOUBLE_LP, BOX_SET]
   *         description: Filtro por formato
   *       - in: query
   *         name: archived
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Incluir álbuns arquivados
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [title, artist, year, createdAt]
   *           default: createdAt
   *         description: Campo de ordenação
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Direção da ordenação
   *     responses:
   *       200:
   *         description: Lista de álbuns
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Album'
   *                 meta:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     offset:
   *                       type: integer
   */
  router.get(
    '/albums',
    validate(albumQuerySchema, 'query'),
    async (req: Request, res: Response) => {
      try {
        const {
          limit: queryLimit,
          offset: queryOffset,
          search,
          artist,
          year,
          format,
          archived,
          sort,
          order,
        } = req.query as AlbumQueryInput;

        // Aplicar defaults
        const limit = Math.min(queryLimit ?? 20, 100);
        const offset = queryOffset ?? 0;
        const sortField = sort ?? 'createdAt';
        const sortOrder = order ?? 'desc';

        // Construir filtro where
        const where: Prisma.AlbumWhereInput = {};

        // Por padrão, não retorna arquivados (AC-10)
        if (archived !== true) {
          where.archived = false;
        }

        // Filtro de busca (title ou artist)
        if (search) {
          where.OR = [
            { title: { contains: search } },
            { artist: { contains: search } },
          ];
        }

        // Filtro exato por artista
        if (artist) {
          where.artist = artist;
        }

        // Filtro por ano
        if (year) {
          where.year = year;
        }

        // Filtro por formato
        if (format) {
          where.format = format;
        }

        // Construir ordenação
        const orderBy: Prisma.AlbumOrderByWithRelationInput = {
          [sortField]: sortOrder,
        };

        // Buscar álbuns e total em paralelo
        const [albums, total] = await Promise.all([
          prisma.album.findMany({
            where,
            orderBy,
            take: limit,
            skip: offset,
          }),
          prisma.album.count({ where }),
        ]);

        const response: AlbumsListResponse = {
          data: albums.map(formatAlbumResponse),
          meta: {
            total,
            limit,
            offset,
          },
        };

        res.json(response);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao buscar álbuns', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao buscar álbuns',
            code: 'ALBUMS_FETCH_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums:
   *   post:
   *     summary: Cria novo álbum
   *     description: Adiciona um novo álbum à coleção
   *     tags:
   *       - Albums
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AlbumCreate'
   *     responses:
   *       201:
   *         description: Álbum criado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Album'
   *       400:
   *         description: Dados de entrada inválidos
   */
  router.post(
    '/albums',
    validate(albumCreateSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const input = req.body as AlbumCreateInput;

        // Verificar se discogsId já existe (se fornecido)
        if (input.discogsId) {
          const existing = await prisma.album.findUnique({
            where: { discogsId: input.discogsId },
          });
          if (existing) {
            res.status(409).json({
              error: {
                message: `Já existe um álbum com o Discogs ID ${input.discogsId}`,
                code: 'DISCOGS_ID_EXISTS',
              },
            });
            return;
          }
        }

        const album = await prisma.album.create({
          data: {
            title: input.title,
            artist: input.artist,
            year: input.year ?? null,
            label: input.label ?? null,
            format: input.format ?? null,
            coverUrl: input.coverUrl ?? null,
            discogsId: input.discogsId ?? null,
            condition: input.condition ?? null,
            tags: input.tags ?? undefined,
            notes: input.notes ?? null,
          },
        });

        logger.info('Álbum criado', { id: album.id, title: album.title, artist: album.artist });

        res.status(201).json({
          data: formatAlbumResponse(album),
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao criar álbum', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao criar álbum',
            code: 'ALBUM_CREATE_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums/{id}/sessions:
   *   get:
   *     summary: Lista sessões onde o álbum foi tocado
   *     description: Retorna histórico de escuta do álbum com sessões onde foi reconhecido
   *     tags:
   *       - Albums
   *       - Sessions
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do álbum
   *     responses:
   *       200:
   *         description: Sessões do álbum
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 sessions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       startedAt:
   *                         type: string
   *                         format: date-time
   *                       endedAt:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                       durationSeconds:
   *                         type: integer
   *                       recognizedTrack:
   *                         type: object
   *                         properties:
   *                           title:
   *                             type: string
   *                           recognizedAt:
   *                             type: string
   *                             format: date-time
   *                 totalSessions:
   *                   type: integer
   *       404:
   *         description: Álbum não encontrado
   */
  router.get(
    '/albums/:id/sessions',
    validate(albumIdParamSchema, 'params'),
    async (req: Request<AlbumIdParam>, res: Response) => {
      try {
        const { id } = req.params;

        // Verificar se álbum existe
        const album = await prisma.album.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!album) {
          res.status(404).json({
            error: {
              message: `Álbum não encontrado: nenhum álbum com id '${id}'`,
              code: 'ALBUM_NOT_FOUND',
            },
          });
          return;
        }

        // Buscar tracks deste álbum, ordenados por data de reconhecimento (mais recente primeiro)
        const tracks = await prisma.track.findMany({
          where: { albumId: id },
          orderBy: { recognizedAt: 'desc' },
          include: {
            session: {
              select: {
                id: true,
                startedAt: true,
                endedAt: true,
                durationSeconds: true,
              },
            },
          },
        });

        // Agrupar por sessão, pegar primeiro reconhecimento de cada sessão
        const sessionsMap = new Map<string, {
          id: string;
          startedAt: string;
          endedAt: string | null;
          durationSeconds: number;
          recognizedTrack: {
            title: string;
            recognizedAt: string;
          };
        }>();

        for (const track of tracks) {
          if (!sessionsMap.has(track.sessionId)) {
            sessionsMap.set(track.sessionId, {
              id: track.session.id,
              startedAt: track.session.startedAt.toISOString(),
              endedAt: track.session.endedAt?.toISOString() || null,
              durationSeconds: track.session.durationSeconds,
              recognizedTrack: {
                title: track.title,
                recognizedAt: track.recognizedAt.toISOString(),
              },
            });
          }
        }

        // Converter para array (já ordenado por recognizedAt desc)
        const sessions = Array.from(sessionsMap.values());

        res.json({
          sessions,
          totalSessions: sessions.length,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao buscar sessões do álbum', { id: req.params.id, error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao buscar sessões do álbum',
            code: 'ALBUM_SESSIONS_FETCH_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums/{id}:
   *   get:
   *     summary: Busca álbum por ID
   *     description: Retorna detalhes de um álbum específico
   *     tags:
   *       - Albums
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do álbum
   *     responses:
   *       200:
   *         description: Álbum encontrado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Album'
   *       404:
   *         description: Álbum não encontrado
   */
  router.get(
    '/albums/:id',
    validate(albumIdParamSchema, 'params'),
    async (req: Request<AlbumIdParam>, res: Response) => {
      try {
        const { id } = req.params;

        const album = await prisma.album.findUnique({
          where: { id },
          include: {
            recordings: {
              orderBy: { startedAt: 'desc' },
              include: {
                _count: {
                  select: { trackMarkers: true },
                },
              },
            },
          },
        });

        if (!album) {
          res.status(404).json({
            error: {
              message: `Álbum não encontrado: nenhum álbum com id '${id}'`,
              code: 'ALBUM_NOT_FOUND',
            },
          });
          return;
        }

        res.json({
          data: formatAlbumResponse(album),
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao buscar álbum', { id: req.params.id, error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao buscar álbum',
            code: 'ALBUM_FETCH_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums/{id}:
   *   put:
   *     summary: Atualiza álbum
   *     description: Atualiza dados de um álbum existente. Nota - discogsId não pode ser alterado.
   *     tags:
   *       - Albums
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do álbum
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AlbumUpdate'
   *     responses:
   *       200:
   *         description: Álbum atualizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Album'
   *       404:
   *         description: Álbum não encontrado
   */
  router.put(
    '/albums/:id',
    validate(albumIdParamSchema, 'params'),
    validate(albumUpdateSchema, 'body'),
    async (req: Request<AlbumIdParam>, res: Response) => {
      try {
        const { id } = req.params;
        const input = req.body as AlbumUpdateInput;

        // Verificar se álbum existe
        const existing = await prisma.album.findUnique({
          where: { id },
        });

        if (!existing) {
          res.status(404).json({
            error: {
              message: `Álbum não encontrado: nenhum álbum com id '${id}'`,
              code: 'ALBUM_NOT_FOUND',
            },
          });
          return;
        }

        // Construir dados de atualização (apenas campos fornecidos)
        const updateData: Prisma.AlbumUpdateInput = {};

        if (input.title !== undefined) updateData.title = input.title;
        if (input.artist !== undefined) updateData.artist = input.artist;
        if (input.year !== undefined) updateData.year = input.year;
        if (input.label !== undefined) updateData.label = input.label;
        if (input.format !== undefined) updateData.format = input.format;
        if (input.coverUrl !== undefined) updateData.coverUrl = input.coverUrl;
        if (input.condition !== undefined) updateData.condition = input.condition;
        if (input.tags !== undefined) updateData.tags = input.tags ?? undefined;
        if (input.notes !== undefined) updateData.notes = input.notes;

        const album = await prisma.album.update({
          where: { id },
          data: updateData,
        });

        logger.info('Álbum atualizado', { id: album.id, title: album.title });

        res.json({
          data: formatAlbumResponse(album),
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao atualizar álbum', { id: req.params.id, error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao atualizar álbum',
            code: 'ALBUM_UPDATE_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums/{id}:
   *   delete:
   *     summary: Deleta álbum
   *     description: Remove um álbum da coleção. Considere usar arquivar em vez de deletar para preservar histórico.
   *     tags:
   *       - Albums
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do álbum
   *     responses:
   *       200:
   *         description: Álbum deletado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *       404:
   *         description: Álbum não encontrado
   */
  router.delete(
    '/albums/:id',
    validate(albumIdParamSchema, 'params'),
    async (req: Request<AlbumIdParam>, res: Response) => {
      try {
        const { id } = req.params;

        // Verificar se álbum existe
        const existing = await prisma.album.findUnique({
          where: { id },
        });

        if (!existing) {
          res.status(404).json({
            error: {
              message: `Álbum não encontrado: nenhum álbum com id '${id}'`,
              code: 'ALBUM_NOT_FOUND',
            },
          });
          return;
        }

        await prisma.album.delete({
          where: { id },
        });

        logger.info('Álbum deletado', { id, title: existing.title });

        res.json({ success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao deletar álbum', { id: req.params.id, error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao deletar álbum',
            code: 'ALBUM_DELETE_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums/{id}/archive:
   *   patch:
   *     summary: Arquiva ou desarquiva álbum
   *     description: Marca um álbum como arquivado (vendido/doado) ou desarquiva
   *     tags:
   *       - Albums
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do álbum
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - archived
   *             properties:
   *               archived:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Status de arquivamento atualizado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Album'
   *       404:
   *         description: Álbum não encontrado
   */
  router.patch(
    '/albums/:id/archive',
    validate(albumIdParamSchema, 'params'),
    validate(albumArchiveSchema, 'body'),
    async (req: Request<AlbumIdParam>, res: Response) => {
      try {
        const { id } = req.params;
        const { archived } = req.body as AlbumArchiveInput;

        // Verificar se álbum existe
        const existing = await prisma.album.findUnique({
          where: { id },
        });

        if (!existing) {
          res.status(404).json({
            error: {
              message: `Álbum não encontrado: nenhum álbum com id '${id}'`,
              code: 'ALBUM_NOT_FOUND',
            },
          });
          return;
        }

        const album = await prisma.album.update({
          where: { id },
          data: { archived },
        });

        logger.info(`Álbum ${archived ? 'arquivado' : 'desarquivado'}`, {
          id: album.id,
          title: album.title,
        });

        res.json({
          data: formatAlbumResponse(album),
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao arquivar álbum', { id: req.params.id, error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao arquivar álbum',
            code: 'ALBUM_ARCHIVE_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums/import-discogs:
   *   post:
   *     summary: Importa álbum do Discogs
   *     description: Busca álbum no Discogs por catálogo, barcode ou ID e importa metadados
   *     tags:
   *       - Albums
   *       - Discogs
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               catalogNumber:
   *                 type: string
   *                 description: Número de catálogo do disco
   *               barcode:
   *                 type: string
   *                 description: Código de barras do disco
   *               releaseId:
   *                 type: integer
   *                 description: ID do release no Discogs
   *     responses:
   *       201:
   *         description: Álbum importado com sucesso
   *       200:
   *         description: Múltiplos resultados encontrados, seleção necessária
   *       400:
   *         description: Dados de entrada inválidos ou Discogs não configurado
   *       404:
   *         description: Nenhum resultado encontrado
   *       409:
   *         description: Álbum com mesmo discogsId já existe
   *       429:
   *         description: Rate limit do Discogs excedido
   *       504:
   *         description: Timeout na requisição ao Discogs
   */
  router.post(
    '/albums/import-discogs',
    validate(discogsImportSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        // Verificar se Discogs está configurado
        if (!isDiscogsConfigured()) {
          res.status(400).json({
            error: {
              message: 'Integração com Discogs não configurada. Configure DISCOGS_CONSUMER_KEY e DISCOGS_CONSUMER_SECRET.',
              code: 'DISCOGS_NOT_CONFIGURED',
            },
          });
          return;
        }

        const input = req.body as DiscogsImportInput;

        // Buscar no Discogs
        const result = await importAlbum(input);

        // Se múltiplos resultados, retornar lista para seleção
        if ('results' in result) {
          logger.info('Múltiplos resultados Discogs', { count: result.results.length });
          res.status(200).json({
            multiple: true,
            results: result.results.map((r: DiscogsSearchResult) => ({
              releaseId: r.id,
              title: r.title,
              year: r.year,
              format: r.format,
              label: r.label,
              thumb: r.thumb,
              country: r.country,
            })),
          });
          return;
        }

        // Único resultado - verificar se discogsId já existe
        const existing = await prisma.album.findUnique({
          where: { discogsId: result.album.discogsId },
        });

        if (existing) {
          res.status(409).json({
            error: {
              message: `Já existe um álbum com o Discogs ID ${result.album.discogsId}`,
              code: 'DISCOGS_ID_EXISTS',
              existingAlbumId: existing.id,
            },
          });
          return;
        }

        // Criar álbum
        const album = await prisma.album.create({
          data: {
            title: result.album.title,
            artist: result.album.artist,
            year: result.album.year,
            label: result.album.label,
            format: result.album.format as Prisma.AlbumCreateInput['format'],
            coverUrl: result.album.coverUrl,
            discogsId: result.album.discogsId,
            discogsAvailable: true,
          },
        });

        logger.info('Álbum importado do Discogs', {
          id: album.id,
          discogsId: album.discogsId,
          title: album.title,
        });

        res.status(201).json({
          data: formatAlbumResponse(album),
          source: 'discogs',
          discogsUrl: result.album.discogsUrl,
        });
      } catch (error) {
        if (error instanceof DiscogsNotFoundError) {
          res.status(404).json({
            error: {
              message: 'Nenhum resultado encontrado no Discogs',
              code: 'DISCOGS_NOT_FOUND',
            },
          });
          return;
        }

        if (error instanceof DiscogsRateLimitError) {
          res.status(429).json({
            error: {
              message: 'Rate limit do Discogs excedido. Tente novamente em alguns segundos.',
              code: 'DISCOGS_RATE_LIMIT',
            },
          });
          return;
        }

        if (error instanceof DiscogsTimeoutError) {
          res.status(504).json({
            error: {
              message: 'Timeout na requisição ao Discogs. Tente novamente.',
              code: 'DISCOGS_TIMEOUT',
            },
          });
          return;
        }

        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao importar do Discogs', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao importar do Discogs',
            code: 'DISCOGS_IMPORT_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums/import-discogs/select:
   *   post:
   *     summary: Seleciona e importa um release específico
   *     description: Após busca retornar múltiplos resultados, seleciona um para importar
   *     tags:
   *       - Albums
   *       - Discogs
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - releaseId
   *             properties:
   *               releaseId:
   *                 type: integer
   *                 description: ID do release selecionado
   *     responses:
   *       201:
   *         description: Álbum importado com sucesso
   *       404:
   *         description: Release não encontrado
   *       409:
   *         description: Álbum com mesmo discogsId já existe
   */
  router.post(
    '/albums/import-discogs/select',
    validate(discogsSelectSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        if (!isDiscogsConfigured()) {
          res.status(400).json({
            error: {
              message: 'Integração com Discogs não configurada',
              code: 'DISCOGS_NOT_CONFIGURED',
            },
          });
          return;
        }

        const { releaseId } = req.body as DiscogsSelectInput;

        // Verificar se já existe
        const existing = await prisma.album.findUnique({
          where: { discogsId: releaseId },
        });

        if (existing) {
          res.status(409).json({
            error: {
              message: `Já existe um álbum com o Discogs ID ${releaseId}`,
              code: 'DISCOGS_ID_EXISTS',
              existingAlbumId: existing.id,
            },
          });
          return;
        }

        // Buscar release completo
        const release = await getRelease(releaseId);
        const albumData = releaseToAlbumData(release);

        // Criar álbum
        const album = await prisma.album.create({
          data: {
            title: albumData.title,
            artist: albumData.artist,
            year: albumData.year,
            label: albumData.label,
            format: albumData.format as Prisma.AlbumCreateInput['format'],
            coverUrl: albumData.coverUrl,
            discogsId: albumData.discogsId,
            discogsAvailable: true,
          },
        });

        logger.info('Álbum importado do Discogs (seleção)', {
          id: album.id,
          discogsId: album.discogsId,
          title: album.title,
        });

        res.status(201).json({
          data: formatAlbumResponse(album),
          source: 'discogs',
          discogsUrl: albumData.discogsUrl,
        });
      } catch (error) {
        if (error instanceof DiscogsNotFoundError) {
          res.status(404).json({
            error: {
              message: 'Release não encontrado no Discogs',
              code: 'DISCOGS_NOT_FOUND',
            },
          });
          return;
        }

        if (error instanceof DiscogsRateLimitError) {
          res.status(429).json({
            error: {
              message: 'Rate limit do Discogs excedido',
              code: 'DISCOGS_RATE_LIMIT',
            },
          });
          return;
        }

        if (error instanceof DiscogsTimeoutError) {
          res.status(504).json({
            error: {
              message: 'Timeout na requisição ao Discogs',
              code: 'DISCOGS_TIMEOUT',
            },
          });
          return;
        }

        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao importar release do Discogs', { error: errorMsg });
        res.status(500).json({
          error: {
            message: 'Erro ao importar do Discogs',
            code: 'DISCOGS_IMPORT_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums/{id}/sync-discogs:
   *   post:
   *     summary: Re-sincroniza álbum com Discogs
   *     description: Atualiza campos vazios do álbum com dados atualizados do Discogs
   *     tags:
   *       - Albums
   *       - Discogs
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do álbum
   *     responses:
   *       200:
   *         description: Álbum sincronizado com sucesso
   *       400:
   *         description: Álbum não possui discogsId
   *       404:
   *         description: Álbum não encontrado
   */
  router.post(
    '/albums/:id/sync-discogs',
    validate(albumIdParamSchema, 'params'),
    async (req: Request<AlbumIdParam>, res: Response) => {
      try {
        if (!isDiscogsConfigured()) {
          res.status(400).json({
            error: {
              message: 'Integração com Discogs não configurada',
              code: 'DISCOGS_NOT_CONFIGURED',
            },
          });
          return;
        }

        const { id } = req.params;

        // Buscar álbum
        const album = await prisma.album.findUnique({
          where: { id },
        });

        if (!album) {
          res.status(404).json({
            error: {
              message: `Álbum não encontrado: nenhum álbum com id '${id}'`,
              code: 'ALBUM_NOT_FOUND',
            },
          });
          return;
        }

        // Verificar se tem discogsId
        if (!album.discogsId) {
          res.status(400).json({
            error: {
              message: 'Este álbum não possui vínculo com o Discogs',
              code: 'NO_DISCOGS_LINK',
            },
          });
          return;
        }

        try {
          // Buscar release atual no Discogs
          const release = await getRelease(album.discogsId);
          const discogsData = releaseToAlbumData(release);

          // Atualizar APENAS campos vazios (preservar edições do usuário)
          const updateData: Prisma.AlbumUpdateInput = {
            discogsAvailable: true,
          };

          // Campos vazios localmente são atualizados
          if (!album.year && discogsData.year) updateData.year = discogsData.year;
          if (!album.label && discogsData.label) updateData.label = discogsData.label;
          if (!album.format && discogsData.format) updateData.format = discogsData.format as Prisma.AlbumUpdateInput['format'];

          // coverUrl: atualizar se maior resolução disponível ou se vazio
          if (!album.coverUrl && discogsData.coverUrl) {
            updateData.coverUrl = discogsData.coverUrl;
          }

          const updatedAlbum = await prisma.album.update({
            where: { id },
            data: updateData,
          });

          logger.info('Álbum sincronizado com Discogs', {
            id: updatedAlbum.id,
            discogsId: updatedAlbum.discogsId,
          });

          res.json({
            data: formatAlbumResponse(updatedAlbum),
            synced: true,
          });
        } catch (error) {
          // Discogs não encontrou o release (removido ou erro)
          if (error instanceof DiscogsNotFoundError) {
            // Marcar como indisponível mas preservar dados
            const updatedAlbum = await prisma.album.update({
              where: { id },
              data: { discogsAvailable: false },
            });

            logger.warn('Álbum não encontrado no Discogs', {
              id: album.id,
              discogsId: album.discogsId,
            });

            res.json({
              data: formatAlbumResponse(updatedAlbum),
              synced: false,
              warning: 'Álbum não encontrado no Discogs. Dados locais preservados.',
            });
            return;
          }

          throw error;
        }
      } catch (error) {
        if (error instanceof DiscogsRateLimitError) {
          res.status(429).json({
            error: {
              message: 'Rate limit do Discogs excedido',
              code: 'DISCOGS_RATE_LIMIT',
            },
          });
          return;
        }

        if (error instanceof DiscogsTimeoutError) {
          res.status(504).json({
            error: {
              message: 'Timeout na requisição ao Discogs',
              code: 'DISCOGS_TIMEOUT',
            },
          });
          return;
        }

        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Erro ao sincronizar com Discogs', {
          id: req.params.id,
          error: errorMsg,
        });
        res.status(500).json({
          error: {
            message: 'Erro ao sincronizar com Discogs',
            code: 'DISCOGS_SYNC_ERROR',
          },
        });
      }
    }
  );

  /**
   * @openapi
   * /api/albums/import-collection:
   *   post:
   *     summary: Importa coleção completa do Discogs
   *     description: |
   *       Importa todos os álbuns da coleção do usuário configurado no Discogs.
   *       Álbuns que já existem (mesmo discogsId) são ignorados.
   *       Esta operação NÃO deleta álbuns locais que não existem no Discogs.
   *       Requer DISCOGS_USERNAME configurado nas variáveis de ambiente.
   *     tags:
   *       - Albums
   *       - Discogs
   *     responses:
   *       200:
   *         description: Importação concluída
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 results:
   *                   type: object
   *                   properties:
   *                     imported:
   *                       type: integer
   *                       description: Número de álbuns importados
   *                     skipped:
   *                       type: integer
   *                       description: Número de álbuns já existentes
   *                     errors:
   *                       type: integer
   *                       description: Número de erros durante importação
   *                     total:
   *                       type: integer
   *                       description: Total de álbuns na coleção Discogs
   *                 message:
   *                   type: string
   *       400:
   *         description: Discogs não configurado
   *       404:
   *         description: Usuário não encontrado ou coleção privada
   *       429:
   *         description: Rate limit do Discogs excedido
   *       504:
   *         description: Timeout na requisição ao Discogs
   */
  router.post('/albums/import-collection', async (req: Request, res: Response) => {
    try {
      // Verificar se Discogs está configurado
      if (!isDiscogsConfigured()) {
        res.status(400).json({
          error: {
            message: 'Integração com Discogs não configurada. Configure DISCOGS_CONSUMER_KEY e DISCOGS_CONSUMER_SECRET.',
            code: 'DISCOGS_NOT_CONFIGURED',
          },
        });
        return;
      }

      // Verificar se username está configurado
      if (!isUsernameConfigured()) {
        res.status(400).json({
          error: {
            message: 'Username do Discogs não configurado. Configure DISCOGS_USERNAME.',
            code: 'DISCOGS_USERNAME_NOT_CONFIGURED',
          },
        });
        return;
      }

      const username = getConfiguredUsername()!;
      logger.info('Iniciando importação da coleção Discogs', { username });

      // Buscar todos os álbuns da coleção
      const discogsAlbums = await getCollectionReleases(username);

      // Resultados da importação
      const results = {
        imported: 0,
        skipped: 0,
        errors: 0,
        total: discogsAlbums.length,
      };

      // Para cada álbum, verificar se já existe e importar se não
      for (const albumData of discogsAlbums) {
        try {
          // Verificar se já existe
          const existing = await prisma.album.findUnique({
            where: { discogsId: albumData.discogsId },
          });

          if (existing) {
            results.skipped++;
            continue;
          }

          // Criar álbum
          await prisma.album.create({
            data: {
              title: albumData.title,
              artist: albumData.artist,
              year: albumData.year,
              label: albumData.label,
              format: albumData.format as Prisma.AlbumCreateInput['format'],
              coverUrl: albumData.coverUrl,
              discogsId: albumData.discogsId,
              discogsAvailable: true,
            },
          });

          results.imported++;
        } catch (error) {
          logger.error('Erro ao importar álbum individual', {
            discogsId: albumData.discogsId,
            title: albumData.title,
            error: error instanceof Error ? error.message : String(error),
          });
          results.errors++;
        }
      }

      logger.info('Importação da coleção concluída', results);

      res.json({
        success: true,
        results,
        message: `Importação concluída! ${results.imported} importados, ${results.skipped} já existentes, ${results.errors} erros.`,
      });
    } catch (error) {
      if (error instanceof DiscogsNotFoundError) {
        res.status(404).json({
          error: {
            message: error.message,
            code: 'DISCOGS_USER_NOT_FOUND',
          },
        });
        return;
      }

      if (error instanceof DiscogsRateLimitError) {
        res.status(429).json({
          error: {
            message: 'Rate limit do Discogs excedido. Tente novamente mais tarde.',
            code: 'DISCOGS_RATE_LIMIT',
          },
        });
        return;
      }

      if (error instanceof DiscogsTimeoutError) {
        res.status(504).json({
          error: {
            message: 'Timeout na requisição ao Discogs',
            code: 'DISCOGS_TIMEOUT',
          },
        });
        return;
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Erro ao importar coleção', { error: errorMsg });
      res.status(500).json({
        error: {
          message: 'Erro ao importar coleção do Discogs',
          code: 'DISCOGS_COLLECTION_IMPORT_ERROR',
        },
      });
    }
  });

  return router;
}
