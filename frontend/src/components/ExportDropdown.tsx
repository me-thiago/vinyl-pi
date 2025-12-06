import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const API_HOST =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

export type ExportType = 'collection' | 'history';

interface ExportDropdownProps {
  /**
   * Tipo de export: 'collection' ou 'history'
   */
  type: ExportType;
  /**
   * Parâmetros adicionais para o endpoint (ex: from, to para history)
   */
  params?: Record<string, string>;
  /**
   * Classe CSS adicional para o botão trigger
   */
  className?: string;
  /**
   * Variante do botão
   */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /**
   * Mostra apenas ícone (sem texto)
   */
  iconOnly?: boolean;
}

/**
 * Componente dropdown para exportar dados em JSON ou CSV.
 *
 * Usado nas páginas Collection e Sessions para exportar dados.
 *
 * @example
 * <ExportDropdown type="collection" />
 *
 * @example
 * <ExportDropdown
 *   type="history"
 *   params={{ from: '2025-01-01', to: '2025-12-31' }}
 *   variant="outline"
 * />
 */
export function ExportDropdown({
  type,
  params = {},
  className,
  variant = 'outline',
  iconOnly = false,
}: ExportDropdownProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<'json' | 'csv' | null>(
    null
  );

  const handleExport = async (format: 'json' | 'csv') => {
    setLoading(true);
    setLoadingFormat(format);

    try {
      const queryParams = new URLSearchParams({
        format,
        ...params,
      });

      const url = `${API_HOST}/api/export/${type}?${queryParams}`;

      // Usar fetch para download
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Extrair filename do header Content-Disposition
      const disposition = response.headers.get('Content-Disposition');
      let filename = `vinyl-os-${type}.${format}`;

      if (disposition) {
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Criar blob e trigger download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Export error:', error);
      // TODO: Adicionar toast de erro quando disponível
    } finally {
      setLoading(false);
      setLoadingFormat(null);
    }
  };

  const buttonLabel =
    type === 'collection'
      ? t('export.exportCollection')
      : t('export.exportHistory');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          className={className}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {!iconOnly && (
            <span className="ml-2">
              {loading ? t('export.downloading') : buttonLabel}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport('json')}
          disabled={loading}
        >
          {loadingFormat === 'json' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileJson className="mr-2 h-4 w-4" />
          )}
          {t('export.formatJson')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('csv')}
          disabled={loading}
        >
          {loadingFormat === 'csv' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-2 h-4 w-4" />
          )}
          {t('export.formatCsv')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

