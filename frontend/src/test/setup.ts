import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Limpar após cada teste
afterEach(() => {
  cleanup();
});

// Mock Web Audio API
(globalThis as any).AudioContext = class MockAudioContext {
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

  decodeAudioData(_buffer: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({
      duration: 0.1,
      sampleRate: 44100,
      numberOfChannels: 2,
      length: 4410,
    } as AudioBuffer);
  }

  resume() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
} as any;

// Mock ReadableStream
(globalThis as any).ReadableStream = class MockReadableStream {
  getReader() {
    return {
      read: () => Promise.resolve({ done: true, value: undefined }),
      cancel: () => Promise.resolve(),
    };
  }
} as any;

// Mock ResizeObserver
(globalThis as any).ResizeObserver = class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

