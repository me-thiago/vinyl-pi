/**
 * V3a-09: Componente que exibe os álbuns tocados em uma sessão
 *
 * - Mostra capa do álbum (thumbnail 64x64)
 * - Título, artista, ano
 * - Badge de origem (Manual/Auto)
 * - Horário de adição e notas
 * - Botão para adicionar álbum
 * - Botão para remover álbum
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Disc, ExternalLink, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
} from '@/components/ui/alert-dialog';
import { AddAlbumDialog } from './AddAlbumDialog';

const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

/**
 * V3a-09: Álbum tocado na sessão (via SessionAlbum)
 */
export interface SessionAlbum {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
  source: string;      // 'manual' | 'recognition'
  addedAt: string;     // ISO string
  notes: string | null;
}

interface AlbumsPlayedProps {
  albums: SessionAlbum[];
  sessionId: string;
  onRefresh: () => void;
}

/**
 * Formata hora (ex: "14:32")
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AlbumsPlayed({ albums, sessionId, onRefresh }: AlbumsPlayedProps) {
  const { t } = useTranslation();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [albumToRemove, setAlbumToRemove] = useState<SessionAlbum | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!albumToRemove) return;

    setRemoving(true);
    try {
      const res = await fetch(
        `${API_HOST}/api/sessions/${sessionId}/albums/${albumToRemove.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to remove album:', err);
    } finally {
      setRemoving(false);
      setAlbumToRemove(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Disc className="w-5 h-5" />
            {t('sessionDetail.albumsPlayed')}
            {albums.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {albums.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {albums.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Disc className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('sessionDetail.noAlbumsPlayed')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {albums.map((album) => (
                <div
                  key={album.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  {/* Capa do álbum */}
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt={`${album.title} - ${album.artist}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Disc className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Info do álbum */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{album.title}</h3>
                      {/* Badge de origem */}
                      <Badge variant={album.source === 'manual' ? 'secondary' : 'outline'} className="shrink-0">
                        {album.source === 'manual' ? t('sessionDetail.manual') : t('sessionDetail.auto')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {album.artist}
                      {album.year && ` (${album.year})`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('sessionDetail.addedAt', { time: formatTime(album.addedAt) })}
                      {album.notes && ` • ${album.notes}`}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Link to={`/collection/${album.id}`}>
                      <Button variant="ghost" size="sm">
                        {t('sessionDetail.viewAlbum')}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setAlbumToRemove(album)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Botão adicionar */}
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('sessionDetail.addAlbum')}
          </Button>
        </CardContent>
      </Card>

      {/* Dialog de adicionar */}
      <AddAlbumDialog
        sessionId={sessionId}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={onRefresh}
      />

      {/* Dialog de confirmação de remoção */}
      <AlertDialog open={!!albumToRemove} onOpenChange={() => setAlbumToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sessionDetail.removeAlbumTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sessionDetail.removeAlbumDesc', { title: albumToRemove?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing}>
              {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
