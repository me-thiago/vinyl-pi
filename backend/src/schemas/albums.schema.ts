/**
 * Schema de validação para Albums (V2)
 *
 * Define as regras de validação para endpoints de álbuns.
 * Mensagens de erro em português BR conforme padrão do projeto.
 *
 * Nota: Usando Zod 4 API (message em vez de errorMap/required_error)
 */

import { z } from 'zod';
import { paginationSchema } from './pagination.schema';

/**
 * Enum de formatos de álbum (corresponde ao Prisma AlbumFormat)
 */
export const AlbumFormatEnum = z.enum(
  ['LP', 'EP', 'SINGLE_7', 'SINGLE_12', 'DOUBLE_LP', 'BOX_SET'],
  { message: 'Formato deve ser: LP, EP, SINGLE_7, SINGLE_12, DOUBLE_LP ou BOX_SET' }
);

/**
 * Enum de condição do álbum (corresponde ao Prisma AlbumCondition)
 */
export const AlbumConditionEnum = z.enum(
  ['mint', 'near_mint', 'vg_plus', 'vg', 'good', 'fair', 'poor'],
  { message: 'Condição deve ser: mint, near_mint, vg_plus, vg, good, fair ou poor' }
);

/**
 * Campos de ordenação permitidos
 */
export const AlbumSortFieldEnum = z.enum(
  ['title', 'artist', 'year', 'createdAt'],
  { message: 'Campo de ordenação deve ser: title, artist, year ou createdAt' }
);

/**
 * Direção de ordenação
 */
export const SortOrderEnum = z.enum(
  ['asc', 'desc'],
  { message: 'Ordem deve ser: asc ou desc' }
);

/**
 * Schema para criação de álbum
 * POST /api/albums
 */
export const albumCreateSchema = z.object({
  title: z
    .string({ message: 'Título é obrigatório' })
    .min(1, { message: 'Título não pode estar vazio' })
    .max(500, { message: 'Título deve ter no máximo 500 caracteres' }),
  artist: z
    .string({ message: 'Artista é obrigatório' })
    .min(1, { message: 'Artista não pode estar vazio' })
    .max(500, { message: 'Artista deve ter no máximo 500 caracteres' }),
  year: z.coerce
    .number()
    .int({ message: 'Ano deve ser um número inteiro' })
    .min(1900, { message: 'Ano deve ser maior que 1900' })
    .max(new Date().getFullYear() + 1, { message: 'Ano não pode ser no futuro' })
    .optional()
    .nullable(),
  label: z
    .string()
    .max(200, { message: 'Gravadora deve ter no máximo 200 caracteres' })
    .optional()
    .nullable(),
  format: AlbumFormatEnum.optional().nullable(),
  coverUrl: z
    .string()
    .url({ message: 'URL da capa deve ser uma URL válida' })
    .optional()
    .nullable(),
  discogsId: z.coerce
    .number()
    .int({ message: 'ID do Discogs deve ser um número inteiro' })
    .positive({ message: 'ID do Discogs deve ser positivo' })
    .optional()
    .nullable(),
  condition: AlbumConditionEnum.optional().nullable(),
  tags: z
    .array(z.string().max(50, { message: 'Cada tag deve ter no máximo 50 caracteres' }))
    .max(20, { message: 'Máximo de 20 tags permitido' })
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(2000, { message: 'Notas devem ter no máximo 2000 caracteres' })
    .optional()
    .nullable(),
});

/**
 * Schema para atualização de álbum
 * PUT /api/albums/:id
 *
 * NOTA: discogsId NÃO pode ser alterado via PUT (apenas via import)
 */
export const albumUpdateSchema = albumCreateSchema
  .omit({ discogsId: true })
  .partial();

/**
 * Schema para arquivar/desarquivar álbum
 * PATCH /api/albums/:id/archive
 */
export const albumArchiveSchema = z.object({
  archived: z.boolean({ message: 'Campo archived é obrigatório e deve ser boolean' }),
});

/**
 * Schema para query params de GET /api/albums
 * Combina paginação com filtros específicos de álbuns
 */
export const albumQuerySchema = paginationSchema.extend({
  limit: z.coerce
    .number()
    .int({ message: 'limit deve ser um número inteiro' })
    .min(1, { message: 'limit deve ser pelo menos 1' })
    .max(100, { message: 'limit deve ser no máximo 100' })
    .optional(),
  search: z
    .string()
    .max(200, { message: 'Busca deve ter no máximo 200 caracteres' })
    .optional(),
  artist: z
    .string()
    .max(500, { message: 'Filtro de artista deve ter no máximo 500 caracteres' })
    .optional(),
  year: z.coerce
    .number()
    .int({ message: 'Ano deve ser um número inteiro' })
    .optional(),
  format: AlbumFormatEnum.optional(),
  archived: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  sort: AlbumSortFieldEnum.optional(),
  order: SortOrderEnum.optional(),
});

/**
 * Schema para parâmetro de rota :id
 */
export const albumIdParamSchema = z.object({
  id: z
    .string()
    .uuid({ message: 'ID do álbum deve ser um UUID válido' }),
});

/**
 * Schema para importação do Discogs
 * POST /api/albums/import-discogs
 *
 * Pelo menos um dos campos deve ser fornecido: catalogNumber, barcode ou releaseId
 */
export const discogsImportSchema = z
  .object({
    catalogNumber: z
      .string()
      .min(1, { message: 'Número de catálogo não pode estar vazio' })
      .max(100, { message: 'Número de catálogo deve ter no máximo 100 caracteres' })
      .optional(),
    barcode: z
      .string()
      .min(1, { message: 'Código de barras não pode estar vazio' })
      .max(50, { message: 'Código de barras deve ter no máximo 50 caracteres' })
      .optional(),
    releaseId: z.coerce
      .number()
      .int({ message: 'ID do release deve ser um número inteiro' })
      .positive({ message: 'ID do release deve ser positivo' })
      .optional(),
  })
  .refine((data) => data.catalogNumber || data.barcode || data.releaseId, {
    message: 'Pelo menos um dos campos deve ser fornecido: catalogNumber, barcode ou releaseId',
  });

/**
 * Schema para seleção de release após busca
 * POST /api/albums/import-discogs/select
 */
export const discogsSelectSchema = z.object({
  releaseId: z.coerce
    .number({ message: 'ID do release é obrigatório' })
    .int({ message: 'ID do release deve ser um número inteiro' })
    .positive({ message: 'ID do release deve ser positivo' }),
});

// Types exportados
export type AlbumCreateInput = z.infer<typeof albumCreateSchema>;
export type AlbumUpdateInput = z.infer<typeof albumUpdateSchema>;
export type AlbumArchiveInput = z.infer<typeof albumArchiveSchema>;
export type AlbumQueryInput = z.infer<typeof albumQuerySchema>;
export type AlbumIdParam = z.infer<typeof albumIdParamSchema>;
export type DiscogsImportInput = z.infer<typeof discogsImportSchema>;
export type DiscogsSelectInput = z.infer<typeof discogsSelectSchema>;
