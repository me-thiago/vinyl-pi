/**
 * MatchConfirmation Modal Component (V2-07)
 *
 * Modal para confirmar/selecionar álbum da coleção quando
 * o reconhecimento musical encontra múltiplos matches.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Music2, Check, Plus, Disc3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { AlbumMatchItem } from '@/hooks/useRecognition';

interface MatchConfirmationProps {
  /** Se o modal está aberto */
  open: boolean;
  /** Callback para mudar estado de abertura */
  onOpenChange: (open: boolean) => void;
  /** Dados do track reconhecido */
  track: {
    id: string;
    title: string;
    artist: string;
    albumArt?: string | null;
  };
  /** Lista de matches possíveis */
  matches: AlbumMatchItem[];
  /** Callback ao confirmar seleção */
  onConfirm: (albumId: string | null) => Promise<void>;
  /** Callback para adicionar à coleção */
  onAddToCollection: () => void;
  /** Se está processando confirmação */
  isConfirming?: boolean;
}

/**
 * Formata confiança como porcentagem
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Modal de confirmação de match de álbum
 */
export function MatchConfirmation({
  open,
  onOpenChange,
  track,
  matches,
  onConfirm,
  onAddToCollection,
  isConfirming = false,
}: MatchConfirmationProps) {
  const { t } = useTranslation();
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  const handleSelect = (albumId: string) => {
    setSelectedAlbumId(albumId);
  };

  const handleConfirm = async (albumId: string | null) => {
    try {
      await onConfirm(albumId);
      onOpenChange(false);
    } catch {
      // Erro tratado no parent
    } finally {
      setSelectedAlbumId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music2 className="w-5 h-5" />
            {t('recognition.confirmTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('recognition.selectAlbum')}
          </DialogDescription>
        </DialogHeader>

        {/* Track Identificado */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          {track.albumArt ? (
            <img
              src={track.albumArt}
              alt={track.title}
              className="w-12 h-12 rounded object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-muted-foreground/20 flex items-center justify-center">
              <Disc3 className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{track.title}</p>
            <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
          </div>
        </div>

        <Separator />

        {/* Lista de Matches */}
        <ScrollArea className="max-h-[280px] pr-4">
          <div className="space-y-2">
            {matches.map((match) => (
              <button
                key={match.albumId}
                onClick={() => handleSelect(match.albumId)}
                disabled={isConfirming}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  'hover:bg-accent hover:border-accent-foreground/20',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  selectedAlbumId === match.albumId && 'border-2 border-foreground bg-accent'
                )}
              >
                {match.coverUrl ? (
                  <img
                    src={match.coverUrl}
                    alt={match.title}
                    className="w-14 h-14 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                    <Disc3 className="w-7 h-7 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate">{match.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{match.artist}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-mono text-muted-foreground">
                    {formatConfidence(match.confidence)}
                  </span>
                  {selectedAlbumId === match.albumId && isConfirming ? (
                    <div className="w-5 h-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Check className={cn(
                      'w-5 h-5 text-primary opacity-0 transition-opacity',
                      selectedAlbumId === match.albumId && 'opacity-100'
                    )} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <Separator />

        {/* Ações */}
        <div className="flex flex-col gap-2">
          {/* Botão principal dinâmico */}
          {selectedAlbumId ? (
            // Com seleção → Confirmar álbum selecionado
            <Button
              variant="default"
              className="w-full"
              onClick={() => handleConfirm(selectedAlbumId)}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {t('recognition.confirmSelection')}
            </Button>
          ) : (
            // Sem seleção → Adicionar novo álbum
            <Button
              variant="default"
              className="w-full gap-1"
              onClick={onAddToCollection}
              disabled={isConfirming}
            >
              <Plus className="w-4 h-4" />
              {t('recognition.addToCollection')}
            </Button>
          )}
          
          {/* Ação secundária */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleConfirm(null)}
            disabled={isConfirming}
          >
            {t('recognition.noneOfThese')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
