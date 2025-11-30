import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Radio,
  Activity,
  Clock,
  AlertTriangle,
  Volume2,
  VolumeX,
  Disc3,
  ArrowLeft,
  RefreshCw
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
import { ThemeToggle } from '@/components/theme-toggle'

// Tipos para as APIs
interface StatusResponse {
  session: {
    id: string
    started_at: string
    duration: number
    event_count: number
  } | null
  streaming: {
    active: boolean
    listeners?: number
    bitrate: string
    mount_point: string
  }
  audio: {
    level_db: number | null
    clipping_detected: boolean
    clipping_count: number
    silence_detected: boolean
  }
}

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

// Traduzir tipo de evento
function translateEventType(type: string): string {
  const translations: Record<string, string> = {
    'silence.detected': 'Silêncio detectado',
    'silence.ended': 'Silêncio encerrado',
    'clipping.detected': 'Clipping detectado',
    'session.started': 'Sessão iniciada',
    'session.ended': 'Sessão encerrada',
    'track.change.detected': 'Troca de faixa',
    'audio.start': 'Áudio iniciado',
    'audio.stop': 'Áudio parado'
  }
  return translations[type] || type
}

// Cor do badge por tipo de evento
function getEventBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type.includes('clipping')) return 'destructive'
  if (type.includes('silence')) return 'secondary'
  if (type.includes('session')) return 'default'
  return 'outline'
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Buscar dados das APIs
  const fetchData = useCallback(async () => {
    try {
      setError(null)

      const [statusRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/status`),
        fetch(`${API_BASE}/events?limit=10`)
      ])

      if (!statusRes.ok) throw new Error('Falha ao buscar status')
      if (!eventsRes.ok) throw new Error('Falha ao buscar eventos')

      const statusData: StatusResponse = await statusRes.json()
      const eventsData: EventsResponse = await eventsRes.json()

      setStatus(statusData)
      setEvents(eventsData.events)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  // Buscar dados inicialmente e a cada 5 segundos
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

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
              <h1 className="text-xl font-bold">Dashboard</h1>
              <p className="text-xs text-muted-foreground">Monitoramento em tempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Badge variant="outline" className="hidden sm:flex">
              Atualizado {formatRelativeTime(lastUpdate.toISOString())}
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
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
                Streaming
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  status?.streaming.active
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-muted'
                }`} />
                <span className="text-2xl font-bold">
                  {status?.streaming.active ? 'ON' : 'OFF'}
                </span>
              </div>
              {status?.streaming.active && (
                <p className="text-xs text-muted-foreground mt-1">
                  {status.streaming.bitrate} • {status.streaming.mount_point}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Session Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Sessão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  status?.session
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-muted'
                }`} />
                <span className="text-2xl font-bold">
                  {status?.session ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              {status?.session && (
                <p className="text-xs text-muted-foreground mt-1">
                  {status.session.event_count} eventos
                </p>
              )}
            </CardContent>
          </Card>

          {/* Session Duration */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Duração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold font-mono">
                {status?.session
                  ? formatDuration(status.session.duration)
                  : '--:--'
                }
              </span>
              {status?.session && (
                <p className="text-xs text-muted-foreground mt-1">
                  Iniciada {formatRelativeTime(status.session.started_at)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Audio Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {status?.audio.silence_detected
                  ? <VolumeX className="w-4 h-4" />
                  : <Volume2 className="w-4 h-4" />
                }
                Áudio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {status?.audio.clipping_detected && (
                  <Badge variant="destructive" className="text-xs">
                    Clipping
                  </Badge>
                )}
                {status?.audio.silence_detected && (
                  <Badge variant="secondary" className="text-xs">
                    Silêncio
                  </Badge>
                )}
                {!status?.audio.clipping_detected && !status?.audio.silence_detected && (
                  <Badge variant="outline" className="text-xs">
                    Normal
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Nível: {status?.audio.level_db?.toFixed(1) ?? '--'} dB
                {status?.audio.clipping_count ? ` • ${status.audio.clipping_count} clips` : ''}
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
              Últimos Eventos
            </CardTitle>
            <CardDescription>
              Os 10 eventos mais recentes detectados pelo sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum evento registrado ainda</p>
                <p className="text-sm">Eventos aparecerão aqui quando forem detectados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={getEventBadgeVariant(event.eventType)}>
                        {translateEventType(event.eventType)}
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
            Vinyl-OS Dashboard • Atualização automática a cada 5s
          </p>
        </div>
      </footer>
    </div>
  )
}
