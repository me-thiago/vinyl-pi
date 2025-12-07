import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlbumRecordings } from '../AlbumRecordings';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock useRecording hook
vi.mock('@/hooks/useRecording', () => ({
  useRecording: () => ({
    startRecording: vi.fn(),
    isLoading: false,
  }),
}));

describe('AlbumRecordings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with no recordings', () => {
    render(
      <AlbumRecordings
        albumId="album-1"
        albumTitle="Test Album"
        albumArtist="Test Artist"
        recordings={[]}
      />
    );

    expect(screen.getByText('album.recordings')).toBeInTheDocument();
    expect(screen.getByText('album.noRecordings')).toBeInTheDocument();
    expect(screen.getByText('album.recordThisAlbum')).toBeInTheDocument();
  });

  it('should render recordings list', () => {
    const recordings = [
      {
        id: 'rec-1',
        fileName: 'recording1.flac',
        durationSeconds: 120,
        fileSizeBytes: 1024 * 1024 * 10,
        status: 'completed',
        startedAt: '2025-01-01T10:00:00Z',
      },
    ];

    render(
      <AlbumRecordings
        albumId="album-1"
        albumTitle="Test Album"
        albumArtist="Test Artist"
        albumCoverUrl="https://example.com/cover.jpg"
        recordings={recordings}
      />
    );

    expect(screen.getByText('recording1.flac')).toBeInTheDocument();
  });

  it('should show recording count badge', () => {
    const recordings = [
      {
        id: 'rec-1',
        fileName: 'recording1.flac',
        durationSeconds: 120,
        fileSizeBytes: 1024 * 1024 * 10,
        status: 'completed',
        startedAt: '2025-01-01T10:00:00Z',
      },
      {
        id: 'rec-2',
        fileName: 'recording2.flac',
        durationSeconds: 150,
        fileSizeBytes: 1024 * 1024 * 12,
        status: 'completed',
        startedAt: '2025-01-02T10:00:00Z',
      },
    ];

    render(
      <AlbumRecordings
        albumId="album-1"
        albumTitle="Test Album"
        albumArtist="Test Artist"
        recordings={recordings}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should call onRecordingsChange when starting recording', async () => {
    const onRecordingsChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AlbumRecordings
        albumId="album-1"
        albumTitle="Test Album"
        albumArtist="Test Artist"
        recordings={[]}
        onRecordingsChange={onRecordingsChange}
      />
    );

    const recordButton = screen.getByText('album.recordThisAlbum');
    await user.click(recordButton);

    // Should call after timeout
    await waitFor(() => {
      expect(onRecordingsChange).toHaveBeenCalled();
    }, { timeout: 2000 });
  });
});
