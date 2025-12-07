import { cn } from '@/lib/utils';

interface RecordingStatusProps {
  durationSeconds: number;
  fileSizeBytes?: number;
  className?: string;
}

/**
 * Indicador de gravação ativa com duração e tamanho
 * Exibido ao lado do botão de gravação quando recording ativo
 */
export function RecordingStatus({ durationSeconds, fileSizeBytes, className }: RecordingStatusProps) {

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
      
      {/* Duração */}
      <span className="font-mono text-red-500">
        {formattedDuration}
      </span>

      {/* Tamanho (opcional) */}
      {formattedSize && (
        <>
          <span className="text-muted-foreground">•</span>
          <span>{formattedSize}</span>
        </>
      )}
    </div>
  );
}
