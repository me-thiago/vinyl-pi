import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Player } from '../Player';

// Mock do hook
vi.mock('@/hooks/useAudioStream', () => ({
  useAudioStream: vi.fn(() => ({
    playing: false,
    buffering: false,
    error: null,
    latency: 0,
    volume: 1.0,
    analyser: null,
    togglePlayPause: vi.fn(),
    setVolume: vi.fn(),
    webAudioSupported: true,
    startStream: vi.fn(),
    stopStream: vi.fn(),
    state: {
      playing: false,
      buffering: false,
      error: null,
      latency: 0,
      volume: 1.0,
      analyser: null,
    },
  })),
}));

describe('Player', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    // URL não está mais visível na nova interface
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

  it('deve chamar togglePlayPause ao clicar no botão', async () => {
    const mockTogglePlayPause = vi.fn();
    const useAudioStreamModule = await import('@/hooks/useAudioStream');
    vi.mocked(useAudioStreamModule.useAudioStream).mockReturnValue({
      playing: false,
      buffering: false,
      error: null,
      latency: 0,
      volume: 1.0,
      analyser: null,
      togglePlayPause: mockTogglePlayPause,
      setVolume: vi.fn(),
      webAudioSupported: true,
      startStream: vi.fn(),
      stopStream: vi.fn(),
      state: {
        playing: false,
        buffering: false,
        error: null,
        latency: 0,
        volume: 1.0,
        analyser: null,
      },
    });

    render(<Player />);
    const playButton = screen.getAllByRole('button')[0];
    await userEvent.click(playButton);

    expect(mockTogglePlayPause).toHaveBeenCalledTimes(1);
  });

  it('deve exibir aviso quando Web Audio não suportado', async () => {
    const useAudioStreamModule = await import('@/hooks/useAudioStream');
    vi.mocked(useAudioStreamModule.useAudioStream).mockReturnValue({
      playing: false,
      buffering: false,
      error: null,
      latency: 0,
      volume: 1.0,
      analyser: null,
      togglePlayPause: vi.fn(),
      setVolume: vi.fn(),
      webAudioSupported: false as true,
      startStream: vi.fn(),
      stopStream: vi.fn(),
      state: {
        playing: false,
        buffering: false,
        error: null,
        latency: 0,
        volume: 1.0,
        analyser: null,
      },
    });

    render(<Player />);
    expect(screen.getByText(/Web Audio API não suportado/i)).toBeInTheDocument();
  });

  it('deve exibir mensagem de erro quando houver erro', async () => {
    const useAudioStreamModule = await import('@/hooks/useAudioStream');
    vi.mocked(useAudioStreamModule.useAudioStream).mockReturnValue({
      playing: false,
      buffering: false,
      error: 'Connection failed',
      latency: 0,
      volume: 1.0,
      analyser: null,
      togglePlayPause: vi.fn(),
      setVolume: vi.fn(),
      webAudioSupported: true,
      startStream: vi.fn(),
      stopStream: vi.fn(),
      state: {
        playing: false,
        buffering: false,
        error: 'Connection failed',
        latency: 0,
        volume: 1.0,
        analyser: null,
      },
    });

    render(<Player />);
    expect(screen.getByText(/Erro de Conexão/i)).toBeInTheDocument();
    expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
  });

  it('deve exibir indicador de buffering', async () => {
    const useAudioStreamModule = await import('@/hooks/useAudioStream');
    vi.mocked(useAudioStreamModule.useAudioStream).mockReturnValue({
      playing: true,
      buffering: true,
      error: null,
      latency: 0,
      volume: 1.0,
      analyser: null,
      togglePlayPause: vi.fn(),
      setVolume: vi.fn(),
      webAudioSupported: true,
      startStream: vi.fn(),
      stopStream: vi.fn(),
      state: {
        playing: true,
        buffering: true,
        error: null,
        latency: 0,
        volume: 1.0,
        analyser: null,
      },
    });

    render(<Player />);
    expect(screen.getByText(/Carregando stream/i)).toBeInTheDocument();
  });
});

