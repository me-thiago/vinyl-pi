import { Circle, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface RecordButtonProps {
  isRecording: boolean;
  isLoading: boolean;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Botão de gravação para o footer do player
 * 
 * Estados:
 * - Não gravando: Ícone de círculo (Record)
 * - Gravando: Ícone de quadrado pulsante (Stop)
 * - Loading: Disabled durante transição
 */
export function RecordButton({ isRecording, isLoading, onClick, disabled }: RecordButtonProps) {
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'relative',
        isRecording && 'text-red-500 hover:text-red-600'
      )}
      title={isRecording ? t('recording.stop') : t('recording.start')}
    >
      {isRecording ? (
        <>
          <Square className={cn('w-5 h-5', isRecording && 'animate-pulse')} />
          {/* Indicador visual de gravação ativa */}
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </>
      ) : (
        <Circle className="w-5 h-5" />
      )}
    </Button>
  );
}
