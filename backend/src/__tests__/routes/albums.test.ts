import express, { Express } from 'express';
import request from 'supertest';
import { createAlbumsRouter } from '../../routes/albums';
import prisma from '../../prisma/client';

// Mock do Prisma
jest.mock('../../prisma/client', () => ({
  __esModule: true,
  default: {
    album: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Albums Router', () => {
  let app: Express;
  const mockFindMany = prisma.album.findMany as jest.Mock;
  const mockFindUnique = prisma.album.findUnique as jest.Mock;
  const mockCreate = prisma.album.create as jest.Mock;
  const mockUpdate = prisma.album.update as jest.Mock;
  const mockDelete = prisma.album.delete as jest.Mock;
  const mockCount = prisma.album.count as jest.Mock;

  // Helper para criar álbum mock
  const createMockAlbum = (overrides = {}) => ({
    id: 'album-123',
    title: 'Abbey Road',
    artist: 'The Beatles',
    year: 1969,
    label: 'Apple Records',
    format: 'LP',
    coverUrl: 'https://example.com/cover.jpg',
    discogsId: 24047,
    discogsAvailable: true,
    condition: 'near_mint',
    tags: ['rock', '60s'],
    notes: 'Prensagem original',
    archived: false,
    createdAt: new Date('2025-01-01T10:00:00.000Z'),
    updatedAt: new Date('2025-01-01T10:00:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api', createAlbumsRouter());

    // Default mock responses
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  describe('GET /api/albums', () => {
    it('deve retornar 200 OK', async () => {
      const response = await request(app).get('/api/albums');
      expect(response.status).toBe(200);
    });

    it('deve retornar JSON', async () => {
      const response = await request(app).get('/api/albums');
      expect(response.type).toBe('application/json');
    });

    it('deve retornar lista vazia quando não há álbuns', async () => {
      const response = await request(app).get('/api/albums');

      expect(response.body).toEqual({
        data: [],
        meta: { total: 0, limit: 20, offset: 0 },
      });
    });

    it('deve retornar álbuns do banco', async () => {
      const mockAlbums = [
        createMockAlbum({ id: 'album-1' }),
        createMockAlbum({ id: 'album-2', title: 'Let It Be' }),
      ];

      mockFindMany.mockResolvedValue(mockAlbums);
      mockCount.mockResolvedValue(2);

      const response = await request(app).get('/api/albums');

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);
      expect(response.body.data[0].title).toBe('Abbey Road');
      expect(response.body.data[1].title).toBe('Let It Be');
    });

    it('deve formatar datas como ISO string', async () => {
      mockFindMany.mockResolvedValue([createMockAlbum()]);
      mockCount.mockResolvedValue(1);

      const response = await request(app).get('/api/albums');

      expect(response.body.data[0].createdAt).toBe('2025-01-01T10:00:00.000Z');
      expect(response.body.data[0].updatedAt).toBe('2025-01-01T10:00:00.000Z');
    });

    describe('Paginação', () => {
      it('deve usar limit padrão de 20', async () => {
        await request(app).get('/api/albums');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 20,
            skip: 0,
          })
        );
      });

      it('deve respeitar limit customizado', async () => {
        await request(app).get('/api/albums?limit=10');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 10 })
        );
      });

      it('deve rejeitar limit acima de 100 (validação)', async () => {
        // limit=200 é rejeitado pelo schema, não chega ao handler
        const response = await request(app).get('/api/albums?limit=200');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('deve rejeitar limit acima de 100 na validação', async () => {
        const response = await request(app).get('/api/albums?limit=101');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('deve respeitar offset', async () => {
        await request(app).get('/api/albums?offset=40');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 40 })
        );
      });

      it('deve rejeitar offset negativo', async () => {
        const response = await request(app).get('/api/albums?offset=-1');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('deve retornar meta com total, limit, offset', async () => {
        mockFindMany.mockResolvedValue([createMockAlbum()]);
        mockCount.mockResolvedValue(100);

        const response = await request(app).get('/api/albums?limit=10&offset=20');

        expect(response.body.meta).toEqual({
          total: 100,
          limit: 10,
          offset: 20,
        });
      });
    });

    describe('Filtros', () => {
      it('deve filtrar por search (title e artist)', async () => {
        await request(app).get('/api/albums?search=beatles');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [
                { title: { contains: 'beatles' } },
                { artist: { contains: 'beatles' } },
              ],
            }),
          })
        );
      });

      it('deve filtrar por artist exato', async () => {
        await request(app).get('/api/albums?artist=The%20Beatles');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              artist: 'The Beatles',
            }),
          })
        );
      });

      it('deve filtrar por year', async () => {
        await request(app).get('/api/albums?year=1969');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              year: 1969,
            }),
          })
        );
      });

      it('deve filtrar por format', async () => {
        await request(app).get('/api/albums?format=LP');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              format: 'LP',
            }),
          })
        );
      });

      it('deve rejeitar format inválido', async () => {
        const response = await request(app).get('/api/albums?format=CD');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('deve NÃO incluir arquivados por padrão (AC-10)', async () => {
        await request(app).get('/api/albums');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              archived: false,
            }),
          })
        );
      });

      it('deve incluir arquivados quando archived=true', async () => {
        await request(app).get('/api/albums?archived=true');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.not.objectContaining({
              archived: false,
            }),
          })
        );
      });
    });

    describe('Ordenação', () => {
      it('deve ordenar por createdAt desc por padrão', async () => {
        await request(app).get('/api/albums');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { createdAt: 'desc' },
          })
        );
      });

      it('deve aceitar sort por title', async () => {
        await request(app).get('/api/albums?sort=title');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { title: 'desc' },
          })
        );
      });

      it('deve aceitar sort por artist', async () => {
        await request(app).get('/api/albums?sort=artist');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { artist: 'desc' },
          })
        );
      });

      it('deve aceitar sort por year', async () => {
        await request(app).get('/api/albums?sort=year');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { year: 'desc' },
          })
        );
      });

      it('deve aceitar order asc', async () => {
        await request(app).get('/api/albums?sort=title&order=asc');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { title: 'asc' },
          })
        );
      });

      it('deve rejeitar sort inválido', async () => {
        const response = await request(app).get('/api/albums?sort=invalid');

        expect(response.status).toBe(400);
      });

      it('deve rejeitar order inválido', async () => {
        const response = await request(app).get('/api/albums?order=random');

        expect(response.status).toBe(400);
      });
    });

    describe('Error Handling', () => {
      it('deve tratar erros do banco graciosamente', async () => {
        mockFindMany.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app).get('/api/albums');

        expect(response.status).toBe(500);
        expect(response.body.error.message).toBe('Erro ao buscar álbuns');
        expect(response.body.error.code).toBe('ALBUMS_FETCH_ERROR');
      });
    });
  });

  describe('POST /api/albums', () => {
    it('deve criar álbum com campos obrigatórios', async () => {
      const newAlbum = createMockAlbum();
      mockCreate.mockResolvedValue(newAlbum);

      const response = await request(app)
        .post('/api/albums')
        .send({ title: 'Abbey Road', artist: 'The Beatles' });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('Abbey Road');
    });

    it('deve criar álbum com todos os campos', async () => {
      const input = {
        title: 'Abbey Road',
        artist: 'The Beatles',
        year: 1969,
        label: 'Apple Records',
        format: 'LP',
        coverUrl: 'https://example.com/cover.jpg',
        discogsId: 24047,
        condition: 'near_mint',
        tags: ['rock', '60s'],
        notes: 'Original UK pressing',
      };

      mockCreate.mockResolvedValue(createMockAlbum(input));

      const response = await request(app).post('/api/albums').send(input);

      expect(response.status).toBe(201);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Abbey Road',
          artist: 'The Beatles',
          year: 1969,
          discogsId: 24047,
        }),
      });
    });

    it('deve rejeitar sem title (AC-08)', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ artist: 'The Beatles' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].campo).toBe('title');
    });

    it('deve rejeitar sem artist (AC-08)', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ title: 'Abbey Road' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].campo).toBe('artist');
    });

    it('deve rejeitar title vazio', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ title: '', artist: 'The Beatles' });

      expect(response.status).toBe(400);
    });

    it('deve rejeitar format inválido', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ title: 'A', artist: 'B', format: 'CD' });

      expect(response.status).toBe(400);
    });

    it('deve rejeitar condition inválida', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ title: 'A', artist: 'B', condition: 'excellent' });

      expect(response.status).toBe(400);
    });

    it('deve retornar 409 se discogsId já existe', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());

      const response = await request(app)
        .post('/api/albums')
        .send({ title: 'A', artist: 'B', discogsId: 24047 });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('DISCOGS_ID_EXISTS');
    });

    it('deve tratar erros do banco graciosamente', async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/albums')
        .send({ title: 'A', artist: 'B' });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('ALBUM_CREATE_ERROR');
    });
  });

  describe('GET /api/albums/:id', () => {
    it('deve retornar álbum por ID', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());

      const response = await request(app).get(
        '/api/albums/550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe('Abbey Road');
    });

    it('deve retornar 404 para álbum inexistente', async () => {
      mockFindUnique.mockResolvedValue(null);

      const response = await request(app).get(
        '/api/albums/550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('não encontrado');
      expect(response.body.error.code).toBe('ALBUM_NOT_FOUND');
    });

    it('deve rejeitar ID não-UUID', async () => {
      const response = await request(app).get('/api/albums/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].campo).toBe('id');
    });

    it('deve tratar erros do banco graciosamente', async () => {
      mockFindUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get(
        '/api/albums/550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('ALBUM_FETCH_ERROR');
    });
  });

  describe('PUT /api/albums/:id', () => {
    it('deve atualizar álbum', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());
      mockUpdate.mockResolvedValue(createMockAlbum({ title: 'New Title' }));

      const response = await request(app)
        .put('/api/albums/550e8400-e29b-41d4-a716-446655440000')
        .send({ title: 'New Title' });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe('New Title');
    });

    it('deve atualizar múltiplos campos', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());
      mockUpdate.mockResolvedValue(
        createMockAlbum({ title: 'New Title', year: 1970 })
      );

      const response = await request(app)
        .put('/api/albums/550e8400-e29b-41d4-a716-446655440000')
        .send({ title: 'New Title', year: 1970 });

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
        data: expect.objectContaining({
          title: 'New Title',
          year: 1970,
        }),
      });
    });

    it('deve aceitar body vazio (sem alterações)', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());
      mockUpdate.mockResolvedValue(createMockAlbum());

      const response = await request(app)
        .put('/api/albums/550e8400-e29b-41d4-a716-446655440000')
        .send({});

      expect(response.status).toBe(200);
    });

    it('NÃO deve permitir alterar discogsId (AC-04)', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());
      mockUpdate.mockResolvedValue(createMockAlbum());

      const response = await request(app)
        .put('/api/albums/550e8400-e29b-41d4-a716-446655440000')
        .send({ discogsId: 99999 });

      expect(response.status).toBe(200);
      // discogsId não deve estar na chamada de update
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
        data: expect.not.objectContaining({ discogsId: 99999 }),
      });
    });

    it('deve retornar 404 para álbum inexistente', async () => {
      mockFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/albums/550e8400-e29b-41d4-a716-446655440000')
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
    });

    it('deve rejeitar ID não-UUID', async () => {
      const response = await request(app)
        .put('/api/albums/invalid-id')
        .send({ title: 'New Title' });

      expect(response.status).toBe(400);
    });

    it('deve tratar erros do banco graciosamente', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());
      mockUpdate.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/albums/550e8400-e29b-41d4-a716-446655440000')
        .send({ title: 'New' });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('ALBUM_UPDATE_ERROR');
    });
  });

  describe('DELETE /api/albums/:id', () => {
    it('deve deletar álbum', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());
      mockDelete.mockResolvedValue(createMockAlbum());

      const response = await request(app).delete(
        '/api/albums/550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('deve retornar 404 para álbum inexistente', async () => {
      mockFindUnique.mockResolvedValue(null);

      const response = await request(app).delete(
        '/api/albums/550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(404);
    });

    it('deve rejeitar ID não-UUID', async () => {
      const response = await request(app).delete('/api/albums/invalid-id');

      expect(response.status).toBe(400);
    });

    it('deve tratar erros do banco graciosamente', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());
      mockDelete.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete(
        '/api/albums/550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('ALBUM_DELETE_ERROR');
    });
  });

  describe('PATCH /api/albums/:id/archive', () => {
    it('deve arquivar álbum', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());
      mockUpdate.mockResolvedValue(createMockAlbum({ archived: true }));

      const response = await request(app)
        .patch('/api/albums/550e8400-e29b-41d4-a716-446655440000/archive')
        .send({ archived: true });

      expect(response.status).toBe(200);
      expect(response.body.data.archived).toBe(true);
    });

    it('deve desarquivar álbum', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum({ archived: true }));
      mockUpdate.mockResolvedValue(createMockAlbum({ archived: false }));

      const response = await request(app)
        .patch('/api/albums/550e8400-e29b-41d4-a716-446655440000/archive')
        .send({ archived: false });

      expect(response.status).toBe(200);
      expect(response.body.data.archived).toBe(false);
    });

    it('deve rejeitar sem campo archived', async () => {
      const response = await request(app)
        .patch('/api/albums/550e8400-e29b-41d4-a716-446655440000/archive')
        .send({});

      expect(response.status).toBe(400);
    });

    it('deve retornar 404 para álbum inexistente', async () => {
      mockFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/albums/550e8400-e29b-41d4-a716-446655440000/archive')
        .send({ archived: true });

      expect(response.status).toBe(404);
    });

    it('deve tratar erros do banco graciosamente', async () => {
      mockFindUnique.mockResolvedValue(createMockAlbum());
      mockUpdate.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .patch('/api/albums/550e8400-e29b-41d4-a716-446655440000/archive')
        .send({ archived: true });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('ALBUM_ARCHIVE_ERROR');
    });
  });

  describe('POST /api/albums/:id/sync-discogs', () => {
    it('deve retornar 501 Not Implemented (stub para V2-04)', async () => {
      const response = await request(app).post(
        '/api/albums/550e8400-e29b-41d4-a716-446655440000/sync-discogs'
      );

      expect(response.status).toBe(501);
      expect(response.body.error.code).toBe('NOT_IMPLEMENTED');
      expect(response.body.error.message).toContain('V2-04');
    });
  });

  describe('Cenários de Integração', () => {
    it('deve criar, listar e deletar álbum (CRUD completo)', async () => {
      const album = createMockAlbum();

      // Criar
      mockCreate.mockResolvedValue(album);
      const createResponse = await request(app)
        .post('/api/albums')
        .send({ title: 'Abbey Road', artist: 'The Beatles' });
      expect(createResponse.status).toBe(201);

      // Listar
      mockFindMany.mockResolvedValue([album]);
      mockCount.mockResolvedValue(1);
      const listResponse = await request(app).get('/api/albums');
      expect(listResponse.body.data).toHaveLength(1);

      // Buscar por ID
      mockFindUnique.mockResolvedValue(album);
      const getResponse = await request(app).get(
        '/api/albums/550e8400-e29b-41d4-a716-446655440000'
      );
      expect(getResponse.body.data.id).toBe('album-123');

      // Atualizar
      mockUpdate.mockResolvedValue({ ...album, title: 'Updated' });
      const updateResponse = await request(app)
        .put('/api/albums/550e8400-e29b-41d4-a716-446655440000')
        .send({ title: 'Updated' });
      expect(updateResponse.body.data.title).toBe('Updated');

      // Deletar
      mockDelete.mockResolvedValue(album);
      const deleteResponse = await request(app).delete(
        '/api/albums/550e8400-e29b-41d4-a716-446655440000'
      );
      expect(deleteResponse.body.success).toBe(true);
    });

    it('deve arquivar álbum e não retorná-lo na listagem padrão', async () => {
      const album = createMockAlbum();
      const archivedAlbum = { ...album, archived: true };

      // Arquivar
      mockFindUnique.mockResolvedValue(album);
      mockUpdate.mockResolvedValue(archivedAlbum);

      const archiveResponse = await request(app)
        .patch('/api/albums/550e8400-e29b-41d4-a716-446655440000/archive')
        .send({ archived: true });
      expect(archiveResponse.body.data.archived).toBe(true);

      // Verificar que filtro archived=false é aplicado por padrão
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await request(app).get('/api/albums');

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ archived: false }),
        })
      );
    });
  });
});
