/**
 * WaveformEditor - Componente de visualização de waveform
 *
 * Wrapper do wavesurfer.js com:
 * - Visualização de waveform
 * - Zoom controls
 * - Cursor de posição
 *
 * @module components/Editor/WaveformEditor
 */

import { useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UseWaveformReturn } from '@/hooks/useWaveform';
import { cn } from '@/lib/utils';

interface WaveformEditorProps {
  waveform: UseWaveformReturn;
  streamUrl: string;
  className?: string;
}

export function WaveformEditor({
  waveform,
  streamUrl,
  className,
}: WaveformEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { init, isReady, error, zoomIn, zoomOut } = waveform;

  // Inicializar wavesurfer quando container estiver pronto
  useEffect(() => {
    if (containerRef.current && streamUrl) {
      init({
        container: containerRef.current,
        url: streamUrl,
        height: 128,
        barWidth: 2,
        barRadius: 2,
        normalize: true,
        // Cores mais visíveis para o cursor (playhead)
        cursorColor: '#ef4444', // Red-500 para máxima visibilidade
      });
    }
  }, [init, streamUrl]);

  return (
    <div className={cn('relative', className)}>
      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={zoomOut}
          disabled={!isReady}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={zoomIn}
          disabled={!isReady}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Waveform Container */}
      <div
        ref={containerRef}
        className={cn(
          'w-full rounded-lg bg-muted/50 border overflow-hidden',
          // Estilo customizado para cursor/playhead mais visível
          '[&_[part=cursor]]:!w-[2px] [&_[part=cursor]]:!shadow-[0_0_4px_rgba(239,68,68,0.8)]',
          !isReady && 'min-h-[128px]'
        )}
      />

      {/* Loading State */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando áudio...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 rounded-lg">
          <div className="text-destructive text-sm">{error}</div>
        </div>
      )}
    </div>
  );
}
