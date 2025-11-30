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
import { SettingsService } from './services/settings-service';
import prisma from './prisma/client';
import { eventBus } from './utils/event-bus';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// CORS para permitir frontend em porta diferente (local e rede)
app.use(cors({
  origin: true, // Aceita qualquer origem (rede local)
  credentials: true
}));

app.use(express.json());

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
          console.error('Error writing to client:', err);
          wavClients.delete(client);
        }
      });
    });

    source.on('end', () => {
      console.log('WAV source ended');
      wavBroadcaster = null;
      wavClients.forEach(c => c.end());
      wavClients.clear();
    });

    source.on('error', (err) => {
      console.error('WAV source error:', err);
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
  console.log('Audio capture started');
});

audioManager.on('stopped', () => {
  console.log('Audio capture stopped');
});

audioManager.on('error', (error) => {
  console.error('Audio capture error:', error);
});

audioManager.on('device_disconnected', (info) => {
  console.error('Audio device disconnected:', info);
});

audioManager.on('streaming_started', (info) => {
  console.log('Streaming started:', info);
});

audioManager.on('streaming_stopped', () => {
  console.log('Streaming stopped');
});

// Inicializar HealthMonitor
const healthMonitor = new HealthMonitor(audioManager);

// Event handlers para HealthMonitor
healthMonitor.on('memory_high', (data) => {
  console.warn('⚠️  High memory usage detected:', data);
});

healthMonitor.on('memory_leak_detected', (data) => {
  console.error('🚨 Potential memory leak detected:', data);
});

healthMonitor.on('orphan_processes', (data) => {
  console.warn('⚠️  Orphan FFmpeg processes detected:', data);
});

healthMonitor.on('streaming_recovered', (data) => {
  console.log('✅ Streaming auto-recovered:', data);
});

healthMonitor.on('streaming_failed', (data) => {
  console.error('🚨 Streaming failed to auto-restart:', data);
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
  console.log('⚙️  Settings changed, applying...');
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

  console.log('⚙️  Settings loaded and applied');
}).catch(err => {
  console.error('⚙️  Failed to initialize settings:', err);
});

console.log('🎛️  AudioAnalyzer started');
console.log('🔍 EventDetector started');
console.log('📍 SessionManager started');
console.log('💾 EventPersistence started');

// Inicializar SocketManager para WebSocket real-time updates
const socketManager = new SocketManager(httpServer, {
  audioManager,
  audioAnalyzer,
  eventDetector,
  sessionManager
});

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
    res.json({ success: true, message: 'Audio capture started' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// Endpoint para parar captura
app.post('/audio/stop', async (req, res) => {
  try {
    await audioManager.stop();
    res.json({ success: true, message: 'Audio capture stopped' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMsg });
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

    res.json({ success: true, message: 'Streaming started', config: {
      host: config.icecastHost,
      port: config.icecastPort,
      mountPoint: config.mountPoint,
      bitrate: config.bitrate
    }});
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// Endpoint para parar streaming
app.post('/streaming/stop', async (req, res) => {
  try {
    await audioManager.stopStreaming();
    res.json({ success: true, message: 'Streaming stopped' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// Endpoint para reiniciar streaming (aplica novo bitrate)
app.post('/streaming/restart', async (req, res) => {
  try {
    const status = audioManager.getStreamingStatus();

    if (!status.active) {
      res.status(400).json({ success: false, error: 'Streaming is not active' });
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
      message: 'Streaming restarted with new configuration',
      config: {
        host: config.icecastHost,
        port: config.icecastPort,
        mountPoint: config.mountPoint,
        bitrate: config.bitrate
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMsg });
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
      success: false,
      error: 'WAV streaming not available. Start streaming first.'
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

  console.log(`Client connected to WAV stream (total: ${wavClients.size})`);

  // Enviar para response
  clientStream.pipe(res);

  // Cleanup quando cliente desconectar
  const cleanup = () => {
    wavClients.delete(clientStream);
    clientStream.destroy();
    console.log(`Client disconnected from WAV stream (remaining: ${wavClients.size})`);
  };

  req.on('close', cleanup);
  res.on('error', cleanup);
  clientStream.on('error', cleanup);
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  try {
    // Parar socket manager primeiro (fecha conexões WebSocket)
    await socketManager.destroy();

    // Parar event persistence (para de persistir eventos)
    await eventPersistence.destroy();
    console.log('💾 EventPersistence stopped');

    // Parar session manager (encerra sessão ativa se houver)
    await sessionManager.destroy();
    console.log('📍 SessionManager stopped');

    // Parar event detector (para de escutar eventos)
    await eventDetector.stop();
    console.log('🔍 EventDetector stopped');

    // Parar audio analyzer
    audioAnalyzer.stop();
    console.log('🎛️  AudioAnalyzer stopped');

    // Parar health monitor
    await healthMonitor.stop();

    // Parar audio manager
    await audioManager.cleanup();

    console.log('Cleanup completed, exiting...');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Registrar handlers de shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handler para recovery failures
audioManager.on('recovery_failed', (data) => {
  console.error('🚨 FFmpeg recovery failed after max retries:', data);
  console.error('Exiting process to allow PM2 restart...');
  gracefulShutdown('RECOVERY_FAILED').then(() => {
    process.exit(1);
  });
});

