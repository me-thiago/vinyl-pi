import { useEffect, useState, useCallback } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Clock,
  Calendar,
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Disc3,
  Radio
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/theme-toggle'

// Configuração da API
const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`
const API_BASE = `${API_HOST}/api`

// Tipos
interface SessionItem {
  id: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number
  eventCount: number
}

interface SessionsResponse {
  sessions: SessionItem[]
  total: number
  hasMore: boolean
}

interface ActiveSessionResponse {
  active: boolean
  session: {
    id: string
    startedAt: string
    durationSeconds: number
    eventCount: number
  } | null
}

const PAGE_SIZE = 10

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

// Formatar data/hora
function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function Sessions() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [activeSession, setActiveSession] = useState<ActiveSessionResponse['session']>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros e paginação do URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const dateFrom = searchParams.get('date_from') || ''
  const dateTo = searchParams.get('date_to') || ''

  // Estados locais para inputs de filtro
  const [filterFrom, setFilterFrom] = useState(dateFrom)
  const [filterTo, setFilterTo] = useState(dateTo)

  // Sincronizar filtros com URL
  useEffect(() => {
    setFilterFrom(dateFrom)
    setFilterTo(dateTo)
  }, [dateFrom, dateTo])

  // Buscar sessão ativa
  const fetchActiveSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/sessions/active`)
      if (response.ok) {
        const data: ActiveSessionResponse = await response.json()
        setActiveSession(data.session)
      }
    } catch (err) {
      console.error('Erro ao buscar sessão ativa:', err)
    }
  }, [])

  // Buscar sessões
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const offset = (page - 1) * PAGE_SIZE
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: offset.toString()
      })

      if (dateFrom) {
        params.append('date_from', new Date(dateFrom).toISOString())
      }
      if (dateTo) {
        // Adicionar 23:59:59 ao date_to para incluir o dia todo
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        params.append('date_to', endDate.toISOString())
      }

      const response = await fetch(`${API_BASE}/sessions?${params}`)
      if (!response.ok) throw new Error(t('sessions.fetchError'))

      const data: SessionsResponse = await response.json()
      setSessions(data.sessions)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'))
    } finally {
      setLoading(false)
    }
  }, [page, dateFrom, dateTo, t])

  // Buscar dados no mount e quando filtros mudarem
  useEffect(() => {
    fetchActiveSession()
  }, [fetchActiveSession])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Aplicar filtros
  const applyFilters = () => {
    const params = new URLSearchParams()
    if (filterFrom) params.set('date_from', filterFrom)
    if (filterTo) params.set('date_to', filterTo)
    params.set('page', '1') // Reset para página 1 ao filtrar
    setSearchParams(params)
  }

  // Limpar filtros
  const clearFilters = () => {
    setFilterFrom('')
    setFilterTo('')
    setSearchParams({ page: '1' })
  }

  // Navegar páginas
  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', newPage.toString())
    setSearchParams(params)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = dateFrom || dateTo

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
              <h1 className="text-xl font-bold">{t('sessions.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('sessions.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">{t('nav.dashboard')}</Button>
            </Link>
            <Link to="/diagnostics">
              <Button variant="ghost" size="sm">{t('nav.diagnostics')}</Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Sessão Ativa (se houver) */}
        {activeSession && (
          <Card className="border-success/50 bg-success/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-success">
                <Radio className="w-5 h-5 animate-pulse" />
                {t('sessions.activeSession')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {t('sessions.startedAt')} {formatDateTime(activeSession.startedAt)}
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-sm">
                      <Clock className="w-4 h-4" />
                      {formatDuration(activeSession.durationSeconds)}
                    </span>
                    <span className="flex items-center gap-1 text-sm">
                      <Activity className="w-4 h-4" />
                      {activeSession.eventCount} {t('dashboard.events')}
                    </span>
                  </div>
                </div>
                <Link to={`/sessions/${activeSession.id}`}>
                  <Button variant="outline" size="sm">
                    {t('common.details')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="w-4 h-4" />
              {t('sessions.filters')}
              {hasFilters && (
                <Badge variant="secondary" className="ml-2">
                  {t('common.active')}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_from" className="text-sm">{t('common.from')}</Label>
                <Input
                  type="date"
                  id="date_from"
                  value={filterFrom}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_to" className="text-sm">{t('common.to')}</Label>
                <Input
                  type="date"
                  id="date_to"
                  value={filterTo}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterTo(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={applyFilters} size="sm">
                {t('common.filter')}
              </Button>
              {hasFilters && (
                <Button onClick={clearFilters} variant="ghost" size="sm">
                  <X className="w-4 h-4 mr-1" />
                  {t('common.clear')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Sessões */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t('sessions.history')}
              {total > 0 && (
                <Badge variant="outline" className="ml-2">
                  {t('sessions.session', { count: total })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {hasFilters
                ? t('sessions.filteredByPeriod')
                : t('sessions.allSessions')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="text-center py-8 text-destructive">
                <p>{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={fetchSessions}
                >
                  {t('common.retry')}
                </Button>
              </div>
            )}

            {loading && !error && (
              <div className="text-center py-8 text-muted-foreground">
                {t('sessions.loadingSessions')}
              </div>
            )}

            {!loading && !error && sessions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('sessions.noSessionsFound')}</p>
                {hasFilters && (
                  <p className="text-sm mt-1">
                    {t('sessions.adjustFilters')}
                  </p>
                )}
              </div>
            )}

            {!loading && !error && sessions.length > 0 && (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const isActive = activeSession?.id === session.id

                  return (
                    <Link
                      key={session.id}
                      to={`/sessions/${session.id}`}
                      className="block"
                    >
                      <div className={`
                        flex items-center justify-between p-4 rounded-lg
                        bg-muted/50 hover:bg-muted transition-colors
                        ${isActive ? 'ring-2 ring-success/50' : ''}
                      `}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {formatDateTime(session.startedAt)}
                            </span>
                            {isActive ? (
                              <Badge variant="default" className="bg-success text-success-foreground">
                                {t('sessions.active')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {t('sessions.ended')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(session.durationSeconds)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              {session.eventCount} {t('dashboard.events')}
                            </span>
                            {session.endedAt && (
                              <span className="hidden sm:inline">
                                {t('sessions.endedAt')} {formatDateTime(session.endedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {t('sessions.page', { current: page, total: totalPages })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {t('sessions.previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    {t('sessions.next')}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>{t('footer.sessions')}</p>
        </div>
      </footer>
    </div>
  )
}
