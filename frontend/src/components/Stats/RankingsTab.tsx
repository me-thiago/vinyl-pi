/**
 * RankingsTab - Top álbuns e artistas
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Disc, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ListeningStats {
  totalSessions: number;
  sessionsThisMonth: number;
  uniqueAlbumsPlayed: number;
  topAlbums: {
    albumId: string;
    title: string;
    artist: string;
    coverUrl: string | null;
    sessionCount: number;
  }[];
  topArtists: {
    artist: string;
    sessionCount: number;
  }[];
}

interface RankingsTabProps {
  stats: ListeningStats | null;
  loading: boolean;
}

export function RankingsTab({ stats, loading }: RankingsTabProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Top Álbuns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Disc className="h-5 w-5" />
            {t('stats.rankings.topAlbums')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.topAlbums?.length ? (
            <div className="space-y-3">
              {stats.topAlbums.map((album, index) => (
                <Link
                  key={album.albumId}
                  to={`/collection/${album.albumId}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                >
                  <div className="relative">
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                        <Disc className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <Badge
                      variant="secondary"
                      className="absolute -left-2 -top-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {index + 1}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{album.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {album.artist}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {t('stats.sessions', { count: album.sessionCount })}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              {t('stats.noListeningData')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Artistas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('stats.rankings.topArtists')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.topArtists?.length ? (
            <div className="space-y-3">
              {stats.topArtists.map((artist, index) => (
                <div
                  key={artist.artist}
                  className="flex items-center gap-3 rounded-lg p-2"
                >
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <Badge
                      variant="secondary"
                      className="absolute -left-2 -top-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {index + 1}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{artist.artist}</p>
                  </div>
                  <Badge variant="outline">
                    {t('stats.sessions', { count: artist.sessionCount })}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              {t('stats.noListeningData')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
