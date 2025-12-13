/**
 * ListeningTab - Estatísticas de escuta com taxa de exploração
 */

import { useTranslation } from 'react-i18next';
import { Calendar, Music2, Disc, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatCard } from './StatCard';

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

interface ListeningTabProps {
  stats: ListeningStats | null;
  totalAlbums: number;
  loading: boolean;
}

export function ListeningTab({ stats, totalAlbums, loading }: ListeningTabProps) {
  const { t } = useTranslation();

  // Taxa de exploração
  const explorationRate = stats && totalAlbums > 0
    ? Math.round((stats.uniqueAlbumsPlayed / totalAlbums) * 100)
    : 0;

  // Álbuns não ouvidos
  const unplayedAlbums = totalAlbums - (stats?.uniqueAlbumsPlayed ?? 0);

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Calendar}
          value={stats?.totalSessions ?? 0}
          label={t('stats.totalSessions')}
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          value={stats?.sessionsThisMonth ?? 0}
          label={t('stats.sessionsThisMonth')}
          loading={loading}
        />
        <StatCard
          icon={Music2}
          value={stats?.uniqueAlbumsPlayed ?? 0}
          label={t('stats.uniqueAlbumsPlayed')}
          loading={loading}
        />
        <StatCard
          icon={Disc}
          value={unplayedAlbums}
          label={t('stats.listening.unplayed')}
          loading={loading}
        />
      </div>

      {/* Taxa de Exploração */}
      <Card>
        <CardHeader>
          <CardTitle>{t('stats.listening.explorationRate')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              <div className="h-4 animate-pulse bg-muted rounded" />
              <div className="h-8 w-24 animate-pulse bg-muted rounded" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {stats?.uniqueAlbumsPlayed ?? 0} / {totalAlbums} {t('stats.totalAlbums').toLowerCase()}
                  </span>
                  <span className="font-medium">{explorationRate}%</span>
                </div>
                <Progress value={explorationRate} className="h-3" />
              </div>

              <p className="text-sm text-muted-foreground">
                {explorationRate < 25 && t('stats.listening.explorationLow')}
                {explorationRate >= 25 && explorationRate < 50 && t('stats.listening.explorationMedium')}
                {explorationRate >= 50 && explorationRate < 75 && t('stats.listening.explorationGood')}
                {explorationRate >= 75 && t('stats.listening.explorationExcellent')}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {stats && stats.totalSessions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.listening.insights')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  {t('stats.listening.avgAlbumsPerSession')}
                </p>
                <p className="text-2xl font-bold">
                  {(stats.uniqueAlbumsPlayed / stats.totalSessions).toFixed(1)}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  {t('stats.listening.sessionsPerAlbum')}
                </p>
                <p className="text-2xl font-bold">
                  {stats.uniqueAlbumsPlayed > 0
                    ? (stats.totalSessions / stats.uniqueAlbumsPlayed).toFixed(1)
                    : '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
