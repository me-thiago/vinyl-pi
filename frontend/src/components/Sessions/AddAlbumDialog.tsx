/**
 * V3a-09: Dialog para adicionar álbum à sessão
 *
 * - Busca na coleção com Command (autocomplete)
 * - Campo opcional de notas
 * - POST /api/sessions/:id/albums
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Disc, Loader2 } from 'lucide-react';

const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

interface Album {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
}

interface Props {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddAlbumDialog({ sessionId, open, onOpenChange, onSuccess }: Props) {
  const { t } = useTranslation();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar álbuns quando dialog abre
  useEffect(() => {
    if (open) {
      fetchAlbums();
    } else {
      // Reset state quando fecha
      setSelectedAlbum(null);
      setNotes('');
      setSearch('');
      setError(null);
    }
  }, [open]);

  const fetchAlbums = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_HOST}/api/albums?limit=100`);
      const data = await res.json();
      setAlbums(data.data || []);
    } catch (err) {
      console.error('Failed to fetch albums:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar álbuns pelo search
  const filtered = albums.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.artist.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedAlbum) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_HOST}/api/sessions/${sessionId}/albums`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            albumId: selectedAlbum.id,
            notes: notes || undefined,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to add album');
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('sessionDetail.addAlbumTitle')}</DialogTitle>
        </DialogHeader>

        {!selectedAlbum ? (
          <Command className="border rounded-md">
            <CommandInput
              placeholder={t('sessionDetail.searchAlbumPlaceholder')}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-64">
              {loading && (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              <CommandEmpty>
                {t('sessionDetail.noAlbumsFound')}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((album) => (
                  <CommandItem
                    key={album.id}
                    value={`${album.artist} ${album.title}`}
                    onSelect={() => setSelectedAlbum(album)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Disc className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{album.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {album.artist}
                        {album.year && ` (${album.year})`}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="space-y-4">
            {/* Álbum selecionado */}
            <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
              {selectedAlbum.coverUrl ? (
                <img
                  src={selectedAlbum.coverUrl}
                  alt={selectedAlbum.title}
                  className="w-12 h-12 rounded object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <Disc className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium">{selectedAlbum.title}</p>
                <p className="text-sm text-muted-foreground">{selectedAlbum.artist}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedAlbum(null)}>
                {t('common.change')}
              </Button>
            </div>

            {/* Campo de notas */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {t('sessionDetail.notesLabel')}
              </Label>
              <Input
                id="notes"
                placeholder={t('sessionDetail.notesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedAlbum || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
