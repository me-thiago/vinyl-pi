import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as LinkIcon, Search, Loader2, Music } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface Album {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
}

interface LinkRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: string;
  recordingFileName: string;
  onSuccess?: () => void;
}

/**
 * Modal para vincular uma gravação a um álbum
 * Permite buscar e selecionar um álbum da coleção
 */
export function LinkRecordingDialog({
  open,
  onOpenChange,
  recordingId,
  recordingFileName,
  onSuccess,
}: LinkRecordingDialogProps) {
  const { t } = useTranslation();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [filteredAlbums, setFilteredAlbums] = useState<Album[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

  // Buscar álbuns quando o modal abre
  useEffect(() => {
    if (open) {
      fetchAlbums();
    } else {
      // Resetar estado ao fechar
      setSearchTerm('');
      setSelectedAlbumId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Filtrar álbuns por busca
  useEffect(() => {
    if (!searchTerm) {
      setFilteredAlbums(albums);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = albums.filter(
      (album) =>
        album.title.toLowerCase().includes(term) ||
        album.artist.toLowerCase().includes(term)
    );
    setFilteredAlbums(filtered);
  }, [searchTerm, albums]);

  const fetchAlbums = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/albums?limit=100&archived=false`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch albums');
      }

      const result = await response.json();
      setAlbums(result.data);
      setFilteredAlbums(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load albums';
      toast.error(t('recording.loadAlbumsError'), { description: message });
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedAlbumId) return;

    setLinking(true);
    try {
      const response = await fetch(`${apiUrl}/api/recordings/${recordingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: selectedAlbumId }),
      });

      if (!response.ok) {
        throw new Error('Failed to link recording');
      }

      const selectedAlbum = albums.find((a) => a.id === selectedAlbumId);
      toast.success(
        t('recording.linked', {
          album: selectedAlbum ? `${selectedAlbum.artist} - ${selectedAlbum.title}` : '',
        })
      );

      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link recording';
      toast.error(t('recording.linkError'), { description: message });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            {t('recording.linkToAlbum')}
          </DialogTitle>
          <DialogDescription>
            {t('recording.linkDialogDescription', { recording: recordingFileName })}
          </DialogDescription>
        </DialogHeader>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('recording.searchAlbums')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Lista de álbuns */}
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAlbums.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>
                {searchTerm ? t('recording.noAlbumsFound') : t('recording.noAlbumsInCollection')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAlbums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => setSelectedAlbumId(album.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    selectedAlbumId === album.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {/* Capa */}
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{album.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {album.artist}
                      {album.year && ` • ${album.year}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={linking}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleLink} disabled={!selectedAlbumId || linking}>
            {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('recording.linkAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
