import { AudioAnalyzer, AudioAnalyzerConfig, AudioAnalysisData } from '../../services/audio-analyzer';
import { eventBus } from '../../utils/event-bus';

// Mock do EventBus
jest.mock('../../utils/event-bus', () => ({
  eventBus: {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    clearAllListeners: jest.fn()
  }
}));

describe('AudioAnalyzer', () => {
  let analyzer: AudioAnalyzer;
  const mockPublish = eventBus.publish as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new AudioAnalyzer({
      sampleRate: 48000,
      channels: 2,
      bufferSize: 512,  // Menor para testes
      publishIntervalMs: 50
    });
  });

  afterEach(() => {
    analyzer.stop();
  });

  describe('Initialization', () => {
    it('should create with default config', () => {
      const defaultAnalyzer = new AudioAnalyzer();
      const config = defaultAnalyzer.getConfig();
      
      expect(config.sampleRate).toBe(48000);
      expect(config.channels).toBe(2);
      expect(config.bufferSize).toBe(2048);
      expect(config.publishIntervalMs).toBe(100);
      
      defaultAnalyzer.stop();
    });

    it('should create with custom config', () => {
      const config = analyzer.getConfig();
      
      expect(config.sampleRate).toBe(48000);
      expect(config.channels).toBe(2);
      expect(config.bufferSize).toBe(512);
      expect(config.publishIntervalMs).toBe(50);
    });

    it('should not be active initially', () => {
      expect(analyzer.isActive()).toBe(false);
    });

    it('should have default level of -100dB', () => {
      expect(analyzer.getCurrentLevelDb()).toBe(-100);
    });
  });

  describe('Start/Stop', () => {
    it('should start analyzer', () => {
      analyzer.start();
      expect(analyzer.isActive()).toBe(true);
    });

    it('should stop analyzer', () => {
      analyzer.start();
      analyzer.stop();
      expect(analyzer.isActive()).toBe(false);
    });

    it('should handle multiple start calls gracefully', () => {
      analyzer.start();
      analyzer.start(); // Should not throw
      expect(analyzer.isActive()).toBe(true);
    });

    it('should handle multiple stop calls gracefully', () => {
      analyzer.start();
      analyzer.stop();
      analyzer.stop(); // Should not throw
      expect(analyzer.isActive()).toBe(false);
    });
  });

  describe('PCM Analysis', () => {
    /**
     * Creates a PCM buffer with a sine wave
     * @param frequency Frequency in Hz
     * @param amplitude Amplitude 0-1 (1 = full scale)
     * @param sampleRate Sample rate in Hz
     * @param durationMs Duration in milliseconds
     * @param channels Number of channels
     */
    function createSineWaveBuffer(
      frequency: number,
      amplitude: number,
      sampleRate: number,
      durationMs: number,
      channels: number
    ): Buffer {
      const samples = Math.floor((sampleRate * durationMs) / 1000);
      const buffer = Buffer.alloc(samples * channels * 2); // 2 bytes per sample (s16le)
      
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const value = Math.sin(2 * Math.PI * frequency * t) * amplitude * 32767;
        const sample = Math.round(value);
        
        for (let ch = 0; ch < channels; ch++) {
          const offset = (i * channels + ch) * 2;
          buffer.writeInt16LE(sample, offset);
        }
      }
      
      return buffer;
    }

    /**
     * Creates a silent PCM buffer
     */
    function createSilentBuffer(samples: number, channels: number): Buffer {
      return Buffer.alloc(samples * channels * 2);
    }

    it('should analyze silence and get very low level', async () => {
      analyzer.start();
      
      // Create multiple silent buffers to fill the analysis buffer
      const silentBuffer = createSilentBuffer(1024, 2);
      
      for (let i = 0; i < 10; i++) {
        analyzer.analyze(silentBuffer);
      }
      
      // Wait for publish interval
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Level should be very low (close to -100dB)
      const level = analyzer.getCurrentLevelDb();
      expect(level).toBeLessThan(-80);
    });

    it('should analyze loud signal and get high level', async () => {
      analyzer.start();
      
      // Create a loud 1kHz sine wave (amplitude 0.9 = ~-1dB)
      const loudBuffer = createSineWaveBuffer(1000, 0.9, 48000, 50, 2);
      
      for (let i = 0; i < 10; i++) {
        analyzer.analyze(loudBuffer);
      }
      
      // Wait for analysis
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Level should be high (close to 0dB)
      const level = analyzer.getCurrentLevelDb();
      expect(level).toBeGreaterThan(-10);
    });

    it('should analyze medium signal correctly', async () => {
      analyzer.start();
      
      // Create a medium 1kHz sine wave (amplitude 0.1 = ~-20dB)
      const mediumBuffer = createSineWaveBuffer(1000, 0.1, 48000, 50, 2);
      
      for (let i = 0; i < 10; i++) {
        analyzer.analyze(mediumBuffer);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Level should be around -20dB (with some tolerance)
      const level = analyzer.getCurrentLevelDb();
      expect(level).toBeGreaterThan(-30);
      expect(level).toBeLessThan(-10);
    });

    it('should not analyze when not running', () => {
      // Don't start the analyzer
      const silentBuffer = createSilentBuffer(1024, 2);
      
      analyzer.analyze(silentBuffer);
      
      // Level should still be default
      expect(analyzer.getCurrentLevelDb()).toBe(-100);
    });
  });

  describe('EventBus Integration', () => {
    it('should publish audio.level events', async () => {
      // Create analyzer with shorter bufferSize and publishInterval for testing
      const testAnalyzer = new AudioAnalyzer({
        sampleRate: 48000,
        channels: 2,
        bufferSize: 256,  // Smaller buffer for faster analysis
        publishIntervalMs: 10  // Very short interval
      });
      testAnalyzer.start();
      mockPublish.mockClear();
      
      // Create enough audio data to fill the buffer multiple times
      const buffer = Buffer.alloc(512 * 2 * 2); // 512 samples * 2 channels * 2 bytes
      
      // Fill with some values
      for (let i = 0; i < buffer.length / 2; i++) {
        buffer.writeInt16LE(Math.floor(Math.random() * 10000), i * 2);
      }
      
      // Analyze multiple times to trigger publish
      for (let i = 0; i < 30; i++) {
        testAnalyzer.analyze(buffer);
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      // Wait for publish interval
      await new Promise(resolve => setTimeout(resolve, 100));
      
      testAnalyzer.stop();
      
      // Should have published audio.level
      expect(mockPublish).toHaveBeenCalledWith(
        'audio.level',
        expect.objectContaining({
          rms: expect.any(Number),
          levelDb: expect.any(Number),
          energy: expect.any(Number),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should publish at configured interval', async () => {
      // Use a longer interval for this test
      const slowAnalyzer = new AudioAnalyzer({
        sampleRate: 48000,
        channels: 2,
        bufferSize: 512,
        publishIntervalMs: 200
      });
      
      slowAnalyzer.start();
      mockPublish.mockClear();
      
      const buffer = Buffer.alloc(1024 * 2 * 2);
      
      // Analyze continuously for 500ms
      const startTime = Date.now();
      while (Date.now() - startTime < 500) {
        slowAnalyzer.analyze(buffer);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Should have published 2-3 times (500ms / 200ms interval)
      const publishCalls = mockPublish.mock.calls.filter(
        call => call[0] === 'audio.level'
      );
      expect(publishCalls.length).toBeGreaterThanOrEqual(2);
      expect(publishCalls.length).toBeLessThanOrEqual(4);
      
      slowAnalyzer.stop();
    });
  });

  describe('RMS Calculation', () => {
    it('should return RMS between 0 and 1', async () => {
      analyzer.start();
      
      // Create a full-scale sine wave
      const buffer = Buffer.alloc(1024 * 2 * 2);
      for (let i = 0; i < 1024; i++) {
        const value = Math.sin(2 * Math.PI * i / 100) * 32767;
        buffer.writeInt16LE(Math.round(value), i * 4);
        buffer.writeInt16LE(Math.round(value), i * 4 + 2);
      }
      
      for (let i = 0; i < 10; i++) {
        analyzer.analyze(buffer);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const rms = analyzer.getCurrentRms();
      expect(rms).toBeGreaterThanOrEqual(0);
      expect(rms).toBeLessThanOrEqual(1);
    });
  });
});

