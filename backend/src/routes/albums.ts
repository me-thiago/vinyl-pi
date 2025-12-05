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
  AlbumCreateInput,
  AlbumUpdateInput,
  AlbumArchiveInput,
  AlbumQueryInput,
  AlbumIdParam,
} from '../schemas';
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
  };
}

/**
 * Cria router para endpoints de álbuns (V2)
 *
 * Endpoints:
 * - GET /api/albums - Lista álbuns com filtros e paginação
 * - POST /api/albums - Cria novo álbum
 * - GET /api/albums/:id - Busca álbum por ID
 * - PUT /api/albums/:id - Atualiza álbum
 * - DELETE /api/albums/:id - Deleta álbum
 * - PATCH /api/albums/:id/archive - Arquiva/desarquiva álbum
 * - POST /api/albums/:id/sync-discogs - Stub para V2-04 (501)
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
   * /api/albums/{id}/sync-discogs:
   *   post:
   *     summary: Sincroniza álbum com Discogs (Stub)
   *     description: Endpoint reservado para V2-04. Atualmente retorna 501 Not Implemented.
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
   *       501:
   *         description: Funcionalidade não implementada
   */
  router.post(
    '/albums/:id/sync-discogs',
    validate(albumIdParamSchema, 'params'),
    async (req: Request<AlbumIdParam>, res: Response) => {
      res.status(501).json({
        error: {
          message: 'Sincronização com Discogs será implementada na story V2-04',
          code: 'NOT_IMPLEMENTED',
        },
      });
    }
  );

  return router;
}
