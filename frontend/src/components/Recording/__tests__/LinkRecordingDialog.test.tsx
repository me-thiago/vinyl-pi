import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkRecordingDialog } from '../LinkRecordingDialog';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'recording.linkDialogDescription') {
        return `Select an album to link "${params?.recording}"`;
      }
      return key;
    },
  }),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn() as unknown as typeof fetch;

describe('LinkRecordingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
  });

  it('should render when open', () => {
    render(
      <LinkRecordingDialog
        open={true}
        onOpenChange={vi.fn()}
        recordingId="rec-1"
        recordingFileName="test.flac"
      />
    );

    expect(screen.getByText('recording.linkToAlbum')).toBeInTheDocument();
    expect(screen.getByText(/Select an album to link "test.flac"/)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <LinkRecordingDialog
        open={false}
        onOpenChange={vi.fn()}
        recordingId="rec-1"
        recordingFileName="test.flac"
      />
    );

    expect(screen.queryByText('recording.linkToAlbum')).not.toBeInTheDocument();
  });

  it('should fetch albums when opened', async () => {
    const mockAlbums = [
      {
        id: 'album-1',
        title: 'Test Album',
        artist: 'Test Artist',
        year: 2020,
        coverUrl: null,
      },
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockAlbums }),
    } as Response);

    render(
      <LinkRecordingDialog
        open={true}
        onOpenChange={vi.fn()}
        recordingId="rec-1"
        recordingFileName="test.flac"
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/albums?limit=100&archived=false')
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Test Album')).toBeInTheDocument();
    });
  });

  it('should show empty state when no albums', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    render(
      <LinkRecordingDialog
        open={true}
        onOpenChange={vi.fn()}
        recordingId="rec-1"
        recordingFileName="test.flac"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('recording.noAlbumsInCollection')).toBeInTheDocument();
    });
  });

  it('should filter albums by search', async () => {
    const mockAlbums = [
      { id: '1', title: 'Abbey Road', artist: 'The Beatles', year: 1969, coverUrl: null },
      { id: '2', title: 'Dark Side', artist: 'Pink Floyd', year: 1973, coverUrl: null },
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockAlbums }),
    } as Response);

    const user = userEvent.setup();

    render(
      <LinkRecordingDialog
        open={true}
        onOpenChange={vi.fn()}
        recordingId="rec-1"
        recordingFileName="test.flac"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Abbey Road')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('recording.searchAlbums');
    await user.type(searchInput, 'beatles');

    await waitFor(() => {
      expect(screen.getByText('Abbey Road')).toBeInTheDocument();
      expect(screen.queryByText('Dark Side')).not.toBeInTheDocument();
    });
  });

  it('should enable link button when album selected', async () => {
    const mockAlbums = [
      { id: '1', title: 'Test Album', artist: 'Test Artist', year: 2020, coverUrl: null },
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockAlbums }),
    } as Response);

    const user = userEvent.setup();

    render(
      <LinkRecordingDialog
        open={true}
        onOpenChange={vi.fn()}
        recordingId="rec-1"
        recordingFileName="test.flac"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Album')).toBeInTheDocument();
    });

    const linkButton = screen.getByText('recording.linkAction');
    expect(linkButton).toBeDisabled();

    const albumButton = screen.getByText('Test Album');
    await user.click(albumButton);

    expect(linkButton).not.toBeDisabled();
  });
});
