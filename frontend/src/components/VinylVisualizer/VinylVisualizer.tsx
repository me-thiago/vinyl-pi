import { useEffect, useRef } from 'react';

// Constantes do visualizador
const CANVAS_SIZE = 400;
const CENTER = CANVAS_SIZE / 2;
const VINYL_RADIUS = 140;
const LABEL_RADIUS = 45;
const GROOVES = [90, 105, 120, 135];
const BAR_COUNT = 90;
const BAR_WIDTH = 5;
const BAR_BASE_RADIUS = 140; // Barras começam exatamente na borda do vinil
const BAR_MAX_HEIGHT = 40;
const RPM = 33.33;

interface VinylVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export function VinylVisualizer({ analyser, isPlaying }: VinylVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Função auxiliar para ler cores do tema CSS (suporta OKLCH, HSL, RGB, HEX)
  const getCSSColor = (variable: string): string => {
    const rootStyles = getComputedStyle(document.documentElement);
    const cssValue = rootStyles.getPropertyValue(variable).trim();
    
    // Se já é uma cor válida com função (oklch, rgb, rgba, hsl, etc), retornar
    if (cssValue.includes('oklch') || cssValue.includes('rgb') || cssValue.includes('hsl') || cssValue.startsWith('#')) {
      return cssValue;
    }
    
    // Fallback: usar a variável CSS diretamente no canvas
    // Canvas aceita cores CSS incluindo variáveis
    return cssValue || '#000000';
  };

  // Função para desenhar o vinil
  const drawVinylRecord = (
    ctx: CanvasRenderingContext2D,
    currentRotation: number,
    primaryColor: string,
    cardColor: string,
    mutedColor: string
  ) => {
    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate(currentRotation);

    // 1. Círculo base do vinil (usa primary desbotado)
    ctx.fillStyle = primaryColor;
    ctx.globalAlpha = 0.3; // Desbotar para 30% de opacidade
    ctx.beginPath();
    ctx.arc(0, 0, VINYL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0; // Reset

    // 2. Grooves (sulcos concêntricos)
    ctx.strokeStyle = mutedColor;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;

    GROOVES.forEach((radius) => {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.globalAlpha = 1.0;

    // 3. Marcadores de rotação (bolinhas que giram com o vinil)
    ctx.fillStyle = mutedColor; // Usar muted para ser mais ameno
    ctx.globalAlpha = 0.6; // 60% de opacidade para ficar discreto
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; // Sombra mais suave
    ctx.shadowBlur = 2;

    // Primeiro marcador no groove 2 (mais externo)
    ctx.beginPath();
    ctx.arc(GROOVES[2], 0, 2.5, 0, Math.PI * 2); // Reduzido de 3 para 2.5
    ctx.fill();

    // Segundo marcador no groove 0 (mais interno), em posição oposta
    ctx.beginPath();
    ctx.arc(-GROOVES[0], 0, 2.5, 0, Math.PI * 2); // Reduzido de 3 para 2.5
    ctx.fill();

    // Reset shadow e alpha
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;

    // 4. Label central (contra-rotacionar para ficar fixo)
    ctx.rotate(-currentRotation);

    ctx.fillStyle = cardColor;
    ctx.beginPath();
    ctx.arc(0, 0, LABEL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 5. Dot indicator pulsante no centro
    const pulseScale = 0.8 + Math.sin(Date.now() / 500) * 0.2;
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(0, 0, 4 * pulseScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Função para desenhar as barras de frequência (pulsando PARA DENTRO)
  const drawFrequencyBars = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, accentColor: string) => {
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

      // Usar a cor do accent com opacity baseada na amplitude
      const opacity = 0.3 + (value / 255) * 0.7;
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = opacity;

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

      // Atualizar rotação (33.33 RPM = sentido horário) - apenas se está tocando
      if (isPlaying) {
        const rotationSpeed = (RPM / 60) * Math.PI * 2; // radianos/segundo
        currentRotation += rotationSpeed * deltaTime;
      }

      // Ler cores do tema CSS
      const primaryColor = getCSSColor('--primary');
      const bgColor = getCSSColor('--background');
      const cardColor = getCSSColor('--card');
      const mutedColor = getCSSColor('--muted-foreground');
      const accentColor = getCSSColor('--accent');

      // Limpar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fundo (usa background color)
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Desenhar vinil (com rotação)
      drawVinylRecord(ctx, currentRotation, primaryColor, cardColor, mutedColor);

      // Obter dados de frequência (se analyser existe)
      if (analyser && isPlaying) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        // Desenhar barras (sem rotação)
        drawFrequencyBars(ctx, dataArray, accentColor);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
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
  );
}

