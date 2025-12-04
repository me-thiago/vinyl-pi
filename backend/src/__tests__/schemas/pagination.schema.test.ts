/**
 * Testes unitários para Pagination Schema
 */

import { paginationSchema, dateFilterSchema } from '../../schemas';

describe('paginationSchema', () => {
  describe('limit', () => {
    it('deve converter string para número (coerce)', () => {
      const result = paginationSchema.safeParse({ limit: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(typeof result.data.limit).toBe('number');
      }
    });

    it('deve aceitar número diretamente', () => {
      const result = paginationSchema.safeParse({ limit: 10 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('deve aceitar limite como opcional', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBeUndefined();
      }
    });

    it('deve rejeitar limite menor que 1', () => {
      const result = paginationSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1');
      }
    });

    it('deve rejeitar limite negativo', () => {
      const result = paginationSchema.safeParse({ limit: -5 });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar string não numérica', () => {
      const result = paginationSchema.safeParse({ limit: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('offset', () => {
    it('deve converter string para número (coerce)', () => {
      const result = paginationSchema.safeParse({ offset: '20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(20);
        expect(typeof result.data.offset).toBe('number');
      }
    });

    it('deve aceitar offset 0', () => {
      const result = paginationSchema.safeParse({ offset: 0 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(0);
      }
    });

    it('deve aceitar offset como opcional', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBeUndefined();
      }
    });

    it('deve rejeitar offset negativo', () => {
      const result = paginationSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('0');
      }
    });
  });

  describe('combinação', () => {
    it('deve aceitar limit e offset juntos', () => {
      const result = paginationSchema.safeParse({ limit: '50', offset: '100' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(100);
      }
    });
  });
});

describe('dateFilterSchema', () => {
  describe('date_from', () => {
    it('deve aceitar data ISO válida', () => {
      const result = dateFilterSchema.safeParse({
        date_from: '2024-01-15T10:30:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('deve aceitar date_from como opcional', () => {
      const result = dateFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date_from).toBeUndefined();
      }
    });

    it('deve rejeitar data inválida', () => {
      const result = dateFilterSchema.safeParse({
        date_from: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar data parcial sem timezone', () => {
      const result = dateFilterSchema.safeParse({
        date_from: '2024-01-15',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('date_to', () => {
    it('deve aceitar data ISO válida', () => {
      const result = dateFilterSchema.safeParse({
        date_to: '2024-01-20T23:59:59.999Z',
      });
      expect(result.success).toBe(true);
    });

    it('deve aceitar date_to como opcional', () => {
      const result = dateFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date_to).toBeUndefined();
      }
    });
  });

  describe('combinação', () => {
    it('deve aceitar date_from e date_to juntos', () => {
      const result = dateFilterSchema.safeParse({
        date_from: '2024-01-01T00:00:00.000Z',
        date_to: '2024-01-31T23:59:59.999Z',
      });
      expect(result.success).toBe(true);
    });
  });
});
