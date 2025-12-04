import express, { Express } from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

// Criar um rate limiter de teste com limites baixos para testes rápidos
const createTestLimiter = (max: number, windowMs: number = 1000) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: {
        message: 'Muitas requisições. Por favor, aguarde antes de tentar novamente.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const skipPaths = ['/stream', '/socket.io'];
      return skipPaths.some((path) => req.path.startsWith(path));
    },
  });
};

describe('Rate Limiter Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      const limiter = createTestLimiter(5);
      app.use('/api', limiter);
      app.get('/api/test', (req, res) => res.json({ success: true }));

      // Fazer 3 requisições (abaixo do limite de 5)
      for (let i = 0; i < 3; i++) {
        const response = await request(app).get('/api/test');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests over the limit with 429', async () => {
      const limiter = createTestLimiter(3);
      app.use('/api', limiter);
      app.get('/api/test', (req, res) => res.json({ success: true }));

      // Fazer 3 requisições (atingir o limite)
      for (let i = 0; i < 3; i++) {
        await request(app).get('/api/test');
      }

      // 4ª requisição deve ser bloqueada
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.error.message).toContain('Muitas requisições');
    });

    it('should include RateLimit headers in response', async () => {
      const limiter = createTestLimiter(10);
      app.use('/api', limiter);
      app.get('/api/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/api/test');

      expect(response.status).toBe(200);
      // standardHeaders: true usa o formato RFC draft
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
    });
  });

  describe('Path Exclusions', () => {
    it('should NOT apply rate limiting to /stream paths', async () => {
      const limiter = createTestLimiter(1); // Limite muito baixo
      app.use(limiter);
      app.get('/stream', (req, res) => res.json({ streaming: true }));
      app.get('/stream.wav', (req, res) => res.json({ streaming: true }));

      // Fazer múltiplas requisições para /stream
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/stream');
        expect(response.status).toBe(200);
      }

      // Fazer múltiplas requisições para /stream.wav
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/stream.wav');
        expect(response.status).toBe(200);
      }
    });

    it('should NOT apply rate limiting to /socket.io paths', async () => {
      const limiter = createTestLimiter(1); // Limite muito baixo
      app.use(limiter);
      app.get('/socket.io', (req, res) => res.json({ socket: true }));
      app.get('/socket.io/test', (req, res) => res.json({ socket: true }));

      // Fazer múltiplas requisições para /socket.io
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/socket.io');
        expect(response.status).toBe(200);
      }
    });

    it('should apply rate limiting to normal API paths', async () => {
      const limiter = createTestLimiter(2);
      app.use('/api', limiter);
      app.get('/api/status', (req, res) => res.json({ status: 'ok' }));

      // 2 requisições OK
      await request(app).get('/api/status');
      await request(app).get('/api/status');

      // 3ª requisição bloqueada
      const response = await request(app).get('/api/status');
      expect(response.status).toBe(429);
    });
  });

  describe('Counter Reset', () => {
    it('should reset counter after window expires', async () => {
      const windowMs = 100; // 100ms para teste rápido
      const limiter = createTestLimiter(2, windowMs);
      app.use('/api', limiter);
      app.get('/api/test', (req, res) => res.json({ success: true }));

      // Esgotar o limite
      await request(app).get('/api/test');
      await request(app).get('/api/test');

      // Verificar que está bloqueado
      let response = await request(app).get('/api/test');
      expect(response.status).toBe(429);

      // Aguardar janela expirar
      await new Promise((resolve) => setTimeout(resolve, windowMs + 50));

      // Agora deve funcionar novamente
      response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
    });
  });

  describe('Error Message', () => {
    it('should return error message in Portuguese', async () => {
      const limiter = createTestLimiter(1);
      app.use('/api', limiter);
      app.get('/api/test', (req, res) => res.json({ success: true }));

      // Esgotar o limite
      await request(app).get('/api/test');

      // Verificar mensagem
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(429);
      expect(response.body.error.message).toBe(
        'Muitas requisições. Por favor, aguarde antes de tentar novamente.'
      );
    });
  });
});
