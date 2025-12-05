import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreVertical, Edit, Archive, ArchiveRestore, Trash2, AlertTriangle, Disc } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Album, AlbumCondition } from '@/hooks/useAlbums';

interface AlbumCardProps {
  album: Album;
  onEdit: (album: Album) => void;
  onArchive: (album: Album) => void;
  onDelete: (album: Album) => void;
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
 * Labels traduzidos das condições
 */
const conditionLabels: Record<AlbumCondition, string> = {
  mint: 'Mint',
  near_mint: 'NM',
  vg_plus: 'VG+',
  vg: 'VG',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

/**
 * Card de álbum para exibição em grid
 *
 * Features:
 * - Lazy loading da imagem de capa
 * - Placeholder quando sem capa
 * - Badge de condição colorido
 * - Menu de contexto (editar, arquivar, excluir)
 * - Warning para álbuns indisponíveis no Discogs
 * - Clicável para navegar ao detalhe
 */
export function AlbumCard({ album, onEdit, onArchive, onDelete }: AlbumCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    navigate(`/collection/${album.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const showPlaceholder = !album.coverUrl || imageError;

  return (
    <Card
      className={cn(
        'group relative cursor-pointer overflow-hidden transition-all hover:shadow-md p-0',
        album.archived && 'opacity-60'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${album.title} - ${album.artist}`}
    >
      {/* Imagem de capa */}
      <div className="relative aspect-square bg-muted">
        {/* Skeleton enquanto carrega */}
        {!imageLoaded && !showPlaceholder && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}

        {/* Imagem real */}
        {album.coverUrl && !imageError && (
          <img
            src={album.coverUrl}
            alt={`${album.title} - ${album.artist}`}
            className={cn(
              'h-full w-full object-cover transition-opacity',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {/* Placeholder */}
        {showPlaceholder && (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Disc className="h-16 w-16 text-muted-foreground/40" />
          </div>
        )}

        {/* Overlay com ações no hover */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(album);
            }}
          >
            <Edit className="mr-1 h-4 w-4" />
            {t('collection.actions.edit')}
          </Button>
        </div>

        {/* Badge Discogs indisponível */}
        {!album.discogsAvailable && album.discogsId && (
          <div className="absolute top-2 left-2">
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
            </Badge>
          </div>
        )}

        {/* Menu de contexto */}
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Button variant="secondary" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">{t('collection.actions.menu')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onEdit(album);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                {t('collection.actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onArchive(album);
                }}
              >
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
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onDelete(album);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('collection.actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Informações do álbum */}
      <div className="p-3">
        <h3 className="truncate font-medium leading-tight" title={album.title}>
          {album.title}
        </h3>
        <p className="truncate text-sm text-muted-foreground" title={album.artist}>
          {album.artist}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {album.year && <span>{album.year}</span>}
          {album.year && album.format && <span>·</span>}
          {album.format && <span>{album.format}</span>}
        </div>
        {album.condition && (
          <div className="mt-2">
            <Badge
              variant="outline"
              className={cn('text-xs', conditionColors[album.condition])}
            >
              {conditionLabels[album.condition]}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Skeleton para loading do card
 */
export function AlbumCardSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <Skeleton className="aspect-square" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/4 mt-2" />
      </div>
    </Card>
  );
}
