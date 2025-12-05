import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Download, Loader2 } from 'lucide-react';
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
import {
  AlbumCard,
  AlbumCardSkeleton,
  AlbumForm,
  CollectionFilters,
  CollectionEmpty,
} from '@/components/Collection';
import { useAlbums, type Album, type AlbumFilters, type AlbumCreateInput, type AlbumUpdateInput } from '@/hooks/useAlbums';
import { cn } from '@/lib/utils';

/**
 * Página de Gestão da Coleção (/collection)
 *
 * Features:
 * - Grid responsivo de álbuns
 * - Busca e filtros
 * - Toggle grid/lista
 * - CRUD de álbuns via modal
 * - Infinite scroll via "Carregar mais"
 * - Estado vazio personalizado
 */
export default function Collection() {
  const { t } = useTranslation();

  // Estado de visualização
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Estado do formulário
  const [formOpen, setFormOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);

  // Estado do dialog de confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [albumToDelete, setAlbumToDelete] = useState<Album | null>(null);

  // Hook de álbuns
  const {
    albums,
    total,
    loading,
    error,
    filters,
    hasMore,
    updateFilters,
    loadMore,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    archiveAlbum,
    clearError,
  } = useAlbums();

  // Handlers
  const handleFiltersChange = useCallback((newFilters: AlbumFilters) => {
    updateFilters(newFilters);
  }, [updateFilters]);

  const handleAddAlbum = useCallback(() => {
    setEditingAlbum(null);
    setFormOpen(true);
  }, []);

  const handleEditAlbum = useCallback((album: Album) => {
    setEditingAlbum(album);
    setFormOpen(true);
  }, []);

  const handleArchiveAlbum = useCallback(async (album: Album) => {
    await archiveAlbum(album.id, !album.archived);
  }, [archiveAlbum]);

  const handleDeleteClick = useCallback((album: Album) => {
    setAlbumToDelete(album);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (albumToDelete) {
      await deleteAlbum(albumToDelete.id);
      setAlbumToDelete(null);
      setDeleteDialogOpen(false);
    }
  }, [albumToDelete, deleteAlbum]);

  const handleSaveAlbum = useCallback(async (data: AlbumCreateInput | AlbumUpdateInput) => {
    if (editingAlbum) {
      await updateAlbum(editingAlbum.id, data);
    } else {
      await createAlbum(data as AlbumCreateInput);
    }
  }, [editingAlbum, createAlbum, updateAlbum]);

  // Verifica se há filtros ativos
  const hasActiveFilters = !!(filters.search || filters.format || filters.condition || filters.archived);

  // Loading inicial (sem álbuns ainda)
  const isInitialLoading = loading && albums.length === 0;

  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      {/* Ações principais */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('collection.title')}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={handleAddAlbum}>
            <Plus className="mr-2 h-4 w-4" />
            {t('collection.add_album')}
          </Button>
          <Button variant="outline" disabled title={t('collection.import_discogs_disabled')}>
            <Download className="mr-2 h-4 w-4" />
            {t('collection.import_discogs')}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <CollectionFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Mensagem de erro */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={clearError}
          >
            {t('common.dismiss')}
          </Button>
        </div>
      )}

      {/* Loading inicial */}
      {isInitialLoading && (
        <div
          className={cn(
            'grid gap-4',
            viewMode === 'grid'
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
              : 'grid-cols-1'
          )}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <AlbumCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {!isInitialLoading && albums.length === 0 && (
        <CollectionEmpty hasFilters={hasActiveFilters} onAddAlbum={handleAddAlbum} />
      )}

      {/* Grid de álbuns */}
      {!isInitialLoading && albums.length > 0 && (
        <>
          <div
            className={cn(
              'grid gap-4',
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                : 'grid-cols-1'
            )}
          >
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onEdit={handleEditAlbum}
                onArchive={handleArchiveAlbum}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>

          {/* Contador e Carregar Mais */}
          <div className="flex flex-col items-center gap-4 pt-4">
            <p className="text-sm text-muted-foreground">
              {t('collection.showing_count', { count: albums.length, total })}
            </p>
            {hasMore && (
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('collection.load_more')
                )}
              </Button>
            )}
          </div>
        </>
      )}

      {/* Modal de Formulário */}
      <AlbumForm
        open={formOpen}
        onOpenChange={setFormOpen}
        album={editingAlbum}
        onSave={handleSaveAlbum}
        loading={loading}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('collection.actions.confirm_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('collection.actions.confirm_delete', { title: albumToDelete?.title })}
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
