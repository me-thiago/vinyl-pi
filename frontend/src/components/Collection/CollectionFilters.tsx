import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Grid, List, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AlbumFilters, AlbumFormat, AlbumCondition } from '@/hooks/useAlbums';

interface CollectionFiltersProps {
  filters: AlbumFilters;
  onFiltersChange: (filters: AlbumFilters) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

/**
 * Opções de formato
 */
const formatOptions: { value: AlbumFormat | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'LP', label: 'LP' },
  { value: 'EP', label: 'EP' },
  { value: 'SINGLE_7', label: '7"' },
  { value: 'SINGLE_12', label: '12"' },
  { value: 'DOUBLE_LP', label: '2xLP' },
  { value: 'BOX_SET', label: 'Box Set' },
];

/**
 * Opções de condição
 */
const conditionOptions: { value: AlbumCondition | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'mint', label: 'Mint' },
  { value: 'near_mint', label: 'Near Mint' },
  { value: 'vg_plus', label: 'VG+' },
  { value: 'vg', label: 'VG' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

/**
 * Barra de filtros da coleção
 *
 * Features:
 * - Campo de busca com debounce
 * - Filtros por formato e condição
 * - Toggle para mostrar arquivados
 * - Toggle grid/lista
 */
export function CollectionFilters({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
}: CollectionFiltersProps) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState(filters.search ?? '');

  // Debounce na busca
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput || undefined });
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput, filters, onFiltersChange]);

  // Atualiza input quando filtro externo muda
  useEffect(() => {
    setSearchInput(filters.search ?? '');
  }, [filters.search]);

  const handleFormatChange = (value: string) => {
    onFiltersChange({
      ...filters,
      format: value ? (value as AlbumFormat) : undefined,
    });
  };

  const handleConditionChange = (value: string) => {
    onFiltersChange({
      ...filters,
      condition: value ? (value as AlbumCondition) : undefined,
    });
  };

  const handleArchivedChange = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      archived: checked || undefined,
    });
  };

  const clearSearch = () => {
    setSearchInput('');
    onFiltersChange({ ...filters, search: undefined });
  };

  const hasActiveFilters =
    filters.search || filters.format || filters.condition || filters.archived;

  const clearAllFilters = () => {
    setSearchInput('');
    onFiltersChange({});
  };

  return (
    <div className="space-y-4">
      {/* Linha principal: busca + toggle de visualização */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Campo de busca */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('collection.search_placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t('common.clear')}</span>
            </Button>
          )}
        </div>

        {/* Toggle Grid/List */}
        <div className="flex items-center gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewModeChange('grid')}
            aria-pressed={viewMode === 'grid'}
          >
            <Grid className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewModeChange('list')}
            aria-pressed={viewMode === 'list'}
          >
            <List className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </Button>
        </div>
      </div>

      {/* Linha de filtros */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Filtro de formato */}
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            {t('collection.filters.format')}:
          </Label>
          <Select
            value={filters.format ?? ''}
            onValueChange={handleFormatChange}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formatOptions.map((opt) => (
                <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                  {opt.value === '' ? t('collection.filters.all') : opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro de condição */}
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            {t('collection.filters.condition')}:
          </Label>
          <Select
            value={filters.condition ?? ''}
            onValueChange={handleConditionChange}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {conditionOptions.map((opt) => (
                <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                  {opt.value === '' ? t('collection.filters.all') : opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Toggle mostrar arquivados */}
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={filters.archived ?? false}
            onCheckedChange={handleArchivedChange}
          />
          <Label htmlFor="show-archived" className="text-sm cursor-pointer">
            {t('collection.filters.show_archived')}
          </Label>
        </div>

        {/* Botão limpar filtros */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            {t('collection.filters.clear')}
          </Button>
        )}
      </div>
    </div>
  );
}
