import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { PassThrough } from 'stream';
import { AudioManager } from './services/audio-manager';
import { HealthMonitor } from './services/health-monitor';
import { AudioAnalyzer } from './services/audio-analyzer';
import { EventDetector } from './services/event-detector';
import { EventPersistence } from './services/event-persistence';
import { SessionManager } from './services/session-manager';
import { SocketManager } from './services/socket-manager';
import { createStatusRouter } from './routes/status';
import { createEventsRouter } from './routes/events';
import { createSessionsRouter } from './routes/sessions';
import { createSettingsRouter } from './routes/settings';
import { createAlbumsRouter } from './routes/albums';
import { createRecognitionRouter } from './routes/recognition';
import { createStatsRouter } from './routes/stats';
import { createExportRouter } from './routes/export';
import { SettingsService } from './services/settings-service';
import { AutoRecognitionService } from './services/auto-recognition';
import prisma from './prisma/client';
import { eventBus } from './utils/event-bus';
import { createLogger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { corsOriginCallback } from './utils/cors-validator';
import { apiLimiter } from './middleware/rate-limiter';
import { setupSwagger } from './config/swagger';
import { staticCache } from './middleware/static-cache';

const logger = createLogger('Server');

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// CORS restrito para rede local
// Apenas localhost, 127.0.0.1 e IPs privados (192.168.x.x, 10.x.x.x, 172.16-31.x.x) são permitidos
// Origens adicionais podem ser configuradas via ALLOWED_ORIGINS no .env
app.use(cors({
  origin: corsOriginCallback,
  credentials: true
}));

app.use(express.json());

// Rate limiting para rotas de API
// Protege contra abuso e ataques DoS
// Configurável via RATE_LIMIT_WINDOW_MS e RATE_LIMIT_MAX
app.use('/api', apiLimiter);

// WAV Stream Broadcaster
// Mantém lista de clientes conectados e transmite dados para todos simultaneamente
let wavBroadcaster: PassThrough | null = null;
const wavClients = new Set<PassThrough>();

function getOrCreateBroadcaster(source: NodeJS.ReadableStream, analyzer: AudioAnalyzer): PassThrough {
  if (!wavBroadcaster) {
    wavBroadcaster = new PassThrough({ highWaterMark: 64 * 1024 }); // 64KB buffer limit

    // Ler do source e escrever para o broadcaster
    source.on('data', (chunk) => {
      // SEMPRE analisar chunks para detecção de silêncio (mesmo sem clientes)
      // Isso garante que silence.detected funcione independente de listeners
      if (Buffer.isBuffer(chunk)) {
        analyzer.analyze(chunk);
      }

      // CRITICAL FIX: Só escrever para clientes se houver algum conectado
      if (wavClients.size === 0) {
        // Sem clientes, não precisa broadcast (mas análise já foi feita acima)
        return;
      }

      // Broadcast para todos os clientes ativos
      wavClients.forEach((client) => {
        try {
          // Verificar backpressure antes de escrever
          if (!client.write(chunk)) {
            // Cliente lento, pausar source temporariamente
            source.pause();
            client.once('drain', () => {
              source.resume();
            });
          }
        } catch (err) {
          logger.error('Erro ao escrever para cliente', { error: err });
          wavClients.delete(client);
        }
      });
    });

    source.on('end', () => {
      logger.info('Stream WAV finalizado');
      wavBroadcaster = null;
      wavClients.forEach(c => c.end());
      wavClients.clear();
    });

    source.on('error', (err) => {
      logger.error('Erro no stream WAV', { error: err });
      wavBroadcaster = null;
      wavClients.forEach(c => c.destroy(err));
      wavClients.clear();
    });
  }
  return wavBroadcaster;
}

// Inicializar AudioManager
const audioManager = new AudioManager({
  device: process.env.AUDIO_DEVICE || 'plughw:1,0',
  sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '48000'),
  channels: parseInt(process.env.AUDIO_CHANNELS || '2'),
  bitDepth: parseInt(process.env.AUDIO_BIT_DEPTH || '16'),
  bufferSize: parseInt(process.env.AUDIO_BUFFER_SIZE || '1024')
});

// Event handlers para AudioManager
audioManager.on('started', () => {
  logger.info('Captura de áudio iniciada');
});

audioManager.on('stopped', () => {
  logger.info('Captura de áudio parada');
});

audioManager.on('error', (error) => {
  logger.error('Erro na captura de áudio', { error });
});

audioManager.on('device_disconnected', (info) => {
  logger.error('Dispositivo de áudio desconectado', { info });
});

audioManager.on('streaming_started', (info) => {
  logger.info('Streaming iniciado', { info });
});

audioManager.on('streaming_stopped', () => {
  logger.info('Streaming parado');
});

// Inicializar HealthMonitor
const healthMonitor = new HealthMonitor(audioManager);

// Event handlers para HealthMonitor
healthMonitor.on('memory_high', (data) => {
  logger.warn('Uso alto de memória detectado', { data });
});

healthMonitor.on('memory_leak_detected', (data) => {
  logger.error('Possível vazamento de memória detectado', { data });
});

healthMonitor.on('orphan_processes', (data) => {
  logger.warn('Processos FFmpeg órfãos detectados', { data });
});

healthMonitor.on('streaming_recovered', (data) => {
  logger.info('Streaming recuperado automaticamente', { data });
});

healthMonitor.on('streaming_failed', (data) => {
  logger.error('Falha ao reiniciar streaming automaticamente', { data });
});

// Iniciar health monitoring
healthMonitor.start();

// Inicializar AudioAnalyzer para análise de níveis de áudio
const audioAnalyzer = new AudioAnalyzer({
  sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '48000'),
  channels: parseInt(process.env.AUDIO_CHANNELS || '2'),
  bufferSize: 2048,
  publishIntervalMs: 100  // Publicar audio.level a cada 100ms
});

// Inicializar SettingsService para configurações dinâmicas
const settingsService = new SettingsService(prisma);

// Inicializar EventDetector e SessionManager com valores temporários
// Serão atualizados após o SettingsService carregar
const eventDetector = new EventDetector({
  silence: {
    threshold: parseInt(process.env.SILENCE_THRESHOLD || '-50'),
    duration: parseInt(process.env.SILENCE_DURATION || '10')
  },
  clipping: {
    threshold: parseInt(process.env.CLIPPING_THRESHOLD || '-3'),
    cooldown: parseInt(process.env.CLIPPING_COOLDOWN || '1000')
  }
});

const sessionManager = new SessionManager({
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '1800'),
  audioThreshold: parseInt(process.env.SILENCE_THRESHOLD || '-50')
});

// Inicializar EventPersistence para persistir eventos no banco
const eventPersistence = new EventPersistence();

// Função para aplicar settings aos detectores
function applySettings(settings: Record<string, number | string | boolean>): void {
  const silenceThreshold = settings['silence.threshold'] as number;
  const silenceDuration = settings['silence.duration'] as number;
  const clippingThreshold = settings['clipping.threshold'] as number;
  const clippingCooldown = settings['clipping.cooldown'] as number;
  const sessionTimeout = settings['session.timeout'] as number;

  // Atualizar EventDetector
  eventDetector.updateConfig({
    silenceThreshold,
    silenceDuration,
    clippingThreshold,
    clippingCooldown
  });

  // Atualizar SessionManager
  sessionManager.setSessionTimeout(sessionTimeout);
  sessionManager.setAudioThreshold(silenceThreshold);
}

// Listener para mudanças de settings em tempo real
eventBus.subscribe('settings.changed' as any, async (payload) => {
  logger.info('Configurações alteradas, aplicando...');
  applySettings(payload.settings);
});

// Iniciar serviços
audioAnalyzer.start();
eventDetector.start();
sessionManager.start();
eventPersistence.start();

// Conectar EventPersistence ao SessionManager
eventPersistence.setSessionManager(sessionManager);

// Inicializar SettingsService e aplicar configurações
settingsService.initialize().then(async () => {
  const allSettings = await settingsService.getAll();
  const settings: Record<string, number | string | boolean> = {};
  allSettings.forEach(s => { settings[s.key] = s.value; });
  applySettings(settings);

  logger.info('Configurações carregadas e aplicadas');
}).catch(err => {
  logger.error('Falha ao inicializar configurações', { error: err });
});

logger.info('AudioAnalyzer iniciado');
logger.info('EventDetector iniciado');
logger.info('SessionManager iniciado');
logger.info('EventPersistence iniciado');

// Inicializar SocketManager para WebSocket real-time updates
const socketManager = new SocketManager(httpServer, {
  audioManager,
  audioAnalyzer,
  eventDetector,
  sessionManager
});

// Inicializar AutoRecognitionService para reconhecimento automático no início de sessões (V2-12)
const autoRecognitionService = new AutoRecognitionService({
  settingsService,
  audioManager,
  socketManager,
});
autoRecognitionService.start();
logger.info('AutoRecognitionService iniciado');

// Registrar routes com todas as dependências
app.use('/api', createStatusRouter({
  audioManager,
  audioAnalyzer,
  eventDetector,
  sessionManager
}));

app.use('/api', createEventsRouter({
  eventPersistence
}));

app.use('/api', createSessionsRouter({
  sessionManager
}));

app.use('/api', createSettingsRouter({
  settingsService
}));

app.use('/api', createAlbumsRouter());

app.use('/api', createRecognitionRouter({
  sessionManager,
  audioManager,
  settingsService
}));

app.use('/api', createStatsRouter());

app.use('/api', createExportRouter());

// Swagger UI e documentação OpenAPI
// Acessível em /api/docs e /api/docs.json
setupSwagger(app);

// Servir arquivos estáticos do frontend em produção
// O frontend compilado deve ser copiado para a pasta 'public' do backend
// Cache headers otimizados: assets com hash = 1 ano imutável, outros = 24h
if (process.env.NODE_ENV === 'production') {
  app.use(staticCache());
  app.use(express.static('public'));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vinyl-OS Backend is running' });
});

// Endpoint para status de áudio
app.get('/audio/status', (req, res) => {
  const status = audioManager.getStatus();
  res.json(status);
});

// Endpoint para iniciar captura
app.post('/audio/start', async (req, res) => {
  try {
    await audioManager.start();
    res.json({ success: true, message: 'Captura de áudio iniciada' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Falha ao iniciar captura de áudio', { error: errorMsg });
    res.status(500).json({ error: { message: 'Falha ao iniciar captura de áudio', code: 'AUDIO_START_ERROR' } });
  }
});

// Endpoint para parar captura
app.post('/audio/stop', async (req, res) => {
  try {
    await audioManager.stop();
    res.json({ success: true, message: 'Captura de áudio parada' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Falha ao parar captura de áudio', { error: errorMsg });
    res.status(500).json({ error: { message: 'Falha ao parar captura de áudio', code: 'AUDIO_STOP_ERROR' } });
  }
});

// Helper para criar config de streaming
function getStreamingConfig() {
  return {
    icecastHost: process.env.ICECAST_HOST || 'localhost',
    icecastPort: parseInt(process.env.ICECAST_PORT || '8000'),
    icecastPassword: process.env.ICECAST_SOURCE_PASSWORD || 'hackme',
    mountPoint: process.env.ICECAST_MOUNT_POINT || '/stream',
    bitrate: settingsService.getNumber('stream.bitrate'),
    fallbackSilence: true
  };
}

// Endpoint para iniciar streaming
app.post('/streaming/start', async (req, res) => {
  try {
    const config = getStreamingConfig();

    await audioManager.startStreaming(config);

    // Configurar health monitor para auto-restart
    healthMonitor.setStreamingConfig(config);

    res.json({ success: true, message: 'Streaming iniciado', config: {
      host: config.icecastHost,
      port: config.icecastPort,
      mountPoint: config.mountPoint,
      bitrate: config.bitrate
    }});
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Falha ao iniciar streaming', { error: errorMsg });
    res.status(500).json({ error: { message: 'Falha ao iniciar streaming', code: 'STREAMING_START_ERROR' } });
  }
});

// Endpoint para parar streaming
app.post('/streaming/stop', async (req, res) => {
  try {
    await audioManager.stopStreaming();
    res.json({ success: true, message: 'Streaming parado' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Falha ao parar streaming', { error: errorMsg });
    res.status(500).json({ error: { message: 'Falha ao parar streaming', code: 'STREAMING_STOP_ERROR' } });
  }
});

// Endpoint para reiniciar streaming (aplica novo bitrate)
app.post('/streaming/restart', async (req, res) => {
  try {
    const status = audioManager.getStreamingStatus();

    if (!status.active) {
      res.status(400).json({ error: { message: 'Streaming não está ativo', code: 'STREAMING_NOT_ACTIVE' } });
      return;
    }

    // Parar e reiniciar com novo config
    await audioManager.stopStreaming();

    // Pequena pausa para cleanup
    await new Promise(resolve => setTimeout(resolve, 500));

    const config = getStreamingConfig();
    await audioManager.startStreaming(config);

    // Atualizar health monitor
    healthMonitor.setStreamingConfig(config);

    res.json({
      success: true,
      message: 'Streaming reiniciado com nova configuração',
      config: {
        host: config.icecastHost,
        port: config.icecastPort,
        mountPoint: config.mountPoint,
        bitrate: config.bitrate
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Falha ao reiniciar streaming', { error: errorMsg });
    res.status(500).json({ error: { message: 'Falha ao reiniciar streaming', code: 'STREAMING_RESTART_ERROR' } });
  }
});

// Endpoint para status de streaming
app.get('/streaming/status', (req, res) => {
  const status = audioManager.getStreamingStatus();
  res.json(status);
});

// Endpoint para WAV streaming (baixa latência)
// Serve o stdout do FFmpeg (PCM WAV) via HTTP chunked com suporte a múltiplos clientes
app.get('/stream.wav', (req, res) => {
  const wavStream = audioManager.getWavStream();

  if (!wavStream) {
    res.status(503).json({
      error: { message: 'Stream WAV indisponível. Inicie o streaming primeiro.', code: 'WAV_STREAM_UNAVAILABLE' }
    });
    return;
  }

  // Headers para streaming chunked
  res.setHeader('Content-Type', 'audio/pcm'); // Raw PCM, não WAV
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Inicializar broadcaster se necessário
  getOrCreateBroadcaster(wavStream, audioAnalyzer);

  // Criar stream individual para este cliente
  const clientStream = new PassThrough();
  wavClients.add(clientStream);

  logger.info('Cliente conectado ao stream WAV', { totalClients: wavClients.size });

  // Enviar para response
  clientStream.pipe(res);

  // Cleanup quando cliente desconectar
  const cleanup = () => {
    wavClients.delete(clientStream);
    clientStream.destroy();
    logger.info('Cliente desconectado do stream WAV', { remainingClients: wavClients.size });
  };

  req.on('close', cleanup);
  res.on('error', cleanup);
  clientStream.on('error', cleanup);
});

// Registrar middleware de rotas não encontradas e error handler (ÚLTIMO)
app.use(notFoundHandler);
app.use(errorHandler);

httpServer.listen(PORT, () => {
  logger.info(`Servidor iniciado na porta ${PORT}`);
  logger.info('Servidor WebSocket pronto');
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} recebido, encerrando graciosamente...`);

  try {
    // Parar auto-recognition primeiro (cancela timers pendentes)
    await autoRecognitionService.destroy();
    logger.info('AutoRecognitionService parado');

    // Parar socket manager (fecha conexões WebSocket)
    await socketManager.destroy();

    // Parar event persistence (para de persistir eventos)
    await eventPersistence.destroy();
    logger.info('EventPersistence parado');

    // Parar session manager (encerra sessão ativa se houver)
    await sessionManager.destroy();
    logger.info('SessionManager parado');

    // Parar event detector (para de escutar eventos)
    await eventDetector.stop();
    logger.info('EventDetector parado');

    // Parar audio analyzer
    audioAnalyzer.stop();
    logger.info('AudioAnalyzer parado');

    // Parar health monitor
    await healthMonitor.stop();

    // Parar audio manager
    await audioManager.cleanup();

    logger.info('Cleanup concluído, encerrando...');
    process.exit(0);
  } catch (err) {
    logger.error('Erro durante shutdown', { error: err });
    process.exit(1);
  }
};

// Registrar handlers de shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handler para recovery failures
audioManager.on('recovery_failed', (data) => {
  logger.error('Recuperação do FFmpeg falhou após máximo de tentativas', { data });
  logger.error('Encerrando processo para permitir restart pelo PM2...');
  gracefulShutdown('RECOVERY_FAILED').then(() => {
    process.exit(1);
  });
});

