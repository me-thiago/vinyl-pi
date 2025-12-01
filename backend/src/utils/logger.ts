/**
 * Logger centralizado usando Winston
 *
 * Este módulo exporta uma instância singleton de logger configurada
 * para uso em toda a aplicação backend do Vinyl-OS.
 *
 * Uso:
 *   import { logger } from './utils/logger';
 *   logger.info('Mensagem informativa');
 *   logger.error('Erro ocorreu', { details: error.message });
 *   logger.warn('Aviso importante');
 *   logger.debug('Info para debug');
 *
 * Para criar logger com contexto específico:
 *   const log = createLogger('MeuServico');
 *   log.info('Iniciando serviço'); // [MeuServico] Iniciando serviço
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Diretório de logs relativo à raiz do projeto
const LOG_DIR = path.resolve(__dirname, '../../../logs');

// Formato personalizado para console (colorido em dev)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const svc = service ? `[${service}] ` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${svc}${message}${metaStr}`;
  })
);

// Formato para arquivo (JSON estruturado)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transporte para rotação diária de arquivos
const dailyRotateTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'vinyl-os-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
});

// Transporte específico para erros
const errorRotateTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'vinyl-os-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: fileFormat,
});

// Determinar nível de log baseado no ambiente
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

/**
 * Logger principal da aplicação
 */
export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'vinyl-os' },
  transports: [
    // Console com cores (desabilitado em produção se necessário)
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Arquivo com rotação diária
    dailyRotateTransport,
    // Arquivo separado só para erros
    errorRotateTransport,
  ],
});

/**
 * Cria um child logger com contexto de serviço específico
 *
 * @param serviceName - Nome do serviço/módulo para identificação nos logs
 * @returns Logger configurado com o serviço especificado
 *
 * @example
 * const log = createLogger('AudioManager');
 * log.info('Streaming iniciado');
 * // Output: 2025-11-30 14:00:00 info: [AudioManager] Streaming iniciado
 */
export function createLogger(serviceName: string): winston.Logger {
  return logger.child({ service: serviceName });
}

export default logger;
