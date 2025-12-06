/**
 * RecognitionButton Component (V2-07)
 *
 * Botão de reconhecimento musical para o PlayerBar.
 * Mostra estados visuais: idle, loading, success, error.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Music2, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface RecognitionButtonProps {
  /** Desabilita o botão */
  disabled?: boolean;
  /** Estado atual do botão (controlado externamente) */
  state?: ButtonState;
  /** Callback ao clicar */
  onClick?: () => void;
  /** Classe CSS adicional */
  className?: string;
}

/**
 * Botão de reconhecimento musical com feedback visual
 */
export function RecognitionButton({
  disabled = false,
  state = 'idle',
  onClick,
  className,
}: RecognitionButtonProps) {
  const { t } = useTranslation();
  const [internalState, setInternalState] = useState<ButtonState>(state);

  // Sincroniza estado externo
  useEffect(() => {
    setInternalState(state);
  }, [state]);

  // Reset automático após success/error (3s)
  useEffect(() => {
    if (internalState === 'success' || internalState === 'error') {
      const timer = setTimeout(() => {
        setInternalState('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [internalState]);

  const isLoading = internalState === 'loading';
  const isSuccess = internalState === 'success';
  const isError = internalState === 'error';

  // Ícone baseado no estado
  const Icon = isLoading
    ? Loader2
    : isSuccess
      ? Check
      : isError
        ? X
        : Music2;

  // Variante visual
  const getVariant = () => {
    if (isSuccess) return 'default';
    if (isError) return 'destructive';
    return 'outline';
  };

  // Tooltip/aria-label
  const getLabel = () => {
    if (isLoading) return t('recognition.identifying');
    if (isSuccess) return t('recognition.success');
    if (isError) return t('recognition.error');
    return t('recognition.identify');
  };

  return (
    <Button
      variant={getVariant()}
      size="icon"
      className={cn(
        'h-8 w-8 shrink-0 transition-colors',
        isSuccess && 'bg-green-600 hover:bg-green-600 text-white',
        isError && 'bg-destructive hover:bg-destructive text-destructive-foreground',
        className
      )}
      onClick={onClick}
      disabled={disabled || isLoading}
      title={getLabel()}
      aria-label={getLabel()}
    >
      <Icon
        className={cn(
          'w-4 h-4',
          isLoading && 'animate-spin'
        )}
      />
    </Button>
  );
}
