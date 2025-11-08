import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface WaveSurferPlayerProps {
  url: string;
  height?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function WaveSurferPlayer({ url, height = 80, onReady, onError }: WaveSurferPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create WaveSurfer instance
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgb(147, 51, 234)',
      progressColor: 'rgb(126, 34, 206)',
      cursorColor: 'rgb(88, 28, 135)',
      height,
      normalize: true,
      backend: 'MediaElement',
      barWidth: 2,
      barRadius: 2,
      barGap: 1,
    });

    wavesurferRef.current = ws;

    // Event handlers
    ws.on('ready', () => {
      setLoading(false);
      setDuration(ws.getDuration());
      onReady?.();
    });

    ws.on('error', (error: Error) => {
      console.error('WaveSurfer error:', error);
      setLoading(false);
      onError?.(error);
    });

    ws.on('audioprocess', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    // Load audio
    ws.load(url);

    // Cleanup
    return () => {
      ws.destroy();
    };
  }, [url, height, onReady, onError]);

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full" />

      {loading && (
        <div className="flex items-center justify-center h-20">
          <span className="text-sm text-muted-foreground">Loading waveform...</span>
        </div>
      )}

      {!loading && (
        <>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={togglePlayPause}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </Button>

            <span className="text-sm text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1">
              <Progress value={progressPercent} className="h-2" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}