import { useState, useRef, useEffect, useCallback } from 'react';

export interface AudioStreamState {
  playing: boolean;
  buffering: boolean;
  error: string | null;
  latency: number; // em ms
  volume: number; // 0.0 - 1.0
}

export interface UseAudioStreamOptions {
  streamUrl: string;
  bufferSize?: number; // em ms, default 150ms (otimizado para WAV baixa latência)
  onError?: (error: Error) => void;
}

export function useAudioStream({
  streamUrl,
  bufferSize = 150, // Reduzido de 200ms para 150ms (WAV tem latência menor)
  onError,
}: UseAudioStreamOptions) {
  const [state, setState] = useState<AudioStreamState>({
    playing: false,
    buffering: false,
    error: null,
    latency: 0,
    volume: 1.0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bufferQueueRef = useRef<AudioBuffer[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const latencyMonitorRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const useWebAudioRef = useRef<boolean>(true); // Tenta Web Audio primeiro
  const chunkBufferRef = useRef<Uint8Array[]>([]); // Buffer para acumular chunks WAV antes de decodificar
  const chunkBufferSizeRef = useRef<number>(0); // Tamanho total do buffer em bytes

  // Verificar suporte Web Audio API
  const checkWebAudioSupport = useCallback(() => {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }, []);

  // Inicializar AudioContext
  const initializeAudioContext = useCallback(async () => {
    if (!useWebAudioRef.current) {
      throw new Error('Web Audio API not supported, using HTML5 Audio fallback');
    }

    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported');
      }

      const context = new AudioContextClass({ sampleRate: 44100 });
      audioContextRef.current = context;

      // Criar GainNode para controle de volume
      const gainNode = context.createGain();
      gainNode.connect(context.destination);
      gainNodeRef.current = gainNode;

      // Resumir contexto se suspenso (necessário em alguns browsers)
      if (context.state === 'suspended') {
        await context.resume();
      }

      return context;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to initialize AudioContext');
      setState((prev) => ({ ...prev, error: err.message }));
      onError?.(err);
      throw err;
    }
  }, [onError]);

  // Processar chunk de áudio Raw PCM
  const processAudioChunk = useCallback(
    async (chunk: Uint8Array, context: AudioContext) => {
      try {
        // Acumular chunks PCM antes de processar
        chunkBufferRef.current.push(chunk);
        chunkBufferSizeRef.current += chunk.byteLength;

        // Threshold: 8KB de dados antes de criar AudioBuffer
        // Raw PCM 48kHz stereo 16-bit = 192KB/s → 8KB ≈ 42ms de áudio
        const DECODE_THRESHOLD = 8192; // bytes

        if (chunkBufferSizeRef.current < DECODE_THRESHOLD) {
          return;
        }

        // Concatenar chunks acumulados
        const totalSize = chunkBufferSizeRef.current;
        const concatenated = new Uint8Array(totalSize);
        let offset = 0;
        for (const bufferedChunk of chunkBufferRef.current) {
          concatenated.set(bufferedChunk, offset);
          offset += bufferedChunk.byteLength;
        }

        // Limpar buffer
        chunkBufferRef.current = [];
        chunkBufferSizeRef.current = 0;

        // Converter raw PCM para AudioBuffer
        // PCM s16le: 2 bytes por sample, 2 canais (stereo)
        const int16Data = new Int16Array(concatenated.buffer);
        const numSamples = Math.floor(int16Data.length / 2); // 2 channels
        const sampleRate = 48000; // Config do AudioManager

        // Criar AudioBuffer
        const audioBuffer = context.createBuffer(2, numSamples, sampleRate);

        // Converter Int16 → Float32 e separar canais
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);

        for (let i = 0; i < numSamples; i++) {
          // Int16 range: -32768 to 32767
          // Float32 range: -1.0 to 1.0
          leftChannel[i] = int16Data[i * 2] / 32768.0;
          rightChannel[i] = int16Data[i * 2 + 1] / 32768.0;
        }

        bufferQueueRef.current.push(audioBuffer);

        // Agendar reprodução
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current!);

        const currentTime = context.currentTime;
        const startTime = Math.max(currentTime, nextStartTimeRef.current);
        source.start(startTime);
        nextStartTimeRef.current = startTime + audioBuffer.duration;

        // Monitorar latência
        const queuedLatency = (startTime - currentTime) * 1000;
        const actualLatency = Math.max(0, queuedLatency);

        setState((prev) => ({
          ...prev,
          latency: actualLatency,
        }));

        // Ajuste dinâmico de buffer
        const totalDuration = bufferQueueRef.current.reduce((sum, buf) => sum + buf.duration, 0);
        const targetDuration = bufferSize / 1000;

        if (actualLatency < 30 && totalDuration < targetDuration * 0.5) {
          console.warn('Buffer underrun risk detected, current latency:', actualLatency);
        }

        if (totalDuration > targetDuration * 2) {
          bufferQueueRef.current = bufferQueueRef.current.slice(-3);
        }
      } catch (error) {
        console.error('Error processing audio chunk:', error);
        chunkBufferRef.current = [];
        chunkBufferSizeRef.current = 0;
      }
    },
    [bufferSize]
  );

  // Ler stream
  const readStream = useCallback(
    async (context: AudioContext) => {
      if (!readerRef.current) return;

      try {
        setState((prev) => ({ ...prev, buffering: true, error: null }));

        while (isPlayingRef.current && readerRef.current) {
          const { done, value } = await readerRef.current.read();

          if (done) {
            console.log('Stream ended');
            break;
          }

          if (value) {
            await processAudioChunk(value, context);
            setState((prev) => ({ ...prev, buffering: false }));
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Stream read error:', error);
          setState((prev) => ({
            ...prev,
            error: error.message,
            buffering: false,
          }));
          onError?.(error);
        }
      } finally {
        setState((prev) => ({ ...prev, buffering: false }));
      }
    },
    [processAudioChunk, onError]
  );

  // Iniciar stream
  const startStream = useCallback(async () => {
    if (isPlayingRef.current) {
      return; // Já está tocando
    }

    try {
      const context = await initializeAudioContext();
      
      // Resetar estado e tentativas de reconexão
      bufferQueueRef.current = [];
      nextStartTimeRef.current = context.currentTime + 0.1; // Pequeno delay inicial
      isPlayingRef.current = true;
      reconnectAttemptsRef.current = 0; // Resetar tentativas ao iniciar novo stream

      // Abort controller para cancelar fetch se necessário
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Fetch stream WAV (baixa latência)
      // TEMPORÁRIO: Usar backend direto (proxy Vite conflita com /stream Icecast)
      const effectiveUrl = 'http://localhost:3001/stream.wav';

      let response: Response;
      try {
        response = await fetch(effectiveUrl, {
          signal: abortController.signal,
          headers: {
            'Accept': 'audio/wav, audio/*',
          },
        });

        if (!response.ok) {
          throw new Error(`WAV stream failed with ${response.status}`);
        }
      } catch (wavError) {
        // Fallback para MP3 Icecast2 se WAV falhar
        console.warn('WAV streaming failed, trying MP3 fallback:', wavError);

        const mp3Url = isDev && streamUrl.includes('localhost:8000')
          ? streamUrl.replace('http://localhost:8000', '')
          : streamUrl;

        response = await fetch(mp3Url, {
          signal: abortController.signal,
          headers: {
            'Accept': 'audio/mpeg, audio/*',
          },
        });

        if (!response.ok) {
          throw new Error(`MP3 fallback also failed with ${response.status}`);
        }

        console.log('Using MP3 Icecast2 fallback stream');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Criar reader
      const reader = response.body.getReader();
      readerRef.current = reader;

      setState((prev) => ({
        ...prev,
        playing: true,
        error: null,
        buffering: true,
      }));

      // Iniciar leitura
      await readStream(context);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Start stream error:', error);
        
        // Tentar reconexão com exponential backoff
        const maxAttempts = 5;
        const currentAttempt = reconnectAttemptsRef.current;
        
        if (currentAttempt < maxAttempts && isPlayingRef.current) {
          const delay = Math.min(1000 * Math.pow(2, currentAttempt), 30000); // Max 30s
          reconnectAttemptsRef.current = currentAttempt + 1;
          
          setState((prev) => ({
            ...prev,
            error: `Erro de conexão. Tentando reconectar... (${currentAttempt + 1}/${maxAttempts})`,
            buffering: true,
          }));

          reconnectTimeoutRef.current = window.setTimeout(() => {
            startStream().catch(console.error);
          }, delay);
        } else {
          setState((prev) => ({
            ...prev,
            playing: false,
            error: error.message,
            buffering: false,
          }));
          onError?.(error);
        }
      }
    }
  }, [streamUrl, initializeAudioContext, readStream, onError]);

  // Parar stream
  const stopStream = useCallback(() => {
    isPlayingRef.current = false;

    // Cancelar reconexão pendente
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    reconnectAttemptsRef.current = 0;

    // Cancelar fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Fechar reader
    if (readerRef.current) {
      readerRef.current.cancel().catch(console.error);
      readerRef.current = null;
    }

    // Limpar buffer
    bufferQueueRef.current = [];

    setState((prev) => ({
      ...prev,
      playing: false,
      buffering: false,
      error: null,
    }));
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    if (isPlayingRef.current) {
      stopStream();
    } else {
      await startStream();
    }
  }, [startStream, stopStream]);

  // Atualizar volume
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedVolume;
    }
    setState((prev) => ({ ...prev, volume: clampedVolume }));
  }, []);

  // Monitoramento contínuo de latência
  useEffect(() => {
    if (state.playing && audioContextRef.current) {
      latencyMonitorRef.current = window.setInterval(() => {
        if (audioContextRef.current && nextStartTimeRef.current > 0) {
          const currentTime = audioContextRef.current.currentTime;
          const queuedLatency = (nextStartTimeRef.current - currentTime) * 1000;
          setState((prev) => ({
            ...prev,
            latency: Math.max(0, queuedLatency),
          }));
        }
      }, 100); // Atualizar a cada 100ms
    } else {
      if (latencyMonitorRef.current) {
        clearInterval(latencyMonitorRef.current);
        latencyMonitorRef.current = null;
      }
    }

    return () => {
      if (latencyMonitorRef.current) {
        clearInterval(latencyMonitorRef.current);
        latencyMonitorRef.current = null;
      }
    };
  }, [state.playing]);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      stopStream();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      if (latencyMonitorRef.current) {
        clearInterval(latencyMonitorRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [stopStream]);

  // Exportar função para verificar suporte
  const webAudioSupported = checkWebAudioSupport();

  return {
    ...state,
    togglePlayPause,
    setVolume,
    startStream,
    stopStream,
    webAudioSupported,
  };
}

