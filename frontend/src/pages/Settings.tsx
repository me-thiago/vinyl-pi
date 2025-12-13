import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Volume2,
  Radio,
  Cpu,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Music,
  CheckCircle2,
  XCircle,
  Disc
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
import { Switch } from '@/components/ui/switch'

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

// Recognition service options
const SERVICE_OPTIONS = [
  { value: 'auto', labelKey: 'serviceAuto' },
  { value: 'audd', labelKey: 'serviceAudd' },
  { value: 'acrcloud', labelKey: 'serviceAcrcloud' }
]

// Recognition status type
interface RecognitionStatus {
  services: {
    acrcloud: {
      configured: boolean
      lastTestAt: string | null
      lastTestResult: 'success' | 'error' | null
      lastTestError: string | null
    }
    audd: {
      configured: boolean
      lastTestAt: string | null
      lastTestResult: 'success' | 'error' | null
      lastTestError: string | null
    }
  }
  settings: {
    preferredService: 'acrcloud' | 'audd' | 'auto'
    sampleDuration: number
    autoOnSessionStart: boolean
    autoDelay: number
  }
}

export default function Settings() {
  const { t } = useTranslation()
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

  // Recognition settings (V2-12)
  const [recognitionStatus, setRecognitionStatus] = useState<RecognitionStatus | null>(null)
  const [recognitionLoading, setRecognitionLoading] = useState(true)
  const [testingService, setTestingService] = useState<'acrcloud' | 'audd' | null>(null)
  const [testResult, setTestResult] = useState<{ service: string; success: boolean; message: string } | null>(null)
  const [savingRecognition, setSavingRecognition] = useState(false)
  const [recognitionSaved, setRecognitionSaved] = useState(false)

  // Pending recognition settings
  const [pendingAutoEnabled, setPendingAutoEnabled] = useState<boolean | null>(null)
  const [pendingAutoDelay, setPendingAutoDelay] = useState<number | null>(null)
  const [pendingPreferredService, setPendingPreferredService] = useState<string | null>(null)
  const [pendingSampleDuration, setPendingSampleDuration] = useState<number | null>(null)

  // Recording settings (V3a-08)
  const [pendingMaxDuration, setPendingMaxDuration] = useState<number | null>(null)
  const [savingRecording, setSavingRecording] = useState(false)

  // Buscar settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const [settingsRes, systemRes] = await Promise.all([
        fetch(`${API_BASE}/settings`),
        fetch(`${API_BASE}/system/info`)
      ])

      if (!settingsRes.ok) throw new Error(t('settings.loadError'))
      if (!systemRes.ok) throw new Error(t('settings.systemInfoError'))

      const settingsData = await settingsRes.json()
      const systemData = await systemRes.json()

      setSettings(settingsData.settings)
      setSystemInfo(systemData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  // Buscar status de reconhecimento (V2-12)
  const fetchRecognitionStatus = useCallback(async () => {
    try {
      setRecognitionLoading(true)
      const res = await fetch(`${API_BASE}/recognition/status`)
      if (!res.ok) throw new Error('Falha ao carregar status de reconhecimento')
      const data = await res.json()
      setRecognitionStatus(data)
    } catch (err) {
      console.error('Erro ao buscar status de reconhecimento:', err)
    } finally {
      setRecognitionLoading(false)
    }
  }, [])

  // Testar conexão com API de reconhecimento
  const testApiConnection = useCallback(async (service: 'acrcloud' | 'audd') => {
    setTestingService(service)
    setTestResult(null)
    try {
      const res = await fetch(`${API_BASE}/recognition/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service })
      })
      const data = await res.json()
      setTestResult({
        service,
        success: data.success,
        message: data.success
          ? t('recognition.settings.testSuccess', { time: data.responseTime })
          : data.message
      })
    } catch (err) {
      setTestResult({
        service,
        success: false,
        message: err instanceof Error ? err.message : 'Erro desconhecido'
      })
    } finally {
      setTestingService(null)
    }
  }, [t])

  // Salvar configurações de reconhecimento
  const saveRecognitionSettings = useCallback(async () => {
    setSavingRecognition(true)
    try {
      const updates: Record<string, unknown> = {}
      if (pendingAutoEnabled !== null) updates.autoOnSessionStart = pendingAutoEnabled
      if (pendingAutoDelay !== null) updates.autoDelay = pendingAutoDelay
      if (pendingPreferredService !== null) updates.preferredService = pendingPreferredService
      if (pendingSampleDuration !== null) updates.sampleDuration = pendingSampleDuration

      const res = await fetch(`${API_BASE}/recognition/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!res.ok) throw new Error('Falha ao salvar configurações')

      // Limpar pending states
      setPendingAutoEnabled(null)
      setPendingAutoDelay(null)
      setPendingPreferredService(null)
      setPendingSampleDuration(null)

      // Recarregar status
      await fetchRecognitionStatus()

      // Mostrar sucesso
      setRecognitionSaved(true)
      setTimeout(() => setRecognitionSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSavingRecognition(false)
    }
  }, [pendingAutoEnabled, pendingAutoDelay, pendingPreferredService, pendingSampleDuration, fetchRecognitionStatus])

  useEffect(() => {
    fetchSettings()
    fetchRecognitionStatus()
  }, [fetchSettings, fetchRecognitionStatus])

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

  // Current recognition values (pending or saved)
  const currentAutoEnabled = pendingAutoEnabled ?? recognitionStatus?.settings.autoOnSessionStart ?? false
  const currentAutoDelay = pendingAutoDelay ?? recognitionStatus?.settings.autoDelay ?? 20
  const currentPreferredService = pendingPreferredService ?? recognitionStatus?.settings.preferredService ?? 'auto'
  const currentSampleDuration = pendingSampleDuration ?? recognitionStatus?.settings.sampleDuration ?? 10

  // Has recognition changes
  const hasRecognitionChanges =
    (pendingAutoEnabled !== null && pendingAutoEnabled !== recognitionStatus?.settings.autoOnSessionStart) ||
    (pendingAutoDelay !== null && pendingAutoDelay !== recognitionStatus?.settings.autoDelay) ||
    (pendingPreferredService !== null && pendingPreferredService !== recognitionStatus?.settings.preferredService) ||
    (pendingSampleDuration !== null && pendingSampleDuration !== recognitionStatus?.settings.sampleDuration)

  // Recording values (V3a-08)
  const currentMaxDuration = pendingMaxDuration ?? (getSettingValue('recording.maxDurationMinutes') || 60)
  const hasMaxDurationChange = pendingMaxDuration !== null && pendingMaxDuration !== getSettingValue('recording.maxDurationMinutes')

  // Salvar max duration (V3a-08)
  const saveMaxDuration = useCallback(async () => {
    if (pendingMaxDuration === null) return

    try {
      setSavingRecording(true)
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'recording.maxDurationMinutes': pendingMaxDuration })
      })

      if (!response.ok) throw new Error(t('settings.saveError'))

      const data = await response.json()
      setSettings(data.settings)
      setPendingMaxDuration(null)
      setSuccessMessage(t('common.success'))
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'))
    } finally {
      setSavingRecording(false)
    }
  }, [pendingMaxDuration, t])

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

      if (!response.ok) throw new Error(t('settings.saveError'))

      const data = await response.json()
      setSettings(data.settings)
      setPendingBuffer(null)
      setSuccessMessage(t('settings.bufferUpdated'))
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'))
    } finally {
      setSaving(false)
    }
  }, [pendingBuffer, t])

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
        throw new Error(errorData.error || t('settings.restartError'))
      }

      const data = await saveRes.json()
      setSettings(data.settings)
      setPendingBitrate(null)
      setSuccessMessage(t('settings.bitrateUpdated'))
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'))
    } finally {
      setSaving(false)
      setRestarting(false)
    }
  }, [pendingBitrate, t])

  // Copiar URL
  const copyUrl = useCallback(async () => {
    if (!systemInfo?.icecastUrl) return

    try {
      await navigator.clipboard.writeText(systemInfo.icecastUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('settings.copyError'))
    }
  }, [systemInfo?.icecastUrl, t])

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Actions Bar */}
        <div className="flex items-center justify-end mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchSettings}
            disabled={loading}
            title={t('settings.reload')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {successMessage && (
          <Alert className="border-green-500 bg-green-500/10">
            <Check className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-500">{t('common.success')}</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            {t('settings.loadingSettings')}
          </div>
        ) : (
          <>
            {/* Card 1: Player Local (PCM) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  {t('settings.localPlayer')}
                </CardTitle>
                <CardDescription>
                  {t('settings.localPlayerDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('settings.playerBuffer')}</Label>
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
                    {t('settings.bufferDesc')}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    {t('settings.estimatedLatency')}: <span className="font-mono">~{currentBuffer}ms</span>
                  </p>
                </div>

                {hasBufferChange && (
                  <Button
                    onClick={saveBuffer}
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? t('settings.saving') : t('settings.saveBuffer')}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Card 2: Stream MP3 (Icecast) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="w-5 h-5" />
                  {t('settings.mp3Stream')}
                </CardTitle>
                <CardDescription>
                  {t('settings.mp3StreamDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>{t('settings.bitrate')}</Label>
                  <Select
                    value={currentBitrate}
                    onValueChange={(value: string) => setPendingBitrate(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('settings.selectBitrate')} />
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
                      {t('settings.bitrateChangeWarning')}
                    </AlertDescription>
                  </Alert>
                )}

                {/* URL do Stream */}
                <div className="space-y-2">
                  <Label>{t('settings.streamUrl')}</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono truncate">
                      {systemInfo?.icecastUrl || 'http://localhost:8000/stream'}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyUrl}
                      title={t('settings.copyUrl')}
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
                    {restarting ? t('settings.restartingStream') : saving ? t('settings.saving') : t('settings.saveAndRestart')}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Card 3: Reconhecimento Musical (V2-12) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  {t('recognition.settings.title')}
                </CardTitle>
                <CardDescription>
                  {t('recognition.settings.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {recognitionLoading ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    {/* Seção: Reconhecimento Automático */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">{t('recognition.settings.autoSection')}</h4>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="auto-recognition">
                            {t('recognition.settings.autoOnSessionStart')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('recognition.settings.autoOnSessionStartDesc')}
                          </p>
                        </div>
                        <Switch
                          id="auto-recognition"
                          checked={currentAutoEnabled}
                          onCheckedChange={(checked) => setPendingAutoEnabled(checked)}
                        />
                      </div>

                      {currentAutoEnabled && (
                        <div className="space-y-3 pl-4 border-l-2 border-muted">
                          <div className="flex items-center justify-between">
                            <Label>{t('recognition.settings.autoDelay')}</Label>
                            <span className="font-mono text-sm tabular-nums">
                              {currentAutoDelay} {t('recognition.settings.seconds')}
                            </span>
                          </div>
                          <Slider
                            value={[currentAutoDelay]}
                            onValueChange={([value]: number[]) => setPendingAutoDelay(value)}
                            min={10}
                            max={60}
                            step={5}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h4 className="text-sm font-medium">{t('recognition.settings.generalSection')}</h4>

                      {/* Serviço Preferido */}
                      <div className="space-y-2">
                        <Label>{t('recognition.settings.preferredService')}</Label>
                        <Select
                          value={currentPreferredService}
                          onValueChange={(value) => setPendingPreferredService(value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {t(`recognition.settings.${option.labelKey}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Duração da Amostra */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>{t('recognition.settings.sampleDuration')}</Label>
                          <span className="font-mono text-sm tabular-nums">
                            {currentSampleDuration} {t('recognition.settings.seconds')}
                          </span>
                        </div>
                        <Slider
                          value={[currentSampleDuration]}
                          onValueChange={([value]: number[]) => setPendingSampleDuration(value)}
                          min={5}
                          max={15}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* API Keys Status */}
                    <div className="border-t pt-4 space-y-4">
                      <h4 className="text-sm font-medium">{t('recognition.settings.apiKeysSection')}</h4>

                      {/* AudD */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">AudD</span>
                          {recognitionStatus?.services.audd.configured ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('recognition.settings.configured')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-yellow-600">
                              <XCircle className="w-3 h-3" />
                              {t('recognition.settings.notConfigured')}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testApiConnection('audd')}
                          disabled={testingService !== null || !recognitionStatus?.services.audd.configured}
                        >
                          {testingService === 'audd' ? t('recognition.settings.testing') : t('recognition.settings.testConnection')}
                        </Button>
                      </div>

                      {/* ACRCloud */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">ACRCloud</span>
                          {recognitionStatus?.services.acrcloud.configured ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('recognition.settings.configured')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <XCircle className="w-3 h-3" />
                              {t('recognition.settings.notConfigured')}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testApiConnection('acrcloud')}
                          disabled={testingService !== null || !recognitionStatus?.services.acrcloud.configured}
                        >
                          {testingService === 'acrcloud' ? t('recognition.settings.testing') : t('recognition.settings.testConnection')}
                        </Button>
                      </div>

                      {/* Test Result */}
                      {testResult && (
                        <Alert variant={testResult.success ? 'default' : 'destructive'}>
                          {testResult.success ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          <AlertDescription>{testResult.message}</AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* Saved Success */}
                    {recognitionSaved && (
                      <Alert className="border-green-500 bg-green-500/10">
                        <Check className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-700 dark:text-green-300">
                          {t('recognition.settings.saved')}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Save Button */}
                    {hasRecognitionChanges && (
                      <Button
                        onClick={saveRecognitionSettings}
                        disabled={savingRecognition}
                        className="w-full"
                      >
                        {savingRecognition ? t('recognition.settings.saving') : t('recognition.settings.save')}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 4: Gravação (V3a-08) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Disc className="w-5 h-5" />
                  {t('recording.title')}
                </CardTitle>
                <CardDescription>
                  {t('recording.maxDurationDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('recording.maxDuration')}</Label>
                    <span className="font-mono text-sm tabular-nums">
                      {currentMaxDuration} {t('recording.minutes')}
                    </span>
                  </div>
                  <Slider
                    value={[currentMaxDuration]}
                    onValueChange={([value]: number[]) => setPendingMaxDuration(value)}
                    min={15}
                    max={180}
                    step={15}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>15 min</span>
                    <span>180 min</span>
                  </div>
                </div>

                {hasMaxDurationChange && (
                  <Button
                    onClick={saveMaxDuration}
                    disabled={savingRecording}
                    className="w-full"
                  >
                    {savingRecording ? t('common.saving') : t('common.save')}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Card 5: Sistema (read-only) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5" />
                  {t('settings.system')}
                </CardTitle>
                <CardDescription>
                  {t('settings.systemDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">{t('settings.alsaDevice')}</span>
                    <code className="font-mono text-sm">{systemInfo?.device || '-'}</code>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">{t('settings.sampleRate')}</span>
                    <code className="font-mono text-sm">{systemInfo?.sampleRate || '-'} Hz</code>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">{t('settings.version')}</span>
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
          <p>{t('footer.settings')}</p>
        </div>
      </footer>
    </div>
  )
}
