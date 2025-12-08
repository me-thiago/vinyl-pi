/**
 * MarkerList - Lista de marcadores de faixa
 *
 * Inclui:
 * - Lista de marcadores existentes
 * - Edição inline de título
 * - Botão de adicionar novo marcador
 * - Botão de deletar
 *
 * @module components/Editor/MarkerList
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Music,
  Plus,
  Trash2,
  GripVertical,
  Play,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { UseWaveformReturn, MarkerData } from '@/hooks/useWaveform';

interface MarkerListProps {
  markers: MarkerData[];
  waveform: UseWaveformReturn;
  onAddMarker: () => void;
  onUpdateMarker: (id: string, data: Partial<MarkerData>) => void;
  onDeleteMarker: (id: string) => void;
}

/**
 * Formata segundos para MM:SS
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface MarkerItemProps {
  marker: MarkerData;
  onSeek: (time: number) => void;
  onUpdate: (id: string, data: Partial<MarkerData>) => void;
  onDelete: (id: string) => void;
}

function MarkerItem({ marker, onSeek, onUpdate, onDelete }: MarkerItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(marker.title || '');

  const handleSaveTitle = () => {
    onUpdate(marker.id, { title: editTitle || undefined });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(marker.title || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group">
      {/* Drag Handle (visual only for now) */}
      <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />

      {/* Track Number */}
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
        {marker.trackNumber}
      </div>

      {/* Title / Time */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Faixa ${marker.trackNumber}`}
              className="h-7 text-sm"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleSaveTitle}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCancelEdit}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <div className="font-medium text-sm truncate">
              {marker.title || `Faixa ${marker.trackNumber}`}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatTime(marker.startOffset)} - {formatTime(marker.endOffset)}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onSeek(marker.startOffset)}
            title="Ir para marcador"
          >
            <Play className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsEditing(true)}
            title="Editar título"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(marker.id)}
            title="Remover marcador"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function MarkerList({
  markers,
  waveform,
  onAddMarker,
  onUpdateMarker,
  onDeleteMarker,
}: MarkerListProps) {
  const { t } = useTranslation();
  const { seek, currentTime, duration, isReady } = waveform;

  const sortedMarkers = [...markers].sort((a, b) => a.trackNumber - b.trackNumber);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">
            {t('editor.markers.title', 'Marcadores de Faixa')}
          </span>
          <span className="text-sm text-muted-foreground">
            ({markers.length})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddMarker}
          disabled={!isReady}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('editor.markers.add', 'Adicionar')}
        </Button>
      </div>

      {/* Markers List */}
      {markers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            {t('editor.markers.empty', 'Nenhum marcador definido')}
          </p>
          <p className="text-xs mt-1">
            {t(
              'editor.markers.emptyHint',
              'Clique em "Adicionar" ou clique na waveform para criar um marcador'
            )}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 pr-4">
            {sortedMarkers.map((marker) => (
              <MarkerItem
                key={marker.id}
                marker={marker}
                onSeek={seek}
                onUpdate={onUpdateMarker}
                onDelete={onDeleteMarker}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Current Position Hint */}
      {isReady && (
        <div className="text-xs text-muted-foreground border-t pt-3">
          {t('editor.markers.currentPosition', 'Posição atual')}:{' '}
          <span className="font-mono">{formatTime(currentTime)}</span>
          {' / '}
          <span className="font-mono">{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
}
