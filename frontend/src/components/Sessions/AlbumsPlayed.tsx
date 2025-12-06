import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Disc, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Info do track reconhecido
 */
interface RecognizedTrackInfo {
  title: string;
  recognizedAt: string;
}

/**
 * Álbum tocado na sessão
 */
export interface SessionAlbum {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
  recognizedTrack: RecognizedTrackInfo;
}

interface AlbumsPlayedProps {
  albums: SessionAlbum[];
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

/**
 * Componente que exibe os álbuns tocados em uma sessão
 *
 * - Mostra capa do álbum (thumbnail 64x64)
 * - Título, artista, ano
 * - Faixa identificada e horário
 * - Link para ver o álbum
 */
export function AlbumsPlayed({ albums }: AlbumsPlayedProps) {
  const { t } = useTranslation();

  return (
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
                  <h3 className="font-medium truncate">{album.title}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {album.artist}
                    {album.year && ` (${album.year})`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('sessionDetail.identifiedAt', { time: formatTime(album.recognizedTrack.recognizedAt) })}
                    {' • '}
                    {t('sessionDetail.identifiedVia', { track: album.recognizedTrack.title })}
                  </p>
                </div>

                {/* Link para álbum */}
                <Link to={`/collection/${album.id}`}>
                  <Button variant="ghost" size="sm">
                    {t('sessionDetail.viewAlbum')}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

