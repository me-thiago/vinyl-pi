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
    it('deve renderizar os cards de status', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Streaming')).toBeInTheDocument();
        // i18n: "Sessão" (pt-BR) or "Session" (en)
        expect(screen.getByText(/Sessão|Session/i)).toBeInTheDocument();
        // i18n: "Duração" (pt-BR) or "Duration" (en)
        expect(screen.getByText(/Duração|Duration/i)).toBeInTheDocument();
        // i18n: "Áudio" (pt-BR) or "Audio" (en)
        expect(screen.getByText(/Áudio|Audio/i)).toBeInTheDocument();
      });
    });

    it('deve renderizar seção de eventos', async () => {
      renderWithRouter(<Dashboard />);
      // i18n: "Últimos Eventos" (pt-BR) or "Recent Events" (en)
      // Use getAllByText because the footer may also contain this text
      const elements = screen.getAllByText(/Últimos Eventos|Recent Events/i);
      expect(elements.length).toBeGreaterThan(0);
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
        // i18n: "Ativa" (pt-BR) or "Active" (en)
        expect(screen.getByText(/Ativa|Active/i)).toBeInTheDocument();
      });
    });

    it('deve mostrar contagem de eventos da sessão', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        // i18n: "15 eventos" (pt-BR) or "15 events" (en)
        expect(screen.getByText(/15 eventos|15 events/i)).toBeInTheDocument();
      });
    });

    it('deve mostrar número de listeners', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        // i18n: "2 ouvintes" (pt-BR) or "2 listeners" (en)
        expect(screen.getByText(/2 ouvintes|2 listeners/i)).toBeInTheDocument();
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
        // i18n: "Nível: -20.0 dB" (pt-BR) or "Level: -20.0 dB" (en)
        expect(screen.getByText(/Nível|Level/i)).toBeInTheDocument();
        expect(screen.getByText(/-20\.0 dB/i)).toBeInTheDocument();
      });
    });
  });

  describe('indicador de conexão', () => {
    it('deve mostrar indicador de conexão WebSocket', async () => {
      renderWithRouter(<Dashboard />);

      // i18n title: "Conectado via WebSocket" (pt-BR) or "Connected via WebSocket" (en)
      const connectionButton = screen.getByTitle(/Conectado via WebSocket|Connected via WebSocket/i);
      expect(connectionButton).toBeInTheDocument();
    });

    it('deve chamar reconnect ao clicar no indicador de conexão', async () => {
      renderWithRouter(<Dashboard />);
      const user = userEvent.setup();

      const connectionButton = screen.getByTitle(/Conectado via WebSocket|Connected via WebSocket/i);
      await user.click(connectionButton);

      expect(mockReconnect).toHaveBeenCalled();
    });

    it('deve mostrar badge "Ao vivo" quando conectado', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        // i18n: "Ao vivo" (pt-BR) or "Live" (en)
        expect(screen.getByText(/Ao vivo|Live/i)).toBeInTheDocument();
      });
    });
  });

  describe('lista de eventos', () => {
    it('deve mostrar mensagem quando não há eventos', async () => {
      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        // i18n: "Nenhum evento registrado ainda" (pt-BR) or "No events recorded yet" (en)
        expect(screen.getByText(/Nenhum evento registrado ainda|No events recorded yet/i)).toBeInTheDocument();
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

      // i18n: Check for footer containing "Vinyl-OS Dashboard"
      expect(
        screen.getByText(/Vinyl-OS Dashboard/i)
      ).toBeInTheDocument();
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
      // i18n: "Inativa" (pt-BR) or "Inactive" (en)
      expect(screen.getByText(/Inativa|Inactive/i)).toBeInTheDocument();
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

    // i18n: "Desconectado - clique para reconectar" (pt-BR) or "Disconnected - click to reconnect" (en)
    const connectionButton = screen.getByTitle(/Desconectado|Disconnected/i);
    expect(connectionButton).toBeInTheDocument();
  });

  it('deve mostrar footer com mensagem de reconexão', async () => {
    renderWithRouter(<Dashboard />);

    // i18n: Check for Vinyl-OS Dashboard footer
    expect(
      screen.getByText(/Vinyl-OS Dashboard/i)
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
      // i18n: "Silêncio" (pt-BR) or "Silence" (en)
      expect(screen.getByText(/Silêncio|Silence/i)).toBeInTheDocument();
    });
  });
});
