import { AudioManager } from '../../services/audio-manager';
import { ChildProcess } from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

const mockSpawn = require('child_process').spawn;

describe('AudioManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor e Configuração', () => {
    test('deve criar instância com configuração padrão', () => {
      const audioManager = new AudioManager();
      const status = audioManager.getStatus();

      expect(status.device).toBe('plughw:1,0');
      expect(status.isCapturing).toBe(false);
      expect(status.error).toBeUndefined();
    });

    test('deve criar instância com configuração customizada', () => {
      const customConfig = {
        device: 'plughw:0,0',
        sampleRate: 44100,
        channels: 2,
        bitDepth: 16,
        bufferSize: 2048
      };

      const audioManager = new AudioManager(customConfig);
      const status = audioManager.getStatus();

      expect(status.device).toBe('plughw:0,0');
    });

    test('deve aceitar configuração parcial e usar defaults', () => {
      const audioManager = new AudioManager({
        device: 'plughw:2,0'
      });
      const status = audioManager.getStatus();

      expect(status.device).toBe('plughw:2,0');
    });

    test('deve validar buffer size mínimo (512)', () => {
      expect(() => {
        new AudioManager({ bufferSize: 256 });
      }).toThrow('Buffer size must be between 512 and 2048');
    });

    test('deve validar buffer size máximo (2048)', () => {
      expect(() => {
        new AudioManager({ bufferSize: 4096 });
      }).toThrow('Buffer size must be between 512 and 2048');
    });

    test('deve aceitar buffer size válido (1024)', () => {
      expect(() => {
        new AudioManager({ bufferSize: 1024 });
      }).not.toThrow();
    });
  });

  describe('Métodos de Controle', () => {
    let audioManager: AudioManager;
    let mockProcess: any;

    beforeEach(() => {
      audioManager = new AudioManager();

      // Mock do processo FFmpeg
      mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      // Mock arecord validation
      const mockArecord = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              // Simular output do arecord listando card 1
              setTimeout(() => callback(Buffer.from('card 1: Device [USB Audio Device]\n')), 0);
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            // Simular saída bem-sucedida com device disponível
            setTimeout(() => callback(0), 0);
          }
        })
      };

      mockSpawn.mockImplementation((cmd: string) => {
        if (cmd === 'arecord') {
          return mockArecord;
        }
        if (cmd === 'ffmpeg') {
          return mockProcess;
        }
        return mockArecord;
      });
    });

    test('getStatus deve retornar estado atual', () => {
      const status = audioManager.getStatus();

      expect(status).toHaveProperty('isCapturing');
      expect(status).toHaveProperty('device');
      expect(status.isCapturing).toBe(false);
    });

    test('start deve iniciar captura com comando FFmpeg correto', async () => {
      await audioManager.start();

      expect(mockSpawn).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-f', 'alsa',
          '-i', 'plughw:1,0',
          '-ar', '48000',
          '-ac', '2',
          '-f', 's16le',
          '-bufsize', '1024',
          '-'
        ]),
        expect.any(Object)
      );

      const status = audioManager.getStatus();
      expect(status.isCapturing).toBe(true);
    });

    test('start deve validar device ALSA antes de iniciar', async () => {
      await audioManager.start();

      // Verificar que arecord foi chamado para validação
      expect(mockSpawn).toHaveBeenCalledWith('arecord', ['-l']);
    });

    test('start não deve iniciar se já estiver capturando', async () => {
      await audioManager.start();
      const callCountBefore = mockSpawn.mock.calls.length;

      await audioManager.start(); // Segunda chamada

      // Não deve ter chamado spawn novamente
      expect(mockSpawn.mock.calls.length).toBe(callCountBefore);
    });

    test('stop deve parar captura graciosamente', async () => {
      await audioManager.start();

      // Simular que o processo vai terminar quando receber kill
      mockProcess.on.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1]();

      await audioManager.stop();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('restart deve parar e reiniciar captura', async () => {
      await audioManager.start();

      // Mock para simular término
      mockProcess.on.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1]();

      await audioManager.restart();

      // Deve ter chamado stop (kill) e depois start (spawn novamente)
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });

  describe('Event Emitters', () => {
    let audioManager: AudioManager;
    let mockProcess: any;

    beforeEach(() => {
      audioManager = new AudioManager();

      mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      const mockArecord = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('card 1: Device [USB Audio Device]\n')), 0);
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };

      mockSpawn.mockImplementation((cmd: string) => {
        if (cmd === 'arecord') return mockArecord;
        if (cmd === 'ffmpeg') return mockProcess;
        return mockArecord;
      });
    });

    test('deve emitir evento "started" quando captura iniciar', async () => {
      const startedHandler = jest.fn();
      audioManager.on('started', startedHandler);

      await audioManager.start();

      expect(startedHandler).toHaveBeenCalledWith({ device: 'plughw:1,0' });
    });

    test('deve emitir evento "stopped" quando captura parar', async () => {
      const stoppedHandler = jest.fn();
      audioManager.on('stopped', stoppedHandler);

      await audioManager.start();

      // Simular término do processo
      const exitHandler = mockProcess.on.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1];
      exitHandler();

      await audioManager.stop();

      expect(stoppedHandler).toHaveBeenCalled();
    });

    test('deve emitir evento "error" quando processo FFmpeg falhar', async () => {
      const errorHandler = jest.fn();
      audioManager.on('error', errorHandler);

      await audioManager.start();

      // Simular erro do processo
      const processErrorHandler = mockProcess.on.mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];

      const mockError = new Error('FFmpeg process error');
      processErrorHandler(mockError);

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Detecção de Erros de Dispositivo', () => {
    let audioManager: AudioManager;
    let mockProcess: any;

    beforeEach(() => {
      audioManager = new AudioManager();

      mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };

      const mockArecord = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('card 1: Device [USB Audio Device]\n')), 0);
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };

      mockSpawn.mockImplementation((cmd: string) => {
        if (cmd === 'arecord') return mockArecord;
        if (cmd === 'ffmpeg') return mockProcess;
        return mockArecord;
      });
    });

    test('deve detectar erro "No such file or directory"', async () => {
      const disconnectHandler = jest.fn();
      audioManager.on('device_disconnected', disconnectHandler);

      await audioManager.start();

      // Simular erro de dispositivo no stderr
      const stderrHandler = mockProcess.stderr.on.mock.calls.find(
        (call: any[]) => call[0] === 'data'
      )?.[1];

      stderrHandler(Buffer.from('No such file or directory'));

      expect(disconnectHandler).toHaveBeenCalled();
    });

    test('deve detectar erro "Device or resource busy"', async () => {
      const disconnectHandler = jest.fn();
      audioManager.on('device_disconnected', disconnectHandler);

      await audioManager.start();

      const stderrHandler = mockProcess.stderr.on.mock.calls.find(
        (call: any[]) => call[0] === 'data'
      )?.[1];

      stderrHandler(Buffer.from('Device or resource busy'));

      expect(disconnectHandler).toHaveBeenCalled();
    });
  });

  describe('Configurações de Sample Rate', () => {
    test('deve suportar 48kHz (padrão)', async () => {
      const audioManager = new AudioManager({ sampleRate: 48000 });

      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      const mockArecord = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('card 1: Device [USB Audio Device]\n')), 0);
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };

      mockSpawn.mockImplementation((cmd: string) => {
        if (cmd === 'arecord') return mockArecord;
        return mockProcess;
      });

      await audioManager.start();

      expect(mockSpawn).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-ar', '48000']),
        expect.any(Object)
      );
    });

    test('deve suportar 44.1kHz', async () => {
      const audioManager = new AudioManager({ sampleRate: 44100 });

      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };

      const mockArecord = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('card 1: Device [USB Audio Device]\n')), 0);
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };

      mockSpawn.mockImplementation((cmd: string) => {
        if (cmd === 'arecord') return mockArecord;
        return mockProcess;
      });

      await audioManager.start();

      expect(mockSpawn).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-ar', '44100']),
        expect.any(Object)
      );
    });
  });
});
