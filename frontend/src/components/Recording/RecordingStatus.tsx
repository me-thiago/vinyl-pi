import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RecordingStatusProps {
  durationSeconds: number;
  fileSizeBytes?: number;
  className?: string;
}

/**
 * Indicador de gravação ativa com duração e tamanho
 * Exibido ao lado do botão de gravação quando recording ativo
 *
 * V3a-08: Alterna entre duração e tamanho a cada 3 segundos
 */
export function RecordingStatus({ durationSeconds, fileSizeBytes, className }: RecordingStatusProps) {
  // V3a-08: Alternar entre duração e tamanho a cada 3s
  const [showDuration, setShowDuration] = useState(true);

  useEffect(() => {
    // Só alternar se tivermos tamanho disponível
    if (!fileSizeBytes) return;

    const interval = setInterval(() => {
      setShowDuration(prev => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, [fileSizeBytes]);

  // Formatar duração como mm:ss
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Formatar tamanho em MB (se disponível)
  const formattedSize = fileSizeBytes
    ? `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB`
    : null;

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      {/* Ícone pulsante */}
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />

      {/* Duração ou Tamanho (com transição) */}
      <div className="relative overflow-hidden min-w-[60px]">
        <span
          className={cn(
            'font-mono text-red-500 transition-all duration-300',
            showDuration || !formattedSize
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-2 absolute'
          )}
        >
          {formattedDuration}
        </span>
        {formattedSize && (
          <span
            className={cn(
              'text-muted-foreground transition-all duration-300',
              !showDuration
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 absolute'
            )}
          >
            {formattedSize}
          </span>
        )}
      </div>
    </div>
  );
}
