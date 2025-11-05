import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Limpar após cada teste
afterEach(() => {
  cleanup();
});

// Mock Web Audio API
global.AudioContext = class MockAudioContext {
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

  decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
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
global.ReadableStream = class MockReadableStream {
  getReader() {
    return {
      read: () => Promise.resolve({ done: true, value: undefined }),
      cancel: () => Promise.resolve(),
    };
  }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

