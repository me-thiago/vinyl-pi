/**
 * Rate Limiter Middleware
 *
 * Protege as APIs contra abuso e ataques de negação de serviço (DoS).
 * Limita o número de requisições por IP em uma janela de tempo.
 *
 * Configuração via variáveis de ambiente:
 * - RATE_LIMIT_WINDOW_MS: Janela de tempo em ms (default: 60000 = 1 minuto)
 * - RATE_LIMIT_MAX: Máximo de requisições por janela (default: 100)
 *
 * Rotas excluídas (não limitadas):
 * - /stream* (streaming de áudio)
 * - /socket.io* (WebSocket)
 */

import rateLimit from 'express-rate-limit';
import { createLogger } from '../utils/logger';

const logger = createLogger('RateLimiter');

// Configuração via variáveis de ambiente
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);

logger.info(`Rate limiter configurado: ${maxRequests} req/${windowMs / 1000}s por IP`);

/**
 * Rate limiter para rotas de API
 *
 * Retorna status 429 (Too Many Requests) quando limite é excedido.
 * Inclui headers padrão RateLimit-* nas respostas.
 */
export const apiLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: {
    error: {
      message: 'Muitas requisições. Por favor, aguarde antes de tentar novamente.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true, // Retorna headers `RateLimit-*` (RFC 6585)
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*` legados
  skip: (req) => {
    // Não aplicar rate limit para streaming e WebSocket
    const skipPaths = ['/stream', '/socket.io'];
    return skipPaths.some((path) => req.path.startsWith(path));
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido para IP ${req.ip} em ${req.path}`);
    res.status(429).json(options.message);
  },
});

export default apiLimiter;
