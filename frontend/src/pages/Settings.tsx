import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Volume2,
  Radio,
  Cpu,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Disc3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ThemeToggle } from '@/components/theme-toggle'

// Configuracao da API
const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`
const API_BASE = `${API_HOST}/api`

// Tipos
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

interface SystemInfo {
  device: string
  sampleRate: number
  version: string
  icecastUrl: string
}

// Bitrate options
const BITRATE_OPTIONS = [
  { value: '128', label: '128 kbps', description: 'Menor uso de banda' },
  { value: '192', label: '192 kbps', description: 'Balanceado' },
  { value: '256', label: '256 kbps', description: 'Maior qualidade' }
]

export default function Settings() {
  const [settings, setSettings] = useState<SettingDefinition[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Valores pendentes
  const [pendingBuffer, setPendingBuffer] = useState<number | null>(null)
  const [pendingBitrate, setPendingBitrate] = useState<string | null>(null)

  // Buscar settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const [settingsRes, systemRes] = await Promise.all([
        fetch(`${API_BASE}/settings`),
        fetch(`${API_BASE}/system/info`)
      ])

      if (!settingsRes.ok) throw new Error('Falha ao carregar configuracoes')
      if (!systemRes.ok) throw new Error('Falha ao carregar info do sistema')

      const settingsData = await settingsRes.json()
      const systemData = await systemRes.json()

      setSettings(settingsData.settings)
      setSystemInfo(systemData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Obter valor de uma setting
  const getSettingValue = useCallback((key: string): number => {
    const setting = settings.find(s => s.key === key)
    return setting?.value ?? 0
  }, [settings])

  // Buffer atual (pendente ou salvo)
  const currentBuffer = pendingBuffer ?? getSettingValue('player.buffer_ms')
  const currentBitrate = pendingBitrate ?? String(getSettingValue('stream.bitrate'))

  // Verificar se ha mudancas
  const hasBufferChange = pendingBuffer !== null && pendingBuffer !== getSettingValue('player.buffer_ms')
  const hasBitrateChange = pendingBitrate !== null && pendingBitrate !== String(getSettingValue('stream.bitrate'))

  // Salvar buffer
  const saveBuffer = useCallback(async () => {
    if (pendingBuffer === null) return

    try {
      setSaving(true)
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'player.buffer_ms': pendingBuffer })
      })

      if (!response.ok) throw new Error('Falha ao salvar')

      const data = await response.json()
      setSettings(data.settings)
      setPendingBuffer(null)
      setSuccessMessage('Buffer atualizado! Reconecte o player para aplicar.')
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }, [pendingBuffer])

  // Salvar bitrate e reiniciar stream
  const saveBitrateAndRestart = useCallback(async () => {
    if (pendingBitrate === null) return

    try {
      setSaving(true)
      setRestarting(true)

      // Primeiro salvar a setting
      const saveRes = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'stream.bitrate': parseInt(pendingBitrate) })
      })

      if (!saveRes.ok) throw new Error('Falha ao salvar bitrate')

      // Depois reiniciar o stream
      const restartRes = await fetch(`${API_HOST}/streaming/restart`, {
        method: 'POST'
      })

      if (!restartRes.ok) {
        const errorData = await restartRes.json()
        throw new Error(errorData.error || 'Falha ao reiniciar stream')
      }

      const data = await saveRes.json()
      setSettings(data.settings)
      setPendingBitrate(null)
      setSuccessMessage('Bitrate atualizado! Stream reiniciado.')
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
      setRestarting(false)
    }
  }, [pendingBitrate])

  // Copiar URL
  const copyUrl = useCallback(async () => {
    if (!systemInfo?.icecastUrl) return

    try {
      await navigator.clipboard.writeText(systemInfo.icecastUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Falha ao copiar URL')
    }
  }, [systemInfo?.icecastUrl])

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
              <h1 className="text-xl font-bold">Configuracoes</h1>
              <p className="text-xs text-muted-foreground">Streaming e Sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchSettings}
              disabled={loading}
              title="Recarregar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {successMessage && (
          <Alert className="border-green-500 bg-green-500/10">
            <Check className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-500">Sucesso</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando configuracoes...
          </div>
        ) : (
          <>
            {/* Card 1: Player Local (PCM) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Player Local (PCM)
                </CardTitle>
                <CardDescription>
                  Configuracoes do player web em :3000/stream.wav
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Buffer do Player</Label>
                    <span className="font-mono text-sm tabular-nums">
                      {currentBuffer} ms
                    </span>
                  </div>
                  <Slider
                    value={[currentBuffer]}
                    onValueChange={([value]: number[]) => setPendingBuffer(value)}
                    min={100}
                    max={300}
                    step={10}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Buffer antes de iniciar reproducao. Menor = menos latencia, maior = mais estabilidade.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    Latencia estimada: <span className="font-mono">~{currentBuffer}ms</span>
                  </p>
                </div>

                {hasBufferChange && (
                  <Button
                    onClick={saveBuffer}
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? 'Salvando...' : 'Salvar Buffer'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Card 2: Stream MP3 (Icecast) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="w-5 h-5" />
                  Stream MP3 (Icecast)
                </CardTitle>
                <CardDescription>
                  Configuracoes do stream em :8000/stream
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Bitrate</Label>
                  <Select
                    value={currentBitrate}
                    onValueChange={(value: string) => setPendingBitrate(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o bitrate" />
                    </SelectTrigger>
                    <SelectContent>
                      {BITRATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {hasBitrateChange && (
                  <Alert className="border-yellow-500 bg-yellow-500/10">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                      Alterar o bitrate reinicia o stream (~2s de silencio)
                    </AlertDescription>
                  </Alert>
                )}

                {/* URL do Stream */}
                <div className="space-y-2">
                  <Label>URL do Stream</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono truncate">
                      {systemInfo?.icecastUrl || 'http://localhost:8000/stream'}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyUrl}
                      title="Copiar URL"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {hasBitrateChange && (
                  <Button
                    onClick={saveBitrateAndRestart}
                    disabled={saving || restarting}
                    variant="destructive"
                    className="w-full"
                  >
                    {restarting ? 'Reiniciando stream...' : saving ? 'Salvando...' : 'Salvar e Reiniciar Stream'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Card 3: Sistema (read-only) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5" />
                  Sistema
                </CardTitle>
                <CardDescription>
                  Informacoes do sistema (somente leitura)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Device ALSA</span>
                    <code className="font-mono text-sm">{systemInfo?.device || '-'}</code>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Sample Rate</span>
                    <code className="font-mono text-sm">{systemInfo?.sampleRate || '-'} Hz</code>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Versao</span>
                    <code className="font-mono text-sm">Vinyl-OS {systemInfo?.version || '-'}</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>Vinyl-OS Configuracoes</p>
        </div>
      </footer>
    </div>
  )
}
