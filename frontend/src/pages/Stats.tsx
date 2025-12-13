/**
 * Stats - Página de estatísticas com tabs
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  OverviewTab,
  CollectionTab,
  ListeningTab,
  RankingsTab,
} from '@/components/Stats';

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

        const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

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

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">{t('stats.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="collection">{t('stats.tabs.collection')}</TabsTrigger>
          <TabsTrigger value="listening">{t('stats.tabs.listening')}</TabsTrigger>
          <TabsTrigger value="rankings">{t('stats.tabs.rankings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            collectionStats={collectionStats}
            listeningStats={listeningStats}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="collection">
          <CollectionTab
            stats={collectionStats}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="listening">
          <ListeningTab
            stats={listeningStats}
            totalAlbums={collectionStats?.totalAlbums ?? 0}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="rankings">
          <RankingsTab
            stats={listeningStats}
            loading={loading}
          />
        </TabsContent>
      </Tabs>

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
