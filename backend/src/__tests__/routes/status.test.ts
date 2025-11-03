import express, { Express } from 'express';
import request from 'supertest';
import { AudioManager } from '../../services/audio-manager';
import { createStatusRouter } from '../../routes/status';

describe('GET /api/status', () => {
  let app: Express;
  let audioManager: AudioManager;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    audioManager = new AudioManager({
      device: 'plughw:1,0',
      sampleRate: 48000,
      channels: 2,
      bitDepth: 16,
      bufferSize: 1024
    });

    app.use('/api', createStatusRouter(audioManager));
  });

  afterEach(async () => {
    await audioManager.cleanup();
  });

  it('should return 200 OK', async () => {
    const response = await request(app).get('/api/status');
    expect(response.status).toBe(200);
  });

  it('should return JSON response', async () => {
    const response = await request(app).get('/api/status');
    expect(response.type).toBe('application/json');
  });

  it('should include session field', async () => {
    const response = await request(app).get('/api/status');
    expect(response.body).toHaveProperty('session');
  });

  it('should include streaming status', async () => {
    const response = await request(app).get('/api/status');

    expect(response.body).toHaveProperty('streaming');
    expect(response.body.streaming).toHaveProperty('active');
    expect(response.body.streaming).toHaveProperty('bitrate');
    expect(response.body.streaming).toHaveProperty('mount_point');
  });

  it('should include audio status', async () => {
    const response = await request(app).get('/api/status');

    expect(response.body).toHaveProperty('audio');
    expect(response.body.audio).toHaveProperty('clipping_detected');
    expect(response.body.audio).toHaveProperty('silence_detected');
    // level_db is present in response (null when not available)
    expect('level_db' in response.body.audio).toBe(true);
  });

  it('should return streaming inactive when not streaming', async () => {
    const response = await request(app).get('/api/status');

    expect(response.body.streaming.active).toBe(false);
    expect(response.body.streaming.bitrate).toBe(0);
    expect(response.body.streaming.mount_point).toBe('');
  });

  it('should handle errors gracefully', async () => {
    // Create a broken AudioManager that throws errors
    const brokenManager = new AudioManager();
    // @ts-ignore - Force error by calling private method incorrectly
    jest.spyOn(brokenManager, 'getStatus').mockImplementation(() => {
      throw new Error('Test error');
    });

    const errorApp = express();
    errorApp.use('/api', createStatusRouter(brokenManager));

    const response = await request(errorApp).get('/api/status');

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });

  describe('Streaming status fields', () => {
    it('should have listeners field when available or omit when undefined', async () => {
      const response = await request(app).get('/api/status');

      // listeners may be present (number) or omitted (when undefined)
      // Both behaviors are acceptable - undefined values are omitted in JSON serialization
      const hasListeners = 'listeners' in response.body.streaming;
      if (hasListeners) {
        expect(typeof response.body.streaming.listeners).toBe('number');
      }
      // Test passes whether listeners is present or not
      expect(response.body.streaming).toBeDefined();
    });

    it('should return correct bitrate type', async () => {
      const response = await request(app).get('/api/status');

      expect(typeof response.body.streaming.bitrate).toBe('number');
    });

    it('should return correct mount_point type', async () => {
      const response = await request(app).get('/api/status');

      expect(typeof response.body.streaming.mount_point).toBe('string');
    });
  });

  describe('Audio status fields', () => {
    it('should have boolean clipping_detected', async () => {
      const response = await request(app).get('/api/status');

      expect(typeof response.body.audio.clipping_detected).toBe('boolean');
    });

    it('should have boolean silence_detected', async () => {
      const response = await request(app).get('/api/status');

      expect(typeof response.body.audio.silence_detected).toBe('boolean');
    });
  });
});
