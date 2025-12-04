import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { useSocket } from '@/hooks/useSocket';

// Mock useSocket hook
vi.mock('@/hooks/useSocket');

// Mock fetch
const mockFetch = vi.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

// Helper para renderizar com Router
const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

const mockReconnect = vi.fn();

// Default mock data
const defaultMockData = {
  isConnected: true,
  status: {
    session: {
      id: 'session-1',
      started_at: new Date().toISOString(),
      duration: 3600,
      event_count: 15,
    },
    streaming: {
      active: true,
      listeners: 2,
      bitrate: 192,
      mount_point: '/stream',
    },
    audio: {
      level_db: -20,
      clipping_detected: false,
      clipping_count: 0,
      silence_detected: false,
    },
  },
  lastEvent: null,
  reconnect: mockReconnect,
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSocket).mockReturnValue(defaultMockData);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], total: 0, hasMore: false }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('renderização inicial', () => {
    it('deve renderizar o título Dashboard', async () => {
      renderWithRouter(<Dashboard />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('deve renderizar o subtítulo', async () => {
      renderWithRouter(<Dashboard />);
      expect(screen.getByText('Monitoramento em tempo real')).toBeInTheDocument();
    });

    it('deve renderizar os cards de status', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Streaming')).toBeInTheDocument();
        expect(screen.getByText('Sessão')).toBeInTheDocument();
        expect(screen.getByText('Duração')).toBeInTheDocument();
        expect(screen.getByText('Áudio')).toBeInTheDocument();
      });
    });

    it('deve renderizar seção de eventos', async () => {
      renderWithRouter(<Dashboard />);
      expect(screen.getByText('Últimos Eventos')).toBeInTheDocument();
    });
  });

  describe('cards de status', () => {
    it('deve mostrar status de streaming como ON quando ativo', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('ON')).toBeInTheDocument();
      });
    });

    it('deve mostrar sessão como Ativa quando há sessão', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Ativa')).toBeInTheDocument();
      });
    });

    it('deve mostrar contagem de eventos da sessão', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('15 eventos')).toBeInTheDocument();
      });
    });

    it('deve mostrar número de listeners', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('2 ouvintes')).toBeInTheDocument();
      });
    });

    it('deve mostrar bitrate e mount point', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('192 kbps • /stream')).toBeInTheDocument();
      });
    });

    it('deve mostrar badge Normal quando não há clipping nem silêncio', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Normal')).toBeInTheDocument();
      });
    });

    it('deve mostrar nível de áudio em dB', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Nível: -20.0 dB')).toBeInTheDocument();
      });
    });
  });

  describe('indicador de conexão', () => {
    it('deve mostrar indicador de conexão WebSocket', async () => {
      renderWithRouter(<Dashboard />);

      const connectionButton = screen.getByTitle('Conectado via WebSocket');
      expect(connectionButton).toBeInTheDocument();
    });

    it('deve chamar reconnect ao clicar no indicador de conexão', async () => {
      renderWithRouter(<Dashboard />);
      const user = userEvent.setup();

      const connectionButton = screen.getByTitle('Conectado via WebSocket');
      await user.click(connectionButton);

      expect(mockReconnect).toHaveBeenCalled();
    });

    it('deve mostrar badge "Ao vivo" quando conectado', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Ao vivo')).toBeInTheDocument();
      });
    });
  });

  describe('lista de eventos', () => {
    it('deve mostrar mensagem quando não há eventos', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Nenhum evento registrado ainda')).toBeInTheDocument();
      });
    });

    it('deve buscar eventos iniciais ao montar', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/events?limit=')
        );
      });
    });
  });

  describe('botão de refresh', () => {
    it('deve ter botão de refresh', async () => {
      renderWithRouter(<Dashboard />);

      const buttons = screen.getAllByRole('button');
      const refreshButton = buttons.find(btn => btn.querySelector('.lucide-refresh-cw'));
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('deve renderizar o footer', async () => {
      renderWithRouter(<Dashboard />);

      expect(
        screen.getByText('Vinyl-OS Dashboard • Atualizações em tempo real via WebSocket')
      ).toBeInTheDocument();
    });
  });

  describe('link de volta', () => {
    it('deve ter link para página inicial', async () => {
      renderWithRouter(<Dashboard />);

      const backLink = screen.getByRole('link');
      expect(backLink).toHaveAttribute('href', '/');
    });
  });
});

describe('Dashboard com status offline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSocket).mockReturnValue({
      isConnected: false,
      status: null,
      lastEvent: null,
      reconnect: mockReconnect,
      connectionState: 'disconnected',
      audioLevel: null,
      disconnect: vi.fn(),
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], total: 0, hasMore: false }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve mostrar status de streaming como OFF quando inativo', async () => {
    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('OFF')).toBeInTheDocument();
    });
  });

  it('deve mostrar sessão como Inativa', async () => {
    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Inativa')).toBeInTheDocument();
    });
  });

  it('deve mostrar duração como --:--', async () => {
    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('--:--')).toBeInTheDocument();
    });
  });

  it('deve mostrar indicador desconectado', async () => {
    renderWithRouter(<Dashboard />);

    const connectionButton = screen.getByTitle('Desconectado - clique para reconectar');
    expect(connectionButton).toBeInTheDocument();
  });

  it('deve mostrar footer com mensagem de reconexão', async () => {
    renderWithRouter(<Dashboard />);

    expect(
      screen.getByText('Vinyl-OS Dashboard • Reconectando...')
    ).toBeInTheDocument();
  });
});

describe('Dashboard com estados de áudio especiais', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], total: 0, hasMore: false }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve mostrar badge Clipping quando detectado', async () => {
    vi.mocked(useSocket).mockReturnValue({
      isConnected: true,
      status: {
        session: null,
        streaming: { active: true, bitrate: 128, mount_point: '/stream' },
        audio: {
          level_db: -1,
          clipping_detected: true,
          clipping_count: 5,
          silence_detected: false,
        },
      },
      lastEvent: null,
      reconnect: mockReconnect,
      connectionState: 'connected',
      audioLevel: -1,
      disconnect: vi.fn(),
    });

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Clipping')).toBeInTheDocument();
      expect(screen.getByText(/5 clips/)).toBeInTheDocument();
    });
  });

  it('deve mostrar badge Silêncio quando detectado', async () => {
    vi.mocked(useSocket).mockReturnValue({
      isConnected: true,
      status: {
        session: null,
        streaming: { active: true, bitrate: 128, mount_point: '/stream' },
        audio: {
          level_db: -60,
          clipping_detected: false,
          clipping_count: 0,
          silence_detected: true,
        },
      },
      lastEvent: null,
      reconnect: mockReconnect,
      connectionState: 'connected',
      audioLevel: -60,
      disconnect: vi.fn(),
    });

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Silêncio')).toBeInTheDocument();
    });
  });
});
