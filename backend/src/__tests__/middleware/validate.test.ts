/**
 * Testes unitários para Validate Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, validateMultiple } from '../../middleware/validate';

// Mock do logger para evitar output nos testes
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('validate middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: {},
      query: {},
      params: {},
      path: '/test',
      method: 'POST',
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();
  });

  describe('validação de body', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    });

    it('deve chamar next() quando body é válido', () => {
      mockReq.body = { name: 'João', age: 25 };

      const middleware = validate(testSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('deve retornar 400 quando body é inválido', () => {
      mockReq.body = { name: '', age: -5 };

      const middleware = validate(testSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Dados de entrada inválidos',
            code: 'VALIDATION_ERROR',
            details: expect.any(Array),
          }),
        })
      );
    });

    it('deve incluir campo e mensagem nos detalhes de erro', () => {
      mockReq.body = { name: 'João', age: 'não é número' };

      const middleware = validate(testSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const call = jsonMock.mock.calls[0][0];
      expect(call.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            campo: expect.any(String),
            mensagem: expect.any(String),
          }),
        ])
      );
    });

    it('deve substituir body pelos dados validados', () => {
      mockReq.body = { name: 'João', age: 25 };

      const middleware = validate(testSchema, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body).toEqual({ name: 'João', age: 25 });
    });
  });

  describe('validação de query', () => {
    const querySchema = z.object({
      limit: z.coerce.number().min(1).optional(),
      offset: z.coerce.number().min(0).optional(),
    });

    it('deve converter strings para números (coerce)', () => {
      mockReq.query = { limit: '10', offset: '20' };

      const middleware = validate(querySchema, 'query');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({ limit: 10, offset: 20 });
    });

    it('deve aceitar query vazia quando campos são opcionais', () => {
      mockReq.query = {};

      const middleware = validate(querySchema, 'query');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validação de params', () => {
    const paramsSchema = z.object({
      id: z.string().min(1),
    });

    it('deve validar params corretamente', () => {
      mockReq.params = { id: '123' };

      const middleware = validate(paramsSchema, 'params');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('deve rejeitar param vazio', () => {
      mockReq.params = { id: '' };

      const middleware = validate(paramsSchema, 'params');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('default source', () => {
    it('deve usar body como source padrão', () => {
      const bodySchema = z.object({
        test: z.string(),
      });

      mockReq.body = { test: 'value' };

      const middleware = validate(bodySchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('validateMultiple middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: {},
      query: {},
      params: {},
      path: '/test',
      method: 'GET',
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();
  });

  it('deve validar múltiplas fontes', () => {
    const paramsSchema = z.object({ id: z.string() });
    const querySchema = z.object({ limit: z.coerce.number().optional() });

    mockReq.params = { id: '123' };
    mockReq.query = { limit: '10' };

    const middleware = validateMultiple([
      { schema: paramsSchema, source: 'params' },
      { schema: querySchema, source: 'query' },
    ]);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.query).toEqual({ limit: 10 });
  });

  it('deve agregar erros de múltiplas fontes', () => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const querySchema = z.object({ limit: z.coerce.number().min(1) });

    mockReq.params = { id: '' };
    mockReq.query = { limit: '0' };

    const middleware = validateMultiple([
      { schema: paramsSchema, source: 'params' },
      { schema: querySchema, source: 'query' },
    ]);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);

    const call = jsonMock.mock.calls[0][0];
    expect(call.error.details.length).toBeGreaterThanOrEqual(2);
  });
});
