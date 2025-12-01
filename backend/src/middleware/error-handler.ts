/**
 * Middleware global de tratamento de erros Express
 *
 * Este middleware captura todos os erros síncronos e assíncronos,
 * loga via Winston e retorna respostas padronizadas em português BR.
 *
 * IMPORTANTE: Deve ser registrado como o ÚLTIMO middleware em index.ts
 *
 * Formato de resposta padrão:
 * {
 *   error: {
 *     message: string,    // Mensagem user-friendly em português BR
 *     code?: string,      // Código de erro opcional (ex: "SESSION_NOT_FOUND")
 *     details?: unknown   // Detalhes adicionais (apenas em desenvolvimento)
 *   }
 * }
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('ErrorHandler');

/**
 * Classe base para erros da aplicação
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erros de validação (400 Bad Request)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Recurso não encontrado (404 Not Found)
 */
export class NotFoundError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 404, code || 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Serviço indisponível (503 Service Unavailable)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(message, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Interface para resposta de erro padronizada
 */
interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Determina se deve expor detalhes do erro (apenas em desenvolvimento)
 */
function shouldExposeDetails(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Mapeia mensagens de erro comuns para português BR
 */
function getPortugueseMessage(error: Error): string {
  const message = error.message.toLowerCase();

  // Mapeamentos comuns
  if (message.includes('not found')) return 'Recurso não encontrado';
  if (message.includes('invalid') || message.includes('validation')) return 'Dados inválidos';
  if (message.includes('unauthorized')) return 'Não autorizado';
  if (message.includes('forbidden')) return 'Acesso negado';
  if (message.includes('timeout')) return 'Tempo limite excedido';
  if (message.includes('connection')) return 'Erro de conexão';

  // Se já está em português ou não tem mapeamento, retorna original
  return error.message;
}

/**
 * Middleware principal de tratamento de erros
 *
 * Captura todos os erros lançados nos handlers de rota
 * e retorna resposta padronizada.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Log do erro com contexto
  logger.error('Erro na requisição', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: shouldExposeDetails() ? err.stack : undefined,
  });

  // Determinar status code
  let statusCode = 500;
  let errorCode: string | undefined;
  let details: unknown;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    details = err.details;
  } else if (err.name === 'SyntaxError') {
    // JSON parse error
    statusCode = 400;
    errorCode = 'INVALID_JSON';
  }

  // Construir resposta
  const errorObj: ErrorResponse['error'] = {
    message: err instanceof AppError ? err.message : getPortugueseMessage(err),
  };

  if (errorCode) {
    errorObj.code = errorCode;
  }

  if (shouldExposeDetails() && details !== undefined) {
    errorObj.details = details;
  }

  const response: ErrorResponse = { error: errorObj };

  // Em produção, erros internos não expõem a mensagem original
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    response.error.message = 'Erro interno do servidor';
  }

  res.status(statusCode).json(response);
}

/**
 * Middleware para rotas não encontradas (404)
 *
 * Deve ser registrado ANTES do errorHandler
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn('Rota não encontrada', {
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    error: {
      message: 'Rota não encontrada',
      code: 'ROUTE_NOT_FOUND',
    },
  });
}

/**
 * Wrapper para handlers async que captura erros automaticamente
 *
 * Uso:
 *   router.get('/rota', asyncHandler(async (req, res) => {
 *     // código que pode lançar erro
 *   }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default errorHandler;
