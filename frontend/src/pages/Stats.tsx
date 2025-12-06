import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Disc,
  Users,
  Archive,
  FileEdit,
  Calendar,
  Play,
  Music2,
  TrendingUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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

function StatCard({
  icon: Icon,
  value,
  label,
  loading,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
      <Icon className="w-5 h-5 text-muted-foreground mb-2" />
      {loading ? (
        <Skeleton className="h-8 w-12 mb-1" />
      ) : (
        <span className="text-2xl font-bold">{value}</span>
      )}
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function FormatLabels({
  byFormat,
  loading,
}: {
  byFormat: Record<string, number>;
  loading?: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton className="h-4 w-48" />;
  }

  const entries = Object.entries(byFormat);
  if (entries.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">{t('stats.noData')}</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([format, count]) => (
        <Badge key={format} variant="secondary" className="text-xs">
          {format}: {count}
        </Badge>
      ))}
    </div>
  );
}

function DecadeLabels({
  byDecade,
  loading,
}: {
  byDecade: Record<string, number>;
  loading?: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton className="h-4 w-64" />;
  }

  const entries = Object.entries(byDecade);
  if (entries.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">{t('stats.noData')}</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([decade, count]) => (
        <Badge key={decade} variant="outline" className="text-xs">
          {decade}: {count}
        </Badge>
      ))}
    </div>
  );
}

function TopAlbumsList({
  albums,
  loading,
}: {
  albums: ListeningStats['topAlbums'];
  loading?: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('stats.noListeningData')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {albums.map((album, index) => (
        <Link
          key={album.albumId}
          to={`/collection/${album.albumId}`}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
        >
          <div className="relative">
            <span className="absolute -top-1 -left-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
              {index + 1}
            </span>
            {album.coverUrl ? (
              <img
                src={album.coverUrl}
                alt={album.title}
                className="w-12 h-12 rounded object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                <Disc className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate group-hover:text-primary transition-colors">
              {album.title}
            </p>
            <p className="text-sm text-muted-foreground truncate">{album.artist}</p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {t('stats.sessions', { count: album.sessionCount })}
          </Badge>
        </Link>
      ))}
    </div>
  );
}

function TopArtistsList({
  artists,
  loading,
}: {
  artists: ListeningStats['topArtists'];
  loading?: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('stats.noData')}</p>
    );
  }

  return (
    <ol className="space-y-2">
      {artists.map((artist, index) => (
        <li key={artist.artist} className="flex items-center gap-2 text-sm">
          <span className="w-5 h-5 bg-muted text-muted-foreground text-xs font-bold rounded-full flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <span className="flex-1 truncate">{artist.artist}</span>
          <span className="text-muted-foreground shrink-0">
            ({t('stats.sessions', { count: artist.sessionCount })})
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function Stats() {
  const { t } = useTranslation();
  const [collectionStats, setCollectionStats] = useState<CollectionStats | null>(null);
  const [listeningStats, setListeningStats] = useState<ListeningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const [collectionRes, listeningRes] = await Promise.all([
          fetch(`${apiUrl}/api/stats/collection`),
          fetch(`${apiUrl}/api/stats/listening`),
        ]);

        if (!collectionRes.ok || !listeningRes.ok) {
          throw new Error('Failed to fetch stats');
        }

        const [collectionData, listeningData] = await Promise.all([
          collectionRes.json(),
          listeningRes.json(),
        ]);

        setCollectionStats(collectionData);
        setListeningStats(listeningData);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          {t('stats.pageTitle')}
        </h1>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Disc className="w-5 h-5" />
              {t('stats.collectionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Counters */}
            <div className="grid grid-cols-3 gap-3">
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
                icon={Archive}
                value={collectionStats?.archivedAlbums ?? 0}
                label={t('stats.archivedAlbums')}
                loading={loading}
              />
            </div>

            {/* By Format */}
            <div>
              <h4 className="text-sm font-medium mb-2">{t('stats.byFormat')}</h4>
              <FormatLabels
                byFormat={collectionStats?.byFormat ?? {}}
                loading={loading}
              />
            </div>

            {/* By Decade */}
            <div>
              <h4 className="text-sm font-medium mb-2">{t('stats.byDecade')}</h4>
              <DecadeLabels
                byDecade={collectionStats?.byDecade ?? {}}
                loading={loading}
              />
            </div>

            {/* Manually Added */}
            <div className="pt-2 border-t">
              <StatCard
                icon={FileEdit}
                value={collectionStats?.manuallyAdded ?? 0}
                label={t('stats.manuallyAdded')}
                loading={loading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Listening Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="w-5 h-5" />
              {t('stats.listeningTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Session Counters */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={Calendar}
                value={listeningStats?.totalSessions ?? 0}
                label={t('stats.totalSessions')}
                loading={loading}
              />
              <StatCard
                icon={Calendar}
                value={listeningStats?.sessionsThisMonth ?? 0}
                label={t('stats.sessionsThisMonth')}
                loading={loading}
              />
              <StatCard
                icon={Music2}
                value={listeningStats?.uniqueAlbumsPlayed ?? 0}
                label={t('stats.uniqueAlbumsPlayed')}
                loading={loading}
              />
            </div>

            {/* Top Albums */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                🏆 {t('stats.topPlayed')}
              </h4>
              <TopAlbumsList
                albums={listeningStats?.topAlbums ?? []}
                loading={loading}
              />
            </div>

            {/* Top Artists */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                🎨 {t('stats.topArtists')}
              </h4>
              <TopArtistsList
                artists={listeningStats?.topArtists ?? []}
                loading={loading}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground mt-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('common.loading')}</span>
        </div>
      )}
    </div>
  );
}

