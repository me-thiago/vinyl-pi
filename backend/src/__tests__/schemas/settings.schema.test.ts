/**
 * Testes unitários para Settings Schema
 */

import { settingsUpdateSchema, settingKeyParamSchema } from '../../schemas';

describe('settingsUpdateSchema', () => {
  describe('campos opcionais', () => {
    it('deve aceitar objeto vazio', () => {
      const result = settingsUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('deve aceitar apenas silence.threshold', () => {
      const result = settingsUpdateSchema.safeParse({
        'silence.threshold': -45,
      });
      expect(result.success).toBe(true);
    });

    it('deve aceitar múltiplos campos', () => {
      const result = settingsUpdateSchema.safeParse({
        'silence.threshold': -45,
        'silence.duration': 15,
        'clipping.threshold': -5,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('silence.threshold', () => {
    it('deve aceitar valor dentro do range (-80 a 0)', () => {
      expect(settingsUpdateSchema.safeParse({ 'silence.threshold': -50 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'silence.threshold': -80 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'silence.threshold': 0 }).success).toBe(true);
    });

    it('deve rejeitar valor abaixo de -80', () => {
      const result = settingsUpdateSchema.safeParse({ 'silence.threshold': -81 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('-80');
      }
    });

    it('deve rejeitar valor acima de 0', () => {
      const result = settingsUpdateSchema.safeParse({ 'silence.threshold': 1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('0');
      }
    });

    it('deve rejeitar string', () => {
      const result = settingsUpdateSchema.safeParse({ 'silence.threshold': '-50' });
      expect(result.success).toBe(false);
    });
  });

  describe('silence.duration', () => {
    it('deve aceitar valor dentro do range (1 a 60)', () => {
      expect(settingsUpdateSchema.safeParse({ 'silence.duration': 10 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'silence.duration': 1 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'silence.duration': 60 }).success).toBe(true);
    });

    it('deve rejeitar valor menor que 1', () => {
      const result = settingsUpdateSchema.safeParse({ 'silence.duration': 0 });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar valor maior que 60', () => {
      const result = settingsUpdateSchema.safeParse({ 'silence.duration': 61 });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar número decimal', () => {
      const result = settingsUpdateSchema.safeParse({ 'silence.duration': 10.5 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('inteiro');
      }
    });
  });

  describe('clipping.threshold', () => {
    it('deve aceitar valor dentro do range (-10 a 0)', () => {
      expect(settingsUpdateSchema.safeParse({ 'clipping.threshold': -5 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'clipping.threshold': -10 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'clipping.threshold': 0 }).success).toBe(true);
    });

    it('deve rejeitar valor abaixo de -10', () => {
      const result = settingsUpdateSchema.safeParse({ 'clipping.threshold': -11 });
      expect(result.success).toBe(false);
    });
  });

  describe('clipping.cooldown', () => {
    it('deve aceitar valor dentro do range (100 a 10000)', () => {
      expect(settingsUpdateSchema.safeParse({ 'clipping.cooldown': 1000 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'clipping.cooldown': 100 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'clipping.cooldown': 10000 }).success).toBe(true);
    });

    it('deve rejeitar valor menor que 100', () => {
      const result = settingsUpdateSchema.safeParse({ 'clipping.cooldown': 99 });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar valor maior que 10000', () => {
      const result = settingsUpdateSchema.safeParse({ 'clipping.cooldown': 10001 });
      expect(result.success).toBe(false);
    });
  });

  describe('session.timeout', () => {
    it('deve aceitar valor dentro do range (60 a 7200)', () => {
      expect(settingsUpdateSchema.safeParse({ 'session.timeout': 1800 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'session.timeout': 60 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'session.timeout': 7200 }).success).toBe(true);
    });

    it('deve rejeitar valor menor que 60', () => {
      const result = settingsUpdateSchema.safeParse({ 'session.timeout': 59 });
      expect(result.success).toBe(false);
    });
  });

  describe('player.buffer_ms', () => {
    it('deve aceitar valor dentro do range (100 a 300)', () => {
      expect(settingsUpdateSchema.safeParse({ 'player.buffer_ms': 150 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'player.buffer_ms': 100 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'player.buffer_ms': 300 }).success).toBe(true);
    });

    it('deve rejeitar valor fora do range', () => {
      expect(settingsUpdateSchema.safeParse({ 'player.buffer_ms': 99 }).success).toBe(false);
      expect(settingsUpdateSchema.safeParse({ 'player.buffer_ms': 301 }).success).toBe(false);
    });
  });

  describe('stream.bitrate', () => {
    it('deve aceitar valor dentro do range (128 a 256)', () => {
      expect(settingsUpdateSchema.safeParse({ 'stream.bitrate': 128 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'stream.bitrate': 192 }).success).toBe(true);
      expect(settingsUpdateSchema.safeParse({ 'stream.bitrate': 256 }).success).toBe(true);
    });

    it('deve rejeitar valor fora do range', () => {
      expect(settingsUpdateSchema.safeParse({ 'stream.bitrate': 127 }).success).toBe(false);
      expect(settingsUpdateSchema.safeParse({ 'stream.bitrate': 257 }).success).toBe(false);
    });
  });

  describe('campos desconhecidos (strict mode)', () => {
    it('deve rejeitar campos não definidos', () => {
      const result = settingsUpdateSchema.safeParse({
        'silence.threshold': -45,
        'unknown.field': 123,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('settingKeyParamSchema', () => {
  it('deve aceitar chave válida', () => {
    const result = settingKeyParamSchema.safeParse({ key: 'silence.threshold' });
    expect(result.success).toBe(true);
  });

  it('deve rejeitar chave vazia', () => {
    const result = settingKeyParamSchema.safeParse({ key: '' });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar objeto sem chave', () => {
    const result = settingKeyParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
