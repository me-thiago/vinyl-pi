// src/services/streamManager.ts
import { EventEmitter } from 'events';
import WebSocket from 'ws';

interface StreamConfig {
  bufferSize: number;
  chunkSize: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

interface AudioChunk {
  data: Buffer;
  timestamp: number;
}

interface StreamStatus {
  streaming: boolean;
  clients: number;
  bufferedChunks: number;
  latency: number;
}

export class StreamManager extends EventEmitter {
  private config: StreamConfig;
  private clients: Set<WebSocket> = new Set();
  private isStreaming: boolean = false;
  private audioBuffer: AudioChunk[] = [];
  private startTime: number = 0;
  private chunkCount: number = 0;

  // Estatísticas
  private lastBroadcastTime: number = 0;
  private averageLatency: number = 0;

  constructor(config: Partial<StreamConfig> = {}) {
    super();

    this.config = {
      bufferSize: config.bufferSize || parseInt(process.env.STREAMING_BUFFER_SIZE || '4096'),
      chunkSize: config.chunkSize || parseInt(process.env.STREAMING_CHUNK_SIZE || '1024'),
      sampleRate: config.sampleRate || parseInt(process.env.SAMPLE_RATE || '48000'),
      channels: config.channels || parseInt(process.env.CHANNELS || '2'),
      bitDepth: config.bitDepth || parseInt(process.env.BIT_DEPTH || '16')
    };

    console.log('StreamManager initialized with config:', this.config);
  }

  /**
   * Adiciona um cliente WebSocket à lista de broadcast
   */
  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    console.log(`Client added. Total clients: ${this.clients.size}`);

    // Enviar status inicial
    this.sendStatus(ws);

    // Configurar handlers
    ws.on('close', () => {
      this.removeClient(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
      this.removeClient(ws);
    });

    // Se já estamos streaming, notificar o novo cliente
    if (this.isStreaming) {
      this.sendMessage(ws, {
        type: 'status',
        streaming: true,
        message: 'Streaming in progress'
      });
    }
  }

  /**
   * Remove um cliente WebSocket da lista
   */
  removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
    console.log(`Client removed. Total clients: ${this.clients.size}`);
  }

  /**
   * Inicia o streaming
   */
  startStreaming(): void {
    if (this.isStreaming) {
      console.log('Streaming already active');
      return;
    }

    this.isStreaming = true;
    this.startTime = Date.now();
    this.chunkCount = 0;
    this.audioBuffer = [];

    console.log('Streaming started');

    // Notificar todos os clientes
    this.broadcast({
      type: 'status',
      streaming: true,
      message: 'Streaming started'
    });
  }

  /**
   * Para o streaming
   */
  stopStreaming(): void {
    if (!this.isStreaming) {
      console.log('Streaming not active');
      return;
    }

    this.isStreaming = false;
    this.audioBuffer = [];

    console.log('Streaming stopped');

    // Notificar todos os clientes
    this.broadcast({
      type: 'status',
      streaming: false,
      message: 'Streaming stopped'
    });
  }

  /**
   * Processa e faz broadcast de um chunk de áudio
   */
  processAudioChunk(chunk: Buffer): void {
    if (!this.isStreaming || this.clients.size === 0) {
      return;
    }

    const now = Date.now();
    this.chunkCount++;

    // Calcular latência média
    if (this.lastBroadcastTime > 0) {
      const timeDiff = now - this.lastBroadcastTime;
      this.averageLatency = (this.averageLatency * 0.9) + (timeDiff * 0.1);
    }
    this.lastBroadcastTime = now;

    // Adicionar ao buffer (manter buffer pequeno para baixa latência)
    const audioChunk: AudioChunk = {
      data: chunk,
      timestamp: now
    };

    this.audioBuffer.push(audioChunk);

    // Limitar tamanho do buffer (ring buffer)
    if (this.audioBuffer.length > 10) {
      this.audioBuffer.shift();
    }

    // Broadcast do chunk para todos os clientes
    this.broadcastAudioChunk(audioChunk);

    // Emitir evento de progresso a cada 100 chunks (~2 segundos)
    if (this.chunkCount % 100 === 0) {
      this.emit('progress', {
        chunkCount: this.chunkCount,
        duration: (now - this.startTime) / 1000,
        clients: this.clients.size,
        latency: Math.round(this.averageLatency)
      });
    }
  }

  /**
   * Faz broadcast de um chunk de áudio para todos os clientes
   */
  private broadcastAudioChunk(chunk: AudioChunk): void {
    // Preparar mensagem
    const message = {
      type: 'audio',
      data: chunk.data.toString('base64'), // Enviar como base64 para JSON
      timestamp: chunk.timestamp,
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
      bitDepth: this.config.bitDepth
    };

    const messageStr = JSON.stringify(message);

    // Enviar para todos os clientes conectados
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('Error sending audio chunk to client:', error);
          this.removeClient(client);
        }
      }
    });
  }

  /**
   * Faz broadcast de uma mensagem JSON para todos os clientes
   */
  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('Error broadcasting message:', error);
          this.removeClient(client);
        }
      }
    });
  }

  /**
   * Envia uma mensagem para um cliente específico
   */
  private sendMessage(client: WebSocket, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message to client:', error);
      }
    }
  }

  /**
   * Envia status atual para um cliente específico
   */
  private sendStatus(client: WebSocket): void {
    const status = this.getStatus();
    this.sendMessage(client, {
      type: 'status',
      ...status
    });
  }

  /**
   * Retorna o status atual do streaming
   */
  getStatus(): StreamStatus {
    return {
      streaming: this.isStreaming,
      clients: this.clients.size,
      bufferedChunks: this.audioBuffer.length,
      latency: Math.round(this.averageLatency)
    };
  }

  /**
   * Retorna número de clientes conectados
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Verifica se está streaming
   */
  isActive(): boolean {
    return this.isStreaming;
  }

  /**
   * Limpa o buffer de áudio
   */
  clearBuffer(): void {
    this.audioBuffer = [];
  }
}

// Singleton instance
export const streamManager = new StreamManager();
