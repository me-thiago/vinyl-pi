import { EventEmitter } from 'events';
import { Readable } from 'stream';

// Mock child_process before importing the module
const mockSpawn = jest.fn();
const mockExecAsync = jest.fn();

jest.mock('child_process', () => ({
  spawn: mockSpawn,
  exec: jest.fn((cmd, callback) => {
    mockExecAsync(cmd);
    callback(null, '', '');
  }),
}));

import { FFmpegProcessManager } from '../../utils/ffmpeg-process';

// Helper to create a mock ChildProcess
function createMockProcess() {
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });

  // Create EventEmitter as base
  const emitter = new EventEmitter();

  // Create mock process with basic properties
  const mockProcess = Object.assign(emitter, {
    pid: 12345,
    _killed: false,
    stdout,
    stderr,
    kill: jest.fn(),
  }) as EventEmitter & {
    pid: number;
    _killed: boolean;
    stdout: Readable;
    stderr: Readable;
    kill: jest.Mock;
    killed: boolean;
  };

  // Define 'killed' as a getter (Object.assign doesn't copy getters properly)
  Object.defineProperty(mockProcess, 'killed', {
    get() {
      return mockProcess._killed;
    },
    configurable: true,
    enumerable: true,
  });

  // Set up kill implementation
  mockProcess.kill.mockImplementation((signal?: string) => {
    if (signal === 'SIGTERM' || signal === 'SIGKILL' || signal === undefined) {
      mockProcess._killed = true;
      // Emit exit after a short delay to simulate real behavior
      setImmediate(() => mockProcess.emit('exit', 0, signal as NodeJS.Signals));
    }
    return true;
  });

  return mockProcess;
}

describe('FFmpegProcessManager', () => {
  let mockProcess: ReturnType<typeof createMockProcess>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create manager with required config', () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-f', 'alsa', '-i', 'test'],
      });

      expect(manager).toBeDefined();
      expect(manager.isRunning()).toBe(false);
    });

    it('should use default values for optional config', () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      expect(manager).toBeDefined();
    });
  });

  describe('start()', () => {
    it('should spawn FFmpeg process', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-f', 'alsa', '-i', 'plughw:1,0'],
      });

      await manager.start();

      expect(mockSpawn).toHaveBeenCalledWith(
        'ffmpeg',
        ['-f', 'alsa', '-i', 'plughw:1,0'],
        expect.objectContaining({ stdio: expect.any(Array) })
      );
      expect(manager.isRunning()).toBe(true);
    });

    it('should not start if already running', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();
      await manager.start(); // Should not spawn again

      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should call onStdout handler when data arrives', async () => {
      const onStdout = jest.fn();
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
        onStdout,
      });

      await manager.start();

      const testData = Buffer.from('audio data');
      mockProcess.stdout.emit('data', testData);

      expect(onStdout).toHaveBeenCalledWith(testData);
    });

    it('should call onStderr handler when data arrives', async () => {
      const onStderr = jest.fn();
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
        onStderr,
      });

      await manager.start();

      const testMessage = Buffer.from('FFmpeg error message');
      mockProcess.stderr.emit('data', testMessage);

      expect(onStderr).toHaveBeenCalledWith('FFmpeg error message');
    });

    it('should call onExit handler when process exits', async () => {
      const onExit = jest.fn();
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
        onExit,
      });

      await manager.start();

      mockProcess.emit('exit', 0, null);

      expect(onExit).toHaveBeenCalledWith(0, null);
    });

    it('should call onError handler when process errors', async () => {
      const onError = jest.fn();
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
        onError,
      });

      await manager.start();

      const testError = new Error('Process failed');
      mockProcess.emit('error', testError);

      expect(onError).toHaveBeenCalledWith(testError);
    });
  });

  describe('stop()', () => {
    it('should send SIGTERM to process', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();
      await manager.stop();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should not throw if not running', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await expect(manager.stop()).resolves.toBeUndefined();
    });

    it('should set isRunning to false after stop', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();
      expect(manager.isRunning()).toBe(true);

      await manager.stop();
      expect(manager.isRunning()).toBe(false);
    });

    it('should handle concurrent stop calls', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();

      // Call stop multiple times concurrently
      await Promise.all([manager.stop(), manager.stop(), manager.stop()]);

      // Should only have killed once
      expect(mockProcess.kill).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop() with useForceKill', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should use force kill when useForceKill is true and process does not respond', async () => {
      // Create a process that doesn't respond to signals
      const stubProcess = createMockProcess();
      stubProcess.kill = jest.fn().mockImplementation(() => {
        // Process doesn't actually die
        return true;
      });
      mockSpawn.mockReturnValue(stubProcess);

      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
        useForceKill: true,
        stopTimeoutMs: 100,
        forceKillDelayMs: 50,
      });

      await manager.start();

      const stopPromise = manager.stop();

      // Advance timers to trigger SIGKILL
      jest.advanceTimersByTime(100);

      // Advance timers to trigger force kill
      jest.advanceTimersByTime(50);

      await stopPromise;

      expect(stubProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(stubProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(mockExecAsync).toHaveBeenCalledWith('kill -9 12345');
    });

    it('should not force kill when useForceKill is false', async () => {
      // Create a process that responds to SIGKILL but not SIGTERM
      const stubProcess = createMockProcess();
      stubProcess.kill = jest.fn().mockImplementation(function (
        this: typeof stubProcess,
        signal
      ) {
        if (signal === 'SIGKILL') {
          this._killed = true;
          setImmediate(() => stubProcess.emit('exit', 0, 'SIGKILL'));
        }
        return true;
      });
      mockSpawn.mockReturnValue(stubProcess);

      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
        useForceKill: false,
        stopTimeoutMs: 100,
      });

      await manager.start();

      const stopPromise = manager.stop();

      // Advance to SIGKILL
      jest.advanceTimersByTime(100);

      // Run any pending microtasks
      await Promise.resolve();

      // Advance a bit more
      jest.advanceTimersByTime(200);

      await stopPromise;

      expect(mockExecAsync).not.toHaveBeenCalled();
    });
  });

  describe('getProcess()', () => {
    it('should return null when not started', () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      expect(manager.getProcess()).toBeNull();
    });

    it('should return process after start', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();

      expect(manager.getProcess()).toBe(mockProcess);
    });
  });

  describe('getStdout()', () => {
    it('should return null when not started', () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      expect(manager.getStdout()).toBeNull();
    });

    it('should return stdout after start', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();

      expect(manager.getStdout()).toBe(mockProcess.stdout);
    });
  });

  describe('getPid()', () => {
    it('should return undefined when not started', () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      expect(manager.getPid()).toBeUndefined();
    });

    it('should return PID after start', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();

      expect(manager.getPid()).toBe(12345);
    });
  });

  describe('isRunning()', () => {
    it('should return false initially', () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      expect(manager.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();

      expect(manager.isRunning()).toBe(true);
    });

    it('should return false after stop', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();
      await manager.stop();

      expect(manager.isRunning()).toBe(false);
    });

    it('should return false when process killed externally', async () => {
      // Create a process that can be "externally killed"
      const killableProcess = createMockProcess();
      mockSpawn.mockReturnValue(killableProcess);

      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
      });

      await manager.start();
      expect(manager.isRunning()).toBe(true);

      // Simulate external kill by calling kill directly
      killableProcess.kill('SIGKILL');

      // After external kill, isRunning should be false
      expect(manager.isRunning()).toBe(false);
    });
  });

  describe('custom stdio configuration', () => {
    it('should use custom stdio config', async () => {
      const manager = new FFmpegProcessManager({
        name: 'Test',
        args: ['-i', 'test'],
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      await manager.start();

      expect(mockSpawn).toHaveBeenCalledWith(
        'ffmpeg',
        expect.any(Array),
        expect.objectContaining({
          stdio: ['ignore', 'ignore', 'pipe'],
        })
      );
    });
  });
});
