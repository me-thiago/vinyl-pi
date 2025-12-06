import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Play, Pause, Volume2, VolumeX, Settings, Power, Loader2, LayoutDashboard, Activity, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { MiniVuMeter } from './MiniVuMeter';
import { RecognitionButton, MatchConfirmation, type ButtonState } from '@/components/Recognition';
import { useRecognition, type RecognizedTrack, type AlbumMatchItem } from '@/hooks/useRecognition';
import { cn } from '@/lib/utils';

interface PlayerBarProps {
  // Audio state
  playing: boolean;
  buffering: boolean;
  volume: number;
  latency: number;
  error: string | null;
  analyser: AnalyserNode | null;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
  // Streaming control
  isStreaming: boolean;
  isStreamingLoading: boolean;
  streamingError: string | null;
  startStreaming: () => void;
  stopStreaming: () => void;
}

export function PlayerBar({
  playing,
  buffering,
  volume,
  latency,
  error,
  analyser,
  togglePlayPause,
  setVolume,
  isStreaming,
  isStreamingLoading,
  streamingError,
  startStreaming,
  stopStreaming,
}: PlayerBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Recognition state (V2-07)
  const {
    recognize,
    confirm,
    isRecognizing,
    isConfirming,
    reset: resetRecognition,
  } = useRecognition();

  const [recognitionButtonState, setRecognitionButtonState] = useState<ButtonState>('idle');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<RecognizedTrack | null>(null);
  const [currentMatches, setCurrentMatches] = useState<AlbumMatchItem[]>([]);

  const hasError = error || streamingError;
  const canPlay = isStreaming && !isStreamingLoading;

  /**
   * Handler para clique no botão de reconhecimento
   */
  const handleRecognize = useCallback(async () => {
    setRecognitionButtonState('loading');

    const result = await recognize();

    if (result.success && result.track) {
      const track = result.track;

      // Verifica se precisa confirmação
      if (track.albumMatch?.needsConfirmation && track.albumMatch.matches.length > 0) {
        // Abre modal de confirmação
        setCurrentTrack(track);
        setCurrentMatches(track.albumMatch.matches);
        setShowMatchModal(true);
        setRecognitionButtonState('idle');
      } else if (track.albumMatch && !track.albumMatch.needsConfirmation) {
        // Match automático - mostra toast de sucesso
        setRecognitionButtonState('success');
        toast.success(t('recognition.playing', { title: track.title, artist: track.artist }));
      } else {
        // Sem match na coleção - oferece adicionar
        setRecognitionButtonState('success');
        setCurrentTrack(track); // Salva para uso no botão de adicionar
        toast.info(t('recognition.playing', { title: track.title, artist: track.artist }), {
          action: {
            label: t('recognition.addToCollection'),
            onClick: () => {
              // Navega para Collection com dados pré-preenchidos
              const params = new URLSearchParams({
                add: 'true',
                title: track.album || track.title,
                artist: track.artist,
                ...(track.year && { year: track.year.toString() }),
                ...(track.albumArt && { coverUrl: track.albumArt }),
              });
              navigate(`/collection?${params.toString()}`);
            },
          },
          duration: 10000, // 10 segundos para dar tempo de clicar
        });
      }
    } else {
      // Erro ou não encontrado
      setRecognitionButtonState('error');
      if (result.errorCode === 'NOT_FOUND') {
        toast.warning(t('recognition.noMatch'));
      } else {
        toast.error(result.error || t('recognition.error'));
      }
    }
  }, [recognize, t]);

  /**
   * Handler para confirmação de álbum
   */
  const handleConfirmMatch = useCallback(async (albumId: string | null) => {
    if (!currentTrack) return;

    try {
      await confirm(currentTrack.id, albumId);

      if (albumId) {
        // Encontrar nome do álbum
        const album = currentMatches.find((m) => m.albumId === albumId);
        toast.success(t('recognition.linkedTo', { album: album?.title || 'álbum' }));
      } else {
        toast.info(t('recognition.noMatch'));
      }

      setShowMatchModal(false);
      resetRecognition();
    } catch {
      toast.error(t('recognition.error'));
    }
  }, [currentTrack, currentMatches, confirm, resetRecognition, t]);

  /**
   * Handler para adicionar à coleção (do modal de confirmação)
   */
  const handleAddToCollection = useCallback(() => {
    setShowMatchModal(false);
    
    if (currentTrack) {
      // Navega para Collection com dados pré-preenchidos do reconhecimento
      const params = new URLSearchParams({
        add: 'true',
        title: currentTrack.album || currentTrack.title,
        artist: currentTrack.artist,
        ...(currentTrack.year && { year: currentTrack.year.toString() }),
        ...(currentTrack.albumArt && { coverUrl: currentTrack.albumArt }),
      });
      navigate(`/collection?${params.toString()}`);
    } else {
      navigate('/collection');
    }
  }, [navigate, currentTrack]);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 bg-card border-t flex items-center px-4 gap-3 z-50">
      {/* Play/Pause Button */}
      <Button
        onClick={togglePlayPause}
        disabled={!canPlay || buffering}
        size="icon"
        variant={playing ? 'default' : 'outline'}
        className="h-9 w-9 shrink-0"
      >
        {buffering ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>

      {/* Backend Status */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:inline">Backend:</span>
        <Badge
          variant={isStreaming ? 'default' : 'secondary'}
          className={cn(
            'text-xs gap-1',
            isStreaming && 'bg-green-600 hover:bg-green-600'
          )}
        >
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              isStreaming ? 'bg-green-300 animate-pulse' : 'bg-gray-400'
            )}
          />
          <span className="hidden xs:inline">{isStreaming ? 'Ativo' : 'Parado'}</span>
        </Badge>

        {/* Start/Stop Backend Button */}
        {!isStreaming && (
          <Button
            onClick={startStreaming}
            disabled={isStreamingLoading}
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
          >
            {isStreamingLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Power className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">Iniciar</span>
          </Button>
        )}

        {isStreaming && (
          <Button
            onClick={stopStreaming}
            disabled={isStreamingLoading}
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            {isStreamingLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Power className="w-3 h-3" />
            )}
          </Button>
        )}
      </div>

      {/* Error Display */}
      {hasError && (
        <div className="flex items-center gap-1 text-xs text-destructive truncate max-w-[150px]">
          <span className="truncate">{error || streamingError}</span>
        </div>
      )}

      {/* VU Meter (center, flexible) */}
      <div className="flex-1 flex justify-center items-center min-w-0">
        {playing && analyser ? (
          <MiniVuMeter analyser={analyser} />
        ) : (
          <div className="h-6 flex items-center gap-[2px]">
            {Array.from({ length: 72 }).map((_, i) => (
              <div
                key={i}
                className="w-1 h-3 bg-muted-foreground/20 rounded-sm"
              />
            ))}
          </div>
        )}
      </div>

      {/* Recognition Button (V2-07) */}
      <RecognitionButton
        state={isRecognizing ? 'loading' : recognitionButtonState}
        onClick={handleRecognize}
        disabled={!isStreaming}
      />

      {/* Volume Control */}
      <div className="flex items-center gap-2 w-56 shrink-0">
        <button
          onClick={() => setVolume(volume > 0 ? 0 : 1)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        <Slider
          value={[volume * 100]}
          onValueChange={(values: number[]) => setVolume(values[0] / 100)}
          min={0}
          max={100}
          step={1}
          className="w-full"
        />
      </div>

      {/* Latency Badge */}
      <Badge variant="outline" className="text-xs font-mono shrink-0 w-14 justify-center">
        {playing ? `${latency.toFixed(0)}ms` : '--ms'}
      </Badge>

      {/* Tools Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
              <Settings className="w-4 h-4" />
              <span>{t('nav.settings')}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard" className="flex items-center gap-2 cursor-pointer">
              <LayoutDashboard className="w-4 h-4" />
              <span>{t('nav.dashboard')}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/diagnostics" className="flex items-center gap-2 cursor-pointer">
              <Activity className="w-4 h-4" />
              <span>{t('nav.diagnostics')}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('nav.theme')}</span>
              <ThemeToggle />
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Match Confirmation Modal (V2-07) */}
      {currentTrack && (
        <MatchConfirmation
          open={showMatchModal}
          onOpenChange={setShowMatchModal}
          track={{
            id: currentTrack.id,
            title: currentTrack.title,
            artist: currentTrack.artist,
            albumArt: currentTrack.albumArt,
          }}
          matches={currentMatches}
          onConfirm={handleConfirmMatch}
          onAddToCollection={handleAddToCollection}
          isConfirming={isConfirming}
        />
      )}
    </div>
  );
}
