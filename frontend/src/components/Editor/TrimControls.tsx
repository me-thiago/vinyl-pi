/**
 * TrimControls - Controles de corte (trim)
 *
 * Inclui:
 * - Botão para ativar/desativar trim region
 * - Inputs de início e fim
 * - Botão de preview
 * - Botão de aplicar trim
 *
 * @module components/Editor/TrimControls
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Scissors, Play, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { UseWaveformReturn, TrimRegion } from '@/hooks/useWaveform';

interface TrimControlsProps {
  waveform: UseWaveformReturn;
  onTrimApply: (region: TrimRegion) => Promise<void>;
  isApplying?: boolean;
}

/**
 * Converte string MM:SS ou HH:MM:SS para segundos
 */
function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parseFloat(timeStr) || 0;
}

/**
 * Formata segundos para MM:SS.mmm
 */
function formatTimeInput(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00.000';

  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m.toString().padStart(2, '0')}:${s.padStart(6, '0')}`;
}

export function TrimControls({
  waveform,
  onTrimApply,
  isApplying = false,
}: TrimControlsProps) {
  const { t } = useTranslation();
  const { duration, setTrimRegion, getTrimRegion, seek, play, pause, isReady } = waveform;

  const [trimEnabled, setTrimEnabled] = useState(false);
  const [startTime, setStartTime] = useState('00:00.000');
  const [endTime, setEndTime] = useState('00:00.000');
  const [showConfirm, setShowConfirm] = useState(false);

  // Ativar/desativar modo trim
  const toggleTrim = () => {
    if (trimEnabled) {
      // Desativar
      setTrimRegion(null);
      setTrimEnabled(false);
    } else {
      // Ativar com região padrão (10% do início e fim)
      const start = 0;
      const end = duration;
      setStartTime(formatTimeInput(start));
      setEndTime(formatTimeInput(end));
      setTrimRegion({ start, end });
      setTrimEnabled(true);
    }
  };

  // Atualizar região quando inputs mudam
  const handleStartChange = (value: string) => {
    setStartTime(value);
    const seconds = parseTime(value);
    const currentEnd = parseTime(endTime);
    if (seconds < currentEnd && seconds >= 0) {
      setTrimRegion({ start: seconds, end: currentEnd });
    }
  };

  const handleEndChange = (value: string) => {
    setEndTime(value);
    const seconds = parseTime(value);
    const currentStart = parseTime(startTime);
    if (seconds > currentStart && seconds <= duration) {
      setTrimRegion({ start: currentStart, end: seconds });
    }
  };

  // Sincronizar com região do waveform
  const syncFromRegion = () => {
    const region = getTrimRegion();
    if (region) {
      setStartTime(formatTimeInput(region.start));
      setEndTime(formatTimeInput(region.end));
    }
  };

  // Preview do segmento
  const handlePreview = () => {
    const region = getTrimRegion();
    if (region) {
      pause();
      seek(region.start);
      play();
      // TODO: Parar no end (requer lógica adicional)
    }
  };

  // Aplicar trim
  const handleApplyClick = () => {
    syncFromRegion(); // Garantir que temos os valores atuais
    setShowConfirm(true);
  };

  const handleConfirmTrim = async () => {
    setShowConfirm(false);
    const region = getTrimRegion();
    if (region) {
      await onTrimApply(region);
      setTrimEnabled(false);
      setTrimRegion(null);
    }
  };

  const trimDuration = parseTime(endTime) - parseTime(startTime);

  return (
    <div className="space-y-4">
      {/* Toggle Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{t('editor.trim.title', 'Cortar Áudio')}</span>
        </div>
        <Button
          variant={trimEnabled ? 'destructive' : 'outline'}
          size="sm"
          onClick={toggleTrim}
          disabled={!isReady}
        >
          {trimEnabled
            ? t('editor.trim.cancel', 'Cancelar')
            : t('editor.trim.enable', 'Ativar Corte')}
        </Button>
      </div>

      {/* Trim Controls (quando ativo) */}
      {trimEnabled && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          {/* Time Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trim-start">{t('editor.trim.start', 'Início')}</Label>
              <Input
                id="trim-start"
                value={startTime}
                onChange={(e) => handleStartChange(e.target.value)}
                placeholder="00:00.000"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trim-end">{t('editor.trim.end', 'Fim')}</Label>
              <Input
                id="trim-end"
                value={endTime}
                onChange={(e) => handleEndChange(e.target.value)}
                placeholder="00:00.000"
                className="font-mono"
              />
            </div>
          </div>

          {/* Info */}
          <div className="text-sm text-muted-foreground">
            {t('editor.trim.newDuration', 'Nova duração')}: {formatTimeInput(trimDuration)}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              {t('editor.trim.preview', 'Preview')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleApplyClick}
              disabled={isApplying || trimDuration <= 0}
              className="flex-1"
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Scissors className="h-4 w-4 mr-2" />
              )}
              {t('editor.trim.apply', 'Aplicar Corte')}
            </Button>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <span className="text-destructive">
              {t('editor.trim.warning', 'Esta operação é irreversível. O áudio fora da seleção será permanentemente removido.')}
            </span>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('editor.trim.confirmTitle', 'Confirmar Corte')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'editor.trim.confirmDescription',
                'Você está prestes a cortar o áudio. Esta operação é irreversível e removerá permanentemente o conteúdo fora da seleção.'
              )}
              <br /><br />
              <strong>{t('editor.trim.newDuration', 'Nova duração')}:</strong> {formatTimeInput(trimDuration)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('common.cancel', 'Cancelar')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTrim}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('editor.trim.confirmButton', 'Sim, Cortar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
