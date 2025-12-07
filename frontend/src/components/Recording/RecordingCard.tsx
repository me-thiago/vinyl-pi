import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Music, Trash2, Edit, Link as LinkIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface RecordingCardProps {
  recording: {
    id: string;
    fileName: string;
    album?: {
      id: string;
      title: string;
      artist: string;
      coverUrl?: string;
    } | null;
    durationSeconds: number | null;
    fileSizeBytes: number | null;
    status: string;
    startedAt: string;
    _count?: {
      trackMarkers: number;
    };
  };
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onLink?: (id: string) => void;
  hideAlbumInfo?: boolean; // V3-05: Ocultar info do álbum (usado na página do álbum)
}

/**
 * Card individual para exibição de gravação
 * Usado na listagem de gravações
 */
export function RecordingCard({ recording, onDelete, onEdit, onLink, hideAlbumInfo }: RecordingCardProps) {
  const { t } = useTranslation();

  // Formatar duração
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Formatar tamanho
  const formatSize = (bytes: number | null) => {
    if (!bytes) return '--';
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Cor do badge de status
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'recording':
        return 'destructive';
      case 'processing':
        return 'secondary';
      case 'error':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Thumbnail do álbum ou ícone */}
          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {recording.album?.coverUrl ? (
              <img
                src={recording.album.coverUrl}
                alt={recording.album.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          {/* Conteúdo principal */}
          <div className="flex-1 min-w-0">
            {/* Nome do arquivo */}
            <h3 className="font-medium truncate">{recording.fileName}</h3>

            {/* Álbum vinculado */}
            {!hideAlbumInfo && (
              recording.album ? (
                <p className="text-sm text-muted-foreground truncate">
                  {recording.album.artist} - {recording.album.title}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {t('recording.noAlbum')}
                </p>
              )
            )}

            {/* Metadados */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{formatDuration(recording.durationSeconds)}</span>
              <span>•</span>
              <span>{formatSize(recording.fileSizeBytes)}</span>
              <span>•</span>
              <span>
                {format(new Date(recording.startedAt), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
              {recording._count && recording._count.trackMarkers > 0 && (
                <>
                  <span>•</span>
                  <span>{recording._count.trackMarkers} {t('recording.tracks')}</span>
                </>
              )}
            </div>

            {/* Status badge */}
            <div className="mt-2">
              <Badge variant={getStatusVariant(recording.status)}>
                {t(`recording.status.${recording.status}`)}
              </Badge>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Vincular a álbum */}
            {!recording.album && onLink && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onLink(recording.id)}
                title={t('recording.linkToAlbum')}
              >
                <LinkIcon className="w-4 h-4" />
              </Button>
            )}

            {/* Editar */}
            {onEdit && recording.status === 'completed' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(recording.id)}
                title={t('recording.edit')}
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}

            {/* Deletar */}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('recording.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('recording.deleteConfirm')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('recording.deleteDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(recording.id)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {t('common.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
