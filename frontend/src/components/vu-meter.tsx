import { cn } from '@/lib/utils'

/**
 * Configuração do VU Meter
 */
export interface VUMeterConfig {
  /** Valor mínimo em dB (default: -80) */
  minDb: number
  /** Valor máximo em dB (default: 0) */
  maxDb: number
  /** Threshold de silêncio em dB */
  silenceThreshold: number
  /** Threshold de clipping em dB */
  clippingThreshold: number
}

export interface VUMeterProps {
  /** Nível atual em dB (null = sem sinal) */
  levelDb: number | null
  /** Configuração do meter */
  config: VUMeterConfig
  /** Mostrar escala de dB */
  showScale?: boolean
  /** Orientação */
  orientation?: 'horizontal' | 'vertical'
  /** Classes CSS adicionais */
  className?: string
}

/**
 * Normaliza valor dB para porcentagem (0-100)
 */
function normalizeDb(db: number, minDb: number, maxDb: number): number {
  const range = maxDb - minDb
  const normalized = ((db - minDb) / range) * 100
  return Math.max(0, Math.min(100, normalized))
}

/**
 * Gera marcadores de escala
 */
function generateScaleMarkers(minDb: number, maxDb: number, step: number = 10): number[] {
  const markers: number[] = []
  for (let db = minDb; db <= maxDb; db += step) {
    markers.push(db)
  }
  return markers
}

/**
 * VU Meter Component
 *
 * Componente de medidor de nível de áudio com:
 * - Indicação visual de nível atual
 * - Marcadores de threshold (silêncio e clipping)
 * - Cores dinâmicas baseadas no nível
 * - Suporte a orientação horizontal e vertical
 */
export function VUMeter({
  levelDb,
  config,
  showScale = true,
  orientation = 'horizontal',
  className
}: VUMeterProps) {
  const { minDb, maxDb, silenceThreshold, clippingThreshold } = config

  // Normalizar valores para porcentagem
  const normalizedLevel = levelDb !== null
    ? normalizeDb(levelDb, minDb, maxDb)
    : 0

  const normalizedSilence = normalizeDb(silenceThreshold, minDb, maxDb)
  const normalizedClipping = normalizeDb(clippingThreshold, minDb, maxDb)

  // Determinar cor baseado no nível
  const getBarColorClass = () => {
    if (levelDb === null) return 'bg-muted'
    if (levelDb >= clippingThreshold) return 'bg-destructive'
    if (levelDb <= silenceThreshold) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  // Gerar marcadores de escala
  const scaleMarkers = showScale ? generateScaleMarkers(minDb, maxDb, 20) : []

  const isHorizontal = orientation === 'horizontal'

  return (
    <div className={cn('space-y-2', className)}>
      {/* Valor atual */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-mono font-medium">
          {levelDb?.toFixed(1) ?? '--'} dB
        </span>
        {showScale && (
          <span className="text-muted-foreground text-xs">
            {maxDb} dB
          </span>
        )}
      </div>

      {/* Container do meter */}
      <div
        className={cn(
          'relative rounded-md overflow-hidden border bg-muted/30',
          isHorizontal ? 'h-8 w-full' : 'w-8 h-48'
        )}
      >
        {/* Barra de nível */}
        <div
          className={cn(
            'absolute transition-all duration-75 ease-out',
            getBarColorClass(),
            isHorizontal
              ? 'left-0 top-0 h-full'
              : 'bottom-0 left-0 w-full'
          )}
          style={isHorizontal
            ? { width: `${normalizedLevel}%` }
            : { height: `${normalizedLevel}%` }
          }
        />

        {/* Marcador de silence threshold */}
        <div
          className={cn(
            'absolute bg-yellow-600/80 z-10',
            isHorizontal
              ? 'top-0 h-full w-0.5'
              : 'left-0 w-full h-0.5'
          )}
          style={isHorizontal
            ? { left: `${normalizedSilence}%` }
            : { bottom: `${normalizedSilence}%` }
          }
          title={`Silêncio: ${silenceThreshold}dB`}
        />

        {/* Marcador de clipping threshold */}
        <div
          className={cn(
            'absolute bg-destructive/80 z-10',
            isHorizontal
              ? 'top-0 h-full w-0.5'
              : 'left-0 w-full h-0.5'
          )}
          style={isHorizontal
            ? { left: `${normalizedClipping}%` }
            : { bottom: `${normalizedClipping}%` }
          }
          title={`Clipping: ${clippingThreshold}dB`}
        />

        {/* Segmentos LED (efeito visual) */}
        <div
          className={cn(
            'absolute inset-0 flex',
            isHorizontal ? 'flex-row' : 'flex-col-reverse'
          )}
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'border-r border-background/20',
                isHorizontal ? 'flex-1 h-full' : 'flex-1 w-full border-r-0 border-b'
              )}
            />
          ))}
        </div>
      </div>

      {/* Escala */}
      {showScale && isHorizontal && (
        <div className="relative h-4 text-xs text-muted-foreground">
          {scaleMarkers.map((db) => {
            const pos = normalizeDb(db, minDb, maxDb)
            return (
              <span
                key={db}
                className="absolute -translate-x-1/2"
                style={{ left: `${pos}%` }}
              >
                {db}
              </span>
            )
          })}
        </div>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-yellow-500" />
          <span>Silêncio ({silenceThreshold}dB)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive" />
          <span>Clipping ({clippingThreshold}dB)</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Props para VUMeter compacto (usado em cards)
 */
export interface VUMeterCompactProps {
  levelDb: number | null
  silenceThreshold: number
  clippingThreshold: number
  className?: string
}

/**
 * Versão compacta do VU Meter para uso em cards
 */
export function VUMeterCompact({
  levelDb,
  silenceThreshold,
  clippingThreshold,
  className
}: VUMeterCompactProps) {
  return (
    <VUMeter
      levelDb={levelDb}
      config={{
        minDb: -80,
        maxDb: 0,
        silenceThreshold,
        clippingThreshold
      }}
      showScale={false}
      className={className}
    />
  )
}
