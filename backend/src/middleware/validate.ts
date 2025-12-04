/**
 * Middleware de validação Zod
 *
 * Middleware genérico para validar body, query ou params usando schemas Zod.
 * Retorna erro 400 com mensagens em português BR quando validação falha.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('ValidateMiddleware');

/**
 * Tipos de fonte de dados para validação
 */
export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Interface para detalhes de erro de validação
 */
interface ValidationErrorDetail {
  campo: string;
  mensagem: string;
}

/**
 * Interface para resposta de erro de validação
 */
interface ValidationErrorResponse {
  error: {
    message: string;
    code: string;
    details: ValidationErrorDetail[];
  };
}

/**
 * Formata erros do Zod para resposta em português
 */
function formatZodErrors(error: z.ZodError): ValidationErrorDetail[] {
  return error.issues.map((issue) => ({
    campo: issue.path.join('.') || 'payload',
    mensagem: issue.message,
  }));
}

/**
 * Middleware factory para validação de dados
 *
 * @param schema - Schema Zod para validação
 * @param source - Fonte dos dados: 'body', 'query' ou 'params'
 * @returns Middleware Express
 *
 * @example
 * // Validar body
 * router.patch('/settings', validate(settingsSchema, 'body'), handler);
 *
 * // Validar query params
 * router.get('/sessions', validate(sessionsQuerySchema, 'query'), handler);
 *
 * // Validar route params
 * router.get('/sessions/:id', validate(sessionIdSchema, 'params'), handler);
 */
export function validate(
  schema: z.ZodSchema,
  source: ValidationSource = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[source];

    const result = schema.safeParse(data);

    if (!result.success) {
      const details = formatZodErrors(result.error);

      logger.warn('Validação falhou', {
        path: req.path,
        method: req.method,
        source,
        errors: details,
      });

      const response: ValidationErrorResponse = {
        error: {
          message: 'Dados de entrada inválidos',
          code: 'VALIDATION_ERROR',
          details,
        },
      };

      res.status(400).json(response);
      return;
    }

    // Substituir dados originais pelos validados/transformados
    // Isso garante que tipos coercidos (ex: string -> number) sejam aplicados
    req[source] = result.data;

    next();
  };
}

/**
 * Middleware para validar múltiplas fontes de dados
 *
 * @param validations - Array de { schema, source } para validar
 * @returns Middleware Express
 *
 * @example
 * router.get('/items/:id',
 *   validateMultiple([
 *     { schema: idParamSchema, source: 'params' },
 *     { schema: filterQuerySchema, source: 'query' }
 *   ]),
 *   handler
 * );
 */
export function validateMultiple(
  validations: Array<{ schema: z.ZodSchema; source: ValidationSource }>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allDetails: ValidationErrorDetail[] = [];

    for (const { schema, source } of validations) {
      const data = req[source];
      const result = schema.safeParse(data);

      if (!result.success) {
        const details = formatZodErrors(result.error);
        allDetails.push(
          ...details.map((d) => ({
            campo: source === 'body' ? d.campo : `${source}.${d.campo}`,
            mensagem: d.mensagem,
          }))
        );
      } else {
        req[source] = result.data;
      }
    }

    if (allDetails.length > 0) {
      logger.warn('Validação múltipla falhou', {
        path: req.path,
        method: req.method,
        errors: allDetails,
      });

      const response: ValidationErrorResponse = {
        error: {
          message: 'Dados de entrada inválidos',
          code: 'VALIDATION_ERROR',
          details: allDetails,
        },
      };

      res.status(400).json(response);
      return;
    }

    next();
  };
}

export default validate;
