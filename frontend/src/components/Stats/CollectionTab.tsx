/**
 * CollectionTab - Estatísticas detalhadas da coleção
 */

import { useTranslation } from 'react-i18next';
import { Disc, Archive, FileEdit, Database } from 'lucide-react';
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

interface CollectionTabProps {
  stats: CollectionStats | null;
  loading: boolean;
}

export function CollectionTab({ stats, loading }: CollectionTabProps) {
  const { t } = useTranslation();

  // Calcular taxa Discogs
  const totalWithDiscogs = stats
    ? stats.totalAlbums - stats.manuallyAdded
    : 0;
  const discogsRate = stats && stats.totalAlbums > 0
    ? Math.round((totalWithDiscogs / stats.totalAlbums) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Disc}
          value={stats?.totalAlbums ?? 0}
          label={t('stats.totalAlbums')}
          loading={loading}
        />
        <StatCard
          icon={Archive}
          value={stats?.archivedAlbums ?? 0}
          label={t('stats.archivedAlbums')}
          loading={loading}
        />
        <StatCard
          icon={FileEdit}
          value={stats?.manuallyAdded ?? 0}
          label={t('stats.manuallyAdded')}
          loading={loading}
        />
        <StatCard
          icon={Database}
          value={`${discogsRate}%`}
          label={t('stats.collection.discogsRate')}
          loading={loading}
        />
      </div>

      {/* Gráfico de Formato */}
      <Card>
        <CardHeader>
          <CardTitle>{t('stats.collection.formatDistribution')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[250px] animate-pulse bg-muted rounded" />
          ) : stats?.byFormat ? (
            <FormatChart data={stats.byFormat} />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              {t('stats.noData')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Década */}
      <Card>
        <CardHeader>
          <CardTitle>{t('stats.collection.decadeDistribution')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[250px] animate-pulse bg-muted rounded" />
          ) : stats?.byDecade ? (
            <DecadeChart data={stats.byDecade} />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              {t('stats.noData')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
