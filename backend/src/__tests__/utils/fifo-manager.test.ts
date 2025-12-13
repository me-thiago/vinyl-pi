import { FifoManager } from '../../utils/fifo-manager';

// Mock the entire module dependencies at the top level
// This avoids issues with spying on native modules
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    unlink: jest.fn((path, callback) => callback(null)),
    access: jest.fn((path, modeOrCallback, callback) => {
      const cb = callback ?? modeOrCallback;
      cb(new Error('ENOENT'));
    }),
  };
});

jest.mock('child_process', () => {
  const actualCp = jest.requireActual('child_process');
  return {
    ...actualCp,
    exec: jest.fn((cmd, callback) => {
      if (callback) callback(null, '', '');
      return {};
    }),
  };
});

// Import mocked modules after jest.mock
import * as fs from 'fs';
import * as childProcess from 'child_process';

const mockUnlink = fs.unlink as unknown as jest.Mock;
const mockAccess = fs.access as unknown as jest.Mock;
const mockExec = childProcess.exec as unknown as jest.Mock;

describe('FifoManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default implementations
    mockUnlink.mockImplementation((path, callback) => callback(null));
    mockAccess.mockImplementation((path, modeOrCallback, callback) => {
      const cb = callback ?? modeOrCallback;
      cb(new Error('ENOENT'));
    });
    mockExec.mockImplementation((cmd, callback) => {
      if (callback) callback(null, '', '');
      return {};
    });
  });

  describe('constructor', () => {
    it('should create FifoManager instance', () => {
      const manager = new FifoManager();
      expect(manager).toBeDefined();
    });
  });

  describe('create()', () => {
    it('should create multiple FIFOs', async () => {
      const manager = new FifoManager();
      const paths = ['/tmp/fifo1', '/tmp/fifo2', '/tmp/fifo3'];

      await manager.create(paths);

      // Each FIFO should have mkfifo and chmod called
      expect(mockExec).toHaveBeenCalledTimes(6); // 2 calls per FIFO
      expect(mockExec).toHaveBeenCalledWith('mkfifo /tmp/fifo1', expect.any(Function));
      expect(mockExec).toHaveBeenCalledWith('chmod 666 /tmp/fifo1', expect.any(Function));
    });

    it('should remove existing FIFO before creating', async () => {
      // Make access succeed (FIFO exists)
      mockAccess.mockImplementation((path, modeOrCallback, callback) => {
        const cb = callback ?? modeOrCallback;
        cb(null); // File exists
      });

      const manager = new FifoManager();
      await manager.create(['/tmp/existing-fifo']);

      // Should call unlink to remove existing
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/existing-fifo', expect.any(Function));
      // Then create new one
      expect(mockExec).toHaveBeenCalledWith('mkfifo /tmp/existing-fifo', expect.any(Function));
    });

    it('should not try to remove non-existing FIFO', async () => {
      const manager = new FifoManager();
      await manager.create(['/tmp/new-fifo']);

      // Should not call unlink
      expect(mockUnlink).not.toHaveBeenCalled();
      // Should create new one
      expect(mockExec).toHaveBeenCalledWith('mkfifo /tmp/new-fifo', expect.any(Function));
    });

    it('should throw error on mkfifo failure', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        if (callback) {
          if (cmd.startsWith('mkfifo')) {
            callback(new Error('Permission denied'), '', '');
          } else {
            callback(null, '', '');
          }
        }
        return {};
      });

      const manager = new FifoManager();

      await expect(manager.create(['/tmp/fail-fifo'])).rejects.toThrow(
        'Failed to create FIFO /tmp/fail-fifo: Permission denied'
      );
    });

    it('should handle empty array', async () => {
      const manager = new FifoManager();
      await manager.create([]);

      expect(mockExec).not.toHaveBeenCalled();
    });
  });

  describe('createSingle()', () => {
    it('should create a single FIFO', async () => {
      const manager = new FifoManager();
      await manager.createSingle('/tmp/single-fifo');

      expect(mockExec).toHaveBeenCalledWith('mkfifo /tmp/single-fifo', expect.any(Function));
      expect(mockExec).toHaveBeenCalledWith('chmod 666 /tmp/single-fifo', expect.any(Function));
    });
  });

  describe('cleanup()', () => {
    it('should remove multiple FIFOs', async () => {
      const manager = new FifoManager();
      const paths = ['/tmp/fifo1', '/tmp/fifo2'];

      await manager.cleanup(paths);

      expect(mockUnlink).toHaveBeenCalledTimes(2);
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/fifo1', expect.any(Function));
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/fifo2', expect.any(Function));
    });

    it('should silently ignore non-existing FIFOs', async () => {
      mockUnlink.mockImplementation((path, callback) => callback(new Error('ENOENT')));

      const manager = new FifoManager();

      // Should not throw
      await expect(manager.cleanup(['/tmp/non-existent'])).resolves.toBeUndefined();
    });

    it('should handle empty array', async () => {
      const manager = new FifoManager();
      await manager.cleanup([]);

      expect(mockUnlink).not.toHaveBeenCalled();
    });
  });

  describe('cleanupSingle()', () => {
    it('should remove a single FIFO', async () => {
      const manager = new FifoManager();
      await manager.cleanupSingle('/tmp/single-fifo');

      expect(mockUnlink).toHaveBeenCalledWith('/tmp/single-fifo', expect.any(Function));
    });

    it('should silently ignore errors', async () => {
      mockUnlink.mockImplementation((path, callback) => callback(new Error('Any error')));

      const manager = new FifoManager();

      await expect(manager.cleanupSingle('/tmp/any-fifo')).resolves.toBeUndefined();
    });
  });

  describe('exists()', () => {
    it('should return true when FIFO exists', async () => {
      mockAccess.mockImplementation((path, modeOrCallback, callback) => {
        const cb = callback ?? modeOrCallback;
        cb(null);
      });

      const manager = new FifoManager();
      const result = await manager.exists('/tmp/existing-fifo');

      expect(result).toBe(true);
    });

    it('should return false when FIFO does not exist', async () => {
      const manager = new FifoManager();
      const result = await manager.exists('/tmp/non-existing-fifo');

      expect(result).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full lifecycle: create -> use -> cleanup', async () => {
      const manager = new FifoManager();
      const paths = ['/tmp/vinyl-audio.fifo', '/tmp/vinyl-recognition.fifo'];

      // Create
      await manager.create(paths);
      expect(mockExec).toHaveBeenCalledTimes(4); // 2 mkfifo + 2 chmod

      // Check exists
      mockAccess.mockImplementation((path, modeOrCallback, callback) => {
        const cb = callback ?? modeOrCallback;
        cb(null);
      });
      expect(await manager.exists(paths[0])).toBe(true);
      expect(await manager.exists(paths[1])).toBe(true);

      // Cleanup
      await manager.cleanup(paths);
      expect(mockUnlink).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent create calls', async () => {
      const manager = new FifoManager();

      await Promise.all([
        manager.createSingle('/tmp/fifo1'),
        manager.createSingle('/tmp/fifo2'),
        manager.createSingle('/tmp/fifo3'),
      ]);

      expect(mockExec).toHaveBeenCalledTimes(6); // 3 mkfifo + 3 chmod
    });

    it('should handle concurrent cleanup calls', async () => {
      const manager = new FifoManager();

      await Promise.all([
        manager.cleanupSingle('/tmp/fifo1'),
        manager.cleanupSingle('/tmp/fifo2'),
        manager.cleanupSingle('/tmp/fifo3'),
      ]);

      expect(mockUnlink).toHaveBeenCalledTimes(3);
    });
  });
});

// Note: We can't test the singleton export in this file because the module
// is already loaded with the mocked fs/child_process. The singleton is
// created at module load time with real dependencies.
