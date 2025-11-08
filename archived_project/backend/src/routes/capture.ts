// src/routes/capture.ts
import { Router, Request, Response } from 'express';
import { captureService } from '../captureService';
import { wsServer } from '../websocketServer';

const router = Router();

// POST /api/capture/start - Iniciar gravação
router.post('/start', async (req: Request, res: Response) => {
  try {
    // Verificar se já está gravando
    const status = captureService.getStatus();
    if (status.isCapturing) {
      return res.status(400).json({
        error: 'Recording already in progress',
        currentRecordingId: status.currentRecordingId
      });
    }

    // Extrair metadata do request
    const { title, artist, album, side, notes } = req.body;

    // Iniciar gravação
    const recordingId = await captureService.startRecording({
      title,
      artist,
      album,
      side,
      notes
    });

    // Iniciar streaming WebSocket se configurado
    if (process.env.ENABLE_STREAMING === 'true') {
      wsServer.startStreaming();
    }

    res.json({
      success: true,
      recording: {
        id: recordingId,
        status: 'recording',
        startedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error starting recording:', error);
    res.status(500).json({
      error: error.message || 'Failed to start recording'
    });
  }
});

// POST /api/capture/stop - Parar gravação
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const status = captureService.getStatus();

    if (!status.isCapturing) {
      return res.status(400).json({
        error: 'No recording in progress'
      });
    }

    // Parar gravação
    await captureService.stopRecording();

    // Parar streaming WebSocket
    wsServer.stopStreaming();

    res.json({
      success: true,
      recording: {
        id: status.currentRecordingId,
        status: 'stopped',
        endedAt: new Date().toISOString(),
        duration: status.duration,
        fileSizeBytes: status.bytesWritten
      }
    });

  } catch (error: any) {
    console.error('Error stopping recording:', error);
    res.status(500).json({
      error: error.message || 'Failed to stop recording'
    });
  }
});

// GET /api/capture/status - Status atual
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = captureService.getStatus();

    res.json({
      isCapturing: status.isCapturing,
      currentRecording: status.isCapturing ? {
        id: status.currentRecordingId,
        duration: status.duration,
        fileSize: status.bytesWritten,
        startedAt: new Date(Date.now() - status.duration * 1000).toISOString()
      } : null,
      device: {
        name: 'Behringer UCA222',
        sampleRate: status.config.sampleRate,
        bitDepth: status.config.bitDepth,
        channels: status.config.channels
      },
      websocket: {
        connected: wsServer.getConnectionCount(),
        streaming: process.env.ENABLE_STREAMING === 'true'
      }
    });

  } catch (error: any) {
    console.error('Error getting status:', error);
    res.status(500).json({
      error: error.message || 'Failed to get status'
    });
  }
});

export default router;