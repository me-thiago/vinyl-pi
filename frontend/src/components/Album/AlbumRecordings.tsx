import { useTranslation } from 'react-i18next';
import { CircleDot, Link as LinkIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecordingCard } from '@/components/Recording/RecordingCard';
import { useRecording } from '@/hooks/useRecording';
import { toast } from 'sonner';

interface Recording {
  id: string;
  fileName: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  status: string;
  startedAt: string;
  _count?: {
    trackMarkers: number;
  };
}

interface AlbumRecordingsProps {
  albumId: string;
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl?: string | null;
  recordings: Recording[];
  onRecordingsChange?: () => void;
}

/**
 * Seção de gravações em uma página de álbum
 * Mostra gravações vinculadas ao álbum e permite iniciar novas gravações
 */
export function AlbumRecordings({ 
  albumId, 
  albumTitle,
  albumArtist,
  albumCoverUrl,
  recordings,
  onRecordingsChange,
}: AlbumRecordingsProps) {
  const { t } = useTranslation();
  const { startRecording, isLoading } = useRecording();

  // Enriquecer recordings com dados do álbum (já temos no contexto)
  const enrichedRecordings = recordings.map(recording => ({
    ...recording,
    album: {
      id: albumId,
      title: albumTitle,
      artist: albumArtist,
      coverUrl: albumCoverUrl ?? undefined,
    },
  }));

  const handleStartRecording = async () => {
    try {
      await startRecording(albumId);
      toast.success(t('recording.startedForAlbum', { album: albumTitle }));
      
      // Notificar mudança para atualizar a lista
      if (onRecordingsChange) {
        setTimeout(onRecordingsChange, 1000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start recording';
      toast.error(t('recording.startError'), { description: message });
    }
  };

  const handleUnlink = async (recordingId: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
      const response = await fetch(`${apiUrl}/api/recordings/${recordingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: null }),
      });

      if (!response.ok) {
        throw new Error('Failed to unlink recording');
      }

      toast.success(t('recording.unlinked'));
      
      if (onRecordingsChange) {
        onRecordingsChange();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unlink recording';
      toast.error(t('recording.unlinkError'), { description: message });
    }
  };

  const handleDelete = async (recordingId: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
      const response = await fetch(`${apiUrl}/api/recordings/${recordingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete recording');
      }

      toast.success(t('recording.deleted'));
      
      if (onRecordingsChange) {
        onRecordingsChange();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete recording';
      toast.error(t('recording.deleteError'), { description: message });
    }
  };

  const handleEdit = (recordingId: string) => {
    // TODO: V3-06 - Navegar para editor de gravação
    console.log('Edit recording:', recordingId);
    toast.info(t('recording.editComingSoon'));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <CircleDot className="h-5 w-5" />
              {t('album.recordings')}
              {recordings.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {recordings.length}
                </Badge>
              )}
            </CardTitle>
          </div>
          <Button onClick={handleStartRecording} disabled={isLoading}>
            <CircleDot className="mr-2 h-4 w-4" />
            {t('album.recordThisAlbum')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CircleDot className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('album.noRecordings')}</p>
            <p className="text-sm mt-1">{t('album.startRecordingHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrichedRecordings.map((recording) => (
              <div key={recording.id} className="relative">
                <RecordingCard
                  recording={recording}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  hideAlbumInfo={true}
                />
                {/* Botão Desvincular (overlay no canto) */}
                <div className="absolute top-2 right-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlink(recording.id)}
                    title={t('recording.unlink')}
                  >
                    <LinkIcon className="w-4 h-4 mr-1" />
                    {t('recording.unlink')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
