/**
 * Testes unitários para Albums Schema (V2)
 */

import {
  albumCreateSchema,
  albumUpdateSchema,
  albumArchiveSchema,
  albumQuerySchema,
  albumIdParamSchema,
  AlbumFormatEnum,
  AlbumConditionEnum,
} from '../../schemas';

describe('albumCreateSchema', () => {
  describe('campos obrigatórios', () => {
    it('deve aceitar álbum válido com apenas campos obrigatórios', () => {
      const result = albumCreateSchema.safeParse({
        title: 'Abbey Road',
        artist: 'The Beatles',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar sem title', () => {
      const result = albumCreateSchema.safeParse({
        artist: 'The Beatles',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar sem artist', () => {
      const result = albumCreateSchema.safeParse({
        title: 'Abbey Road',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar title vazio', () => {
      const result = albumCreateSchema.safeParse({
        title: '',
        artist: 'The Beatles',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar artist vazio', () => {
      const result = albumCreateSchema.safeParse({
        title: 'Abbey Road',
        artist: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('campos opcionais', () => {
    it('deve aceitar álbum com todos os campos', () => {
      const result = albumCreateSchema.safeParse({
        title: 'Abbey Road',
        artist: 'The Beatles',
        year: 1969,
        label: 'Apple Records',
        format: 'LP',
        coverUrl: 'https://example.com/cover.jpg',
        discogsId: 24047,
        condition: 'near_mint',
        tags: ['rock', '60s'],
        notes: 'Prensagem original UK',
      });
      expect(result.success).toBe(true);
    });

    it('deve aceitar campos opcionais como null', () => {
      const result = albumCreateSchema.safeParse({
        title: 'Abbey Road',
        artist: 'The Beatles',
        year: null,
        label: null,
        format: null,
        coverUrl: null,
        discogsId: null,
        condition: null,
        tags: null,
        notes: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('year', () => {
    it('deve aceitar ano válido', () => {
      expect(albumCreateSchema.safeParse({ title: 'A', artist: 'B', year: 1969 }).success).toBe(true);
      expect(albumCreateSchema.safeParse({ title: 'A', artist: 'B', year: 2025 }).success).toBe(true);
    });

    it('deve rejeitar ano antes de 1900', () => {
      const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', year: 1899 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1900');
      }
    });

    it('deve rejeitar ano no futuro distante', () => {
      const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', year: 2100 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('futuro');
      }
    });

    it('deve converter string para número (coerce)', () => {
      const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', year: '1969' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(1969);
      }
    });
  });

  describe('format', () => {
    it('deve aceitar todos os formatos válidos', () => {
      const formats = ['LP', 'EP', 'SINGLE_7', 'SINGLE_12', 'DOUBLE_LP', 'BOX_SET'];
      formats.forEach((format) => {
        const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', format });
        expect(result.success).toBe(true);
      });
    });

    it('deve rejeitar formato inválido', () => {
      const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', format: 'CD' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('LP');
      }
    });
  });

  describe('condition', () => {
    it('deve aceitar todas as condições válidas', () => {
      const conditions = ['mint', 'near_mint', 'vg_plus', 'vg', 'good', 'fair', 'poor'];
      conditions.forEach((condition) => {
        const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', condition });
        expect(result.success).toBe(true);
      });
    });

    it('deve rejeitar condição inválida', () => {
      const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', condition: 'excellent' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('mint');
      }
    });
  });

  describe('coverUrl', () => {
    it('deve aceitar URL válida', () => {
      const result = albumCreateSchema.safeParse({
        title: 'A',
        artist: 'B',
        coverUrl: 'https://example.com/cover.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar URL inválida', () => {
      const result = albumCreateSchema.safeParse({
        title: 'A',
        artist: 'B',
        coverUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('URL');
      }
    });
  });

  describe('discogsId', () => {
    it('deve aceitar ID positivo', () => {
      const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', discogsId: 24047 });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar ID negativo', () => {
      const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', discogsId: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('positivo');
      }
    });

    it('deve converter string para número (coerce)', () => {
      const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', discogsId: '24047' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discogsId).toBe(24047);
      }
    });
  });

  describe('tags', () => {
    it('deve aceitar array de strings', () => {
      const result = albumCreateSchema.safeParse({
        title: 'A',
        artist: 'B',
        tags: ['rock', '60s', 'classic'],
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar mais de 20 tags', () => {
      const tags = Array(21).fill('tag');
      const result = albumCreateSchema.safeParse({ title: 'A', artist: 'B', tags });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('20');
      }
    });

    it('deve rejeitar tag muito longa', () => {
      const result = albumCreateSchema.safeParse({
        title: 'A',
        artist: 'B',
        tags: ['a'.repeat(51)],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('50');
      }
    });
  });

  describe('notes', () => {
    it('deve aceitar notas longas', () => {
      const result = albumCreateSchema.safeParse({
        title: 'A',
        artist: 'B',
        notes: 'a'.repeat(2000),
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar notas muito longas', () => {
      const result = albumCreateSchema.safeParse({
        title: 'A',
        artist: 'B',
        notes: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('2000');
      }
    });
  });

  describe('limites de caracteres', () => {
    it('deve rejeitar title muito longo', () => {
      const result = albumCreateSchema.safeParse({
        title: 'a'.repeat(501),
        artist: 'B',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500');
      }
    });

    it('deve rejeitar artist muito longo', () => {
      const result = albumCreateSchema.safeParse({
        title: 'A',
        artist: 'b'.repeat(501),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500');
      }
    });

    it('deve rejeitar label muito longo', () => {
      const result = albumCreateSchema.safeParse({
        title: 'A',
        artist: 'B',
        label: 'l'.repeat(201),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('200');
      }
    });
  });
});

describe('albumUpdateSchema', () => {
  it('deve aceitar objeto vazio (nenhuma atualização)', () => {
    const result = albumUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('deve aceitar apenas title', () => {
    const result = albumUpdateSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('deve aceitar múltiplos campos', () => {
    const result = albumUpdateSchema.safeParse({
      title: 'New Title',
      artist: 'New Artist',
      year: 1970,
    });
    expect(result.success).toBe(true);
  });

  it('NÃO deve permitir discogsId (bloqueado)', () => {
    // albumUpdateSchema não tem discogsId - verificar que não aceita
    const result = albumUpdateSchema.safeParse({
      title: 'A',
      discogsId: 12345,
    });
    // O campo discogsId será ignorado (não está no schema)
    expect(result.success).toBe(true);
    if (result.success) {
      // @ts-expect-error - discogsId não existe no tipo
      expect(result.data.discogsId).toBeUndefined();
    }
  });

  it('deve aplicar mesmas validações do create', () => {
    // Title vazio
    const result1 = albumUpdateSchema.safeParse({ title: '' });
    expect(result1.success).toBe(false);

    // Ano inválido
    const result2 = albumUpdateSchema.safeParse({ year: 1800 });
    expect(result2.success).toBe(false);

    // Formato inválido
    const result3 = albumUpdateSchema.safeParse({ format: 'CD' });
    expect(result3.success).toBe(false);
  });
});

describe('albumArchiveSchema', () => {
  it('deve aceitar archived=true', () => {
    const result = albumArchiveSchema.safeParse({ archived: true });
    expect(result.success).toBe(true);
  });

  it('deve aceitar archived=false', () => {
    const result = albumArchiveSchema.safeParse({ archived: false });
    expect(result.success).toBe(true);
  });

  it('deve rejeitar sem archived', () => {
    const result = albumArchiveSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('deve rejeitar string', () => {
    const result = albumArchiveSchema.safeParse({ archived: 'true' });
    expect(result.success).toBe(false);
  });
});

describe('albumQuerySchema', () => {
  describe('paginação', () => {
    it('deve aceitar query vazia', () => {
      const result = albumQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('deve aceitar limit válido', () => {
      const result = albumQuerySchema.safeParse({ limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('deve rejeitar limit acima de 100', () => {
      const result = albumQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('100');
      }
    });

    it('deve aceitar offset válido', () => {
      const result = albumQuerySchema.safeParse({ offset: '20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(20);
      }
    });

    it('deve rejeitar offset negativo', () => {
      const result = albumQuerySchema.safeParse({ offset: '-1' });
      expect(result.success).toBe(false);
    });
  });

  describe('filtros', () => {
    it('deve aceitar search', () => {
      const result = albumQuerySchema.safeParse({ search: 'beatles' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe('beatles');
      }
    });

    it('deve aceitar artist', () => {
      const result = albumQuerySchema.safeParse({ artist: 'The Beatles' });
      expect(result.success).toBe(true);
    });

    it('deve aceitar year', () => {
      const result = albumQuerySchema.safeParse({ year: '1969' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(1969);
      }
    });

    it('deve aceitar format válido', () => {
      const result = albumQuerySchema.safeParse({ format: 'LP' });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar format inválido', () => {
      const result = albumQuerySchema.safeParse({ format: 'CD' });
      expect(result.success).toBe(false);
    });

    it('deve converter archived string para boolean', () => {
      const result1 = albumQuerySchema.safeParse({ archived: 'true' });
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.archived).toBe(true);
      }

      const result2 = albumQuerySchema.safeParse({ archived: 'false' });
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.archived).toBe(false);
      }
    });
  });

  describe('ordenação', () => {
    it('deve aceitar sort válido', () => {
      const sorts = ['title', 'artist', 'year', 'createdAt'];
      sorts.forEach((sort) => {
        const result = albumQuerySchema.safeParse({ sort });
        expect(result.success).toBe(true);
      });
    });

    it('deve rejeitar sort inválido', () => {
      const result = albumQuerySchema.safeParse({ sort: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('deve aceitar order válido', () => {
      expect(albumQuerySchema.safeParse({ order: 'asc' }).success).toBe(true);
      expect(albumQuerySchema.safeParse({ order: 'desc' }).success).toBe(true);
    });

    it('deve rejeitar order inválido', () => {
      const result = albumQuerySchema.safeParse({ order: 'random' });
      expect(result.success).toBe(false);
    });
  });
});

describe('albumIdParamSchema', () => {
  it('deve aceitar UUID válido', () => {
    // UUID v4 válido conforme RFC 4122
    const result = albumIdParamSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('deve rejeitar ID não-UUID', () => {
    const result = albumIdParamSchema.safeParse({ id: 'invalid-id' });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar sem ID', () => {
    const result = albumIdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('AlbumFormatEnum', () => {
  it('deve aceitar todos os valores válidos', () => {
    const formats = ['LP', 'EP', 'SINGLE_7', 'SINGLE_12', 'DOUBLE_LP', 'BOX_SET'];
    formats.forEach((format) => {
      expect(AlbumFormatEnum.safeParse(format).success).toBe(true);
    });
  });

  it('deve ter mensagem de erro em português', () => {
    const result = AlbumFormatEnum.safeParse('INVALID');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('LP');
    }
  });
});

describe('AlbumConditionEnum', () => {
  it('deve aceitar todos os valores válidos', () => {
    const conditions = ['mint', 'near_mint', 'vg_plus', 'vg', 'good', 'fair', 'poor'];
    conditions.forEach((condition) => {
      expect(AlbumConditionEnum.safeParse(condition).success).toBe(true);
    });
  });

  it('deve ter mensagem de erro em português', () => {
    const result = AlbumConditionEnum.safeParse('INVALID');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('mint');
    }
  });
});
