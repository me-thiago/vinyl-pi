import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Radio,
  Activity,
  Clock,
  AlertTriangle,
  Volume2,
  VolumeX,
  RefreshCw,
  Wifi,
  WifiOff,
  Headphones
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
import { useSocket } from '@/hooks/useSocket'
import type { StatusPayload, EventPayload } from '@/hooks/useSocket'

// Tipos para as APIs (fallback)
interface EventItem {
  id: string
  sessionId: string | null
  eventType: string
  timestamp: string
  metadata: Record<string, unknown> | null
}

interface EventsResponse {
  events: EventItem[]
  total: number
  hasMore: boolean
}

// Configuração da API - detecta automaticamente o host
// VITE_API_URL não inclui /api, então adicionamos aqui
const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`
const API_BASE = `${API_HOST}/api`

// Formatar duração em HH:MM:SS
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
  }
  return `${minutes}m ${secs.toString().padStart(2, '0')}s`
}

// Formatar timestamp relativo
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 60) return `${diffSecs}s atrás`
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m atrás`
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h atrás`
  return date.toLocaleDateString('pt-BR')
}

// Traduzir tipo de evento - agora usa i18n
// A função é chamada com t() passado como parâmetro

// Cor do badge por tipo de evento
function getEventBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type.includes('clipping')) return 'destructive'
  if (type.includes('silence')) return 'secondary'
  if (type.includes('session')) return 'default'
  return 'outline'
}

// Máximo de eventos a manter na lista
const MAX_EVENTS = 10

export default function Dashboard() {
  const { t } = useTranslation()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Usar WebSocket para atualizações em tempo real
  const {
    isConnected,
    status,
    lastEvent,
    reconnect
  } = useSocket({
    onStatus: () => {
      setLastUpdate(new Date())
      setLoading(false)
      setError(null)
    },
    onEvent: (event: EventPayload) => {
      // Adicionar novo evento no início da lista
      setEvents(prev => {
        const newEvent: EventItem = {
          id: event.id,
          sessionId: event.sessionId,
          eventType: event.eventType,
          timestamp: event.timestamp,
          metadata: event.metadata
        }
        // Manter apenas os últimos MAX_EVENTS
        return [newEvent, ...prev].slice(0, MAX_EVENTS)
      })
    }
  })

  // Buscar eventos iniciais via API (uma vez)
  const fetchInitialEvents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/events?limit=${MAX_EVENTS}`)
      if (!response.ok) throw new Error('Falha ao buscar eventos')
      const data: EventsResponse = await response.json()
      setEvents(data.events)
    } catch (err) {
      console.error('Erro ao buscar eventos iniciais:', err)
    }
  }, [])

  // Buscar eventos iniciais no mount
  useEffect(() => {
    fetchInitialEvents()
  }, [fetchInitialEvents])

  // Fallback: se WebSocket desconectar, usar polling
  useEffect(() => {
    if (!isConnected) {
      const fetchStatus = async () => {
        try {
          const response = await fetch(`${API_BASE}/status`)
          if (response.ok) {
            setLastUpdate(new Date())
            setLoading(false)
          }
        } catch {
          setError('Conexão perdida')
        }
      }

      // Polling a cada 5s como fallback
      const interval = setInterval(fetchStatus, 5000)
      return () => clearInterval(interval)
    }
  }, [isConnected])

  // Usar status do WebSocket ou null
  const currentStatus: StatusPayload | null = status

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={reconnect}
              title={isConnected ? t('dashboard.connected') : t('dashboard.disconnected')}
            >
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-destructive" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchInitialEvents}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Badge variant={isConnected ? 'outline' : 'secondary'}>
              {isConnected ? t('dashboard.live') : formatRelativeTime(lastUpdate.toISOString())}
            </Badge>
          </div>
        </div>
        {/* Error Alert */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Streaming Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Radio className="w-4 h-4" />
                {t('dashboard.streaming')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  currentStatus?.streaming.active
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-muted'
                }`} />
                <span className="text-2xl font-bold">
                  {currentStatus?.streaming.active ? t('dashboard.on') : t('dashboard.off')}
                </span>
              </div>
              {currentStatus?.streaming.active && (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {currentStatus.streaming.bitrate} kbps • {currentStatus.streaming.mount_point}
                  </p>
                  {currentStatus.streaming.listeners !== undefined && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Headphones className="w-3 h-3" />
                      {t('dashboard.listener', { count: currentStatus.streaming.listeners })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4" />
                {t('dashboard.session')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  currentStatus?.session
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-muted'
                }`} />
                <span className="text-2xl font-bold">
                  {currentStatus?.session ? t('dashboard.sessionActive') : t('dashboard.sessionInactive')}
                </span>
              </div>
              {currentStatus?.session && (
                <p className="text-xs text-muted-foreground mt-1">
                  {currentStatus.session.event_count} {t('dashboard.events')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Session Duration */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t('dashboard.duration')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold font-mono">
                {currentStatus?.session
                  ? formatDuration(currentStatus.session.duration)
                  : '--:--'
                }
              </span>
              {currentStatus?.session && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('dashboard.started')} {formatRelativeTime(currentStatus.session.started_at)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Audio Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {currentStatus?.audio.silence_detected
                  ? <VolumeX className="w-4 h-4" />
                  : <Volume2 className="w-4 h-4" />
                }
                {t('dashboard.audio')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {currentStatus?.audio.clipping_detected && (
                  <Badge variant="destructive" className="text-xs">
                    {t('dashboard.clipping')}
                  </Badge>
                )}
                {currentStatus?.audio.silence_detected && (
                  <Badge variant="secondary" className="text-xs">
                    {t('dashboard.silence')}
                  </Badge>
                )}
                {!currentStatus?.audio.clipping_detected && !currentStatus?.audio.silence_detected && (
                  <Badge variant="outline" className="text-xs">
                    {t('dashboard.normal')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t('dashboard.level')}: {currentStatus?.audio.level_db?.toFixed(1) ?? '--'} dB
                {currentStatus?.audio.clipping_count ? ` • ${currentStatus.audio.clipping_count} ${t('dashboard.clips')}` : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-6" />

        {/* Events Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {t('dashboard.recentEvents')}
              {lastEvent && (
                <Badge variant="outline" className="ml-2 animate-pulse">
                  {t('dashboard.newEvent')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t('dashboard.recentEventsDesc', { count: MAX_EVENTS })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('dashboard.noEventsYet')}</p>
                <p className="text-sm">{t('dashboard.eventsWillAppear')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event, index) => (
                  <div
                    key={event.id}
                    className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors ${
                      index === 0 && lastEvent?.id === event.id ? 'ring-2 ring-primary/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={getEventBadgeVariant(event.eventType)}>
                        {t(`events.${event.eventType}`, { defaultValue: event.eventType })}
                      </Badge>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {event.metadata.levelDb !== undefined &&
                            `${(event.metadata.levelDb as number).toFixed(1)} dB`
                          }
                          {event.metadata.duration !== undefined &&
                            ` • ${formatDuration(event.metadata.duration as number)}`
                          }
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>
            {t('footer.dashboard')} • {isConnected ? t('dashboard.realtimeUpdates') : t('dashboard.reconnecting')}
          </p>
        </div>
      </footer>
    </div>
  )
}
