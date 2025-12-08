/**
 * Hook para integração com wavesurfer.js
 *
 * Gerencia:
 * - Instância do wavesurfer
 * - Playback controls
 * - Regions (marcadores e trim)
 * - Estado de loading/ready
 *
 * @module hooks/useWaveform
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import type { Region } from 'wavesurfer.js/dist/plugins/regions';

export interface WaveformOptions {
  container: HTMLElement | null;
  url: string;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  height?: number;
  barWidth?: number;
  barRadius?: number;
  normalize?: boolean;
}

export interface MarkerData {
  id: string;
  trackNumber: number;
  title?: string;
  startOffset: number;
  endOffset: number;
}

export interface TrimRegion {
  start: number;
  end: number;
}

/**
 * Callback para quando uma região (marker) é atualizada pelo usuário
 */
export type OnMarkerRegionUpdated = (
  markerId: string,
  start: number,
  end: number
) => void;

export interface UseWaveformReturn {
  // Estado
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;

  // Controles de playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;

  // Zoom
  zoom: (pxPerSec: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // Regions/Markers
  addMarker: (marker: MarkerData) => void;
  updateMarker: (id: string, data: Partial<MarkerData>) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  setOnMarkerRegionUpdated: (callback: OnMarkerRegionUpdated | null) => void;

  // Trim region
  setTrimRegion: (region: TrimRegion | null) => void;
  getTrimRegion: () => TrimRegion | null;

  // Lifecycle
  init: (options: WaveformOptions) => void;
  destroy: () => void;
}

// Cores padrão que funcionam com tema dark/light
const DEFAULT_COLORS = {
  waveColor: 'hsl(var(--primary) / 0.6)',
  progressColor: 'hsl(var(--primary))',
  cursorColor: 'hsl(var(--primary))',
};

export function useWaveform(): UseWaveformReturn {
  // Refs
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const markersMapRef = useRef<Map<string, Region>>(new Map());
  const trimRegionRef = useRef<Region | null>(null);
  const onMarkerRegionUpdatedRef = useRef<OnMarkerRegionUpdated | null>(null);

  // Estado
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(50);

  /**
   * Inicializa wavesurfer
   */
  const init = useCallback((options: WaveformOptions) => {
    if (!options.container) {
      setError('Container não fornecido');
      return;
    }

    // Limpar instância anterior
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    setIsReady(false);
    setError(null);

    try {
      // Criar plugin de regions
      const regions = RegionsPlugin.create();
      regionsRef.current = regions;

      // Criar instância do wavesurfer
      const ws = WaveSurfer.create({
        container: options.container,
        waveColor: options.waveColor || DEFAULT_COLORS.waveColor,
        progressColor: options.progressColor || DEFAULT_COLORS.progressColor,
        cursorColor: options.cursorColor || DEFAULT_COLORS.cursorColor,
        height: options.height || 128,
        barWidth: options.barWidth || 2,
        barRadius: options.barRadius || 2,
        normalize: options.normalize ?? true,
        backend: 'MediaElement', // Importante para arquivos grandes!
        plugins: [regions],
      });

      wavesurferRef.current = ws;

      // Event listeners
      ws.on('ready', () => {
        setIsReady(true);
        setDuration(ws.getDuration());
      });

      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));

      ws.on('timeupdate', (time) => {
        setCurrentTime(time);
      });

      ws.on('error', (err) => {
        console.error('WaveSurfer error:', err);
        setError(err.message || 'Erro ao carregar áudio');
      });

      // Listener para cliques em regions (markers)
      regions.on('region-clicked', (region, e) => {
        e.stopPropagation();
        // Seek para início do marker
        ws.seekTo(region.start / ws.getDuration());
      });

      // Listener para drag de regions
      regions.on('region-updated', (region) => {
        // Se é a trim region, atualizar ref
        if (region.id === 'trim-region') {
          trimRegionRef.current = region;
        } else {
          // É um marker - chamar callback se existir
          if (onMarkerRegionUpdatedRef.current) {
            onMarkerRegionUpdatedRef.current(region.id, region.start, region.end);
          }
        }
      });

      // Carregar áudio
      ws.load(options.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao inicializar waveform';
      setError(msg);
      console.error('Erro ao inicializar wavesurfer:', err);
    }
  }, []);

  /**
   * Destroy wavesurfer
   */
  const destroy = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
    regionsRef.current = null;
    markersMapRef.current.clear();
    trimRegionRef.current = null;
    setIsReady(false);
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroy();
    };
  }, [destroy]);

  // ============================================
  // Playback Controls
  // ============================================

  const play = useCallback(() => {
    wavesurferRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    wavesurferRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    const ws = wavesurferRef.current;
    if (ws) {
      ws.pause();
      ws.seekTo(0);
      setCurrentTime(0);
    }
  }, []);

  const seek = useCallback((time: number) => {
    const ws = wavesurferRef.current;
    if (ws && duration > 0) {
      const progress = Math.max(0, Math.min(1, time / duration));
      ws.seekTo(progress);
    }
  }, [duration]);

  const setVolume = useCallback((vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    wavesurferRef.current?.setVolume(v);
    setVolumeState(v);
  }, []);

  // ============================================
  // Zoom Controls
  // ============================================

  const zoom = useCallback((pxPerSec: number) => {
    wavesurferRef.current?.zoom(pxPerSec);
    setZoomLevel(pxPerSec);
  }, []);

  const zoomIn = useCallback(() => {
    const newZoom = Math.min(zoomLevel * 1.5, 500);
    zoom(newZoom);
  }, [zoomLevel, zoom]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(zoomLevel / 1.5, 10);
    zoom(newZoom);
  }, [zoomLevel, zoom]);

  // ============================================
  // Markers (Regions)
  // ============================================

  const addMarker = useCallback((marker: MarkerData) => {
    const regions = regionsRef.current;
    if (!regions) return;

    // Remover se já existir
    const existing = markersMapRef.current.get(marker.id);
    if (existing) {
      existing.remove();
    }

    // Criar nova region
    const region = regions.addRegion({
      id: marker.id,
      start: marker.startOffset,
      end: marker.endOffset,
      color: 'rgba(79, 70, 229, 0.3)', // Indigo com transparência
      drag: true,
      resize: true,
      content: marker.title || `Faixa ${marker.trackNumber}`,
    });

    markersMapRef.current.set(marker.id, region);
  }, []);

  const updateMarker = useCallback((id: string, data: Partial<MarkerData>) => {
    const region = markersMapRef.current.get(id);
    if (!region) return;

    if (data.startOffset !== undefined) {
      region.setOptions({ start: data.startOffset });
    }
    if (data.endOffset !== undefined) {
      region.setOptions({ end: data.endOffset });
    }
    if (data.title !== undefined) {
      region.setOptions({ content: data.title || `Faixa ${data.trackNumber}` });
    }
  }, []);

  const removeMarker = useCallback((id: string) => {
    const region = markersMapRef.current.get(id);
    if (region) {
      region.remove();
      markersMapRef.current.delete(id);
    }
  }, []);

  const clearMarkers = useCallback(() => {
    markersMapRef.current.forEach((region) => region.remove());
    markersMapRef.current.clear();
  }, []);

  /**
   * Define callback para quando markers são atualizados pelo usuário via drag
   */
  const setOnMarkerRegionUpdated = useCallback(
    (callback: OnMarkerRegionUpdated | null) => {
      onMarkerRegionUpdatedRef.current = callback;
    },
    []
  );

  // ============================================
  // Trim Region
  // ============================================

  const setTrimRegion = useCallback((region: TrimRegion | null) => {
    const regions = regionsRef.current;
    if (!regions) return;

    // Remover trim region existente
    if (trimRegionRef.current) {
      trimRegionRef.current.remove();
      trimRegionRef.current = null;
    }

    if (region) {
      // Criar nova trim region
      const tr = regions.addRegion({
        id: 'trim-region',
        start: region.start,
        end: region.end,
        color: 'rgba(239, 68, 68, 0.2)', // Red com transparência
        drag: true,
        resize: true,
      });
      trimRegionRef.current = tr;
    }
  }, []);

  const getTrimRegion = useCallback((): TrimRegion | null => {
    const region = trimRegionRef.current;
    if (!region) return null;

    return {
      start: region.start,
      end: region.end,
    };
  }, []);

  return {
    // Estado
    isReady,
    isPlaying,
    currentTime,
    duration,
    volume,
    error,

    // Controles
    play,
    pause,
    stop,
    seek,
    setVolume,

    // Zoom
    zoom,
    zoomIn,
    zoomOut,

    // Markers
    addMarker,
    updateMarker,
    removeMarker,
    clearMarkers,
    setOnMarkerRegionUpdated,

    // Trim
    setTrimRegion,
    getTrimRegion,

    // Lifecycle
    init,
    destroy,
  };
}
