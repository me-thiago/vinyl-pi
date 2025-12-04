import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSocket } from '../useSocket';

// Mock socket.io-client
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockEmit = vi.fn();
const mockDisconnect = vi.fn();

const createMockSocket = () => ({
  on: mockOn,
  off: mockOff,
  emit: mockEmit,
  disconnect: mockDisconnect,
  connected: true,
});

let mockSocket = createMockSocket();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('useSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockOn.mockReset();
    mockOff.mockReset();
    mockEmit.mockReset();
    mockDisconnect.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve inicializar com estado de conexão "connecting"', () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.connectionState).toBe('connecting');
  });

  it('deve ter isConnected como false inicialmente', () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.isConnected).toBe(false);
  });

  it('deve ter status null inicialmente', () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.status).toBeNull();
  });

  it('deve ter lastEvent null inicialmente', () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.lastEvent).toBeNull();
  });

  it('deve ter audioLevel null inicialmente', () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.audioLevel).toBeNull();
  });

  it('deve registrar handlers de eventos na conexão', () => {
    renderHook(() => useSocket());

    // Verificar que os handlers foram registrados
    expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('connect_error', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('status:update', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('event:new', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('audio:level', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('session:started', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('session:ended', expect.any(Function));
  });

  it('deve atualizar connectionState para "connected" quando conectar', async () => {
    const { result } = renderHook(() => useSocket());

    // Simular evento de conexão
    const connectHandler = mockOn.mock.calls.find(call => call[0] === 'connect')?.[1];

    act(() => {
      connectHandler?.();
    });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('deve atualizar connectionState para "disconnected" quando desconectar', async () => {
    const { result } = renderHook(() => useSocket());

    // Simular conexão e depois desconexão
    const connectHandler = mockOn.mock.calls.find(call => call[0] === 'connect')?.[1];
    const disconnectHandler = mockOn.mock.calls.find(call => call[0] === 'disconnect')?.[1];

    act(() => {
      connectHandler?.();
    });

    act(() => {
      disconnectHandler?.('io client disconnect');
    });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('deve atualizar connectionState para "error" em erro de conexão', async () => {
    const { result } = renderHook(() => useSocket());

    const errorHandler = mockOn.mock.calls.find(call => call[0] === 'connect_error')?.[1];

    act(() => {
      errorHandler?.(new Error('Connection failed'));
    });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('error');
    });
  });

  it('deve atualizar status quando receber status:update', async () => {
    const { result } = renderHook(() => useSocket());

    const statusHandler = mockOn.mock.calls.find(call => call[0] === 'status:update')?.[1];

    const mockStatus = {
      session: {
        id: 'session-1',
        started_at: '2024-01-01T00:00:00Z',
        duration: 120,
        event_count: 5,
      },
      streaming: {
        active: true,
        listeners: 2,
        bitrate: 192,
        mount_point: '/stream',
      },
      audio: {
        level_db: -20,
        clipping_detected: false,
        clipping_count: 0,
        silence_detected: false,
      },
    };

    act(() => {
      statusHandler?.(mockStatus);
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(mockStatus);
    });
  });

  it('deve atualizar lastEvent quando receber event:new', async () => {
    const { result } = renderHook(() => useSocket());

    const eventHandler = mockOn.mock.calls.find(call => call[0] === 'event:new')?.[1];

    const mockEvent = {
      id: 'evt-1',
      eventType: 'silence.detected',
      timestamp: '2024-01-01T00:00:00Z',
      metadata: { levelDb: -60 },
      sessionId: 'session-1',
    };

    act(() => {
      eventHandler?.(mockEvent);
    });

    await waitFor(() => {
      expect(result.current.lastEvent).toEqual(mockEvent);
    });
  });

  it('deve atualizar audioLevel quando receber audio:level', async () => {
    const { result } = renderHook(() => useSocket());

    const audioLevelHandler = mockOn.mock.calls.find(call => call[0] === 'audio:level')?.[1];

    act(() => {
      audioLevelHandler?.({ levelDb: -25, timestamp: '2024-01-01T00:00:00Z' });
    });

    await waitFor(() => {
      expect(result.current.audioLevel).toBe(-25);
    });
  });

  it('deve chamar onStatus callback quando receber status:update', async () => {
    const onStatus = vi.fn();
    renderHook(() => useSocket({ onStatus }));

    const statusHandler = mockOn.mock.calls.find(call => call[0] === 'status:update')?.[1];

    const mockStatus = {
      session: null,
      streaming: { active: false, bitrate: 128, mount_point: '/stream' },
      audio: { level_db: null, clipping_detected: false, clipping_count: 0, silence_detected: true },
    };

    act(() => {
      statusHandler?.(mockStatus);
    });

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith(mockStatus);
    });
  });

  it('deve chamar onEvent callback quando receber event:new', async () => {
    const onEvent = vi.fn();
    renderHook(() => useSocket({ onEvent }));

    const eventHandler = mockOn.mock.calls.find(call => call[0] === 'event:new')?.[1];

    const mockEvent = {
      id: 'evt-2',
      eventType: 'clipping.detected',
      timestamp: '2024-01-01T00:00:00Z',
      metadata: {},
      sessionId: null,
    };

    act(() => {
      eventHandler?.(mockEvent);
    });

    await waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith(mockEvent);
    });
  });

  it('deve chamar onAudioLevel callback quando receber audio:level', async () => {
    const onAudioLevel = vi.fn();
    renderHook(() => useSocket({ onAudioLevel }));

    const audioLevelHandler = mockOn.mock.calls.find(call => call[0] === 'audio:level')?.[1];

    const mockLevel = { levelDb: -30, timestamp: '2024-01-01T00:00:00Z' };

    act(() => {
      audioLevelHandler?.(mockLevel);
    });

    await waitFor(() => {
      expect(onAudioLevel).toHaveBeenCalledWith(mockLevel);
    });
  });

  it('deve chamar onSessionStarted callback quando receber session:started', async () => {
    const onSessionStarted = vi.fn();
    renderHook(() => useSocket({ onSessionStarted }));

    const sessionStartedHandler = mockOn.mock.calls.find(call => call[0] === 'session:started')?.[1];

    const mockData = { id: 'session-123', startedAt: '2024-01-01T00:00:00Z' };

    act(() => {
      sessionStartedHandler?.(mockData);
    });

    await waitFor(() => {
      expect(onSessionStarted).toHaveBeenCalledWith(mockData);
    });
  });

  it('deve chamar onSessionEnded callback quando receber session:ended', async () => {
    const onSessionEnded = vi.fn();
    renderHook(() => useSocket({ onSessionEnded }));

    const sessionEndedHandler = mockOn.mock.calls.find(call => call[0] === 'session:ended')?.[1];

    const mockData = {
      id: 'session-123',
      endedAt: '2024-01-01T01:00:00Z',
      durationSeconds: 3600,
      eventCount: 10,
    };

    act(() => {
      sessionEndedHandler?.(mockData);
    });

    await waitFor(() => {
      expect(onSessionEnded).toHaveBeenCalledWith(mockData);
    });
  });

  it('deve desconectar quando o componente for desmontado', () => {
    const { unmount } = renderHook(() => useSocket());

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('função disconnect deve desconectar o socket', () => {
    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.disconnect();
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('função reconnect deve desconectar e reconectar', async () => {
    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.reconnect();
    });

    // Deve ter chamado disconnect para reconectar
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
