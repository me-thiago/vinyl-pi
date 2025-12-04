import { useEffect, useRef } from 'react';

interface MiniVuMeterProps {
  analyser: AnalyserNode;
}

const BAR_COUNT = 72;
const BAR_WIDTH = 4;
const BAR_GAP = 2;
const MAX_HEIGHT = 24;

export function MiniVuMeter({ analyser }: MiniVuMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar canvas
    const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
    canvas.width = totalWidth;
    canvas.height = MAX_HEIGHT;

    // Criar data array uma vez (local ao effect)
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Ler cores do CSS
    const getCSSColor = (variable: string): string => {
      const rootStyles = getComputedStyle(document.documentElement);
      return rootStyles.getPropertyValue(variable).trim() || '#ffffff';
    };

    const animate = () => {
      if (!ctx) return;

      // Ler dados de frequência
      analyser.getByteFrequencyData(dataArray);

      // Limpar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cores do tema
      const primaryColor = getCSSColor('--primary');
      const accentColor = getCSSColor('--accent');

      // Desenhar barras
      for (let i = 0; i < BAR_COUNT; i++) {
        // Mapear índice da barra para frequência
        // Focar nas frequências mais baixas/médias (mais musicais)
        const dataIndex = Math.floor((i / BAR_COUNT) * (dataArray.length * 0.5));
        const value = dataArray[dataIndex];

        // Calcular altura (0 a MAX_HEIGHT)
        const height = (value / 255) * MAX_HEIGHT;
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = MAX_HEIGHT - height;

        // Gradiente de cor baseado na altura
        const intensity = value / 255;
        if (intensity > 0.7) {
          ctx.fillStyle = accentColor;
        } else {
          ctx.fillStyle = primaryColor;
        }

        ctx.globalAlpha = 0.4 + intensity * 0.6;
        ctx.fillRect(x, y, BAR_WIDTH, height);
      }

      ctx.globalAlpha = 1;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser]);

  const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

  return (
    <canvas
      ref={canvasRef}
      className="rounded"
      style={{
        width: totalWidth,
        height: MAX_HEIGHT,
      }}
    />
  );
}
