/**
 * RecordingEditor Page
 *
 * Página de edição de gravação com:
 * - Visualização de waveform (wavesurfer.js)
 * - Controles de playback
 * - Trim (corte)
 * - Marcadores de faixa
 *
 * Rota: /recordings/:id/edit
 *
 * @module pages/RecordingEditor
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Disc3,
  Loader2,
  Info,
  Clock,
  HardDrive,
  Music2,
  Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  WaveformEditor,
  PlaybackControls,
  TrimControls,
  MarkerList,
} from '@/components/Editor';
import { useWaveform } from '@/hooks/useWaveform';
import type { MarkerData, TrimRegion } from '@/hooks/useWaveform';

interface Recording {
  id: string;
  fileName: string;
  filePath: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  status: string;
  startedAt: string;
  notes: string | null;
  album?: {
    id: string;
    title: string;
    artist: string;
    coverUrl?: string;
  } | null;
  trackMarkers: TrackMarker[];
}

interface TrackMarker {
  id: string;
  trackNumber: number;
  title: string | null;
  startOffset: number;
  endOffset: number;
}

/**
 * Formata bytes para tamanho legível
 */
function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Formata duração em segundos para HH:MM:SS
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  return `${m}m ${s}s`;
}

/**
 * Detecta se o dispositivo é mobile ou se o navegador não suporta FLAC
 * iOS Safari não suporta FLAC no elemento <audio>
 */
function useIsMobileOrUnsupported(): boolean {
  return useMemo(() => {
    const userAgent = navigator.userAgent || navigator.vendor;

    // Detectar iOS (iPhone, iPad, iPod)
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);

    // Detectar Android
    const isAndroid = /android/i.test(userAgent);

    // Detectar se é touch device com tela pequena (mobile)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth < 768;

    // iOS Safari não suporta FLAC - sempre bloquear
    if (isIOS) return true;

    // Android com tela pequena - provavelmente mobile
    if (isAndroid && isSmallScreen) return true;

    // Touch device com tela pequena - provavelmente mobile
    if (isTouchDevice && isSmallScreen) return true;

    return false;
  }, []);
}

export default function RecordingEditor() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const waveform = useWaveform();
  const isMobileOrUnsupported = useIsMobileOrUnsupported();

  // State
  const [recording, setRecording] = useState<Recording | null>(null);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
  const streamUrl = `${apiUrl}/api/recordings/${id}/stream`;

  /**
   * Carregar dados da gravação
   */
  const fetchRecording = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/recordings/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t('editor.notFound', 'Gravação não encontrada'));
        }
        throw new Error(`Failed to fetch recording: ${response.status}`);
      }

      const result = await response.json();
      setRecording(result.data);

      // Converter trackMarkers para formato do hook
      const markerData: MarkerData[] = (result.data.trackMarkers || []).map(
        (m: TrackMarker) => ({
          id: m.id,
          trackNumber: m.trackNumber,
          title: m.title || undefined,
          startOffset: m.startOffset,
          endOffset: m.endOffset,
        })
      );
      setMarkers(markerData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recording';
      setError(message);
      toast.error(t('editor.loadError', 'Erro ao carregar gravação'), {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [id, apiUrl, t]);

  // Carregar ao montar
  useEffect(() => {
    fetchRecording();
  }, [fetchRecording]);

  // Sincronizar markers com wavesurfer quando prontos
  useEffect(() => {
    if (waveform.isReady && markers.length > 0) {
      waveform.clearMarkers();
      markers.forEach((marker) => {
        waveform.addMarker(marker);
      });
    }
  }, [waveform.isReady, markers]);

  /**
   * Handler para quando marker é arrastado no waveform
   * Sincroniza com o estado local e salva no backend
   */
  const handleMarkerRegionUpdated = useCallback(
    async (markerId: string, start: number, end: number) => {
      // Atualizar estado local imediatamente para UI responsiva
      setMarkers((prev) =>
        prev.map((m) =>
          m.id === markerId ? { ...m, startOffset: start, endOffset: end } : m
        )
      );

      // Salvar no backend (fire and forget com retry opcional)
      if (!id) return;

      try {
        const response = await fetch(
          `${apiUrl}/api/recordings/${id}/markers/${markerId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startOffset: start, endOffset: end }),
          }
        );

        if (!response.ok) {
          console.error('Failed to save marker position');
        }
      } catch (err) {
        console.error('Error saving marker position:', err);
      }
    },
    [id, apiUrl]
  );

  // Configurar callback de atualização de marker quando waveform estiver pronto
  useEffect(() => {
    if (waveform.isReady) {
      waveform.setOnMarkerRegionUpdated(handleMarkerRegionUpdated);
    }
    return () => {
      waveform.setOnMarkerRegionUpdated(null);
    };
  }, [waveform.isReady, handleMarkerRegionUpdated]);

  /**
   * Adicionar novo marcador na posição atual
   *
   * Ao adicionar um novo marker:
   * 1. A nova faixa começa na posição atual e vai até o fim do arquivo
   * 2. A faixa anterior (se existir e sobrepor) tem seu endOffset ajustado
   */
  const handleAddMarker = async () => {
    if (!id || !recording) return;

    const currentTime = waveform.currentTime;
    const duration = waveform.duration || recording.durationSeconds || 0;
    const nextTrackNumber = markers.length > 0
      ? Math.max(...markers.map((m) => m.trackNumber)) + 1
      : 1;

    // Calcular end como próximo marcador ou fim do arquivo
    const sortedMarkers = [...markers].sort((a, b) => a.startOffset - b.startOffset);
    const nextMarker = sortedMarkers.find((m) => m.startOffset > currentTime);
    const endOffset = nextMarker ? nextMarker.startOffset : duration;

    // Encontrar faixa anterior que precisa ter seu endOffset ajustado
    // (faixa que começa antes da posição atual e termina depois dela)
    const previousMarker = sortedMarkers
      .filter((m) => m.startOffset < currentTime && m.endOffset > currentTime)
      .pop(); // Pegar a última (mais próxima da posição atual)

    try {
      // Se há faixa anterior que sobrepõe, ajustar seu endOffset primeiro
      if (previousMarker) {
        const adjustResponse = await fetch(
          `${apiUrl}/api/recordings/${id}/markers/${previousMarker.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endOffset: currentTime }),
          }
        );

        if (adjustResponse.ok) {
          // Atualizar estado local e região no waveform
          setMarkers((prev) =>
            prev.map((m) =>
              m.id === previousMarker.id ? { ...m, endOffset: currentTime } : m
            )
          );
          waveform.updateMarker(previousMarker.id, { endOffset: currentTime });
        }
      }

      // Criar novo marcador
      const response = await fetch(`${apiUrl}/api/recordings/${id}/markers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackNumber: nextTrackNumber,
          startOffset: currentTime,
          endOffset: endOffset,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create marker');
      }

      const result = await response.json();
      const newMarker: MarkerData = {
        id: result.data.id,
        trackNumber: result.data.trackNumber,
        title: result.data.title || undefined,
        startOffset: result.data.startOffset,
        endOffset: result.data.endOffset,
      };

      setMarkers((prev) => [...prev, newMarker]);
      waveform.addMarker(newMarker);
      toast.success(t('editor.markers.created', 'Marcador criado'));
    } catch {
      toast.error(t('editor.markers.createError', 'Erro ao criar marcador'));
    }
  };

  /**
   * Atualizar marcador
   */
  const handleUpdateMarker = async (markerId: string, data: Partial<MarkerData>) => {
    if (!id) return;

    try {
      const response = await fetch(
        `${apiUrl}/api/recordings/${id}/markers/${markerId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update marker');
      }

      // Atualizar estado local
      setMarkers((prev) =>
        prev.map((m) => (m.id === markerId ? { ...m, ...data } : m))
      );
      waveform.updateMarker(markerId, data);
      toast.success(t('editor.markers.updated', 'Marcador atualizado'));
    } catch {
      toast.error(t('editor.markers.updateError', 'Erro ao atualizar marcador'));
    }
  };

  /**
   * Deletar marcador
   */
  const handleDeleteMarker = async (markerId: string) => {
    if (!id) return;

    try {
      const response = await fetch(
        `${apiUrl}/api/recordings/${id}/markers/${markerId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete marker');
      }

      setMarkers((prev) => prev.filter((m) => m.id !== markerId));
      waveform.removeMarker(markerId);
      toast.success(t('editor.markers.deleted', 'Marcador removido'));
    } catch {
      toast.error(t('editor.markers.deleteError', 'Erro ao remover marcador'));
    }
  };

  /**
   * Aplicar trim
   */
  const handleTrimApply = async (region: TrimRegion) => {
    if (!id) return;

    setIsTrimming(true);

    try {
      const response = await fetch(`${apiUrl}/api/recordings/${id}/trim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startOffset: region.start,
          endOffset: region.end,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to apply trim');
      }

      toast.success(t('editor.trim.success', 'Corte aplicado com sucesso'), {
        description: t('editor.trim.successDescription', 'A gravação foi atualizada.'),
      });

      // Recarregar dados e reinicializar waveform
      waveform.destroy();
      await fetchRecording();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(t('editor.trim.error', 'Erro ao aplicar corte'), {
        description: message,
      });
    } finally {
      setIsTrimming(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Mobile/Unsupported browser state
  if (isMobileOrUnsupported) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="text-center py-24">
          <Monitor className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">
            {t('editor.mobileNotSupported', 'Editor não disponível em dispositivos móveis')}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t(
              'editor.mobileNotSupportedDesc',
              'O editor de áudio requer recursos que não estão disponíveis em navegadores móveis. Por favor, acesse esta página de um computador.'
            )}
          </p>
          <Button asChild>
            <Link to="/recordings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('editor.backToList', 'Voltar para lista')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !recording) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="text-center py-24">
          <Disc3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">
            {t('editor.notFound', 'Gravação não encontrada')}
          </h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button asChild>
            <Link to="/recordings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('editor.backToList', 'Voltar para lista')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/recordings">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{recording.fileName}</h1>
            {recording.album && (
              <p className="text-muted-foreground">
                {recording.album.artist} - {recording.album.title}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waveform & Controls (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Waveform */}
          <Card>
            <CardContent className="p-4">
              <WaveformEditor
                waveform={waveform}
                streamUrl={streamUrl}
                className="mb-4"
              />
              <PlaybackControls waveform={waveform} />
            </CardContent>
          </Card>

          {/* Trim Controls */}
          <Card>
            <CardContent className="p-4">
              <TrimControls
                waveform={waveform}
                onTrimApply={handleTrimApply}
                isApplying={isTrimming}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">
          {/* Recording Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                {t('editor.info.title', 'Informações')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('editor.info.duration', 'Duração')}:
                </span>
                <span>{formatDuration(recording.durationSeconds)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('editor.info.size', 'Tamanho')}:
                </span>
                <span>{formatFileSize(recording.fileSizeBytes)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Music2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('editor.info.markers', 'Marcadores')}:
                </span>
                <span>{markers.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Markers */}
          <Card>
            <CardContent className="p-4">
              <MarkerList
                markers={markers}
                waveform={waveform}
                onAddMarker={handleAddMarker}
                onUpdateMarker={handleUpdateMarker}
                onDeleteMarker={handleDeleteMarker}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
