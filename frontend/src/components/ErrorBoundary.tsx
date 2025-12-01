import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/**
 * Props do ErrorBoundary
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * State do ErrorBoundary
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary - Captura erros de renderização React
 *
 * Envolva componentes com ErrorBoundary para capturar erros de renderização
 * e exibir uma UI de fallback amigável ao invés de crashar a aplicação.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <MeuComponente />
 *   </ErrorBoundary>
 *
 * Com fallback customizado:
 *   <ErrorBoundary fallback={<MinhaUIDeErro />}>
 *     <MeuComponente />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Atualiza state quando um erro é capturado durante renderização
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log do erro para debugging e potencial envio para serviço de monitoramento
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Log para console em desenvolvimento
    console.error('ErrorBoundary capturou um erro:', error);
    console.error('Stack de componentes:', errorInfo.componentStack);

    // TODO: Enviar para serviço de monitoramento de erros (Sentry, etc.)
    // if (process.env.NODE_ENV === 'production') {
    //   errorTrackingService.captureException(error, { extra: errorInfo });
    // }
  }

  /**
   * Recarrega a página para tentar recuperar do erro
   */
  handleReload = (): void => {
    window.location.reload();
  };

  /**
   * Tenta renderizar novamente limpando o estado de erro
   */
  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Se um fallback customizado foi fornecido, usa ele
      if (fallback) {
        return fallback;
      }

      // UI de fallback padrão
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Algo deu errado</CardTitle>
              <CardDescription>
                Ocorreu um erro inesperado na aplicação. Tente recarregar a página.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mostrar detalhes do erro em desenvolvimento */}
              {import.meta.env.DEV && error && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-mono text-muted-foreground break-all">
                    {error.message}
                  </p>
                  {errorInfo && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Stack de componentes
                      </summary>
                      <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-40">
                        {errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={this.handleRetry}
                >
                  Tentar novamente
                </Button>
                <Button
                  className="flex-1"
                  onClick={this.handleReload}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recarregar página
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
