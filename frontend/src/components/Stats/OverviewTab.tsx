/**
 * OverviewTab - Visão geral com principais métricas
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Disc, Users, Calendar, Music2, Trophy, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from './StatCard';
import { FormatChart } from './charts/FormatChart';
import { DecadeChart } from './charts/DecadeChart';

interface CollectionStats {
  totalAlbums: number;
  archivedAlbums: number;
  uniqueArtists: number;
  byFormat: Record<string, number>;
  byDecade: Record<string, number>;
  manuallyAdded: number;
}

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

interface OverviewTabProps {
  collectionStats: CollectionStats | null;
  listeningStats: ListeningStats | null;
  loading: boolean;
}

export function OverviewTab({ collectionStats, listeningStats, loading }: OverviewTabProps) {
  const { t } = useTranslation();

  const topAlbum = listeningStats?.topAlbums?.[0];
  const topArtist = listeningStats?.topArtists?.[0];

  return (
    <div className="space-y-6">
      {/* Cards principais */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Disc}
          value={collectionStats?.totalAlbums ?? 0}
          label={t('stats.totalAlbums')}
          loading={loading}
        />
        <StatCard
          icon={Users}
          value={collectionStats?.uniqueArtists ?? 0}
          label={t('stats.uniqueArtists')}
          loading={loading}
        />
        <StatCard
          icon={Calendar}
          value={listeningStats?.totalSessions ?? 0}
          label={t('stats.totalSessions')}
          loading={loading}
        />
        <StatCard
          icon={Music2}
          value={listeningStats?.sessionsThisMonth ?? 0}
          label={t('stats.sessionsThisMonth')}
          loading={loading}
        />
      </div>

      {/* Mini-charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('stats.byFormat')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[180px] animate-pulse bg-muted rounded" />
            ) : collectionStats?.byFormat ? (
              <FormatChart data={collectionStats.byFormat} compact />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                {t('stats.noData')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('stats.byDecade')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[180px] animate-pulse bg-muted rounded" />
            ) : collectionStats?.byDecade ? (
              <DecadeChart data={collectionStats.byDecade} compact />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                {t('stats.noData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Destaques */}
      {(topAlbum || topArtist) && (
        <div className="grid gap-4 md:grid-cols-2">
          {topAlbum && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {t('stats.overview.mostPlayed')}
                    </p>
                    <Link
                      to={`/collection/${topAlbum.albumId}`}
                      className="font-semibold hover:text-primary truncate block"
                    >
                      {topAlbum.title}
                    </Link>
                    <p className="text-sm text-muted-foreground truncate">
                      {topAlbum.artist}
                    </p>
                  </div>
                  {topAlbum.coverUrl && (
                    <img
                      src={topAlbum.coverUrl}
                      alt={topAlbum.title}
                      className="h-14 w-14 rounded-md object-cover"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {topArtist && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {t('stats.overview.favoriteArtist')}
                    </p>
                    <p className="font-semibold truncate">{topArtist.artist}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('stats.sessions', { count: topArtist.sessionCount })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
