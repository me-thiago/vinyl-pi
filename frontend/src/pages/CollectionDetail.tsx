import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Disc,
  Calendar,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import { AlbumForm } from '@/components/Collection';
import { AlbumRecordings } from '@/components/Album/AlbumRecordings';
import { useAlbum, useAlbums, type AlbumUpdateInput, type AlbumCondition } from '@/hooks/useAlbums';
import { cn } from '@/lib/utils';

// Configuração da API
const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
const API_BASE = `${API_HOST}/api`;

/**
 * Sessão do histórico de escuta do álbum
 */
interface AlbumSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  recognizedTrack: {
    title: string;
    recognizedAt: string;
  };
}

/**
 * Cores para cada condição do disco
 */
const conditionColors: Record<AlbumCondition, string> = {
  mint: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  near_mint: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
  vg_plus: 'bg-lime-500/20 text-lime-700 dark:text-lime-400 border-lime-500/30',
  vg: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  good: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
  fair: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
  poor: 'bg-red-700/20 text-red-800 dark:text-red-300 border-red-700/30',
};

/**
 * Labels das condições
 */
const conditionLabels: Record<AlbumCondition, string> = {
  mint: 'Mint',
  near_mint: 'Near Mint',
  vg_plus: 'VG+',
  vg: 'VG',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

/**
 * Labels dos formatos
 */
const formatLabels: Record<string, string> = {
  LP: 'LP (12" 33rpm)',
  EP: 'EP',
  SINGLE_7: '7" Single',
  SINGLE_12: '12" Single',
  DOUBLE_LP: '2xLP',
  BOX_SET: 'Box Set',
};

/**
 * Formatar duração em HH:MM:SS
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * Formatar data relativa (Hoje, Ontem, ou data)
 */
function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) {
    return `Hoje, ${time}`;
  }
  if (isYesterday) {
    return `Ontem, ${time}`;
  }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }) + `, ${time}`;
}

/**
 * Página de Detalhe do Álbum (/collection/:id)
 *
 * Features:
 * - Exibe informações detalhadas do álbum
 * - Capa grande com placeholder
 * - Tags como badges
 * - Notas do usuário
 * - Ações: editar, arquivar, excluir
 * - Links para Discogs (se aplicável)
 * - Warning para álbuns indisponíveis no Discogs
 */
export default function CollectionDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Estado
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  
  // V2-09: Estado para histórico de escuta
  const [sessions, setSessions] = useState<AlbumSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Hooks
  const { album, loading, error, refresh } = useAlbum(id);
  const { updateAlbum, deleteAlbum, archiveAlbum } = useAlbums();

  // V2-09: Buscar sessões do álbum
  useEffect(() => {
    async function fetchSessions() {
      if (!id) return;
      
      setSessionsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/albums/${id}/sessions`);
        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions);
        }
      } catch (err) {
        console.error('Erro ao buscar sessões do álbum:', err);
      } finally {
        setSessionsLoading(false);
      }
    }
    
    fetchSessions();
  }, [id]);

  // Handlers
  const handleEdit = useCallback(() => {
    setFormOpen(true);
  }, []);

  const handleSave = useCallback(async (data: AlbumUpdateInput) => {
    if (album) {
      await updateAlbum(album.id, data);
      refresh();
    }
  }, [album, updateAlbum, refresh]);

  const handleArchive = useCallback(async () => {
    if (album) {
      await archiveAlbum(album.id, !album.archived);
      refresh();
    }
  }, [album, archiveAlbum, refresh]);

  const handleDeleteClick = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (album) {
      await deleteAlbum(album.id);
      navigate('/collection');
    }
  }, [album, deleteAlbum, navigate]);

  const handleSyncDiscogs = useCallback(async () => {
    if (!album?.discogsId) return;

    setSyncing(true);
    setSyncWarning(null);

    try {
      const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
      const response = await fetch(`${API_HOST}/api/albums/${album.id}/sync-discogs`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || t('discogs.error_generic'));
      }

      // Verificar se houve warning (álbum não encontrado no Discogs)
      if (data.warning) {
        setSyncWarning(data.warning);
      }

      // Atualizar dados
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('discogs.error_generic');
      setSyncWarning(message);
    } finally {
      setSyncing(false);
    }
  }, [album, refresh, t]);

  // Loading state
  if (loading) {
    return (
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-6 flex-col md:flex-row">
          <Skeleton className="w-full md:w-80 aspect-square rounded-lg" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !album) {
    return (
      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-medium mb-2">{t('collection.detail.not_found')}</h2>
            <p className="text-muted-foreground mb-4">{error || t('collection.detail.album_not_found_description')}</p>
            <Button variant="outline" onClick={() => navigate('/collection')}>
              {t('collection.detail.back_to_collection')}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      {/* Ações principais */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={handleEdit}>
          <Edit className="mr-2 h-4 w-4" />
          {t('collection.actions.edit')}
        </Button>
        <Button variant="outline" onClick={handleArchive}>
          {album.archived ? (
            <>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              {t('collection.actions.unarchive')}
            </>
          ) : (
            <>
              <Archive className="mr-2 h-4 w-4" />
              {t('collection.actions.archive')}
            </>
          )}
        </Button>
        <Button variant="destructive" onClick={handleDeleteClick}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('collection.actions.delete')}
        </Button>
      </div>

      {/* Conteúdo principal */}
      <div className="flex gap-6 flex-col md:flex-row">
        {/* Capa */}
        <div className="w-full md:w-80 shrink-0">
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            {album.coverUrl ? (
              <img
                src={album.coverUrl}
                alt={`${album.title} - ${album.artist}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Disc className="h-24 w-24 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Warning Discogs indisponível */}
          {!album.discogsAvailable && album.discogsId && (
            <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">
                  {t('collection.detail.discogs_unavailable')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="flex-1 space-y-6">
          {/* Título e artista */}
          <div>
            <h1 className="text-3xl font-bold">{album.title}</h1>
            <p className="text-xl text-muted-foreground mt-1">{album.artist}</p>
            {album.archived && (
              <Badge variant="secondary" className="mt-2">
                {t('collection.detail.archived')}
              </Badge>
            )}
          </div>

          {/* Metadados */}
          <div className="grid grid-cols-2 gap-4">
            {album.year && (
              <div>
                <p className="text-sm text-muted-foreground">{t('collection.form.year')}</p>
                <p className="font-medium">{album.year}</p>
              </div>
            )}
            {album.label && (
              <div>
                <p className="text-sm text-muted-foreground">{t('collection.form.label')}</p>
                <p className="font-medium">{album.label}</p>
              </div>
            )}
            {album.format && (
              <div>
                <p className="text-sm text-muted-foreground">{t('collection.form.format')}</p>
                <p className="font-medium">{formatLabels[album.format] || album.format}</p>
              </div>
            )}
            {album.condition && (
              <div>
                <p className="text-sm text-muted-foreground">{t('collection.form.condition')}</p>
                <Badge
                  variant="outline"
                  className={cn('mt-1', conditionColors[album.condition])}
                >
                  {conditionLabels[album.condition]}
                </Badge>
              </div>
            )}
          </div>

          {/* Tags */}
          {album.tags && album.tags.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('collection.form.tags')}</p>
              <div className="flex flex-wrap gap-2">
                {album.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notas */}
          {album.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('collection.detail.notes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{album.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Links Discogs */}
          {album.discogsId && album.discogsAvailable && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  asChild
                >
                  <a
                    href={`https://www.discogs.com/release/${album.discogsId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t('collection.detail.view_discogs')}
                  </a>
                </Button>
                <Button variant="outline" onClick={handleSyncDiscogs} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {t('collection.detail.sync_discogs')}
                </Button>
              </div>
              {/* Sync warning */}
              {syncWarning && (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{syncWarning}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* V3-05: Gravações do Álbum */}
      {album.recordings && (
        <AlbumRecordings
          albumId={album.id}
          albumTitle={album.title}
          albumArtist={album.artist}
          albumCoverUrl={album.coverUrl}
          recordings={album.recordings}
          onRecordingsChange={refresh}
        />
      )}

      {/* V2-09: Histórico de Escuta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('collection.detail.play_history')}
            {sessions.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {t('collection.detail.total_sessions', { count: sessions.length })}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t('collection.detail.no_play_history')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatRelativeDate(session.startedAt)}
                        {session.endedAt && ` - ${new Date(session.endedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.durationSeconds)}
                      </span>
                      <span>
                        {t('collection.detail.identified_via', { track: session.recognizedTrack.title })}
                      </span>
                    </div>
                  </div>
                  <Link to={`/sessions/${session.id}`}>
                    <Button variant="ghost" size="sm">
                      {t('collection.detail.view_session')}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Formulário */}
      <AlbumForm
        open={formOpen}
        onOpenChange={setFormOpen}
        album={album}
        onSave={handleSave}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('collection.actions.confirm_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('collection.actions.confirm_delete', { title: album.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('collection.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
