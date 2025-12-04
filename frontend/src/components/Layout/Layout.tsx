import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Header } from './Header';
import { PlayerBar } from './PlayerBar';
import { useAudioStream } from '@/hooks/useAudioStream';
import { useStreamingControl } from '@/hooks/useStreamingControl';

// Contexto exportado para páginas filhas acessarem o analyser
export interface LayoutContext {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export function Layout() {
  const [bufferMs, setBufferMs] = useState(150);

  // Buscar configuração de buffer da API
  useEffect(() => {
    const fetchBufferSetting = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/settings`);
        if (response.ok) {
          const data = await response.json();
          const bufferSetting = data.settings?.find((s: { key: string }) => s.key === 'player.buffer_ms');
          if (bufferSetting?.value) {
            setBufferMs(bufferSetting.value);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch buffer setting, using default:', err);
      }
    };
    fetchBufferSetting();
  }, []);

  // Detectar host para stream URL
  const getStreamUrl = () => {
    const baseUrl = import.meta.env.VITE_STREAM_URL || 'http://localhost:8000/stream';
    if (baseUrl.includes('localhost')) {
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return baseUrl.replace('localhost', 'pi.local');
      }
    }
    return baseUrl;
  };

  // Hook de áudio - vive no Layout para persistir entre páginas
  const audioState = useAudioStream({
    streamUrl: getStreamUrl(),
    bufferSize: bufferMs,
    onError: (err) => {
      console.error('Audio stream error:', err);
    },
  });

  // Hook de controle do streaming do backend
  const streamingControl = useStreamingControl();

  // Atualizar status do backend periodicamente
  const { refreshStatus } = streamingControl;
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Contexto para páginas filhas
  const outletContext: LayoutContext = {
    analyser: audioState.state.analyser,
    isPlaying: audioState.playing,
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pb-16">
        <Outlet context={outletContext} />
      </main>

      <PlayerBar
        playing={audioState.playing}
        buffering={audioState.buffering}
        volume={audioState.volume}
        latency={audioState.latency}
        error={audioState.error}
        analyser={audioState.state.analyser}
        togglePlayPause={audioState.togglePlayPause}
        setVolume={audioState.setVolume}
        isStreaming={streamingControl.isStreaming}
        isStreamingLoading={streamingControl.isLoading}
        streamingError={streamingControl.error}
        startStreaming={streamingControl.startStreaming}
        stopStreaming={streamingControl.stopStreaming}
      />
    </div>
  );
}
