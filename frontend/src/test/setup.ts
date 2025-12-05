import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Initialize i18n for tests
import '../i18n';

// Limpar após cada teste
afterEach(() => {
  cleanup();
});

// Mock Web Audio API
class MockAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};

  createGain() {
    return {
      gain: { value: 1 },
      connect: () => {},
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: () => {},
      start: () => {},
    };
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      connect: () => {},
    };
  }

  decodeAudioData(): Promise<AudioBuffer> {
    return Promise.resolve({
      duration: 0.1,
      sampleRate: 44100,
      numberOfChannels: 2,
      length: 4410,
      getChannelData: () => new Float32Array(4410),
    } as unknown as AudioBuffer);
  }

  resume() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}

(globalThis as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext;

// Mock ReadableStream
class MockReadableStream {
  getReader() {
    return {
      read: () => Promise.resolve({ done: true, value: undefined }),
      cancel: () => Promise.resolve(),
    };
  }
}

(globalThis as unknown as { ReadableStream: typeof MockReadableStream }).ReadableStream = MockReadableStream;

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

