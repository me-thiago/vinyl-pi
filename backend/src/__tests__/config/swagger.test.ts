import express from 'express';
import request from 'supertest';
import { setupSwagger, specs } from '../../config/swagger';

// Tipo para a spec OpenAPI (simplificado)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const typedSpecs = specs as any;

describe('Swagger/OpenAPI Documentation', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    setupSwagger(app);
  });

  describe('GET /api/docs', () => {
    it('deve retornar HTML do Swagger UI com status 200', async () => {
      const response = await request(app).get('/api/docs/');

      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
      expect(response.text).toContain('swagger-ui');
    });

    it('deve ter título customizado', async () => {
      const response = await request(app).get('/api/docs/');

      expect(response.text).toContain('Vinyl-OS API Docs');
    });
  });

  describe('GET /api/docs.json', () => {
    it('deve retornar spec JSON válida com status 200', async () => {
      const response = await request(app).get('/api/docs.json');

      expect(response.status).toBe(200);
      expect(response.type).toMatch(/json/);
      expect(response.body).toHaveProperty('openapi', '3.0.0');
    });

    it('deve conter informações básicas da API', async () => {
      const response = await request(app).get('/api/docs.json');

      expect(response.body.info).toMatchObject({
        title: 'Vinyl-OS API',
        version: expect.any(String),
        description: expect.stringContaining('Vinyl-OS')
      });
    });

    it('deve ter todas as tags definidas', async () => {
      const response = await request(app).get('/api/docs.json');

      const tagNames = response.body.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('Status');
      expect(tagNames).toContain('Settings');
      expect(tagNames).toContain('Sessions');
      expect(tagNames).toContain('Events');
      expect(tagNames).toContain('Health');
    });
  });

  describe('OpenAPI Spec Validation', () => {
    it('deve ter todos os endpoints documentados', () => {
      const paths = Object.keys(typedSpecs.paths || {});

      // Status endpoints
      expect(paths).toContain('/api/status');
      expect(paths).toContain('/api/status/audio');

      // Health endpoint
      expect(paths).toContain('/health');

      // Settings endpoints
      expect(paths).toContain('/api/settings');
      expect(paths).toContain('/api/settings/reset');
      expect(paths).toContain('/api/settings/{key}/reset');
      expect(paths).toContain('/api/system/info');

      // Sessions endpoints
      expect(paths).toContain('/api/sessions');
      expect(paths).toContain('/api/sessions/active');
      expect(paths).toContain('/api/sessions/{id}');

      // Events endpoints
      expect(paths).toContain('/api/events');
      expect(paths).toContain('/api/events/stats');
    });

    it('deve ter todos os schemas definidos', () => {
      const schemas = Object.keys(typedSpecs.components?.schemas || {});

      expect(schemas).toContain('Error');
      expect(schemas).toContain('Session');
      expect(schemas).toContain('AudioEvent');
      expect(schemas).toContain('Setting');
      expect(schemas).toContain('AudioStatus');
      expect(schemas).toContain('HealthResponse');
    });

    it('cada endpoint deve ter responses documentadas', () => {
      const paths = typedSpecs.paths || {};

      for (const [path, methods] of Object.entries(paths)) {
        for (const [method, spec] of Object.entries(methods as Record<string, unknown>)) {
          const endpoint = spec as { responses?: Record<string, unknown> };
          expect(endpoint.responses).toBeDefined();
          // POST pode retornar 201 (created) em vez de 200
          // Endpoints stub podem retornar 501 (not implemented)
          const responseKeys = Object.keys(endpoint.responses || {});
          const hasExpectedResponse = responseKeys.some(key =>
            key === '200' || key === '201' || key === '501'
          );
          expect(hasExpectedResponse).toBe(true);
        }
      }
    });

    it('endpoints devem ter exemplos', () => {
      // Verificar que pelo menos os principais schemas têm examples
      const schemas = typedSpecs.components?.schemas || {};

      expect(schemas.AudioStatus?.example).toBeDefined();
      expect(schemas.Session?.example).toBeDefined();
      expect(schemas.AudioEvent?.example).toBeDefined();
      expect(schemas.Setting?.example).toBeDefined();
    });
  });

  describe('Schemas Validation', () => {
    it('Schema Error deve ter estrutura correta', () => {
      const errorSchema = typedSpecs.components?.schemas?.Error;

      expect(errorSchema?.type).toBe('object');
      expect(errorSchema?.properties?.error?.properties?.message).toBeDefined();
      expect(errorSchema?.properties?.error?.properties?.code).toBeDefined();
    });

    it('Schema Session deve ter todos os campos obrigatórios', () => {
      const sessionSchema = typedSpecs.components?.schemas?.Session;

      expect(sessionSchema?.properties?.id).toBeDefined();
      expect(sessionSchema?.properties?.startedAt).toBeDefined();
      expect(sessionSchema?.properties?.endedAt).toBeDefined();
      expect(sessionSchema?.properties?.durationSeconds).toBeDefined();
      expect(sessionSchema?.properties?.eventCount).toBeDefined();
    });

    it('Schema AudioEvent deve ter enum de tipos válidos', () => {
      const eventSchema = typedSpecs.components?.schemas?.AudioEvent;
      const eventTypes = eventSchema?.properties?.eventType?.enum;

      expect(eventTypes).toContain('silence.start');
      expect(eventTypes).toContain('silence.end');
      expect(eventTypes).toContain('clipping.detected');
      expect(eventTypes).toContain('session.start');
      expect(eventTypes).toContain('session.end');
    });
  });
});
