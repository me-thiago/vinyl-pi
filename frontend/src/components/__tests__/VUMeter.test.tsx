import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VUMeter, VUMeterCompact } from '../vu-meter';

const defaultConfig = {
  minDb: -80,
  maxDb: 0,
  silenceThreshold: -50,
  clippingThreshold: -3,
};

describe('VUMeter', () => {
  describe('renderização básica', () => {
    it('deve renderizar o componente', () => {
      render(<VUMeter levelDb={-20} config={defaultConfig} />);
      expect(screen.getByText('-20.0 dB')).toBeInTheDocument();
    });

    it('deve mostrar "--" quando levelDb é null', () => {
      render(<VUMeter levelDb={null} config={defaultConfig} />);
      expect(screen.getByText('-- dB')).toBeInTheDocument();
    });

    it('deve mostrar o valor de dB formatado com uma casa decimal', () => {
      render(<VUMeter levelDb={-15.678} config={defaultConfig} />);
      expect(screen.getByText('-15.7 dB')).toBeInTheDocument();
    });

    it('deve renderizar com showScale=true por padrão', () => {
      render(<VUMeter levelDb={-20} config={defaultConfig} />);
      // Escala mostra maxDb no canto
      expect(screen.getByText('0 dB')).toBeInTheDocument();
    });

    it('deve ocultar escala quando showScale=false', () => {
      render(<VUMeter levelDb={-20} config={defaultConfig} showScale={false} />);
      // Não deve ter os marcadores de escala além do valor atual
      const dbTexts = screen.queryAllByText(/-\d+ dB$/);
      // Só deve ter o valor atual
      expect(dbTexts.length).toBeLessThanOrEqual(1);
    });
  });

  describe('indicadores visuais', () => {
    it('deve mostrar legenda de silêncio com threshold correto', () => {
      render(<VUMeter levelDb={-20} config={defaultConfig} />);
      expect(screen.getByText(`Silêncio (${defaultConfig.silenceThreshold}dB)`)).toBeInTheDocument();
    });

    it('deve mostrar legenda de clipping com threshold correto', () => {
      render(<VUMeter levelDb={-20} config={defaultConfig} />);
      expect(screen.getByText(`Clipping (${defaultConfig.clippingThreshold}dB)`)).toBeInTheDocument();
    });

    it('deve mostrar legenda Normal', () => {
      render(<VUMeter levelDb={-20} config={defaultConfig} />);
      expect(screen.getByText('Normal')).toBeInTheDocument();
    });
  });

  describe('orientação', () => {
    it('deve renderizar na orientação horizontal por padrão', () => {
      const { container } = render(<VUMeter levelDb={-20} config={defaultConfig} />);
      const meterContainer = container.querySelector('.h-8');
      expect(meterContainer).toBeInTheDocument();
    });

    it('deve renderizar na orientação vertical quando especificado', () => {
      const { container } = render(
        <VUMeter levelDb={-20} config={defaultConfig} orientation="vertical" />
      );
      const meterContainer = container.querySelector('.h-48');
      expect(meterContainer).toBeInTheDocument();
    });
  });

  describe('className personalizada', () => {
    it('deve aplicar className adicional', () => {
      const { container } = render(
        <VUMeter levelDb={-20} config={defaultConfig} className="custom-class" />
      );
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('cores baseadas no nível', () => {
    it('deve usar cor muted quando levelDb é null', () => {
      const { container } = render(<VUMeter levelDb={null} config={defaultConfig} />);
      const levelBar = container.querySelector('.bg-muted');
      expect(levelBar).toBeInTheDocument();
    });

    it('deve usar cor verde para nível normal', () => {
      const { container } = render(<VUMeter levelDb={-20} config={defaultConfig} />);
      const levelBar = container.querySelector('.bg-green-500');
      expect(levelBar).toBeInTheDocument();
    });

    it('deve usar cor amarela para nível de silêncio', () => {
      const { container } = render(
        <VUMeter levelDb={-60} config={defaultConfig} />
      );
      const levelBar = container.querySelector('.bg-yellow-500');
      expect(levelBar).toBeInTheDocument();
    });

    it('deve usar cor vermelha para nível de clipping', () => {
      const { container } = render(
        <VUMeter levelDb={-2} config={defaultConfig} />
      );
      const levelBar = container.querySelector('.bg-destructive');
      expect(levelBar).toBeInTheDocument();
    });
  });

  describe('marcadores de escala', () => {
    it('deve gerar marcadores de escala em intervalos de 20', () => {
      render(<VUMeter levelDb={-20} config={defaultConfig} showScale />);

      // Escala vai de -80 a 0, com step 20: -80, -60, -40, -20, 0
      expect(screen.getByText('-80')).toBeInTheDocument();
      expect(screen.getByText('-60')).toBeInTheDocument();
      expect(screen.getByText('-40')).toBeInTheDocument();
      expect(screen.getByText('-20', { selector: '.relative span' })).toBeInTheDocument();
    });
  });

  describe('normalização de valores', () => {
    it('deve lidar com valores extremos (abaixo do mínimo)', () => {
      const { container } = render(
        <VUMeter levelDb={-100} config={defaultConfig} />
      );
      // A barra deve ter width 0% quando abaixo do mínimo
      const levelBar = container.querySelector('[style*="width"]');
      expect(levelBar).toHaveStyle({ width: '0%' });
    });

    it('deve lidar com valores extremos (acima do máximo)', () => {
      const { container } = render(
        <VUMeter levelDb={10} config={defaultConfig} />
      );
      // A barra deve ter width 100% quando acima do máximo
      const levelBar = container.querySelector('[style*="width"]');
      expect(levelBar).toHaveStyle({ width: '100%' });
    });

    it('deve normalizar corretamente um valor intermediário', () => {
      // -40 é exatamente no meio entre -80 e 0
      const { container } = render(
        <VUMeter levelDb={-40} config={defaultConfig} />
      );
      const levelBar = container.querySelector('[style*="width"]');
      expect(levelBar).toHaveStyle({ width: '50%' });
    });
  });

  describe('segmentos LED', () => {
    it('deve renderizar 20 segmentos LED', () => {
      const { container } = render(<VUMeter levelDb={-20} config={defaultConfig} />);
      const segments = container.querySelectorAll('.border-r');
      // Conta segmentos com border-r (LED segments)
      expect(segments.length).toBeGreaterThanOrEqual(20);
    });
  });
});

describe('VUMeterCompact', () => {
  it('deve renderizar o componente compacto', () => {
    render(
      <VUMeterCompact
        levelDb={-20}
        silenceThreshold={-50}
        clippingThreshold={-3}
      />
    );
    expect(screen.getByText('-20.0 dB')).toBeInTheDocument();
  });

  it('deve usar configuração padrão para min/max', () => {
    const { container } = render(
      <VUMeterCompact
        levelDb={-40}
        silenceThreshold={-50}
        clippingThreshold={-3}
      />
    );
    // -40 é 50% de -80 a 0
    const levelBar = container.querySelector('[style*="width"]');
    expect(levelBar).toHaveStyle({ width: '50%' });
  });

  it('deve ocultar a escala', () => {
    render(
      <VUMeterCompact
        levelDb={-20}
        silenceThreshold={-50}
        clippingThreshold={-3}
      />
    );
    // Não deve mostrar marcadores numéricos da escala
    expect(screen.queryByText('-80')).not.toBeInTheDocument();
    expect(screen.queryByText('-60')).not.toBeInTheDocument();
  });

  it('deve aceitar className personalizada', () => {
    const { container } = render(
      <VUMeterCompact
        levelDb={-20}
        silenceThreshold={-50}
        clippingThreshold={-3}
        className="compact-class"
      />
    );
    expect(container.querySelector('.compact-class')).toBeInTheDocument();
  });

  it('deve mostrar null quando levelDb é null', () => {
    render(
      <VUMeterCompact
        levelDb={null}
        silenceThreshold={-50}
        clippingThreshold={-3}
      />
    );
    expect(screen.getByText('-- dB')).toBeInTheDocument();
  });
});
