import { useEffect, useRef, useState } from 'react';
import { useStreamingWebSocket } from '@/hooks/useStreamingWebSocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Volume2, VolumeX, Radio } from 'lucide-react';

const WS_URL = `ws://${window.location.hostname}:3002/live`;

// Constantes do visualizador
const CANVAS_SIZE = 400;
const CENTER = CANVAS_SIZE / 2;
const VINYL_RADIUS = 140;
const LABEL_RADIUS = 45; // Reduzido de 55 para 45
const GROOVES = [90, 105, 120, 135];
const BAR_COUNT = 90;
const BAR_WIDTH = 5;
const BAR_BASE_RADIUS = 140; // Barras começam exatamente na borda do vinil
const BAR_MAX_HEIGHT = 40;
const RPM = 33.33;

export function StreamingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isInitialized, setIsInitialized] = useState(false);
  const resetPlaybackRef = useRef<(() => void) | null>(null);

  const { status, config, connect, disconnect, onAudioData, isConnected, isStreaming, updateLatency } =
    useStreamingWebSocket(WS_URL);

  // Inicializar
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Função para desenhar o vinil
  const drawVinylRecord = (
    ctx: CanvasRenderingContext2D,
    currentRotation: number,
    primaryColor: string,
    cardColor: string,
    bgColor: string,
    mutedColor: string
  ) => {
    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate(currentRotation);

    // 1. Círculo base do vinil (usa primary)
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(0, 0, VINYL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 2. Grooves (sulcos concêntricos - usa muted com opacidade)
    ctx.strokeStyle = mutedColor;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;

    GROOVES.forEach((radius) => {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.globalAlpha = 1.0;

    // 3. Marcadores de rotação (usa muted)
    ctx.fillStyle = mutedColor;

    // Primeiro marcador no groove 2
    ctx.beginPath();
    ctx.arc(GROOVES[2], 0, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Segundo marcador no groove 0 (mais interno), em posição oposta
    ctx.beginPath();
    ctx.arc(-GROOVES[0], 0, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Label central (usa card color - contra-rotacionar para ficar fixo)
    ctx.rotate(-currentRotation);

    ctx.fillStyle = cardColor;
    ctx.beginPath();
    ctx.arc(0, 0, LABEL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 5. Dot indicator pulsante no centro (usa background)
    const pulseScale = 0.8 + Math.sin(Date.now() / 500) * 0.2;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(0, 0, 4 * pulseScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Função para desenhar as barras de frequência (pulsando PARA DENTRO)
  const drawFrequencyBars = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, cardColor: string) => {
    const angleStep = (Math.PI * 2) / BAR_COUNT;

    for (let i = 0; i < BAR_COUNT; i++) {
      // Mapear índice da barra para índice do dataArray
      const dataIndex = Math.floor((i / BAR_COUNT) * dataArray.length);
      const value = dataArray[dataIndex];

      // Calcular altura da barra (0-40px)
      const barHeight = (value / 255) * BAR_MAX_HEIGHT;

      // Calcular ângulo
      const angle = i * angleStep;

      // Calcular posição - barras crescem PARA DENTRO (subtraindo barHeight)
      const x = CENTER + Math.cos(angle) * (BAR_BASE_RADIUS - barHeight / 2);
      const y = CENTER + Math.sin(angle) * (BAR_BASE_RADIUS - barHeight / 2);

      // Desenhar barra
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2); // Perpendicular ao raio

      // Cor com opacity baseada na amplitude (usa card)
      const opacity = 0.3 + (value / 255) * 0.7;
      // Converter rgb() ou rgba() para rgba() com opacidade
      const rgbMatch = cardColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        ctx.fillStyle = `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${opacity})`;
      } else {
        ctx.fillStyle = cardColor;
      }

      ctx.fillRect(-BAR_WIDTH / 2, -barHeight / 2, BAR_WIDTH, barHeight);

      ctx.restore();
    }
  };

  // Loop de animação do visualizador
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar tamanho do canvas
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    let currentRotation = 0;
    let lastTime = 0;

    const animate = (timestamp: number) => {
      if (!ctx) return;

      // Delta time em segundos
      const deltaTime = lastTime ? (timestamp - lastTime) / 1000 : 0;
      lastTime = timestamp;

      // Atualizar rotação (33.33 RPM = sentido horário)
      const rotationSpeed = (RPM / 60) * Math.PI * 2; // radianos/segundo
      currentRotation += rotationSpeed * deltaTime;

      // Ler cores do tema a cada frame (para atualizar quando o tema mudar)
      const getCSSColor = (variable: string): string => {
        const temp = document.createElement('div');
        temp.style.color = `var(${variable})`;
        document.body.appendChild(temp);
        const color = getComputedStyle(temp).color;
        document.body.removeChild(temp);
        return color;
      };

      const primaryColor = getCSSColor('--primary');
      const bgColor = getCSSColor('--background');
      const cardColor = getCSSColor('--card');
      const mutedColor = getCSSColor('--muted');

      // Limpar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fundo (usa card color)
      ctx.fillStyle = cardColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Desenhar vinil (com rotação)
      drawVinylRecord(ctx, currentRotation, primaryColor, cardColor, bgColor, mutedColor);

      // Obter dados de frequência (se analyser existe)
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Desenhar barras (sem rotação)
        drawFrequencyBars(ctx, dataArray, cardColor);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Configurar Web Audio API para streaming
  useEffect(() => {
    if (!isInitialized || !isConnected) return;

    let nextPlayTime = 0;
    let audioQueue: AudioBuffer[] = [];
    const maxQueueSize = config.bufferSize || 20;

    // Função para resetar playback ao vivo
    const resetToLive = () => {
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        nextPlayTime = ctx.currentTime + (config.initialDelay || 500) / 1000;
        audioQueue = [];
        console.log('Reset to live - cleared queue');
      }
    };

    resetPlaybackRef.current = resetToLive;

    const setupAudio = async () => {
      try {
        // Criar AudioContext
        const audioContext = new AudioContext({ sampleRate: config.sampleRate });
        audioContextRef.current = audioContext;

        // Criar AnalyserNode para visualização
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // Criar MediaStreamDestination
        const destination = audioContext.createMediaStreamDestination();
        mediaStreamRef.current = destination.stream;

        console.log('Audio setup complete', { sampleRate: config.sampleRate });

        // Configurar callback para receber dados do WebSocket
        onAudioData((audioData: Float32Array) => {
          if (!audioContextRef.current) return;

          try {
            const ctx = audioContextRef.current;

            // Criar buffer de áudio
            const buffer = ctx.createBuffer(
              config.channels,
              audioData.length / config.channels,
              config.sampleRate
            );

            // Preencher buffer com dados
            for (let channel = 0; channel < config.channels; channel++) {
              const channelData = buffer.getChannelData(channel);
              for (let i = 0; i < channelData.length; i++) {
                channelData[i] = audioData[i * config.channels + channel];
              }
            }

            // Adicionar à fila
            audioQueue.push(buffer);

            // Limitar tamanho da fila
            if (audioQueue.length > maxQueueSize) {
              audioQueue.shift();
            }

            // Agendar playback
            const currentTime = ctx.currentTime;

            // Se nextPlayTime está no passado ou muito distante, reiniciar
            const initialDelaySeconds = (config.initialDelay || 500) / 1000;
            if (nextPlayTime === 0 || nextPlayTime < currentTime || nextPlayTime > currentTime + 10) {
              nextPlayTime = currentTime + initialDelaySeconds;
            }

            // Tocar o buffer
            if (!isMuted) {
              const source = ctx.createBufferSource();
              source.buffer = buffer;

              // Criar gain node para controle de volume
              const gainNode = ctx.createGain();
              gainNode.gain.value = volume;

              source.connect(gainNode);

              // Conectar ao analyser para visualização
              if (analyserRef.current) {
                gainNode.connect(analyserRef.current);
                analyserRef.current.connect(ctx.destination);
              } else {
                gainNode.connect(ctx.destination);
              }

              source.start(nextPlayTime);

              // Atualizar tempo para próximo buffer
              nextPlayTime += buffer.duration;

              // Atualizar latência real (tempo de buffer em ms)
              const latencyMs = Math.round((nextPlayTime - ctx.currentTime) * 1000);
              if (updateLatency) {
                updateLatency(latencyMs);
              }
            }
          } catch (error) {
            console.error('Error processing audio data:', error);
          }
        });
      } catch (error) {
        console.error('Error setting up audio:', error);
      }
    };

    setupAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      nextPlayTime = 0;
      audioQueue = [];
    };
  }, [isInitialized, isConnected, config, onAudioData, isMuted, volume]);

  // Conectar ao iniciar
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const handlePlayPause = () => {
    if (!audioContextRef.current) return;

    if (isPlaying) {
      audioContextRef.current.suspend();
      setIsPlaying(false);
    } else {
      audioContextRef.current.resume();
      setIsPlaying(true);
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleGoLive = () => {
    if (resetPlaybackRef.current) {
      resetPlaybackRef.current();
    }
  };

  // Threshold para mostrar botão "Go Live" (3 segundos)
  const isDelayed = status.latency > 3000;

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Radio className="h-8 w-8" />
            Live Streaming
          </h1>
          <p className="text-muted-foreground mt-2">
            Listen to audio in real-time from your vinyl player
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Connection Status</span>
              <div className="flex gap-2">
                <Badge variant={isConnected ? 'default' : 'destructive'}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
                {isStreaming && (
                  <Badge variant="secondary" className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    ON AIR
                  </Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              {isConnected
                ? `${config.sampleRate / 1000}kHz • ${config.bitDepth}-bit • ${config.channels} channels`
                : 'Connecting to streaming server...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Latency</p>
                <p className="text-2xl font-bold">{status.latency}ms</p>
              </div>
              <div>
                <p className="text-muted-foreground">Clients</p>
                <p className="text-2xl font-bold">{status.clients}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sample Rate</p>
                <p className="text-2xl font-bold">{config.sampleRate / 1000}kHz</p>
              </div>
            </div>

            {status.error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive rounded-md">
                <p className="text-sm text-destructive">{status.error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vinyl Visualizer Card */}
        <Card>
          <CardHeader>
            <CardTitle>Live Vinyl Visualizer</CardTitle>
            <CardDescription>Real-time frequency visualization with rotating vinyl</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {/* Canvas Visualizer */}
            <canvas
              ref={canvasRef}
              className="rounded-lg"
              style={{
                width: '100%',
                maxWidth: '400px',
                height: 'auto',
                aspectRatio: '1/1',
              }}
            />

            {/* Controls */}
            <div className="mt-6 w-full flex items-center gap-4">
              <Button
                onClick={handlePlayPause}
                disabled={!isConnected}
                variant={isPlaying ? 'default' : 'outline'}
                size="lg"
                className="h-12 px-6 transition-transform hover:scale-105"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Play
                  </>
                )}
              </Button>

              <Button
                onClick={handleMuteToggle}
                variant="outline"
                size="lg"
                className="h-12 px-6"
                disabled={!isConnected}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>

              {isDelayed && (
                <Button
                  onClick={handleGoLive}
                  variant="destructive"
                  size="lg"
                  className="h-12 px-6"
                  disabled={!isConnected}
                >
                  <Radio className="h-5 w-5 mr-2" />
                  Go Live
                </Button>
              )}

              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right,
                      hsl(var(--primary)) 0%,
                      hsl(var(--primary)) ${volume * 100}%,
                      hsl(var(--muted)) ${volume * 100}%,
                      hsl(var(--muted)) 100%)`,
                  }}
                  disabled={!isConnected}
                />
              </div>

              <span className="text-sm text-muted-foreground w-12 text-right font-medium">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              This page streams audio directly from your vinyl player in real-time with minimal latency.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Audio is transmitted via WebSocket as raw PCM chunks</li>
              <li>Circular visualizer shows frequency spectrum in real-time</li>
              <li>Vinyl rotates at authentic 33⅓ RPM</li>
              <li>No compression - pristine audio quality</li>
              <li>Automatic reconnection if connection is lost</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}