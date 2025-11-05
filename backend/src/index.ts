import express from 'express';
import dotenv from 'dotenv';
import { PassThrough } from 'stream';
import { AudioManager } from './services/audio-manager';
import { createStatusRouter } from './routes/status';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// WAV Stream Broadcaster
// Mantém lista de clientes conectados e transmite dados para todos simultaneamente
let wavBroadcaster: PassThrough | null = null;
const wavClients = new Set<PassThrough>();

function getOrCreateBroadcaster(source: NodeJS.ReadableStream): PassThrough {
  if (!wavBroadcaster) {
    wavBroadcaster = new PassThrough();

    // Ler do source e escrever para o broadcaster
    source.on('data', (chunk) => {
      if (wavBroadcaster) {
        wavBroadcaster.write(chunk);
      }
      // Broadcast para todos os clientes ativos
      wavClients.forEach((client) => {
        try {
          client.write(chunk);
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

// Registrar routes
app.use('/api', createStatusRouter(audioManager));

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

// Endpoint para iniciar streaming
app.post('/streaming/start', async (req, res) => {
  try {
    const config = {
      icecastHost: process.env.ICECAST_HOST || 'localhost',
      icecastPort: parseInt(process.env.ICECAST_PORT || '8000'),
      icecastPassword: process.env.ICECAST_SOURCE_PASSWORD || 'hackme',
      mountPoint: process.env.ICECAST_MOUNT_POINT || '/stream',
      bitrate: 320,
      fallbackSilence: true
    };

    await audioManager.startStreaming(config);
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
  getOrCreateBroadcaster(wavStream);

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

