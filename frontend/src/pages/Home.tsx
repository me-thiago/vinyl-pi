import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { VinylVisualizer } from '@/components/VinylVisualizer/VinylVisualizer';
import { Badge } from '@/components/ui/badge';
import { Radio } from 'lucide-react';
import type { LayoutContext } from '@/components/Layout';

export default function Home() {
  const { analyser, isPlaying } = useOutletContext<LayoutContext>();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4">
      {/* Vinil centralizado */}
      <div className="relative">
        <VinylVisualizer analyser={analyser} isPlaying={isPlaying} />
      </div>

      {/* Título e status */}
      <div className="mt-8 text-center">
        <h1 className="text-2xl font-bold flex items-center gap-3 justify-center">
          <Radio className="w-6 h-6" />
          {t('home.title')}
        </h1>
        <Badge
          variant={isPlaying ? 'default' : 'secondary'}
          className={`mt-3 ${isPlaying ? 'bg-green-600 hover:bg-green-600 animate-pulse' : ''}`}
        >
          <div
            className={`w-2 h-2 rounded-full mr-2 ${
              isPlaying ? 'bg-green-300' : 'bg-gray-400'
            }`}
          />
          {isPlaying ? t('home.onAir') : t('home.offline')}
        </Badge>
      </div>
    </div>
  );
}
