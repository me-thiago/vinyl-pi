import { useTranslation } from 'react-i18next';
import { Disc, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CollectionEmptyProps {
  hasFilters?: boolean;
  onAddAlbum: () => void;
}

/**
 * Estado vazio da coleção
 *
 * Exibe mensagem diferente dependendo se há filtros ativos ou não
 */
export function CollectionEmpty({ hasFilters, onAddAlbum }: CollectionEmptyProps) {
  const { t } = useTranslation();

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Disc className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-medium mb-2">
          {t('collection.empty.no_results_title')}
        </h3>
        <p className="text-muted-foreground max-w-md">
          {t('collection.empty.no_results_description')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Disc className="h-20 w-20 text-muted-foreground/40 mb-6" />
      <h3 className="text-xl font-medium mb-2">
        {t('collection.empty_title')}
      </h3>
      <p className="text-muted-foreground max-w-md mb-6">
        {t('collection.empty_description')}
      </p>
      <Button onClick={onAddAlbum}>
        <Plus className="mr-2 h-4 w-4" />
        {t('collection.add_album')}
      </Button>
    </div>
  );
}
