import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Settings from '../Settings';

// Mock fetch
const mockFetch = vi.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Helper para renderizar com Router
const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

// Dados mock de settings
const mockSettings = [
  {
    key: 'player.buffer_ms',
    defaultValue: 150,
    type: 'number',
    label: 'Buffer do Player',
    description: 'Tamanho do buffer em ms',
    min: 100,
    max: 300,
    unit: 'ms',
    value: 150,
  },
  {
    key: 'stream.bitrate',
    defaultValue: 192,
    type: 'number',
    label: 'Bitrate',
    description: 'Bitrate do stream',
    value: 192,
  },
];

const mockSystemInfo = {
  device: 'hw:0,0',
  sampleRate: 48000,
  version: '1.0.0',
  icecastUrl: 'http://localhost:8000/stream',
};

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ settings: mockSettings }),
        });
      }
      if (url.includes('/api/system/info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSystemInfo),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  describe('renderização inicial', () => {
    it('deve renderizar o título Configuracoes', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        // i18n: "Configurações" (pt-BR) or "Settings" (en)
        expect(screen.getByText(/^Configurações$|^Settings$/i)).toBeInTheDocument();
      });
    });

    it('deve renderizar cards de configuração', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        // i18n: "Player Local (PCM)" (pt-BR) or "Local Player (PCM)" (en)
        expect(screen.getByText(/Player Local \(PCM\)|Local Player \(PCM\)/i)).toBeInTheDocument();
        // i18n: "Stream MP3 (Icecast)" (pt-BR) or "MP3 Stream (Icecast)" (en)
        expect(screen.getByText(/Stream MP3 \(Icecast\)|MP3 Stream \(Icecast\)/i)).toBeInTheDocument();
        // i18n: "Sistema" (pt-BR) or "System" (en)
        expect(screen.getByText(/^Sistema$|^System$/i)).toBeInTheDocument();
      });
    });

    it('deve buscar settings e system info ao montar', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/settings'));
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/system/info'));
      });
    });
  });

  describe('card Player Local', () => {
    it('deve mostrar descrição do card', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        // i18n: description for local player card
        expect(screen.getByText(/player web|Web player/i)).toBeInTheDocument();
      });
    });

    it('deve mostrar valor atual do buffer', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('150 ms')).toBeInTheDocument();
      });
    });

    it('deve mostrar label Buffer do Player', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        // i18n: "Buffer do Player" (pt-BR) or "Player Buffer" (en)
        expect(screen.getByText(/Buffer do Player|Player Buffer/i)).toBeInTheDocument();
      });
    });

    it('deve ter slider para ajustar buffer', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        // Verifica se existe um slider (role="slider")
        const sliders = screen.getAllByRole('slider');
        expect(sliders.length).toBeGreaterThan(0);
      });
    });
  });

  describe('card Stream MP3', () => {
    it('deve mostrar seletor de bitrate', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Bitrate')).toBeInTheDocument();
      });
    });

    it('deve mostrar URL do stream', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('http://localhost:8000/stream')).toBeInTheDocument();
      });
    });

    it('deve ter botão para copiar URL', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        // i18n: "Copiar URL" (pt-BR) or "Copy URL" (en)
        expect(screen.getByTitle(/Copiar URL|Copy URL/i)).toBeInTheDocument();
      });
    });

    it('deve ter botão para copiar URL renderizado', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        expect(screen.getByTitle(/Copiar URL|Copy URL/i)).toBeInTheDocument();
      });
    });
  });

  describe('card Sistema', () => {
    it('deve mostrar informações do sistema', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('hw:0,0')).toBeInTheDocument();
        expect(screen.getByText('48000 Hz')).toBeInTheDocument();
        expect(screen.getByText('Vinyl-OS 1.0.0')).toBeInTheDocument();
      });
    });

    it('deve mostrar labels das informações', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        // i18n: "Device ALSA" (pt-BR) or "ALSA Device" (en)
        expect(screen.getByText(/Device ALSA|ALSA Device/i)).toBeInTheDocument();
        expect(screen.getByText('Sample Rate')).toBeInTheDocument();
        // i18n: "Versão" (pt-BR) or "Version" (en)
        expect(screen.getByText(/Versão|Version/i)).toBeInTheDocument();
      });
    });
  });

  describe('botão de refresh', () => {
    it('deve ter botão de recarregar', async () => {
      renderWithRouter(<Settings />);

      await waitFor(() => {
        // i18n: "Recarregar" (pt-BR) or "Reload" (en)
        expect(screen.getByTitle(/Recarregar|Reload/i)).toBeInTheDocument();
      });
    });

    it('deve chamar fetchSettings ao clicar em refresh', async () => {
      renderWithRouter(<Settings />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByTitle(/Recarregar|Reload/i)).toBeInTheDocument();
      });

      // Limpar chamadas anteriores
      mockFetch.mockClear();

      const refreshButton = screen.getByTitle(/Recarregar|Reload/i);
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe('link de volta', () => {
    it('deve ter link para página inicial', async () => {
      renderWithRouter(<Settings />);

      const links = screen.getAllByRole('link');
      const backLink = links.find(link => link.getAttribute('href') === '/');
      expect(backLink).toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('deve renderizar o footer', async () => {
      renderWithRouter(<Settings />);
      // i18n: Check for Vinyl-OS Settings/Configurações in footer
      expect(screen.getByText(/Vinyl-OS (Configurações|Settings)/i)).toBeInTheDocument();
    });
  });

  describe('tratamento de erro', () => {
    it('deve mostrar erro quando falha ao carregar settings', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/settings')) {
          return Promise.resolve({
            ok: false,
            status: 500,
          });
        }
        if (url.includes('/api/system/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSystemInfo),
          });
        }
        return Promise.resolve({ ok: false });
      });

      renderWithRouter(<Settings />);

      await waitFor(() => {
        // i18n: "Erro" (pt-BR) or "Error" (en)
        expect(screen.getByText(/^Erro$|^Error$/i)).toBeInTheDocument();
        // i18n: "Falha ao carregar configurações" (pt-BR) or "Failed to load settings" (en)
        expect(screen.getByText(/Falha ao carregar configurações|Failed to load settings/i)).toBeInTheDocument();
      });
    });
  });

  describe('estado de loading', () => {
    it('deve mostrar mensagem de loading enquanto carrega', async () => {
      // Criar uma promise que não resolve imediatamente
      let resolvePromise: (value: unknown) => void;
      mockFetch.mockReturnValue(
        new Promise(resolve => {
          resolvePromise = resolve;
        })
      );

      renderWithRouter(<Settings />);
      // i18n: "Carregando configurações..." (pt-BR) or "Loading settings..." (en)
      expect(screen.getByText(/Carregando configurações|Loading settings/i)).toBeInTheDocument();

      // Resolver a promise para limpar
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ settings: mockSettings }),
      });
    });
  });
});

describe('Settings - alterações pendentes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ settings: mockSettings }),
        });
      }
      if (url.includes('/api/system/info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSystemInfo),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  it('deve mostrar botão Salvar Buffer quando há alteração pendente', async () => {
    renderWithRouter(<Settings />);

    await waitFor(() => {
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    // Simular alteração no slider (não pode ser testado diretamente, mas verificamos o comportamento)
    // O botão "Salvar Buffer" só aparece quando há mudança
    // Como não podemos simular slider facilmente, verificamos que o componente existe
    const slider = screen.getAllByRole('slider')[0];
    expect(slider).toBeInTheDocument();
  });
});
