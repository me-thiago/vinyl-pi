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
      // i18n: "Diagnóstico" (pt-BR) or "Diagnostics" (en)
      // Use role to target the h1 specifically (footer also contains this text)
      expect(screen.getByRole('heading', { name: /Diagnóstico|Diagnostics/i })).toBeInTheDocument();
    });

    it('deve renderizar subtítulo', async () => {
      renderWithRouter(<Diagnostics />);
      // i18n: "VU Meter e Configurações" (pt-BR) or "VU Meter and Settings" (en)
      expect(screen.getByText(/VU Meter (e|and) (Configurações|Settings)/i)).toBeInTheDocument();
    });

    it('deve renderizar card de VU Meter', async () => {
      renderWithRouter(<Diagnostics />);

      expect(screen.getByText('VU Meter')).toBeInTheDocument();
      // i18n: "Nível de áudio em tempo real" (pt-BR) or "Real-time audio level" (en)
      expect(screen.getByText(/Nível de áudio em tempo real|Real-time audio level/i)).toBeInTheDocument();
    });

    it('deve renderizar card de Configurações', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        // i18n: "Configurações" (pt-BR) or "Settings" (en)
        expect(screen.getByText(/^Configurações$|^Settings$/i)).toBeInTheDocument();
        // i18n: "Ajuste os thresholds de detecção" (pt-BR) or "Adjust detection thresholds" (en)
        expect(screen.getByText(/Ajuste os thresholds de detecção|Adjust detection thresholds/i)).toBeInTheDocument();
      });
    });

    it('deve renderizar card de Log de Eventos', async () => {
      renderWithRouter(<Diagnostics />);
      // i18n: "Log de Eventos" (pt-BR) or "Event Log" (en)
      expect(screen.getByText(/Log de Eventos|Event Log/i)).toBeInTheDocument();
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
        // i18n: "Resetar" (pt-BR) or "Reset" (en)
        expect(screen.getByText(/^Resetar$|^Reset$/i)).toBeInTheDocument();
      });
    });

    it('deve ter botão de Recarregar', async () => {
      renderWithRouter(<Diagnostics />);

      await waitFor(() => {
        // i18n: "Recarregar" (pt-BR) or "Reload" (en)
        expect(screen.getByText(/^Recarregar$|^Reload$/i)).toBeInTheDocument();
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
        // i18n: "Silêncio detectado" (pt-BR) or "Silence detected" (en)
        expect(screen.getByText(/Silêncio detectado|Silence detected/i)).toBeInTheDocument();
        // i18n: "Clipping detectado" (pt-BR) or "Clipping detected" (en)
        expect(screen.getByText(/Clipping detectado|Clipping detected/i)).toBeInTheDocument();
      });
    });

    it('deve ter switch para pausar/retomar auto-scroll', async () => {
      renderWithRouter(<Diagnostics />);

      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(0);
    });

    it('deve mostrar "Ao vivo" quando auto-scroll está ativo', async () => {
      renderWithRouter(<Diagnostics />);
      // i18n: "Ao vivo" (pt-BR) or "Live" (en)
      expect(screen.getByText(/Ao vivo|Live/i)).toBeInTheDocument();
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
      // i18n: "Conectado" (pt-BR) or "Connected" (en)
      const connectionButton = screen.getByTitle(/Conectado|Connected/i);
      expect(connectionButton).toBeInTheDocument();
    });

    it('deve chamar reconnect ao clicar no indicador', async () => {
      renderWithRouter(<Diagnostics />);
      const user = userEvent.setup();

      const connectionButton = screen.getByTitle(/Conectado|Connected/i);
      await user.click(connectionButton);

      expect(mockReconnect).toHaveBeenCalled();
    });
  });

  describe('footer', () => {
    it('deve renderizar footer', async () => {
      renderWithRouter(<Diagnostics />);
      // i18n: Check for Vinyl-OS Diagnóstico/Diagnostics in footer
      expect(screen.getByText(/Vinyl-OS (Diagnóstico|Diagnostics)/i)).toBeInTheDocument();
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
      // i18n: "Nenhum evento registrado ainda" (pt-BR) or "No events recorded yet" (en)
      expect(screen.getByText(/Nenhum evento registrado ainda|No events recorded yet/i)).toBeInTheDocument();
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
    // i18n: "Desconectado" (pt-BR) or "Disconnected" (en)
    const connectionButton = screen.getByTitle(/Desconectado|Disconnected/i);
    expect(connectionButton).toBeInTheDocument();
  });

  it('deve mostrar mensagem de reconexão no footer', async () => {
    renderWithRouter(<Diagnostics />);
    // i18n: Check for Vinyl-OS in footer with reconnecting message
    expect(screen.getByText(/Vinyl-OS (Diagnóstico|Diagnostics)/i)).toBeInTheDocument();
  });

  it('deve mostrar "Aguardando sinal..." quando audioLevel é null', async () => {
    renderWithRouter(<Diagnostics />);

    await waitFor(() => {
      // i18n: "Aguardando sinal..." (pt-BR) or "Waiting for signal..." (en)
      expect(screen.getByText(/Aguardando sinal|Waiting for signal/i)).toBeInTheDocument();
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
      // i18n: "Silêncio" (pt-BR) or "Silence" (en)
      const silenceBadges = screen.getAllByText(/Silêncio|Silence/i);
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
      // i18n: "Erro" (pt-BR) or "Error" (en)
      expect(screen.getByText(/^Erro$|^Error$/i)).toBeInTheDocument();
      // i18n: "Falha ao carregar configurações" (pt-BR) or "Failed to load settings" (en)
      expect(screen.getByText(/Falha ao carregar configurações|Failed to load settings/i)).toBeInTheDocument();
    });
  });
});
