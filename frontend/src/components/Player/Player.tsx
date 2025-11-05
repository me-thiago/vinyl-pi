import { Play, Pause, Volume2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useAudioStream } from '@/hooks/useAudioStream';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface PlayerProps {
  streamUrl?: string;
  className?: string;
}

export function Player({ streamUrl = 'http://localhost:8000/stream', className }: PlayerProps) {
  const [bufferSize, setBufferSize] = useState(400); // ms - aumentado para reduzir "picotes"

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
  } = useAudioStream({
    streamUrl: effectiveStreamUrl,
    bufferSize,
    onError: (err) => {
      console.error('Audio stream error:', err);
    },
  });

  // Determinar status visual do streaming
  const streamingStatus = playing && !error ? 'active' : 'inactive';
  const isStreamingActive = streamingStatus === 'active';

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5" />
            Player de Áudio
          </CardTitle>
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
            {isStreamingActive ? 'Streaming Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controles principais */}
        <div className="flex items-center gap-4">
          <Button
            onClick={togglePlayPause}
            disabled={buffering}
            size="lg"
            className="w-16 h-16 rounded-full"
          >
            {playing ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </Button>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Volume</span>
              <span className="text-sm font-medium ml-auto">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <Slider
              value={[volume * 100]}
              onValueChange={([value]) => setVolume(value / 100)}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {/* Indicadores de status */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="text-muted-foreground">Latência:</span>
            <span className="ml-2 font-medium">
              {latency.toFixed(0)} ms
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Buffer:</span>
            <span className="ml-2 font-medium">{bufferSize} ms</span>
          </div>
        </div>

        {/* Controle de Buffer - sempre visível */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm font-medium">Tamanho do Buffer</span>
              <span className="text-xs text-muted-foreground ml-2">({bufferSize} ms)</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {bufferSize < 250 ? 'Baixa latência' : bufferSize < 400 ? 'Balanceado' : 'Mais estável'}
            </span>
          </div>
          <Slider
            value={[bufferSize]}
            onValueChange={([value]) => setBufferSize(value)}
            min={100}
            max={800}
            step={50}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>100ms (mínimo)</span>
            <span>400ms (recomendado)</span>
            <span>800ms (máximo)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Aumente o buffer se o áudio estiver "picotado". Buffer maior = mais estável, mas maior latência.
          </p>
        </div>

        {/* Mensagens de erro */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive font-medium">Erro de Conexão</p>
            <p className="text-xs text-destructive/80 mt-1">{error}</p>
          </div>
        )}

        {/* Indicador de buffering */}
        {buffering && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Carregando stream...</span>
          </div>
        )}


        {/* Aviso Web Audio não suportado */}
        {!webAudioSupported && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
              Web Audio API não suportado
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
              Este navegador não suporta Web Audio API. Funcionalidade limitada.
            </p>
          </div>
        )}

        {/* URL do stream (debug) */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Stream: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{effectiveStreamUrl}</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

