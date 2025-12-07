import { RecordingManager, RecordingConfig } from '../../services/recording-manager';
import { ChildProcess } from 'child_process';
import { WriteStream } from 'fs';

// Mock modules first (hoisted)
jest.mock('fs', () => ({
  access: jest.fn((path, cb) => cb(null)),
  createWriteStream: jest.fn(() => ({
    write: jest.fn(() => true),
    end: jest.fn((cb) => cb && cb()),
    destroy: jest.fn(),
    destroyed: false,
    on: jest.fn(),
  })),
}));

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
  let mockStdout: { on: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      flacFifoPath: '/tmp/vinyl-flac.fifo',
      recordingsPath: './data/recordings',
      sampleRate: 48000,
      channels: 2,
      compressionLevel: 5,
    };

    // Mock stdout for data events
    mockStdout = {
      on: jest.fn((event: string, handler: (data: Buffer) => void) => {
        // Simular alguns dados FLAC
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('fake-flac-data')), 10);
        }
        return mockStdout;
      }),
    };

    // Mock child process
    mockProcess = {
      pid: 12345,
      killed: false,
      kill: jest.fn(() => true),
      stdout: mockStdout as unknown as NodeJS.ReadableStream,
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
    jest.useRealTimers();
  });

  afterAll(() => {
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(recordingManager).toBeDefined();
      const status = recordingManager.getStatus();
      expect(status.isRecording).toBe(false);
      expect(status.flacProcessActive).toBe(false);
    });

    it('should use default compression level if not provided', () => {
      const configWithoutCompression = { ...mockConfig };
      delete (configWithoutCompression as Partial<RecordingConfig>).compressionLevel;
      const manager = new RecordingManager(configWithoutCompression as RecordingConfig);
      expect(manager).toBeDefined();
    });
  });

  describe('startFlacProcess', () => {
    it('should start FFmpeg #4 FLAC process', async () => {
      await recordingManager.startFlacProcess();

      expect(mockSpawn).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-i', mockConfig.flacFifoPath,
          '-c:a', 'flac',
          'pipe:1',
        ]),
        expect.any(Object)
      );

      const status = recordingManager.getStatus();
      expect(status.flacProcessActive).toBe(true);
    });

    it('should not start if already active', async () => {
      await recordingManager.startFlacProcess();
      await recordingManager.startFlacProcess();

      // spawn should only be called once
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopFlacProcess', () => {
    it('should stop FFmpeg #4 process', async () => {
      await recordingManager.startFlacProcess();
      await recordingManager.stopFlacProcess();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should do nothing if not active', async () => {
      await recordingManager.stopFlacProcess();
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

    beforeEach(async () => {
      mockPrismaCreate.mockResolvedValue(mockRecording);
      // Start FLAC process first (required for recording)
      await recordingManager.startFlacProcess();
    });

    it('should start recording successfully', async () => {
      const result = await recordingManager.startRecording();

      expect(result.status).toBe('recording');
      expect(mockPrismaCreate).toHaveBeenCalled();

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

    it('should throw if FLAC process not active', async () => {
      await recordingManager.stopFlacProcess();

      await expect(recordingManager.startRecording()).rejects.toThrow(
        'FFmpeg FLAC não está ativo'
      );
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

    beforeEach(async () => {
      mockPrismaCreate.mockResolvedValue(mockRecordingCreated);
      mockPrismaUpdate.mockResolvedValue(mockRecordingCompleted);
      await recordingManager.startFlacProcess();
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

    it('should NOT stop FLAC process after stopping recording', async () => {
      await recordingManager.startRecording();
      mockSpawn.mockClear();

      await recordingManager.stopRecording();

      // FLAC process should still be active (consistent with FFmpeg #3)
      const status = recordingManager.getStatus();
      expect(status.flacProcessActive).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return correct status when not recording', () => {
      const status = recordingManager.getStatus();

      expect(status.isRecording).toBe(false);
      expect(status.flacProcessActive).toBe(false);
      expect(status.currentRecording).toBeUndefined();
    });

    it('should return correct status when FLAC process active', async () => {
      await recordingManager.startFlacProcess();
      const status = recordingManager.getStatus();

      expect(status.isRecording).toBe(false);
      expect(status.flacProcessActive).toBe(true);
    });

    it('should return correct status when recording', async () => {
      mockPrismaCreate.mockResolvedValue({
        id: 'test-uuid',
        status: 'recording',
        startedAt: new Date(),
        filePath: '2025-12/test.flac',
      });

      await recordingManager.startFlacProcess();
      await recordingManager.startRecording();
      const status = recordingManager.getStatus();

      expect(status.isRecording).toBe(true);
      expect(status.flacProcessActive).toBe(true);
      expect(status.currentRecording).toBeDefined();
      expect(status.currentRecording?.id).toBeDefined();
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

      await recordingManager.startFlacProcess();
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

      await recordingManager.startFlacProcess();
      await recordingManager.startRecording();
      await recordingManager.destroy();

      expect(recordingManager.getIsRecording()).toBe(false);
    });

    it('should stop FLAC process if active', async () => {
      await recordingManager.startFlacProcess();
      await recordingManager.destroy();

      expect(recordingManager.getStatus().flacProcessActive).toBe(false);
    });
  });

  describe('legacy methods (backwards compatibility)', () => {
    it('startDrain should call startFlacProcess', async () => {
      await recordingManager.startDrain();

      expect(mockSpawn).toHaveBeenCalledWith(
        'ffmpeg',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('stopDrain should call stopFlacProcess', async () => {
      await recordingManager.startFlacProcess();
      await recordingManager.stopDrain();

      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });

  describe('events', () => {
    beforeEach(async () => {
      await recordingManager.startFlacProcess();
    });

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
