/**
 * PlaybackControls - Controles de reprodução
 *
 * Inclui:
 * - Play/Pause
 * - Stop
 * - Indicador de tempo
 * - Controle de volume
 *
 * @module components/Editor/PlaybackControls
 */

import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { UseWaveformReturn } from '@/hooks/useWaveform';

interface PlaybackControlsProps {
  waveform: UseWaveformReturn;
}

/**
 * Formata segundos para MM:SS ou HH:MM:SS
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function PlaybackControls({ waveform }: PlaybackControlsProps) {
  const {
    isReady,
    isPlaying,
    currentTime,
    duration,
    volume,
    play,
    pause,
    stop,
    setVolume,
  } = waveform;

  const isMuted = volume === 0;

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const toggleMute = () => {
    setVolume(isMuted ? 1 : 0);
  };

  return (
    <div className="flex items-center gap-4">
      {/* Play/Pause */}
      <Button
        variant="default"
        size="icon"
        className="h-10 w-10"
        onClick={handlePlayPause}
        disabled={!isReady}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>

      {/* Stop */}
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10"
        onClick={stop}
        disabled={!isReady}
      >
        <Square className="h-4 w-4" />
      </Button>

      {/* Time Display */}
      <div className="flex items-center gap-1 font-mono text-sm min-w-[120px]">
        <span className="text-foreground">{formatTime(currentTime)}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{formatTime(duration)}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Volume Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleMute}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        <Slider
          value={[volume]}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          className="w-24"
        />
      </div>
    </div>
  );
}
