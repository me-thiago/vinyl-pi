import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Activity,
  Settings,
  Volume2,
  VolumeX,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Wifi,
  WifiOff,
  Disc3,
  Zap,
  Clock,
  Gauge
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { ThemeToggle } from '@/components/theme-toggle'
import { VUMeter } from '@/components/vu-meter'
import { useSocket } from '@/hooks/useSocket'
import type { EventPayload } from '@/hooks/useSocket'

// Configuração da API - usa variável de ambiente
const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`
const API_BASE = `${API_HOST}/api`

// Constantes de configuração
const MAX_EVENTS = 100
const VU_METER_MIN_DB = -80
const VU_METER_MAX_DB = 0

// Tipos para Settings
interface SettingDefinition {
  key: string
  defaultValue: number
  type: 'number' | 'string' | 'boolean'
  label: string
  description: string
  min?: number
  max?: number
  unit?: string
  value: number
}

interface SettingsResponse {
  settings: SettingDefinition[]
}

// Event translations moved to i18n (events.* keys)

// Mapa de ícones por tipo de setting
const SETTING_ICONS: Record<string, typeof Settings> = {
  'silence': VolumeX,
  'clipping': Zap,
  'session': Clock
}

// translateEventType now uses i18n - see usage in component

// Cor do badge por tipo de evento
function getEventBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type.includes('clipping')) return 'destructive'
  if (type.includes('silence')) return 'secondary'
  if (type.includes('session')) return 'default'
  return 'outline'
}

// Formatar timestamp com data e hora
function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Obter ícone para uma setting
function getSettingIcon(key: string) {
  for (const [prefix, Icon] of Object.entries(SETTING_ICONS)) {
    if (key.includes(prefix)) return Icon
  }
  return Settings
}

// Step para slider baseado no tipo de setting
function getSliderStep(key: string): number {
  if (key.includes('cooldown')) return 100
  return 1
}

export default function Diagnostics() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<SettingDefinition[]>([])
  const [pendingChanges, setPendingChanges] = useState<Record<string, number>>({})
  const [events, setEvents] = useState<Array<EventPayload & { id: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // WebSocket para atualizações em tempo real
  const { isConnected, audioLevel, reconnect } = useSocket({
    onEvent: (event) => {
      // Só adicionar eventos se auto-scroll estiver ativo
      // Isso permite "pausar" a lista para examinar eventos
      if (!autoScroll) return

      setEvents(prev => [{
        ...event,
        id: event.id || `evt_${Date.now()}`
      }, ...prev].slice(0, MAX_EVENTS))
    }
  })

  // Buscar settings da API
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/settings`)
      if (!response.ok) throw new Error(t('diagnostics.loadError'))
      const data: SettingsResponse = await response.json()
      setSettings(data.settings)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  // Buscar eventos iniciais via API
  const fetchInitialEvents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/events?limit=${MAX_EVENTS}`)
      if (!response.ok) throw new Error(t('diagnostics.loadError'))
      const data = await response.json()
      setEvents(data.events.map((e: EventPayload) => ({
        ...e,
        id: e.id || `evt_${Date.now()}`
      })))
    } catch (err) {
      console.error('Error fetching initial events:', err)
    }
  }, [t])

  // Carregar settings e eventos no mount
  useEffect(() => {
    fetchSettings()
    fetchInitialEvents()
  }, [fetchSettings, fetchInitialEvents])

  // Atualizar setting localmente (antes de salvar)
  const handleSettingChange = useCallback((key: string, value: number) => {
    setPendingChanges(prev => ({ ...prev, [key]: value }))
  }, [])

  // Salvar mudanças
  const saveChanges = useCallback(async () => {
    if (Object.keys(pendingChanges).length === 0) return

    try {
      setSaving(true)
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingChanges)
      })

      if (!response.ok) throw new Error(t('diagnostics.saveError'))

      const data: { settings: SettingDefinition[] } = await response.json()
      setSettings(data.settings)
      setPendingChanges({})
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('diagnostics.saveError'))
    } finally {
      setSaving(false)
    }
  }, [pendingChanges, t])

  // Resetar todas as settings
  const resetAll = useCallback(async () => {
    try {
      setSaving(true)
      const response = await fetch(`${API_BASE}/settings/reset`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error(t('diagnostics.resetError'))

      const data: { settings: SettingDefinition[] } = await response.json()
      setSettings(data.settings)
      setPendingChanges({})
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('diagnostics.resetError'))
    } finally {
      setSaving(false)
    }
  }, [t])

  // Obter valor atual de uma setting (pendente ou salvo)
  const getSettingValue = useCallback((key: string): number => {
    if (pendingChanges[key] !== undefined) return pendingChanges[key]
    const setting = settings.find(s => s.key === key)
    return setting?.value ?? 0
  }, [pendingChanges, settings])

  // Verificar se há mudanças pendentes
  const hasPendingChanges = Object.keys(pendingChanges).length > 0

  // Thresholds para VU meter (memoizado)
  const vuMeterConfig = useMemo(() => ({
    minDb: VU_METER_MIN_DB,
    maxDb: VU_METER_MAX_DB,
    silenceThreshold: getSettingValue('silence.threshold'),
    clippingThreshold: getSettingValue('clipping.threshold')
  }), [getSettingValue])

  // Status do áudio atual
  const audioStatus = useMemo(() => {
    if (audioLevel === null) return null
    if (audioLevel >= vuMeterConfig.clippingThreshold) return 'clipping'
    if (audioLevel <= vuMeterConfig.silenceThreshold) return 'silence'
    return 'normal'
  }, [audioLevel, vuMeterConfig])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
              <Disc3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t('diagnostics.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('diagnostics.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={reconnect}
              title={isConnected ? t('diagnostics.connected') : t('diagnostics.disconnected')}
            >
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-destructive" />
              )}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* VU Meter Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5" />
              {t('diagnostics.vuMeter')}
            </CardTitle>
            <CardDescription>
              {t('diagnostics.vuMeterDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <VUMeter
              levelDb={audioLevel}
              config={vuMeterConfig}
              showScale
              orientation="horizontal"
            />

            {/* Status indicators */}
            <div className="flex items-center gap-2">
              {audioStatus === 'silence' && (
                <Badge variant="secondary" className="gap-1">
                  <VolumeX className="w-3 h-3" />
                  {t('dashboard.silence')}
                </Badge>
              )}
              {audioStatus === 'clipping' && (
                <Badge variant="destructive" className="gap-1">
                  <Zap className="w-3 h-3" />
                  {t('dashboard.clipping')}
                </Badge>
              )}
              {audioStatus === 'normal' && (
                <Badge variant="outline" className="gap-1">
                  <Volume2 className="w-3 h-3" />
                  {t('dashboard.normal')}
                </Badge>
              )}
              {audioStatus === null && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  {t('diagnostics.waitingSignal')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t('diagnostics.settings')}
                </CardTitle>
                <CardDescription>
                  {t('diagnostics.settingsDesc')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAll}
                  disabled={saving}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  {t('diagnostics.reset')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSettings}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  {t('diagnostics.reloadSettings')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('diagnostics.loadingSettings')}
              </div>
            ) : (
              <>
                {settings.map((setting) => {
                  const currentValue = getSettingValue(setting.key)
                  const hasChange = pendingChanges[setting.key] !== undefined
                  const Icon = getSettingIcon(setting.key)
                  const step = getSliderStep(setting.key)

                  return (
                    <div key={setting.key} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          {setting.label}
                          {hasChange && (
                            <Badge variant="secondary" className="text-xs">
                              {t('diagnostics.modified')}
                            </Badge>
                          )}
                        </Label>
                        <span className="font-mono text-sm tabular-nums">
                          {currentValue} {setting.unit}
                        </span>
                      </div>
                      <Slider
                        value={[currentValue]}
                        onValueChange={([value]: number[]) => handleSettingChange(setting.key, value)}
                        min={setting.min}
                        max={setting.max}
                        step={step}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        {setting.description}
                        {setting.min !== undefined && setting.max !== undefined && (
                          <span className="ml-1 opacity-70">
                            (min: {setting.min}, max: {setting.max})
                          </span>
                        )}
                      </p>
                    </div>
                  )
                })}

                {/* Botão de salvar */}
                {hasPendingChanges && (
                  <div className="pt-4 border-t">
                    <Button
                      onClick={saveChanges}
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? t('settings.saving') : t('diagnostics.saveChanges')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Events Log Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  {t('diagnostics.eventLog')}
                  {events.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {events.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {t('diagnostics.lastEvents', { count: MAX_EVENTS })}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-update" className="text-sm text-muted-foreground">
                  {autoScroll ? t('diagnostics.live') : t('diagnostics.paused')}
                </Label>
                <Switch
                  id="auto-update"
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('diagnostics.noEventsYet')}</p>
                <p className="text-sm">{t('diagnostics.eventsRealtime')}</p>
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-2 pr-4">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={getEventBadgeVariant(event.eventType)}>
                          {t(`events.${event.eventType}`, { defaultValue: event.eventType })}
                        </Badge>
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <span className="text-xs text-muted-foreground hidden sm:inline font-mono">
                            {event.metadata.levelDb !== undefined &&
                              `${(event.metadata.levelDb as number).toFixed(1)} dB`
                            }
                            {event.metadata.duration !== undefined &&
                              ` • ${(event.metadata.duration as number).toFixed(1)}s`
                            }
                            {event.metadata.count !== undefined &&
                              ` • #${event.metadata.count}`
                            }
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">
                        {formatDateTime(event.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>
            {t('footer.diagnostics')} • {isConnected ? t('diagnostics.connectedWebSocket') : t('dashboard.reconnecting')}
          </p>
        </div>
      </footer>
    </div>
  )
}
