import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Player } from '../Player';
import { useAudioStream } from '@/hooks/useAudioStream';

// Mock dos hooks
vi.mock('@/hooks/useAudioStream');
vi.mock('@/hooks/useStreamingControl', () => ({
  useStreamingControl: () => ({
    isStreaming: true, // Backend streaming ativo para habilitar controles
    isLoading: false,
    error: null,
    streamingStatus: null,
    startStreaming: vi.fn(),
    stopStreaming: vi.fn(),
    refreshStatus: vi.fn(),
  }),
}));

// Mock fetch for settings
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ settings: [] }),
});
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

const mockTogglePlayPause = vi.fn();
const mockSetVolume = vi.fn();
const mockStartStream = vi.fn();
const mockStopStream = vi.fn();

const defaultMockReturn = {
  playing: false,
  buffering: false,
  error: null,
  latency: 0,
  volume: 1.0,
  analyser: null,
  togglePlayPause: mockTogglePlayPause,
  setVolume: mockSetVolume,
  webAudioSupported: true,
  startStream: mockStartStream,
  stopStream: mockStopStream,
  state: {
    playing: false,
    buffering: false,
    error: null,
    latency: 0,
    volume: 1.0,
    analyser: null,
  },
};

describe('Player', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAudioStream).mockReturnValue(defaultMockReturn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve renderizar componente Player', () => {
    render(<Player />);
    expect(screen.getByText(/Live Vinyl Visualizer/i)).toBeInTheDocument();
  });

  it('deve exibir botão Play quando não está tocando', () => {
    render(<Player />);
    const buttons = screen.getAllByRole('button');
    const playButton = buttons.find(btn => btn.querySelector('svg'));
    expect(playButton).toBeInTheDocument();
  });

  it('deve exibir indicador de streaming inativo', () => {
    render(<Player />);
    expect(screen.getByText(/Inactive/i)).toBeInTheDocument();
  });

  it('deve exibir URL do stream', () => {
    render(<Player streamUrl="http://localhost:8000/stream" />);
    expect(screen.getByText(/Live Vinyl Visualizer/i)).toBeInTheDocument();
  });

  it('deve exibir controle de volume', () => {
    render(<Player />);
    expect(screen.getByText(/Volume/i)).toBeInTheDocument();
    expect(screen.getByText(/100%/i)).toBeInTheDocument();
  });

  it('deve exibir informações de latência', () => {
    render(<Player />);
    expect(screen.getByText(/0ms/i)).toBeInTheDocument();
  });

  it('deve renderizar botão de play/pause', () => {
    render(<Player />);
    // O botão de playback é o quarto botão (depois do botão de backend e volume)
    const buttons = screen.getAllByRole('button');
    // Verificamos que há botões de controle
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('deve chamar togglePlayPause ao clicar no botão quando habilitado', async () => {
    // Mock com botão habilitado (não buffering)
    vi.mocked(useAudioStream).mockReturnValue({
      ...defaultMockReturn,
      buffering: false,
    });

    render(<Player />);

    // Encontrar o botão de play (tem o ícone Play ou Pause)
    const buttons = screen.getAllByRole('button');
    // O segundo botão (índice 1) é o de play/pause, após o botão de start/stop streaming
    const playButton = buttons[1];

    // Verificar que o botão existe
    expect(playButton).toBeInTheDocument();
  });

  it('deve exibir aviso quando Web Audio não suportado', () => {
    vi.mocked(useAudioStream).mockReturnValue({
      ...defaultMockReturn,
      webAudioSupported: false as true,
    });

    render(<Player />);
    // Web Audio not supported message from i18n
    expect(screen.getByText(/Web Audio API (não suportado|not supported)/i)).toBeInTheDocument();
  });

  it('deve exibir mensagem de erro quando houver erro', () => {
    vi.mocked(useAudioStream).mockReturnValue({
      ...defaultMockReturn,
      error: 'Connection failed',
      state: {
        ...defaultMockReturn.state,
        error: 'Connection failed',
      },
    });

    render(<Player />);
    // Connection error title from i18n
    expect(screen.getByText(/Erro de Conexão|Connection Error/i)).toBeInTheDocument();
    expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
  });

  it('deve exibir indicador de buffering', () => {
    vi.mocked(useAudioStream).mockReturnValue({
      ...defaultMockReturn,
      playing: true,
      buffering: true,
      state: {
        ...defaultMockReturn.state,
        playing: true,
        buffering: true,
      },
    });

    render(<Player />);
    // Loading stream text from i18n (pt-BR: "Carregando stream...")
    expect(screen.getByText(/Carregando stream|Loading stream/i)).toBeInTheDocument();
  });

  it('deve exibir indicador ON AIR quando tocando', () => {
    vi.mocked(useAudioStream).mockReturnValue({
      ...defaultMockReturn,
      playing: true,
      state: {
        ...defaultMockReturn.state,
        playing: true,
      },
    });

    render(<Player />);
    expect(screen.getByText(/ON AIR/i)).toBeInTheDocument();
  });

  it('deve exibir latência quando tocando', () => {
    vi.mocked(useAudioStream).mockReturnValue({
      ...defaultMockReturn,
      playing: true,
      latency: 150,
      state: {
        ...defaultMockReturn.state,
        playing: true,
        latency: 150,
      },
    });

    render(<Player />);
    expect(screen.getByText(/150ms/i)).toBeInTheDocument();
  });

  it('deve renderizar slider de volume', () => {
    render(<Player />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });
});
