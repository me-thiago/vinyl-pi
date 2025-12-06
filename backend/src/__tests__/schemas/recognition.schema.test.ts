/**
 * Testes unitários para Recognition Schema (V2-05)
 */

import {
  recognizeSchema,
  recognizeConfirmSchema,
  tracksQuerySchema,
  RecognitionTriggerEnum,
} from '../../schemas';

describe('recognizeSchema', () => {
  describe('trigger', () => {
    it('deve aceitar trigger manual', () => {
      const result = recognizeSchema.safeParse({ trigger: 'manual' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trigger).toBe('manual');
      }
    });

    it('deve aceitar trigger automatic', () => {
      const result = recognizeSchema.safeParse({ trigger: 'automatic' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trigger).toBe('automatic');
      }
    });

    it('deve usar manual como default', () => {
      const result = recognizeSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trigger).toBe('manual');
      }
    });

    it('deve rejeitar trigger inválido', () => {
      const result = recognizeSchema.safeParse({ trigger: 'invalid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('manual');
      }
    });
  });

  describe('sampleDuration', () => {
    it('deve usar 10 como default', () => {
      const result = recognizeSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sampleDuration).toBe(10);
      }
    });

    it('deve aceitar duração válida (5-15)', () => {
      [5, 10, 15].forEach((duration) => {
        const result = recognizeSchema.safeParse({ sampleDuration: duration });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sampleDuration).toBe(duration);
        }
      });
    });

    it('deve rejeitar duração menor que 5', () => {
      const result = recognizeSchema.safeParse({ sampleDuration: 4 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('5');
      }
    });

    it('deve rejeitar duração maior que 15', () => {
      const result = recognizeSchema.safeParse({ sampleDuration: 16 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('15');
      }
    });

    it('deve converter string para número (coerce)', () => {
      const result = recognizeSchema.safeParse({ sampleDuration: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sampleDuration).toBe(10);
      }
    });
  });

  describe('objeto vazio', () => {
    it('deve aplicar todos os defaults', () => {
      const result = recognizeSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trigger).toBe('manual');
        expect(result.data.sampleDuration).toBe(10);
      }
    });
  });
});

describe('recognizeConfirmSchema', () => {
  const validTrackId = '550e8400-e29b-41d4-a716-446655440000';
  const validAlbumId = '660e8400-e29b-41d4-a716-446655440001';

  describe('trackId', () => {
    it('deve aceitar trackId UUID válido', () => {
      const result = recognizeConfirmSchema.safeParse({
        trackId: validTrackId,
        albumId: null,
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar trackId não-UUID', () => {
      const result = recognizeConfirmSchema.safeParse({
        trackId: 'invalid',
        albumId: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('UUID');
      }
    });

    it('deve rejeitar sem trackId', () => {
      const result = recognizeConfirmSchema.safeParse({
        albumId: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('albumId', () => {
    it('deve aceitar albumId UUID válido', () => {
      const result = recognizeConfirmSchema.safeParse({
        trackId: validTrackId,
        albumId: validAlbumId,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.albumId).toBe(validAlbumId);
      }
    });

    it('deve aceitar albumId null (desvincular)', () => {
      const result = recognizeConfirmSchema.safeParse({
        trackId: validTrackId,
        albumId: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.albumId).toBeNull();
      }
    });

    it('deve rejeitar albumId não-UUID', () => {
      const result = recognizeConfirmSchema.safeParse({
        trackId: validTrackId,
        albumId: 'invalid',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('UUID');
      }
    });
  });
});

describe('tracksQuerySchema', () => {
  describe('paginação', () => {
    it('deve aceitar query vazia (com defaults)', () => {
      const result = tracksQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('deve aceitar limit válido', () => {
      const result = tracksQuerySchema.safeParse({ limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('deve rejeitar limit acima de 100', () => {
      const result = tracksQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('100');
      }
    });

    it('deve rejeitar limit menor que 1', () => {
      const result = tracksQuerySchema.safeParse({ limit: '0' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1');
      }
    });

    it('deve aceitar offset válido', () => {
      const result = tracksQuerySchema.safeParse({ offset: '20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(20);
      }
    });

    it('deve rejeitar offset negativo', () => {
      const result = tracksQuerySchema.safeParse({ offset: '-1' });
      expect(result.success).toBe(false);
    });
  });

  describe('filtros', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('deve aceitar sessionId UUID válido', () => {
      const result = tracksQuerySchema.safeParse({ sessionId: validUUID });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe(validUUID);
      }
    });

    it('deve rejeitar sessionId não-UUID', () => {
      const result = tracksQuerySchema.safeParse({ sessionId: 'invalid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('UUID');
      }
    });

    it('deve aceitar albumId UUID válido', () => {
      const result = tracksQuerySchema.safeParse({ albumId: validUUID });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.albumId).toBe(validUUID);
      }
    });

    it('deve rejeitar albumId não-UUID', () => {
      const result = tracksQuerySchema.safeParse({ albumId: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('deve aceitar dateFrom ISO válida', () => {
      const result = tracksQuerySchema.safeParse({
        dateFrom: '2024-01-01T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateFrom).toBe('2024-01-01T00:00:00.000Z');
      }
    });

    it('deve rejeitar dateFrom inválida', () => {
      const result = tracksQuerySchema.safeParse({ dateFrom: 'invalid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ISO');
      }
    });

    it('deve aceitar dateTo ISO válida', () => {
      const result = tracksQuerySchema.safeParse({
        dateTo: '2024-12-31T23:59:59.999Z',
      });
      expect(result.success).toBe(true);
    });

    it('deve aceitar múltiplos filtros', () => {
      const result = tracksQuerySchema.safeParse({
        sessionId: validUUID,
        dateFrom: '2024-01-01T00:00:00.000Z',
        dateTo: '2024-12-31T23:59:59.999Z',
        limit: '10',
        offset: '0',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('RecognitionTriggerEnum', () => {
  it('deve aceitar valores válidos', () => {
    expect(RecognitionTriggerEnum.safeParse('manual').success).toBe(true);
    expect(RecognitionTriggerEnum.safeParse('automatic').success).toBe(true);
  });

  it('deve ter mensagem de erro em português', () => {
    const result = RecognitionTriggerEnum.safeParse('invalid');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('manual');
    }
  });
});
