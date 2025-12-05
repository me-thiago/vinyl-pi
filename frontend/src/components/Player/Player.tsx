import { Play, Pause, Volume2, Radio, Power, PowerOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useAudioStream } from '@/hooks/useAudioStream';
import { useStreamingControl } from '@/hooks/useStreamingControl';
import { VinylVisualizer } from '@/components/VinylVisualizer/VinylVisualizer';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

// API config
const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
const API_BASE = `${API_HOST}/api`;

interface PlayerProps {
  streamUrl?: string;
  className?: string;
}

export function Player({ streamUrl = 'http://localhost:8000/stream', className }: PlayerProps) {
  const { t } = useTranslation();
  const [bufferMs, setBufferMs] = useState(150); // Default, will be updated from settings

  // Fetch buffer setting from API
  useEffect(() => {
    const fetchBufferSetting = async () => {
      try {
        const response = await fetch(`${API_BASE}/settings`);
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

  // Detectar host automaticamente (localhost vs pi.local)
  const getStreamUrl = () => {
    if (streamUrl.includes('localhost')) {
      // Tentar pi.local se estiver em produção ou em rede local
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return streamUrl.replace('localhost', 'pi.local');
      }
    }
    return streamUrl;
  };

  const effectiveStreamUrl = getStreamUrl();

  const {
    playing,
    buffering,
    error,
    latency,
    volume,
    togglePlayPause,
    setVolume,
    webAudioSupported,
    state,
  } = useAudioStream({
    streamUrl: effectiveStreamUrl,
    bufferSize: bufferMs,
    onError: (err) => {
      console.error('Audio stream error:', err);
    },
  });

  // Hook para controlar streaming do backend
  const {
    isStreaming: backendStreaming,
    isLoading: streamingLoading,
    error: streamingError,
    startStreaming,
    stopStreaming,
    refreshStatus,
  } = useStreamingControl();

  // Atualizar status do backend periodicamente
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000); // A cada 5s
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Determinar status visual do streaming
  const streamingStatus = playing && !error ? 'active' : 'inactive';
  const isStreamingActive = streamingStatus === 'active';

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5" />
              {t('player.title')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('player.description')}
            </CardDescription>
          </div>
          <Badge
            variant={isStreamingActive ? 'default' : 'secondary'}
            className={cn(
              'flex items-center gap-1.5',
              isStreamingActive && 'animate-pulse'
            )}
          >
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                isStreamingActive ? 'bg-green-500' : 'bg-gray-400'
              )}
            />
            {isStreamingActive ? t('player.onAir') : t('player.inactive')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Vinyl Visualizer Canvas */}
        <div className="flex flex-col items-center">
          <VinylVisualizer analyser={state.analyser} isPlaying={playing} />
        </div>

        {/* Controles de Streaming do Backend */}
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border">
          <div className="flex-1">
            <p className="text-sm font-medium mb-1">{t('player.backendStreaming')}</p>
            <p className="text-xs text-muted-foreground">
              {backendStreaming ? t('player.ffmpegCapturing') : t('player.streamingStopped')}
            </p>
          </div>
          <Button
            onClick={backendStreaming ? stopStreaming : startStreaming}
            disabled={streamingLoading}
            size="sm"
            variant={backendStreaming ? 'destructive' : 'default'}
            className="h-9 px-4"
          >
            {streamingLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                {backendStreaming ? t('player.stopping') : t('player.starting')}
              </>
            ) : backendStreaming ? (
              <>
                <PowerOff className="w-4 h-4 mr-2" />
                {t('player.stop')}
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                {t('player.start')}
              </>
            )}
          </Button>
        </div>

        {/* Erro de streaming do backend */}
        {streamingError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive font-medium">{t('player.backendError')}</p>
            <p className="text-xs text-destructive/80 mt-1">{streamingError}</p>
          </div>
        )}

        {/* Controles de Playback (Frontend) */}
        <div className="flex items-center gap-4">
          <Button
            onClick={togglePlayPause}
            disabled={buffering || !backendStreaming}
            size="lg"
            variant={playing ? 'default' : 'outline'}
            className="h-12 px-6 transition-transform hover:scale-105"
          >
            {playing ? (
              <>
                <Pause className="w-5 h-5 mr-2" />
                {t('player.pause')}
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                {t('player.play')}
              </>
            )}
          </Button>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t('player.volume')}</span>
              <span className="text-sm font-medium ml-auto">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <Slider
              value={[volume * 100]}
              onValueChange={(values: number[]) => setVolume(values[0] / 100)}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <Badge variant="outline" className="px-3 py-1">
            {latency.toFixed(0)}ms
          </Badge>
        </div>

        {/* Mensagens de erro */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive font-medium">{t('player.connectionError')}</p>
            <p className="text-xs text-destructive/80 mt-1">{error}</p>
          </div>
        )}

        {/* Indicador de buffering */}
        {buffering && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>{t('player.loadingStream')}</span>
          </div>
        )}

        {/* Aviso Web Audio não suportado */}
        {!webAudioSupported && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
              {t('player.webAudioNotSupported')}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
              {t('player.webAudioNotSupportedDesc')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

