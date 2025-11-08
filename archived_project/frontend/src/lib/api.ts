import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Recording {
  id: string;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  durationSeconds: number;
  filePath: string;
  fileSizeBytes: number;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  status: 'recording' | 'stopped' | 'failed';
  title?: string;
  artist?: string;
  album?: string;
  side?: string;
  notes?: string;
}

export interface RecordingMetadata {
  title?: string;
  artist?: string;
  album?: string;
  side?: string;
  notes?: string;
}

export interface CaptureStatus {
  isCapturing: boolean;
  currentRecording?: {
    id: string;
    duration: number;
    fileSize: number;
    startedAt: string;
  };
  device: {
    name: string;
    sampleRate: number;
    bitDepth: number;
    channels: number;
  };
  websocket: {
    connected: number;
    streaming: boolean;
  };
}

export interface RecordingsResponse {
  recordings: Recording[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// API functions
export const captureApi = {
  start: async (metadata?: RecordingMetadata) => {
    const { data } = await api.post('/capture/start', metadata);
    return data;
  },

  stop: async () => {
    const { data } = await api.post('/capture/stop');
    return data;
  },

  status: async (): Promise<CaptureStatus> => {
    const { data } = await api.get('/capture/status');
    return data;
  },
};

export const recordingsApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<RecordingsResponse> => {
    const { data } = await api.get('/recordings', { params });
    return data;
  },

  get: async (id: string): Promise<{ recording: Recording }> => {
    const { data } = await api.get(`/recordings/${id}`);
    return data;
  },

  update: async (id: string, metadata: Partial<RecordingMetadata>) => {
    const { data } = await api.patch(`/recordings/${id}`, metadata);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/recordings/${id}`);
    return data;
  },

  getStreamUrl: (id: string) => `${API_URL}/recordings/${id}/stream`,

  getDownloadUrl: (id: string) => `${API_URL}/recordings/${id}/download`,
};

// WebSocket connection
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(url: string = 'ws://localhost:3002/ws') {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      try {
        if (event.data instanceof Blob) {
          // Binary data (audio chunks)
          this.emit('audioData', event.data);
        } else {
          // JSON messages
          const message = JSON.parse(event.data);
          this.emit(message.type, message.data);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emit('disconnected', {});
      this.attemptReconnect();
    };
  }

  private attemptReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
}

export const wsClient = new WebSocketClient();

export default {
  capture: captureApi,
  recordings: recordingsApi,
  ws: wsClient,
};