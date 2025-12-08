import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Disc3, Search, Filter } from 'lucide-react';
import { RecordingCard } from '@/components/Recording/RecordingCard';
import { LinkRecordingDialog } from '@/components/Recording/LinkRecordingDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Recording {
  id: string;
  fileName: string;
  album?: {
    id: string;
    title: string;
    artist: string;
    coverUrl?: string;
  } | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  status: string;
  startedAt: string;
  _count?: {
    trackMarkers: number;
  };
}

interface RecordingsResponse {
  data: Recording[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Página de listagem de gravações
 * 
 * Features:
 * - Listagem paginada
 * - Filtros (álbum, status)
 * - Busca por nome
 * - Ações (deletar, editar, vincular)
 */
export default function Recordings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // const [albumFilter, setAlbumFilter] = useState<string>('all'); // TODO: Implementar filtro por álbum quando houver endpoint

  // Modal de vinculação
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<{ id: string; fileName: string } | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  /**
   * Buscar gravações da API
   */
  const fetchRecordings = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((currentPage - 1) * limit).toString(),
        sort: 'startedAt',
        order: 'desc',
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      // if (albumFilter !== 'all') {
      //   params.append('albumId', albumFilter);
      // }

      const response = await fetch(`${apiUrl}/api/recordings?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch recordings: ${response.status}`);
      }

      const result: RecordingsResponse = await response.json();
      
      // Filtrar por search term no frontend (simples)
      let filteredData = result.data;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = result.data.filter(r => 
          r.fileName.toLowerCase().includes(term) ||
          r.album?.title.toLowerCase().includes(term) ||
          r.album?.artist.toLowerCase().includes(term)
        );
      }

      setRecordings(filteredData);
      setTotal(result.meta.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recordings';
      setError(message);
      toast.error(t('recording.loadError'), { description: message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Deletar gravação
   */
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/recordings/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete recording');
      }

      toast.success(t('recording.deleted'));
      fetchRecordings(); // Recarregar lista
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete recording';
      toast.error(t('recording.deleteError'), { description: message });
    }
  };

  /**
   * Navegar para editor de gravação
   */
  const handleEdit = (id: string) => {
    navigate(`/recordings/${id}/edit`);
  };

  /**
   * Vincular a álbum (abrir modal)
   */
  const handleLink = (id: string) => {
    const recording = recordings.find((r) => r.id === id);
    if (recording) {
      setSelectedRecording({ id: recording.id, fileName: recording.fileName });
      setLinkDialogOpen(true);
    }
  };

  /**
   * Callback após vincular com sucesso
   */
  const handleLinkSuccess = () => {
    fetchRecordings(); // Recarregar lista
  };

  /**
   * Recarregar quando filtros mudarem
   */
  useEffect(() => {
    fetchRecordings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter]);

  /**
   * Debounce para busca
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== '') {
        fetchRecordings();
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Calcular paginação
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return (
    <div className="container max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Disc3 className="w-8 h-8" />
          <div>
            <h1 className="text-3xl font-bold">{t('recording.title')}</h1>
            <p className="text-muted-foreground">
              {total} {t('recording.totalRecordings')}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros e busca */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Busca */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('recording.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filtro por status */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder={t('recording.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('recording.allStatuses')}</SelectItem>
            <SelectItem value="completed">{t('recording.status.completed')}</SelectItem>
            <SelectItem value="recording">{t('recording.status.recording')}</SelectItem>
            <SelectItem value="processing">{t('recording.status.processing')}</SelectItem>
            <SelectItem value="error">{t('recording.status.error')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtro por álbum (placeholder) */}
        {/* TODO: Carregar álbuns da API para filtro */}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          {t('common.loading')}...
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-12 text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && recordings.length === 0 && (
        <div className="text-center py-12">
          <Disc3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">{t('recording.emptyTitle')}</h2>
          <p className="text-muted-foreground">
            {t('recording.emptyDescription')}
          </p>
        </div>
      )}

      {/* Lista de gravações */}
      {!loading && !error && recordings.length > 0 && (
        <>
          <div className="space-y-4">
            {recordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onLink={handleLink}
              />
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={!hasPrevPage}
              >
                {t('common.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('common.page')} {currentPage} {t('common.of')} {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!hasNextPage}
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal de vinculação */}
      {selectedRecording && (
        <LinkRecordingDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          recordingId={selectedRecording.id}
          recordingFileName={selectedRecording.fileName}
          onSuccess={handleLinkSuccess}
        />
      )}
    </div>
  );
}
