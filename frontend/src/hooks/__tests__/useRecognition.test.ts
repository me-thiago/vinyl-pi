/**
 * Tests for useRecognition hook (V2-07)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecognition } from '../useRecognition';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useRecognition', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('recognize', () => {
    it('should return success result when track is identified', async () => {
      const mockTrack = {
        id: 'track-123',
        title: 'Hey Jude',
        artist: 'The Beatles',
        album: 'Hey Jude',
        albumArt: 'https://example.com/cover.jpg',
        year: 1968,
        durationSeconds: 431,
        confidence: 1.0,
        source: 'audd',
        albumMatch: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, track: mockTrack }),
      });

      const { result } = renderHook(() => useRecognition());

      let recognitionResult;
      await act(async () => {
        recognitionResult = await result.current.recognize();
      });

      expect(recognitionResult).toEqual({
        success: true,
        track: mockTrack,
      });
      expect(result.current.lastResult?.success).toBe(true);
      expect(result.current.lastResult?.track).toEqual(mockTrack);
      expect(result.current.error).toBeNull();
    });

    it('should return error result when track is not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: 'Música não identificada',
          errorCode: 'NOT_FOUND',
        }),
      });

      const { result } = renderHook(() => useRecognition());

      let recognitionResult;
      await act(async () => {
        recognitionResult = await result.current.recognize();
      });

      expect(recognitionResult?.success).toBe(false);
      expect(recognitionResult?.errorCode).toBe('NOT_FOUND');
      // NOT_FOUND shouldn't set error state (it's not an error, just no match)
      expect(result.current.error).toBeNull();
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: { message: 'Internal Server Error', code: 'SERVER_ERROR' },
        }),
      });

      const { result } = renderHook(() => useRecognition());

      let recognitionResult;
      await act(async () => {
        recognitionResult = await result.current.recognize();
      });

      expect(recognitionResult?.success).toBe(false);
      expect(recognitionResult?.error).toBe('Internal Server Error');
      expect(result.current.error).toBe('Internal Server Error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      const { result } = renderHook(() => useRecognition());

      let recognitionResult;
      await act(async () => {
        recognitionResult = await result.current.recognize();
      });

      expect(recognitionResult?.success).toBe(false);
      expect(recognitionResult?.errorCode).toBe('NETWORK_ERROR');
      expect(result.current.error).toBe('Network Error');
    });

    it('should set isRecognizing during request', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useRecognition());

      // Start recognition
      act(() => {
        result.current.recognize();
      });

      // Should be loading
      expect(result.current.isRecognizing).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: () => Promise.resolve({ success: false, error: 'test' }),
        });
        await promise;
      });

      // Should not be loading anymore
      await waitFor(() => {
        expect(result.current.isRecognizing).toBe(false);
      });
    });

    it('should return track with album matches when needsConfirmation is true', async () => {
      const mockTrack = {
        id: 'track-123',
        title: 'Hey Jude',
        artist: 'The Beatles',
        album: 'Hey Jude',
        albumArt: null,
        year: 1968,
        durationSeconds: null,
        confidence: 1.0,
        source: 'audd',
        albumMatch: {
          albumId: 'album-1',
          albumTitle: 'Hey Jude',
          matchConfidence: 0.75,
          needsConfirmation: true,
          matches: [
            { albumId: 'album-1', title: 'Hey Jude', artist: 'The Beatles', coverUrl: null, confidence: 0.75 },
            { albumId: 'album-2', title: '1', artist: 'The Beatles', coverUrl: null, confidence: 0.65 },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, track: mockTrack }),
      });

      const { result } = renderHook(() => useRecognition());

      let recognitionResult;
      await act(async () => {
        recognitionResult = await result.current.recognize();
      });

      expect(recognitionResult?.success).toBe(true);
      expect(recognitionResult?.track?.albumMatch?.needsConfirmation).toBe(true);
      expect(recognitionResult?.track?.albumMatch?.matches).toHaveLength(2);
    });
  });

  describe('confirm', () => {
    it('should confirm album link successfully', async () => {
      // First, set up lastResult
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          track: {
            id: 'track-123',
            title: 'Hey Jude',
            artist: 'The Beatles',
            albumMatch: { albumId: 'album-1', albumTitle: 'Hey Jude', matchConfidence: 0.75, needsConfirmation: true, matches: [] },
          },
        }),
      });

      const { result } = renderHook(() => useRecognition());

      await act(async () => {
        await result.current.recognize();
      });

      // Mock confirm response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'track-123', albumId: 'album-1' } }),
      });

      await act(async () => {
        await result.current.confirm('track-123', 'album-1');
      });

      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle confirm errors', async () => {
      const { result } = renderHook(() => useRecognition());

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          error: { message: 'Track não encontrado', code: 'TRACK_NOT_FOUND' },
        }),
      });

      await act(async () => {
        try {
          await result.current.confirm('invalid-id', 'album-1');
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe('Track não encontrado');
    });
  });

  describe('reset', () => {
    it('should clear lastResult and error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Test Error'));

      const { result } = renderHook(() => useRecognition());

      await act(async () => {
        await result.current.recognize();
      });

      expect(result.current.error).toBe('Test Error');
      expect(result.current.lastResult).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.lastResult).toBeNull();
    });
  });
});
