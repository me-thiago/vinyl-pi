/**
 * DecadeChart - Bar chart para distribuição por década
 */

import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// Gradiente monocromático da primary (violet) - mais escuro = mais antigo
const getColorByIndex = (index: number, total: number) => {
  // Interpolar de violet-300 a violet-700
  const lightness = 78 - (index / Math.max(total - 1, 1)) * 50;
  return `hsl(262, 83%, ${lightness}%)`;
};

interface DecadeChartProps {
  data: Record<string, number>;
  compact?: boolean;
}

export function DecadeChart({ data, compact = false }: DecadeChartProps) {
  const { t } = useTranslation();

  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([decade, count]) => ({
      decade,
      count,
    }))
    .sort((a, b) => a.decade.localeCompare(b.decade));

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t('stats.noData')}
      </div>
    );
  }

  const height = compact ? 180 : 250;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="decade"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          formatter={(value: number) => [value, t('stats.totalAlbums')]}
          labelFormatter={(label) => label}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getColorByIndex(index, chartData.length)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
