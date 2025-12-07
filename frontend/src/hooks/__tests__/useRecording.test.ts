import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRecording } from '../useRecording';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock fetch global
global.fetch = vi.fn() as unknown as typeof fetch;

describe('useRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useRecording());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.currentRecording).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.isLoading).toBe(false);
  });

  it('should fetch status on mount', async () => {
    const mockStatus = {
      data: {
        isRecording: false,
        currentRecording: null,
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    });

    renderHook(() => useRecording());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/recordings/status')
      );
    });
  });

  it('should start recording successfully', async () => {
    const mockRecording = {
      data: {
        id: 'rec-123',
        status: 'recording',
        startedAt: '2025-12-07T10:00:00Z',
        filePath: '2025-12/rec-123.flac',
      },
    };

    // Mock status initial
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { isRecording: false, currentRecording: null } }),
    });

    // Mock start recording
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRecording,
    });

    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.currentRecording).toEqual({
      id: 'rec-123',
      startedAt: expect.any(Date),
      durationSeconds: 0,
    });
  });

  it('should start recording with albumId', async () => {
    const mockRecording = {
      data: {
        id: 'rec-123',
        status: 'recording',
        startedAt: '2025-12-07T10:00:00Z',
        filePath: '2025-12/rec-123.flac',
      },
    };

    // Mock status initial
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { isRecording: false, currentRecording: null } }),
    });

    // Mock start recording
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRecording,
    });

    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording('album-456');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/recordings/start'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ albumId: 'album-456' }),
      })
    );
  });

  it('should handle start recording error', async () => {
    // Mock status initial
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { isRecording: false, currentRecording: null } }),
    });

    // Mock start recording error
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Recording already active' } }),
    });

    const { result } = renderHook(() => useRecording());

    await expect(async () => {
      await act(async () => {
        await result.current.startRecording();
      });
    }).rejects.toThrow('Recording already active');

    // Should not be recording after error
    expect(result.current.isRecording).toBe(false);
  });

  it('should stop recording successfully', async () => {
    const mockStoppedRecording = {
      data: {
        id: 'rec-123',
        status: 'completed',
        startedAt: '2025-12-07T10:00:00Z',
        completedAt: '2025-12-07T10:05:00Z',
        durationSeconds: 300,
        fileSizeBytes: 10000000,
        filePath: '2025-12/rec-123.flac',
      },
    };

    // Mock status initial (recording active)
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          isRecording: true,
          currentRecording: {
            id: 'rec-123',
            startedAt: '2025-12-07T10:00:00Z',
            durationSeconds: 60,
          },
        },
      }),
    });

    const { result } = renderHook(() => useRecording());

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    // Mock stop recording
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStoppedRecording,
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.currentRecording).toBe(null);
  });

  it('should not allow stop if no active recording', async () => {
    // Mock status initial (not recording)
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { isRecording: false, currentRecording: null } }),
    });

    const { result } = renderHook(() => useRecording());

    await waitFor(() => {
      expect(result.current.isRecording).toBe(false);
    });

    await expect(async () => {
      await act(async () => {
        await result.current.stopRecording();
      });
    }).rejects.toThrow('No active recording to stop');
  });

  it('should handle stop recording error', async () => {
    // Mock status initial (recording active)
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          isRecording: true,
          currentRecording: {
            id: 'rec-123',
            startedAt: '2025-12-07T10:00:00Z',
            durationSeconds: 60,
          },
        },
      }),
    });

    const { result } = renderHook(() => useRecording());

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    // Mock stop recording error
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'FFmpeg error' } }),
    });

    await expect(async () => {
      await act(async () => {
        await result.current.stopRecording();
      });
    }).rejects.toThrow('FFmpeg error');

    // Should still be recording if stop failed
    expect(result.current.isRecording).toBe(true);
  });
});
