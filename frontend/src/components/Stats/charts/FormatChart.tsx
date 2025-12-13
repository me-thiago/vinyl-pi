/**
 * FormatChart - Donut chart para distribuição por formato
 */

import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

// Gradiente monocromático da primary (violet)
const COLORS = [
  'hsl(262, 83%, 58%)',  // violet-500
  'hsl(262, 83%, 48%)',  // violet-600
  'hsl(262, 83%, 68%)',  // violet-400
  'hsl(262, 83%, 38%)',  // violet-700
  'hsl(262, 83%, 78%)',  // violet-300
  'hsl(262, 83%, 28%)',  // violet-800
];

// Labels amigáveis para formatos
const FORMAT_LABELS: Record<string, string> = {
  LP: 'LP',
  EP: 'EP',
  SINGLE_7: '7"',
  SINGLE_12: '12"',
  DOUBLE_LP: '2xLP',
  BOX_SET: 'Box Set',
};

interface FormatChartProps {
  data: Record<string, number>;
  compact?: boolean;
}

export function FormatChart({ data, compact = false }: FormatChartProps) {
  const { t } = useTranslation();

  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([format, count]) => ({
      name: FORMAT_LABELS[format] || format,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t('stats.noData')}
      </div>
    );
  }

  const height = compact ? 180 : 250;
  const innerRadius = compact ? 40 : 60;
  const outerRadius = compact ? 65 : 90;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
          label={compact ? false : ({ name, percent }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={!compact}
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              className="outline-none focus:outline-none"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          formatter={(value: number) => [value, t('stats.totalAlbums')]}
        />
        {!compact && (
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-sm text-foreground">{value}</span>
            )}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
