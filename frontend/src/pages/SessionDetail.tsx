import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Calendar,
  Activity,
  Disc3,
  Radio,
  AlertTriangle
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThemeToggle } from '@/components/theme-toggle'

// Configuração da API
const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`
const API_BASE = `${API_HOST}/api`

// Tipos
interface EventItem {
  id: string
  eventType: string
  timestamp: string
  metadata: Record<string, unknown> | null
}

interface SessionDetail {
  id: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number
  eventCount: number
  events: EventItem[]
}

// Mapa de tradução de eventos
const EVENT_TRANSLATIONS: Record<string, string> = {
  'silence.detected': 'Silêncio detectado',
  'silence.ended': 'Silêncio encerrado',
  'clipping.detected': 'Clipping detectado',
  'session.started': 'Sessão iniciada',
  'session.ended': 'Sessão encerrada',
  'track.change.detected': 'Troca de faixa',
  'audio.start': 'Áudio iniciado',
  'audio.stop': 'Áudio parado'
}

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

// Formatar data/hora completa
function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Formatar hora para timeline
function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Traduzir tipo de evento
function translateEventType(type: string): string {
  return EVENT_TRANSLATIONS[type] || type
}

// Cor do badge por tipo de evento
function getEventBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type.includes('clipping')) return 'destructive'
  if (type.includes('silence')) return 'secondary'
  if (type.includes('session')) return 'default'
  return 'outline'
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Buscar detalhes da sessão
  const fetchSession = useCallback(async () => {
    if (!id) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE}/sessions/${id}`)

      if (response.status === 404) {
        setError('Sessão não encontrada')
        return
      }

      if (!response.ok) throw new Error('Falha ao buscar sessão')

      const data: SessionDetail = await response.json()
      setSession(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [id])

  // Buscar dados no mount
  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const isActive = session && !session.endedAt

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/sessions">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
              <Disc3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Detalhes da Sessão</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {id ? `${id.slice(0, 8)}...` : 'Carregando...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/sessions">
              <Button variant="ghost" size="sm">Sessões</Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <p className="text-destructive font-medium">{error}</p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={fetchSession}>
                    Tentar novamente
                  </Button>
                  <Link to="/sessions">
                    <Button variant="ghost" size="sm">
                      Voltar para lista
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && !error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                Carregando detalhes da sessão...
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session Details */}
        {!loading && !error && session && (
          <>
            {/* Resumo */}
            <Card className={isActive ? 'border-success/50 bg-success/5' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isActive ? (
                    <>
                      <Radio className="w-5 h-5 text-success animate-pulse" />
                      Sessão Ativa
                    </>
                  ) : (
                    <>
                      <Calendar className="w-5 h-5" />
                      Resumo da Sessão
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Início */}
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Início</p>
                    <p className="font-medium">{formatDateTime(session.startedAt)}</p>
                  </div>

                  {/* Fim */}
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Fim</p>
                    <p className="font-medium">
                      {session.endedAt ? (
                        formatDateTime(session.endedAt)
                      ) : (
                        <span className="text-success">Em andamento</span>
                      )}
                    </p>
                  </div>

                  {/* Duração */}
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Duração</p>
                    <p className="font-medium font-mono flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(session.durationSeconds)}
                    </p>
                  </div>

                  {/* Eventos */}
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Eventos</p>
                    <p className="font-medium flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      {session.eventCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline de Eventos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Timeline de Eventos
                  <Badge variant="outline" className="ml-2">
                    {session.events.length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Eventos registrados durante esta sessão (ordem cronológica)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {session.events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum evento registrado nesta sessão</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {session.events.map((event, index) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          {/* Indicador de timeline */}
                          <div className="flex flex-col items-center">
                            <div className={`
                              w-3 h-3 rounded-full
                              ${event.eventType.includes('clipping') ? 'bg-destructive' : ''}
                              ${event.eventType.includes('silence') ? 'bg-muted-foreground' : ''}
                              ${event.eventType.includes('session') ? 'bg-primary' : ''}
                              ${!event.eventType.includes('clipping') && !event.eventType.includes('silence') && !event.eventType.includes('session') ? 'bg-muted-foreground' : ''}
                            `} />
                            {index < session.events.length - 1 && (
                              <div className="w-0.5 h-8 bg-border mt-1" />
                            )}
                          </div>

                          {/* Conteúdo do evento */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <Badge variant={getEventBadgeVariant(event.eventType)}>
                                {translateEventType(event.eventType)}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatTime(event.timestamp)}
                              </span>
                            </div>

                            {/* Metadata */}
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <div className="mt-2 text-xs text-muted-foreground font-mono">
                                {event.metadata.levelDb !== undefined && (
                                  <span className="mr-3">
                                    Nível: {(event.metadata.levelDb as number).toFixed(1)} dB
                                  </span>
                                )}
                                {event.metadata.duration !== undefined && (
                                  <span className="mr-3">
                                    Duração: {formatDuration(event.metadata.duration as number)}
                                  </span>
                                )}
                                {event.metadata.count !== undefined && (
                                  <span>
                                    #{String(event.metadata.count)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>Vinyl-OS Session Detail</p>
        </div>
      </footer>
    </div>
  )
}
