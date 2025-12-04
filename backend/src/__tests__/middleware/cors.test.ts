import express, { Express } from 'express';
import cors from 'cors';
import request from 'supertest';
import {
  corsOriginCallback,
  resetAllowedOriginsCache,
} from '../../utils/cors-validator';

// Mock do logger para evitar output nos testes
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('CORS Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    resetAllowedOriginsCache();
    delete process.env.ALLOWED_ORIGINS;

    app = express();
    app.use(
      cors({
        origin: corsOriginCallback,
        credentials: true,
      })
    );
    app.use(express.json());

    // Simple test endpoint
    app.get('/test', (req, res) => {
      res.json({ message: 'ok' });
    });

    app.post('/test', (req, res) => {
      res.json({ received: req.body });
    });
  });

  afterEach(() => {
    resetAllowedOriginsCache();
    delete process.env.ALLOWED_ORIGINS;
  });

  describe('allowed origins', () => {
    it('should allow requests without Origin header (same-origin)', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'ok' });
    });

    it('should allow requests from localhost', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow requests from 127.0.0.1', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://127.0.0.1:8080');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:8080'
      );
    });

    it('should allow requests from 192.168.x.x', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://192.168.1.100:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://192.168.1.100:3000'
      );
    });

    it('should allow requests from 10.x.x.x', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://10.0.0.50:8080');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://10.0.0.50:8080'
      );
    });

    it('should allow requests from 172.16-31.x.x', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://172.20.10.5:9000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://172.20.10.5:9000'
      );
    });
  });

  describe('blocked origins', () => {
    it('should block requests from external domains', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://evil.com');

      // CORS middleware blocks the request
      expect(response.status).toBe(500);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should block requests from public IPs', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://8.8.8.8');

      expect(response.status).toBe(500);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should block requests from non-private 172.x.x.x ranges', async () => {
      // 172.32.x.x is not in the private range (172.16-31.x.x)
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://172.32.0.1');

      expect(response.status).toBe(500);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('ALLOWED_ORIGINS environment variable', () => {
    it('should allow origins from ALLOWED_ORIGINS', async () => {
      process.env.ALLOWED_ORIGINS = 'https://trusted.example.com';
      resetAllowedOriginsCache();

      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://trusted.example.com');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'https://trusted.example.com'
      );
    });

    it('should still block unlisted external origins', async () => {
      process.env.ALLOWED_ORIGINS = 'https://trusted.example.com';
      resetAllowedOriginsCache();

      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://untrusted.example.com');

      expect(response.status).toBe(500);
    });

    it('should work with multiple ALLOWED_ORIGINS', async () => {
      process.env.ALLOWED_ORIGINS =
        'https://app1.example.com,https://app2.example.com';
      resetAllowedOriginsCache();

      const response1 = await request(app)
        .get('/test')
        .set('Origin', 'https://app1.example.com');

      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .get('/test')
        .set('Origin', 'https://app2.example.com');

      expect(response2.status).toBe(200);
    });
  });

  describe('preflight requests (OPTIONS)', () => {
    it('should respond to preflight from allowed origin', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should block preflight from blocked origin', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://evil.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(500);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('credentials support', () => {
    it('should include credentials header for allowed origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://192.168.1.50:3000');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('POST requests with body', () => {
    it('should allow POST from local origin', async () => {
      const response = await request(app)
        .post('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: { data: 'test' } });
    });

    it('should block POST from external origin', async () => {
      const response = await request(app)
        .post('/test')
        .set('Origin', 'https://attacker.com')
        .set('Content-Type', 'application/json')
        .send({ data: 'malicious' });

      expect(response.status).toBe(500);
    });
  });
});
