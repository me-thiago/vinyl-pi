import { AudioManager } from '../../services/audio-manager';
import { ChildProcess } from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn((cmd, callback) => {
    if (callback) callback(null, '', '');
    return { on: jest.fn() };
  })
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

  describe('Race Conditions & State Consistency (V1.5.1)', () => {
    let audioManager: AudioManager;
    let mockProcess: any;

    beforeEach(() => {
      audioManager = new AudioManager();

      mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn().mockReturnThis(),
        once: jest.fn().mockReturnThis(),
        kill: jest.fn(),
        killed: false
      };

      const mockArecord = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              // Usar setTimeout para garantir callback assíncrono
              setTimeout(() => callback(Buffer.from('card 1: Device [USB Audio Device]\n')), 0);
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            // Usar setTimeout para garantir callback assíncrono
            setTimeout(() => callback(0), 0);
          }
        })
      };

      mockSpawn.mockImplementation((cmd: string) => {
        if (cmd === 'arecord') return mockArecord;
        if (cmd === 'ffmpeg') return mockProcess;
        return mockArecord;
      });
    });

    describe('AC1: Estado Sempre Consistente', () => {
      test('stop() com SIGTERM graceful deve limpar estado completamente', async () => {
        await audioManager.start();
        expect(audioManager.getStatus().isCapturing).toBe(true);

        // Simular SIGTERM gracioso - processo termina imediatamente
        const exitHandler = mockProcess.once.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1];

        const stopPromise = audioManager.stop();

        // Simular que processo terminou graciosamente
        if (exitHandler) exitHandler(0, 'SIGTERM');

        await stopPromise;

        // Verificar estado limpo
        const status = audioManager.getStatus();
        expect(status.isCapturing).toBe(false);
        expect(audioManager.getStreamingStatus().active).toBe(false);
      });

      test('stop() com SIGKILL forçado deve limpar estado completamente', async () => {
        jest.useFakeTimers();

        await audioManager.start();
        expect(audioManager.getStatus().isCapturing).toBe(true);

        // Não chamar exitHandler para simular processo que não responde SIGTERM
        const stopPromise = audioManager.stop();

        // Avançar timeout de SIGTERM (5s)
        jest.advanceTimersByTime(5000);

        // Verificar que SIGKILL foi enviado
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

        // Avançar timeout de cleanup forçado (1s)
        jest.advanceTimersByTime(1000);

        await stopPromise;

        // Verificar estado limpo
        const status = audioManager.getStatus();
        expect(status.isCapturing).toBe(false);
        expect(audioManager.getStreamingStatus().active).toBe(false);

        jest.useRealTimers();
      });

      test('múltiplos stop() consecutivos não devem causar crash', async () => {
        await audioManager.start();

        const exitHandler = mockProcess.once.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1];

        // Chamar stop múltiplas vezes sem await
        const stop1 = audioManager.stop();
        const stop2 = audioManager.stop();
        const stop3 = audioManager.stop();

        // Simular término do processo
        if (exitHandler) exitHandler(0, 'SIGTERM');

        // Não deve lançar erro
        await expect(Promise.all([stop1, stop2, stop3])).resolves.not.toThrow();

        // Estado deve ser consistente
        expect(audioManager.getStatus().isCapturing).toBe(false);
      });
    });

    describe('AC2: Recuperação de Falhas', () => {
      test('start() após stop() com SIGKILL deve funcionar sem erro', async () => {
        jest.useFakeTimers();

        // Primeiro start
        await audioManager.start();

        // Stop com SIGKILL
        const stopPromise = audioManager.stop();
        jest.advanceTimersByTime(6000); // 5s + 1s
        await stopPromise;

        jest.useRealTimers();

        // Segundo start deve funcionar
        await expect(audioManager.start()).resolves.not.toThrow();
        expect(audioManager.getStatus().isCapturing).toBe(true);
      });

      test('getStreamingStatus() sempre reflete realidade do processo', async () => {
        // Estado inicial: não streaming
        expect(audioManager.getStreamingStatus().active).toBe(false);

        // Após start de streaming
        const config = {
          icecastHost: 'localhost',
          icecastPort: 8000,
          icecastPassword: 'test',
          mountPoint: '/stream',
          bitrate: 320,
          fallbackSilence: false
        };

        await audioManager.startStreaming(config);
        expect(audioManager.getStreamingStatus().active).toBe(true);

        // Após stop
        const exitHandler = mockProcess.once.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1];
        const stopPromise = audioManager.stopStreaming();
        if (exitHandler) exitHandler(0, 'SIGTERM');
        await stopPromise;

        expect(audioManager.getStreamingStatus().active).toBe(false);
      });
    });

    describe('AC3: Testes de Race Condition', () => {
      test('stop() + imediato start() deve funcionar sem erro', async () => {
        await audioManager.start();

        const exitHandler = mockProcess.once.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1];

        // Stop e start imediatos
        const stopPromise = audioManager.stop();
        if (exitHandler) exitHandler(0, 'SIGTERM');
        await stopPromise;

        // Start imediato após stop
        await expect(audioManager.start()).resolves.not.toThrow();
        expect(audioManager.getStatus().isCapturing).toBe(true);
      });

      test('múltiplos stop() paralelos não devem causar crash', async () => {
        await audioManager.start();

        const exitHandler = mockProcess.once.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1];

        // Múltiplos stop() paralelos
        const stops = [
          audioManager.stop(),
          audioManager.stop(),
          audioManager.stop()
        ];

        // Simular término
        if (exitHandler) exitHandler(0, 'SIGTERM');

        // Não deve lançar erro
        await expect(Promise.all(stops)).resolves.not.toThrow();
      });

      test('SIGKILL path deve manter estado consistente', async () => {
        jest.useFakeTimers();

        await audioManager.start();

        // Simular streaming ativo
        const config = {
          icecastHost: 'localhost',
          icecastPort: 8000,
          icecastPassword: 'test',
          mountPoint: '/stream',
          bitrate: 320,
          fallbackSilence: false
        };

        // Reiniciar para ter streaming
        let exitHandler = mockProcess.once.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1];
        const stopPromise1 = audioManager.stop();
        if (exitHandler) exitHandler(0, 'SIGTERM');
        await stopPromise1;

        jest.useRealTimers();
        await audioManager.startStreaming(config);
        jest.useFakeTimers();

        expect(audioManager.getStreamingStatus().active).toBe(true);

        // Stop com SIGKILL
        const stopPromise2 = audioManager.stopStreaming();
        jest.advanceTimersByTime(6000);
        await stopPromise2;

        // Verificar estado: isStreaming deve ser false
        expect(audioManager.getStreamingStatus().active).toBe(false);

        jest.useRealTimers();
      });
    });

    describe('AC4: Auto-Recovery em startStreaming()', () => {
      test('startStreaming() detecta estado inconsistente e auto-recover', async () => {
        // Criar estado inconsistente manualmente
        // Nota: Não podemos acessar propriedades privadas diretamente,
        // mas podemos simular o cenário via processo morto

        const config = {
          icecastHost: 'localhost',
          icecastPort: 8000,
          icecastPassword: 'test',
          mountPoint: '/stream',
          bitrate: 320,
          fallbackSilence: false
        };

        // Start streaming
        await audioManager.startStreaming(config);
        expect(audioManager.getStreamingStatus().active).toBe(true);

        // Simular processo morrendo inesperadamente (sem stop() controlado)
        // Fazendo processo ser null mas flag continuar true
        const exitHandler = mockProcess.on.mock.calls.find((call: any[]) => call[0] === 'exit')?.[1];

        // Marcar processo como killed para simular morte
        mockProcess.killed = true;

        // Simular exit inesperado com código de erro
        if (exitHandler) exitHandler(1, null);

        // Tentar startStreaming novamente - deve auto-recover
        await expect(audioManager.startStreaming(config)).resolves.not.toThrow();
      });
    });
  });
});
