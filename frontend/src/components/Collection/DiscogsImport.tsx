import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, Download, AlertCircle, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Album } from '@/hooks/useAlbums';

/**
 * Resultado de busca do Discogs
 */
interface DiscogsSearchResult {
  releaseId: number;
  title: string;
  year: string;
  format: string[];
  label: string[];
  thumb: string;
  country: string;
}

/**
 * Resposta da API de importação
 */
interface ImportResponse {
  data: Album;
  source: string;
  discogsUrl: string;
}

/**
 * Resposta com múltiplos resultados
 */
interface MultipleResultsResponse {
  multiple: true;
  results: DiscogsSearchResult[];
}

/**
 * Erro da API
 */
interface ApiError {
  error: {
    message: string;
    code: string;
    existingAlbumId?: string;
  };
}

type SearchType = 'catalogNumber' | 'barcode';

interface DiscogsImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: (album: Album) => void;
}

// URL base da API
const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

/**
 * Modal de Importação do Discogs
 *
 * Permite buscar álbuns no Discogs por:
 * - Número de catálogo
 * - Código de barras
 *
 * Se múltiplos resultados, mostra lista para seleção.
 */
export function DiscogsImport({ open, onOpenChange, onImportSuccess }: DiscogsImportProps) {
  const { t } = useTranslation();

  // Estado do formulário
  const [searchType, setSearchType] = useState<SearchType>('catalogNumber');
  const [searchValue, setSearchValue] = useState('');

  // Estado de busca
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resultados de busca (quando múltiplos)
  const [results, setResults] = useState<DiscogsSearchResult[] | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);

  // Estado de importação (após seleção)
  const [importing, setImporting] = useState(false);

  /**
   * Reseta o estado do modal
   */
  const resetState = useCallback(() => {
    setSearchValue('');
    setError(null);
    setResults(null);
    setSelectedReleaseId(null);
    setLoading(false);
    setImporting(false);
  }, []);

  /**
   * Handler de fechamento
   */
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetState();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetState]
  );

  /**
   * Busca no Discogs
   */
  const handleSearch = useCallback(async () => {
    if (!searchValue.trim()) {
      setError(t('discogs.error_empty_search'));
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setSelectedReleaseId(null);

    try {
      const body: Record<string, string> = {};
      if (searchType === 'catalogNumber') {
        body.catalogNumber = searchValue.trim();
      } else {
        body.barcode = searchValue.trim();
      }

      const response = await fetch(`${API_HOST}/api/albums/import-discogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;

        // Se já existe, mostrar mensagem específica
        if (errorData.error.code === 'DISCOGS_ID_EXISTS') {
          setError(t('discogs.error_already_exists'));
          return;
        }

        // Outros erros
        throw new Error(errorData.error.message);
      }

      // Verifica se são múltiplos resultados
      if ('multiple' in data && data.multiple) {
        const multipleData = data as MultipleResultsResponse;
        setResults(multipleData.results);
        if (multipleData.results.length > 0) {
          setSelectedReleaseId(multipleData.results[0].releaseId);
        }
        return;
      }

      // Resultado único - álbum importado diretamente
      const importData = data as ImportResponse;
      onImportSuccess(importData.data);
      handleOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('discogs.error_generic');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [searchType, searchValue, t, onImportSuccess, handleOpenChange]);

  /**
   * Importa release selecionado
   */
  const handleImportSelected = useCallback(async () => {
    if (!selectedReleaseId) return;

    setImporting(true);
    setError(null);

    try {
      const response = await fetch(`${API_HOST}/api/albums/import-discogs/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId: selectedReleaseId }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;

        if (errorData.error.code === 'DISCOGS_ID_EXISTS') {
          setError(t('discogs.error_already_exists'));
          return;
        }

        throw new Error(errorData.error.message);
      }

      const importData = data as ImportResponse;
      onImportSuccess(importData.data);
      handleOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('discogs.error_generic');
      setError(message);
    } finally {
      setImporting(false);
    }
  }, [selectedReleaseId, t, onImportSuccess, handleOpenChange]);

  /**
   * Volta para busca
   */
  const handleBackToSearch = useCallback(() => {
    setResults(null);
    setSelectedReleaseId(null);
    setError(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('discogs.import_title')}
          </DialogTitle>
          <DialogDescription>{t('discogs.import_description')}</DialogDescription>
        </DialogHeader>

        {/* Formulário de Busca (quando não há resultados) */}
        {!results && (
          <div className="space-y-4">
            {/* Tipo de busca */}
            <div className="space-y-2">
              <Label>{t('discogs.search_by')}</Label>
              <RadioGroup
                value={searchType}
                onValueChange={(v: string) => setSearchType(v as SearchType)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="catalogNumber" id="catalogNumber" />
                  <Label htmlFor="catalogNumber" className="font-normal cursor-pointer">
                    {t('discogs.catalog_number')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="barcode" id="barcode" />
                  <Label htmlFor="barcode" className="font-normal cursor-pointer">
                    {t('discogs.barcode')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Campo de busca */}
            <div className="space-y-2">
              <Label htmlFor="searchValue">
                {searchType === 'catalogNumber'
                  ? t('discogs.catalog_number')
                  : t('discogs.barcode')}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="searchValue"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={
                    searchType === 'catalogNumber'
                      ? t('discogs.catalog_placeholder')
                      : t('discogs.barcode_placeholder')
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleSearch();
                    }
                  }}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Lista de Resultados */}
        {results && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('discogs.results_found', { count: results.length })}
              </p>
              <Button variant="ghost" size="sm" onClick={handleBackToSearch}>
                {t('discogs.back_to_search')}
              </Button>
            </div>

            <ScrollArea className="h-[300px] rounded-md border">
              <RadioGroup
                value={selectedReleaseId?.toString() ?? ''}
                onValueChange={(v: string) => setSelectedReleaseId(parseInt(v, 10))}
              >
                {results.map((result) => (
                  <div
                    key={result.releaseId}
                    className="flex items-start space-x-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <RadioGroupItem
                      value={result.releaseId.toString()}
                      id={`release-${result.releaseId}`}
                      className="mt-1"
                    />
                    <div className="flex gap-3 flex-1 min-w-0">
                      {/* Thumbnail */}
                      {result.thumb ? (
                        <img
                          src={result.thumb}
                          alt=""
                          className="w-12 h-12 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}

                      {/* Info */}
                      <label
                        htmlFor={`release-${result.releaseId}`}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <p className="font-medium truncate">{result.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {result.label?.join(', ') || '-'} &middot; {result.year || '-'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.format?.join(', ')} &middot; {result.country}
                        </p>
                      </label>

                      {/* Link externo */}
                      <a
                        href={`https://www.discogs.com/release/${result.releaseId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                        title={t('discogs.view_on_discogs')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </ScrollArea>

            {/* Erro */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Botão de importar */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleBackToSearch}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleImportSelected}
                disabled={!selectedReleaseId || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('discogs.importing')}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {t('discogs.import_selected')}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
