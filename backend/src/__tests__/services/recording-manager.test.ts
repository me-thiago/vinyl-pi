import { RecordingManager, RecordingConfig } from '../../services/recording-manager';
import { ChildProcess } from 'child_process';

// Mock modules first (hoisted)
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined as void),
  stat: jest.fn().mockResolvedValue({ size: 1024000 }),
  access: jest.fn().mockResolvedValue(undefined as void),
  unlink: jest.fn().mockResolvedValue(undefined as void),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  default: {
    recording: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// Import mocked modules after mock definitions
import { spawn } from 'child_process';
import prisma from '../../prisma/client';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockPrismaCreate = prisma.recording.create as jest.Mock;
const mockPrismaUpdate = prisma.recording.update as jest.Mock;

describe('RecordingManager', () => {
  let recordingManager: RecordingManager;
  let mockConfig: RecordingConfig;
  let mockProcess: Partial<ChildProcess>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      flacFifoPath: '/tmp/vinyl-flac.fifo',
      recordingsPath: './data/recordings',
      sampleRate: 48000,
      channels: 2,
      compressionLevel: 5,
    };

    // Mock child process
    mockProcess = {
      pid: 12345,
      killed: false,
      kill: jest.fn(() => true),
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'exit') {
          // Simular saída imediata do processo
          setTimeout(() => handler(0, null), 10);
        }
        return mockProcess as ChildProcess;
      }),
      once: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'exit') {
          setTimeout(() => handler(0, null), 10);
        }
        return mockProcess as ChildProcess;
      }),
      stderr: {
        on: jest.fn(),
      },
    } as unknown as Partial<ChildProcess>;

    mockSpawn.mockReturnValue(mockProcess as ChildProcess);

    recordingManager = new RecordingManager(mockConfig);
  });

  afterEach(async () => {
    await recordingManager.destroy();
    // Limpar timers pendentes
    jest.useRealTimers();
  });

  afterAll(() => {
    // Garantir cleanup final
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(recordingManager).toBeDefined();
      const status = recordingManager.getStatus();
      expect(status.isRecording).toBe(false);
      expect(status.drainActive).toBe(false);
    });

    it('should use default compression level if not provided', () => {
      const configWithoutCompression = { ...mockConfig };
      delete (configWithoutCompression as Partial<RecordingConfig>).compressionLevel;
      const manager = new RecordingManager(configWithoutCompression as RecordingConfig);
      expect(manager).toBeDefined();
    });
  });

  describe('startDrain', () => {
    it('should start drain process', async () => {
      await recordingManager.startDrain();

      expect(mockSpawn).toHaveBeenCalledWith(
        'dd',
        expect.arrayContaining([
          `if=${mockConfig.flacFifoPath}`,
          'of=/dev/null',
          'bs=4k',
        ]),
        expect.any(Object)
      );

      const status = recordingManager.getStatus();
      expect(status.drainActive).toBe(true);
    });

    it('should not start drain if already active', async () => {
      await recordingManager.startDrain();
      await recordingManager.startDrain();

      // spawn should only be called once
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopDrain', () => {
    it('should stop drain process', async () => {
      await recordingManager.startDrain();
      await recordingManager.stopDrain();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should do nothing if drain not active', async () => {
      await recordingManager.stopDrain();
      // Should not throw
    });
  });

  describe('startRecording', () => {
    const mockRecording = {
      id: 'test-uuid',
      albumId: null,
      sessionId: null,
      filePath: '2025-12/test.flac',
      fileName: 'test',
      format: 'flac',
      sampleRate: 48000,
      bitDepth: 16,
      channels: 2,
      status: 'recording' as const,
      startedAt: new Date(),
      completedAt: null,
      durationSeconds: null,
      fileSizeBytes: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockPrismaCreate.mockResolvedValue(mockRecording);
    });

    it('should start recording successfully', async () => {
      const result = await recordingManager.startRecording();

      expect(result.id).toBe('test-uuid');
      expect(result.status).toBe('recording');
      expect(mockSpawn).toHaveBeenCalled();

      const status = recordingManager.getStatus();
      expect(status.isRecording).toBe(true);
      expect(status.currentRecording).toBeDefined();
    });

    it('should accept albumId option', async () => {
      const albumId = 'album-uuid';
      await recordingManager.startRecording({ albumId });

      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            albumId,
          }),
        })
      );
    });

    it('should accept custom fileName', async () => {
      const fileName = 'My Recording';
      await recordingManager.startRecording({ fileName });

      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileName,
          }),
        })
      );
    });

    it('should throw if already recording', async () => {
      await recordingManager.startRecording();

      await expect(recordingManager.startRecording()).rejects.toThrow(
        'Gravação já em andamento'
      );
    });

    it('should stop drain before starting recording', async () => {
      await recordingManager.startDrain();
      const initialDrain = recordingManager.getStatus().drainActive;
      expect(initialDrain).toBe(true);

      await recordingManager.startRecording();

      // Drain should be stopped
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('stopRecording', () => {
    const mockRecordingCreated = {
      id: 'test-uuid',
      albumId: null,
      sessionId: null,
      filePath: '2025-12/test.flac',
      fileName: 'test',
      format: 'flac',
      sampleRate: 48000,
      bitDepth: 16,
      channels: 2,
      status: 'recording' as const,
      startedAt: new Date(),
      completedAt: null,
      durationSeconds: null,
      fileSizeBytes: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockRecordingCompleted = {
      ...mockRecordingCreated,
      status: 'completed' as const,
      durationSeconds: 60,
      fileSizeBytes: 1024000,
      completedAt: new Date(),
    };

    beforeEach(() => {
      mockPrismaCreate.mockResolvedValue(mockRecordingCreated);
      mockPrismaUpdate.mockResolvedValue(mockRecordingCompleted);
    });

    it('should stop recording and return updated recording', async () => {
      await recordingManager.startRecording();
      const result = await recordingManager.stopRecording();

      expect(result.status).toBe('completed');
      expect(result.durationSeconds).toBeGreaterThanOrEqual(0);

      const status = recordingManager.getStatus();
      expect(status.isRecording).toBe(false);
    });

    it('should throw if not recording', async () => {
      await expect(recordingManager.stopRecording()).rejects.toThrow(
        'Nenhuma gravação em andamento'
      );
    });

    it('should restart drain after stopping', async () => {
      await recordingManager.startRecording();
      mockSpawn.mockClear();

      await recordingManager.stopRecording();

      // Drain should be started again
      expect(mockSpawn).toHaveBeenCalledWith(
        'dd',
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('getStatus', () => {
    it('should return correct status when not recording', () => {
      const status = recordingManager.getStatus();

      expect(status.isRecording).toBe(false);
      expect(status.drainActive).toBe(false);
      expect(status.currentRecording).toBeUndefined();
    });

    it('should return correct status when recording', async () => {
      mockPrismaCreate.mockResolvedValue({
        id: 'test-uuid',
        status: 'recording',
        startedAt: new Date(),
        filePath: '2025-12/test.flac',
      });

      await recordingManager.startRecording();
      const status = recordingManager.getStatus();

      expect(status.isRecording).toBe(true);
      expect(status.currentRecording).toBeDefined();
      // ID é gerado pelo RecordingManager via crypto.randomUUID(), não pelo mock
      expect(status.currentRecording?.id).toBeDefined();
      expect(typeof status.currentRecording?.id).toBe('string');
    });
  });

  describe('getIsRecording', () => {
    it('should return false when not recording', () => {
      expect(recordingManager.getIsRecording()).toBe(false);
    });

    it('should return true when recording', async () => {
      mockPrismaCreate.mockResolvedValue({
        id: 'test-uuid',
        status: 'recording',
        startedAt: new Date(),
        filePath: '2025-12/test.flac',
      });

      await recordingManager.startRecording();
      expect(recordingManager.getIsRecording()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should stop recording if active', async () => {
      mockPrismaCreate.mockResolvedValue({
        id: 'test-uuid',
        status: 'recording',
        startedAt: new Date(),
        filePath: '2025-12/test.flac',
      });
      mockPrismaUpdate.mockResolvedValue({
        id: 'test-uuid',
        status: 'completed',
        durationSeconds: 10,
        fileSizeBytes: 1024,
      });

      await recordingManager.startRecording();
      await recordingManager.destroy();

      expect(recordingManager.getIsRecording()).toBe(false);
    });

    it('should stop drain if active', async () => {
      await recordingManager.startDrain();
      await recordingManager.destroy();

      expect(recordingManager.getStatus().drainActive).toBe(false);
    });
  });

  describe('events', () => {
    it('should emit recording_started event', async () => {
      const listener = jest.fn();
      recordingManager.on('recording_started', listener);

      mockPrismaCreate.mockResolvedValue({
        id: 'test-uuid',
        status: 'recording',
        startedAt: new Date(),
        filePath: '2025-12/test.flac',
      });

      await recordingManager.startRecording();

      expect(listener).toHaveBeenCalled();
    });

    it('should emit recording_stopped event', async () => {
      const listener = jest.fn();
      recordingManager.on('recording_stopped', listener);

      mockPrismaCreate.mockResolvedValue({
        id: 'test-uuid',
        status: 'recording',
        startedAt: new Date(),
        filePath: '2025-12/test.flac',
      });
      mockPrismaUpdate.mockResolvedValue({
        id: 'test-uuid',
        status: 'completed',
        durationSeconds: 10,
        fileSizeBytes: 1024,
      });

      await recordingManager.startRecording();
      await recordingManager.stopRecording();

      expect(listener).toHaveBeenCalled();
    });
  });
});
