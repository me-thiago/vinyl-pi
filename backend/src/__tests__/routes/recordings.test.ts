import request from 'supertest';
import express, { Express } from 'express';
import { createRecordingsRouter } from '../../routes/recordings';
import { RecordingManager } from '../../services/recording-manager';
import { SessionManager } from '../../services/session-manager';
import prisma from '../../prisma/client';
import { errorHandler } from '../../middleware/error-handler';
import { RecordingStatus } from '@prisma/client';

// Mock Prisma
jest.mock('../../prisma/client', () => ({
  __esModule: true,
  default: {
    recording: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock EventBus
jest.mock('../../utils/event-bus', () => ({
  eventBus: {
    publish: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Recordings Router', () => {
  let app: Express;
  let mockRecordingManager: jest.Mocked<RecordingManager>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  beforeEach(() => {
    // Criar mocks do RecordingManager
    mockRecordingManager = {
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      getStatus: jest.fn(),
      getIsRecording: jest.fn(),
      startFlacProcess: jest.fn(),
      stopFlacProcess: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
    } as any;

    // Criar mock do SessionManager
    mockSessionManager = {
      getCurrentSessionId: jest.fn().mockReturnValue('session-123'),
    } as any;

    // Criar app Express com router
    app = express();
    app.use(express.json());
    app.use(
      '/api',
      createRecordingsRouter({
        recordingManager: mockRecordingManager,
        sessionManager: mockSessionManager,
      })
    );
    app.use(errorHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/recordings/start', () => {
    it('should start recording successfully', async () => {
      const mockRecording = {
        id: 'rec-123',
        status: 'recording' as RecordingStatus,
        startedAt: new Date(),
        filePath: '2025-12/rec-test.flac',
      };

      mockRecordingManager.startRecording.mockResolvedValue(mockRecording);

      const response = await request(app)
        .post('/api/recordings/start')
        .send({
          albumId: '550e8400-e29b-41d4-a716-446655440000',
          fileName: 'test-recording',
        })
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: 'rec-123',
        status: 'recording',
        filePath: '2025-12/rec-test.flac',
      });
      expect(mockRecordingManager.startRecording).toHaveBeenCalledWith({
        albumId: '550e8400-e29b-41d4-a716-446655440000',
        fileName: 'test-recording',
        sessionId: 'session-123',
      });
    });

    it('should return 409 if already recording', async () => {
      mockRecordingManager.startRecording.mockRejectedValue(
        new Error('Gravação já em andamento')
      );

      const response = await request(app)
        .post('/api/recordings/start')
        .send({})
        .expect(409);

      expect(response.body.error.code).toBe('RECORDING_ALREADY_ACTIVE');
    });

    it('should validate albumId format', async () => {
      const response = await request(app)
        .post('/api/recordings/start')
        .send({ albumId: 'invalid-uuid' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/recordings/stop', () => {
    it('should stop recording successfully', async () => {
      const mockRecording = {
        id: 'rec-123',
        status: 'completed' as RecordingStatus,
        durationSeconds: 180,
        fileSizeBytes: 1024000,
        filePath: '2025-12/rec-test.flac',
      };

      mockRecordingManager.stopRecording.mockResolvedValue(mockRecording);

      const response = await request(app)
        .post('/api/recordings/stop')
        .send({})
        .expect(200);

      expect(response.body.data).toEqual(mockRecording);
      expect(mockRecordingManager.stopRecording).toHaveBeenCalled();
    });

    it('should return 400 if no active recording', async () => {
      mockRecordingManager.stopRecording.mockRejectedValue(
        new Error('Nenhuma gravação em andamento')
      );

      const response = await request(app)
        .post('/api/recordings/stop')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('NO_ACTIVE_RECORDING');
    });
  });

  describe('GET /api/recordings/status', () => {
    it('should return status when not recording', async () => {
      mockRecordingManager.getStatus.mockReturnValue({
        isRecording: false,
        flacProcessActive: true,
      });

      const response = await request(app)
        .get('/api/recordings/status')
        .expect(200);

      expect(response.body.data).toEqual({
        isRecording: false,
        flacProcessActive: true,
      });
    });

    it('should return status when recording', async () => {
      mockRecordingManager.getStatus.mockReturnValue({
        isRecording: true,
        currentRecording: {
          id: 'rec-123',
          startedAt: new Date('2025-12-07T10:00:00Z'),
          durationSeconds: 60,
          fileSizeBytes: 512000,
          filePath: '2025-12/rec-test.flac',
        },
        flacProcessActive: true,
      });

      const response = await request(app)
        .get('/api/recordings/status')
        .expect(200);

      expect(response.body.data.isRecording).toBe(true);
      expect(response.body.data.currentRecording).toBeDefined();
    });
  });

  describe('GET /api/recordings', () => {
    it('should list recordings with default pagination', async () => {
      const mockRecordings = [
        {
          id: 'rec-1',
          filePath: '2025-12/rec-1.flac',
          status: 'completed',
          album: null,
          _count: { trackMarkers: 0 },
        },
      ];

      (prisma.recording.findMany as jest.Mock).mockResolvedValue(mockRecordings);
      (prisma.recording.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/api/recordings').expect(200);

      expect(response.body.data).toEqual(mockRecordings);
      expect(response.body.meta).toEqual({
        total: 1,
        limit: 20,
        offset: 0,
      });
    });

    it('should filter by albumId', async () => {
      (prisma.recording.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.recording.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/recordings')
        .query({ albumId: '550e8400-e29b-41d4-a716-446655440000' })
        .expect(200);

      expect(prisma.recording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { albumId: '550e8400-e29b-41d4-a716-446655440000' },
        })
      );
    });

    it('should filter by status', async () => {
      (prisma.recording.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.recording.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/recordings')
        .query({ status: 'completed' })
        .expect(200);

      expect(prisma.recording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'completed' },
        })
      );
    });
  });

  describe('GET /api/recordings/:id', () => {
    it('should return recording with details', async () => {
      const mockRecording = {
        id: 'rec-123',
        filePath: '2025-12/rec-test.flac',
        status: 'completed',
        durationSeconds: 180,
        album: { id: 'album-1', title: 'Test Album', artist: 'Artist', coverUrl: null },
        session: { id: 'session-1', startedAt: new Date().toISOString(), endedAt: null },
        trackMarkers: [
          { id: 'marker-1', trackNumber: 1, startOffset: 0, endOffset: 180 },
        ],
      };

      (prisma.recording.findUnique as jest.Mock).mockResolvedValue(mockRecording);

      const response = await request(app).get('/api/recordings/rec-123').expect(200);

      expect(response.body.data).toMatchObject({
        id: 'rec-123',
        status: 'completed',
        album: expect.objectContaining({ id: 'album-1' }),
      });
    });

    it('should return 404 if not found', async () => {
      (prisma.recording.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/recordings/nonexistent').expect(404);

      expect(response.body.error.code).toBe('RECORDING_NOT_FOUND');
    });
  });

  describe('PUT /api/recordings/:id', () => {
    it('should update recording', async () => {
      const existingRecording = { id: 'rec-123', fileName: 'old-name' };
      const updatedRecording = {
        id: 'rec-123',
        fileName: 'new-name',
        album: null,
      };

      (prisma.recording.findUnique as jest.Mock).mockResolvedValue(existingRecording);
      (prisma.recording.update as jest.Mock).mockResolvedValue(updatedRecording);

      const response = await request(app)
        .put('/api/recordings/rec-123')
        .send({ fileName: 'new-name' })
        .expect(200);

      expect(response.body.data.fileName).toBe('new-name');
    });

    it('should return 404 if not found', async () => {
      (prisma.recording.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/recordings/nonexistent')
        .send({ fileName: 'new' })
        .expect(404);

      expect(response.body.error.code).toBe('RECORDING_NOT_FOUND');
    });
  });

  describe('DELETE /api/recordings/:id', () => {
    it('should delete recording', async () => {
      const mockRecording = {
        id: 'rec-123',
        status: 'completed' as RecordingStatus,
      };

      (prisma.recording.findUnique as jest.Mock).mockResolvedValue(mockRecording);
      (prisma.recording.delete as jest.Mock).mockResolvedValue(mockRecording);

      const response = await request(app).delete('/api/recordings/rec-123').expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should not allow deleting active recording', async () => {
      const mockRecording = {
        id: 'rec-123',
        status: 'recording' as RecordingStatus,
      };

      (prisma.recording.findUnique as jest.Mock).mockResolvedValue(mockRecording);

      const response = await request(app).delete('/api/recordings/rec-123').expect(400);

      expect(response.body.error.code).toBe('RECORDING_IN_PROGRESS');
    });

    it('should return 404 if not found', async () => {
      (prisma.recording.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).delete('/api/recordings/nonexistent').expect(404);

      expect(response.body.error.code).toBe('RECORDING_NOT_FOUND');
    });
  });
});
