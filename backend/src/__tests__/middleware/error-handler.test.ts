import { Request, Response, NextFunction } from 'express';
import {
  errorHandler,
  notFoundHandler,
  AppError,
  ValidationError,
  NotFoundError,
  ServiceUnavailableError,
  asyncHandler,
} from '../../middleware/error-handler';

// Mock do logger para evitar output nos testes
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('errorHandler', () => {
    it('deve retornar 500 para erros genéricos', () => {
      const error = new Error('Erro interno');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: expect.any(String),
        },
      });
    });

    it('deve retornar 400 para ValidationError', () => {
      const error = new ValidationError('Dados inválidos');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('deve retornar 404 para NotFoundError', () => {
      const error = new NotFoundError('Recurso não encontrado', 'RESOURCE_NOT_FOUND');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Recurso não encontrado',
          code: 'RESOURCE_NOT_FOUND',
        },
      });
    });

    it('deve retornar 503 para ServiceUnavailableError', () => {
      const error = new ServiceUnavailableError('Serviço indisponível');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Serviço indisponível',
          code: 'SERVICE_UNAVAILABLE',
        },
      });
    });

    it('deve retornar 400 para SyntaxError (JSON parse)', () => {
      const error = new SyntaxError('Unexpected token');
      error.name = 'SyntaxError';

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: expect.any(String),
          code: 'INVALID_JSON',
        },
      });
    });

    it('deve usar AppError customizado com status code', () => {
      const error = new AppError('Erro customizado', 418, 'CUSTOM_ERROR');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(418);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Erro customizado',
          code: 'CUSTOM_ERROR',
        },
      });
    });

    it('não deve expor stack trace em produção', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Erro interno');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Erro interno do servidor',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    it('deve retornar 404 para rotas não encontradas', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Rota não encontrada',
          code: 'ROUTE_NOT_FOUND',
        },
      });
    });
  });

  describe('asyncHandler', () => {
    it('deve capturar erros de funções async e passar para next', async () => {
      const error = new Error('Erro async');
      const asyncFn = jest.fn().mockRejectedValue(error);

      const handler = asyncHandler(asyncFn);
      handler(mockReq as Request, mockRes as Response, mockNext);

      // Aguardar promise ser rejeitada
      await new Promise(resolve => setImmediate(resolve));

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('deve permitir funções async que não lançam erro', async () => {
      const asyncFn = jest.fn().mockResolvedValue(undefined);

      const handler = asyncHandler(asyncFn);
      handler(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setImmediate(resolve));

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('AppError classes', () => {
    it('ValidationError deve ter status 400 e código correto', () => {
      const error = new ValidationError('Teste', { field: 'email' });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.name).toBe('ValidationError');
    });

    it('NotFoundError deve ter status 404', () => {
      const error = new NotFoundError('Não encontrado');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
    });

    it('ServiceUnavailableError deve ter status 503', () => {
      const error = new ServiceUnavailableError('Serviço offline');

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.name).toBe('ServiceUnavailableError');
    });
  });
});
