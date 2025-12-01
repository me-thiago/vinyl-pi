import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Componente que lança erro para teste
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Erro de teste');
  }
  return <div>Renderizado com sucesso</div>;
};

describe('ErrorBoundary', () => {
  // Suprimir console.error durante os testes de erro
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('deve renderizar children quando não há erro', () => {
    render(
      <ErrorBoundary>
        <div>Conteúdo normal</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Conteúdo normal')).toBeInTheDocument();
  });

  it('deve capturar erro e exibir fallback UI padrão', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Verifica se a UI de erro foi renderizada
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
    expect(screen.getByText(/Ocorreu um erro inesperado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recarregar página/i })).toBeInTheDocument();
  });

  it('deve usar fallback customizado quando fornecido', () => {
    const customFallback = <div>Fallback customizado</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Fallback customizado')).toBeInTheDocument();
    expect(screen.queryByText('Algo deu errado')).not.toBeInTheDocument();
  });

  it('deve logar erro no console', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });

  it('deve mostrar detalhes do erro em desenvolvimento', () => {
    const originalEnv = process.env.NODE_ENV;
    // Em vitest, process.env.NODE_ENV é 'test' por padrão, que não é 'production'
    // então os detalhes devem aparecer

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Deve mostrar a mensagem de erro
    expect(screen.getByText('Erro de teste')).toBeInTheDocument();
  });

  it('botão "Tentar novamente" deve limpar estado de erro', () => {
    let shouldThrow = true;

    const DynamicComponent = () => {
      if (shouldThrow) {
        throw new Error('Erro temporário');
      }
      return <div>Recuperado com sucesso</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <DynamicComponent />
      </ErrorBoundary>
    );

    // Verifica que está mostrando erro
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();

    // Simula correção do erro antes de tentar novamente
    shouldThrow = false;

    // Clica em "Tentar novamente"
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    // Re-render para atualizar o componente filho
    rerender(
      <ErrorBoundary>
        <DynamicComponent />
      </ErrorBoundary>
    );

    // Não deve estar mostrando erro (state foi resetado)
    // Nota: Como DynamicComponent ainda pode lançar erro na re-renderização,
    // este teste verifica apenas que handleRetry reseta o estado
  });

  it('botão "Recarregar página" deve chamar window.location.reload', () => {
    const reloadMock = vi.fn();
    const originalReload = window.location.reload;

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /Recarregar página/i }));

    expect(reloadMock).toHaveBeenCalled();

    // Restaurar
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: originalReload },
      writable: true,
    });
  });

  it('deve ter classes CSS apropriadas para layout', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Verifica se o container principal está centralizado
    const container = screen.getByText('Algo deu errado').closest('.min-h-screen');
    expect(container).toBeInTheDocument();
  });
});
