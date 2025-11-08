// src/websocketServer.ts
import WebSocket, { WebSocketServer } from 'ws';
import { Server as HTTPServer } from 'http';
import { captureService } from './captureService';
import { streamManager } from './services/streamManager';
import { liveStreamService } from './liveStreamService';

export class StreamingWebSocketServer {
  private wss: WebSocketServer | null = null; // Para /ws (capture metrics)
  private liveWss: WebSocketServer | null = null; // Para /live (streaming)
  private clients: Set<WebSocket> = new Set();
  private isStreaming: boolean = false;

  initialize(server: HTTPServer) {
    // WebSocket /ws - Para métricas de gravação
    this.wss = new WebSocketServer({ noServer: true });

    // WebSocket /live - Para streaming ao vivo
    this.liveWss = new WebSocketServer({ noServer: true });
    console.log('✅ WebSocket servers created (noServer mode)');

    // Handle upgrade requests
    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
      console.log(`🔌 WebSocket upgrade request for: ${pathname}`);

      if (pathname === '/ws') {
        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          console.log('New WebSocket client connected to /ws (metrics)');
          this.clients.add(ws);

          // Enviar status inicial
          ws.send(JSON.stringify({
            type: 'status',
            data: captureService.getStatus()
          }));

          ws.on('close', () => {
            console.log('Client disconnected from /ws');
            this.clients.delete(ws);
          });

          ws.on('error', (error) => {
            console.error('WebSocket /ws error:', error);
            this.clients.delete(ws);
          });

          this.wss?.emit('connection', ws, request);
        });
      } else if (pathname === '/live') {
        this.liveWss?.handleUpgrade(request, socket, head, async (ws) => {
          console.log('🎵 New client connected to /live (streaming)');

          // Adicionar cliente ao StreamManager
          streamManager.addClient(ws);

          // Enviar mensagem de boas-vindas
          ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to live streaming',
            config: {
              sampleRate: parseInt(process.env.SAMPLE_RATE || '48000'),
              channels: parseInt(process.env.CHANNELS || '2'),
              bitDepth: parseInt(process.env.BIT_DEPTH || '16'),
              bufferSize: parseInt(process.env.FRONTEND_BUFFER_SIZE || '20'),
              initialDelay: parseInt(process.env.FRONTEND_INITIAL_DELAY || '500')
            }
          }));

          // Iniciar streaming se for o primeiro cliente
          if (streamManager.getClientCount() === 1 && !liveStreamService.isActive()) {
            console.log('🎙️ Starting live audio capture (first client connected)');
            try {
              await liveStreamService.start();
              streamManager.startStreaming();
            } catch (error) {
              console.error('Failed to start live stream:', error);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to start audio capture'
              }));
            }
          }

          this.liveWss?.emit('connection', ws, request);
        });
      } else {
        console.log(`❌ Unknown WebSocket path: ${pathname}`);
        socket.destroy();
      }
    });

    // Escutar eventos do capture service para métricas (gravação)
    captureService.on('data', (chunk: Buffer) => {
      // Broadcast para clientes /ws (se necessário para outras features)
      if (this.isStreaming) {
        this.broadcastData(chunk);
      }
    });

    captureService.on('metrics', (metrics: any) => {
      this.broadcastMetrics(metrics);
    });

    captureService.on('stopped', (data: any) => {
      this.broadcastStatus('stopped', data);
    });

    // Escutar eventos do live stream service (streaming ao vivo)
    liveStreamService.on('data', (chunk: Buffer) => {
      // Enviar para streaming manager
      if (process.env.ENABLE_LIVE_STREAMING === 'true') {
        streamManager.processAudioChunk(chunk);
      }
    });

    liveStreamService.on('metrics', (metrics: any) => {
      console.log('Live stream metrics:', metrics);
    });

    liveStreamService.on('stopped', (data: any) => {
      console.log('Live stream stopped:', data);
      streamManager.stopStreaming();
    });

    liveStreamService.on('error', (error: Error) => {
      console.error('Live stream error:', error);
      streamManager.stopStreaming();
    });

    console.log('WebSocket servers initialized (/ws and /live)');
  }

  startStreaming() {
    this.isStreaming = true;
    streamManager.startStreaming();
    this.broadcastStatus('streaming_started', {});
  }

  stopStreaming() {
    this.isStreaming = false;
    streamManager.stopStreaming();
    this.broadcastStatus('streaming_stopped', {});
  }

  private broadcastData(chunk: Buffer) {
    // Converter para Float32Array para compatibilidade com WaveSurfer
    const pcmData = new Float32Array(chunk.length / 2);
    for (let i = 0; i < pcmData.length; i++) {
      const sample = chunk.readInt16LE(i * 2);
      pcmData[i] = sample / 32768.0; // Normalizar para -1 a 1
    }

    const message = Buffer.from(pcmData.buffer);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message, { binary: true });
        } catch (error) {
          console.error('Error sending data to client:', error);
        }
      }
    });
  }

  private broadcastMetrics(metrics: any) {
    const message = JSON.stringify({
      type: 'metrics',
      data: metrics
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('Error sending metrics to client:', error);
        }
      }
    });
  }

  private broadcastStatus(status: string, data: any) {
    const message = JSON.stringify({
      type: 'status',
      status,
      data
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('Error sending status to client:', error);
        }
      }
    });
  }

  getConnectionCount(): number {
    return this.clients.size;
  }
}

export const wsServer = new StreamingWebSocketServer();