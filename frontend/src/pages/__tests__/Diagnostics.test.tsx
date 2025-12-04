import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Diagnostics from '../Diagnostics';
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

// Dados mock de settings
const mockSettings = [
  {
    key: 'silence.threshold',
    defaultValue: -50,
    type: 'number',
    label: 'Threshold de Silêncio',
    description: 'Nível em dB abaixo do qual é considerado silêncio',
    min: -80,
    max: -20,
    unit: 'dB',
    value: -50,
  },
  {
    key: 'clipping.threshold',
    defaultValue: -3,
    type: 'number',
    label: 'Threshold de Clipping',
    description: 'Nível em dB acima do qual é considerado clipping',
    min: -10,
    max: 0,
    unit: 'dB',
    value: -3,
  },
  {
    key: 'session.silence_cooldown_ms',
    defaultValue: 5000,
    type: 'number',
    label: 'Cooldown de Silêncio',
    description: 'Tempo em ms antes de iniciar nova sessão após silêncio',
    min: 1000,
    max: 30000,
    unit: 'ms',
    value: 5000,
  },
];

// Dados mock de eventos
const mockEvents = [
  {
    id: 'evt-1',
    eventType: 'silence.detected',
    timestamp: new Date().toISOString(),
    metadata: { levelDb: -60 },
    sessionId: 'session-1',
  },
  {
    id: 'evt-2',
    eventType: 'clipping.detected',
    timestamp: new Date().toISOString(),
    metadata: { levelDb: -1 },
    sessionId: 'session-1',
  },
];

describe('Diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSocket).mockReturnValue({
      isConnected: true,
      audioLevel: -20,
      reconnect: mockReconnect,
      connectionState: 'connected',
      status: null,
      lastEvent: null,
      disconnect: vi.fn(),
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ settings: mockSettings }),
        });
      }
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: mockEvents }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('renderização inicial', () => {
    it('deve renderizar o título Diagnóstico', async () => {
      renderWithRouter(<Diagnostics />);

      expect(screen.getByText('Diagnóstico')).toBeInTheDocument();
    });

    it('deve renderizar subtítulo', async () => {
      renderWithRouter(<Diagnostics />);

      expect(screen.getByText('VU Meter e Configurações')).toBeInTheDocument();
    });

    it('deve renderizar card de VU Meter', async () => {
      renderWithRouter(<Diagnostics />);

      expect(screen.getByText('VU Meter')).toBeInTheDocument();
      expect(screen.getByText('Nível de áudio em tempo real')).toBeInTheDocument();
    });

    it('deve renderizar card de Configurações', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(screen.getByText('Configurações')).toBeInTheDocument();
        expect(screen.getByText('Ajuste os thresholds de detecção')).toBeInTheDocument();
      });
    });

    it('deve renderizar card de Log de Eventos', async () => {
      renderWithRouter(<Diagnostics />);

      expect(screen.getByText('Log de Eventos')).toBeInTheDocument();
    });
  });

  describe('VU Meter', () => {
    it('deve mostrar nível de áudio atual', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(screen.getByText('-20.0 dB')).toBeInTheDocument();
      });
    });

    it('deve mostrar badge Normal quando nível é normal', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        const normalBadges = screen.getAllByText('Normal');
        expect(normalBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Configurações', () => {
    it('deve buscar settings ao montar', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/settings'));
      });
    });

    it('deve mostrar sliders de configuração', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        const sliders = screen.getAllByRole('slider');
        expect(sliders.length).toBeGreaterThan(0);
      });
    });

    it('deve mostrar labels das configurações', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(screen.getByText('Threshold de Silêncio')).toBeInTheDocument();
        expect(screen.getByText('Threshold de Clipping')).toBeInTheDocument();
      });
    });

    it('deve mostrar valores atuais das configurações', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(screen.getByText('-50 dB')).toBeInTheDocument();
        expect(screen.getByText('-3 dB')).toBeInTheDocument();
      });
    });

    it('deve ter botão de Resetar', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(screen.getByText('Resetar')).toBeInTheDocument();
      });
    });

    it('deve ter botão de Recarregar', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(screen.getByText('Recarregar')).toBeInTheDocument();
      });
    });
  });

  describe('Log de Eventos', () => {
    it('deve buscar eventos ao montar', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/events'));
      });
    });

    it('deve mostrar eventos na lista', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(screen.getByText('Silêncio detectado')).toBeInTheDocument();
        expect(screen.getByText('Clipping detectado')).toBeInTheDocument();
      });
    });

    it('deve ter switch para pausar/retomar auto-scroll', async () => {
      renderWithRouter(<Diagnostics />);

      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(0);
    });

    it('deve mostrar "Ao vivo" quando auto-scroll está ativo', async () => {
      renderWithRouter(<Diagnostics />);

      expect(screen.getByText('Ao vivo')).toBeInTheDocument();
    });

    it('deve mostrar badge com contagem de eventos', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('indicador de conexão', () => {
    it('deve mostrar indicador de conexão WebSocket', async () => {
      renderWithRouter(<Diagnostics />);

      const connectionButton = screen.getByTitle('Conectado');
      expect(connectionButton).toBeInTheDocument();
    });

    it('deve chamar reconnect ao clicar no indicador', async () => {
      renderWithRouter(<Diagnostics />);
      const user = userEvent.setup();

      const connectionButton = screen.getByTitle('Conectado');
      await user.click(connectionButton);

      expect(mockReconnect).toHaveBeenCalled();
    });
  });

  describe('footer', () => {
    it('deve renderizar footer', async () => {
      renderWithRouter(<Diagnostics />);

      expect(screen.getByText('Vinyl-OS Diagnóstico • Conectado via WebSocket')).toBeInTheDocument();
    });
  });

  describe('link de volta', () => {
    it('deve ter link para página inicial', async () => {
      renderWithRouter(<Diagnostics />);

      const links = screen.getAllByRole('link');
      const backLink = links.find(link => link.getAttribute('href') === '/');
      expect(backLink).toBeInTheDocument();
    });
  });
});

describe('Diagnostics - estados especiais', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSocket).mockReturnValue({
      isConnected: true,
      audioLevel: -20,
      reconnect: mockReconnect,
      connectionState: 'connected',
      status: null,
      lastEvent: null,
      disconnect: vi.fn(),
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ settings: mockSettings }),
        });
      }
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: [] }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve mostrar mensagem quando não há eventos', async () => {
    renderWithRouter(<Diagnostics />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum evento registrado ainda')).toBeInTheDocument();
    });
  });
});

describe('Diagnostics - desconectado', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSocket).mockReturnValue({
      isConnected: false,
      audioLevel: null,
      reconnect: mockReconnect,
      connectionState: 'disconnected',
      status: null,
      lastEvent: null,
      disconnect: vi.fn(),
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ settings: mockSettings }),
        });
      }
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: [] }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve mostrar indicador desconectado', async () => {
    renderWithRouter(<Diagnostics />);

    const connectionButton = screen.getByTitle('Desconectado');
    expect(connectionButton).toBeInTheDocument();
  });

  it('deve mostrar mensagem de reconexão no footer', async () => {
    renderWithRouter(<Diagnostics />);

    expect(screen.getByText('Vinyl-OS Diagnóstico • Reconectando...')).toBeInTheDocument();
  });

  it('deve mostrar "Aguardando sinal..." quando audioLevel é null', async () => {
    renderWithRouter(<Diagnostics />);

    await waitFor(() => {
      expect(screen.getByText('Aguardando sinal...')).toBeInTheDocument();
    });
  });
});

describe('Diagnostics - estados de áudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ settings: mockSettings }),
        });
      }
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: [] }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve mostrar badge Silêncio quando nível está abaixo do threshold', async () => {
    vi.mocked(useSocket).mockReturnValue({
      isConnected: true,
      audioLevel: -60,
      reconnect: mockReconnect,
      connectionState: 'connected',
      status: null,
      lastEvent: null,
      disconnect: vi.fn(),
    });

    renderWithRouter(<Diagnostics />);

    await waitFor(() => {
      const silenceBadges = screen.getAllByText('Silêncio');
      expect(silenceBadges.length).toBeGreaterThan(0);
    });
  });

  it('deve mostrar badge Clipping quando nível está acima do threshold', async () => {
    vi.mocked(useSocket).mockReturnValue({
      isConnected: true,
      audioLevel: -1,
      reconnect: mockReconnect,
      connectionState: 'connected',
      status: null,
      lastEvent: null,
      disconnect: vi.fn(),
    });

    renderWithRouter(<Diagnostics />);

    await waitFor(() => {
      const clippingBadges = screen.getAllByText('Clipping');
      expect(clippingBadges.length).toBeGreaterThan(0);
    });
  });
});

describe('Diagnostics - tratamento de erro', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSocket).mockReturnValue({
      isConnected: true,
      audioLevel: -20,
      reconnect: mockReconnect,
      connectionState: 'connected',
      status: null,
      lastEvent: null,
      disconnect: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve mostrar erro quando falha ao carregar settings', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/settings')) {
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      }
      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: [] }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithRouter(<Diagnostics />);

    await waitFor(() => {
      expect(screen.getByText('Erro')).toBeInTheDocument();
      expect(screen.getByText('Falha ao carregar configurações')).toBeInTheDocument();
    });
  });
});
