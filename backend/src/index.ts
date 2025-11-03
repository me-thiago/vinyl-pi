import express from 'express';
import dotenv from 'dotenv';
import { AudioManager } from './services/audio-manager';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

