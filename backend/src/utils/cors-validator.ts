/**
 * Validador de CORS para rede local
 *
 * Este módulo valida se uma origem é permitida baseado em:
 * - Localhost (127.0.0.1, localhost)
 * - IPs de rede local privada (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 * - Origens adicionais configuradas via ALLOWED_ORIGINS
 *
 * Requisições same-origin (sem header Origin) são sempre permitidas.
 */

import { createLogger } from './logger';

const logger = createLogger('CorsValidator');

/**
 * Padrões regex para validar IPs de rede local
 *
 * Redes privadas conforme RFC 1918:
 * - 10.0.0.0/8     (10.x.x.x)
 * - 172.16.0.0/12  (172.16.x.x - 172.31.x.x)
 * - 192.168.0.0/16 (192.168.x.x)
 * - localhost/loopback (127.x.x.x)
 */
const LOCAL_PATTERNS: RegExp[] = [
  // localhost e 127.0.0.1 (loopback)
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,

  // Rede privada classe C: 192.168.x.x
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,

  // Rede privada classe A: 10.x.x.x
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,

  // Rede privada classe B: 172.16.x.x - 172.31.x.x
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
];

/**
 * Cache das origens adicionais configuradas via env
 * Inicializado na primeira chamada para evitar parsing repetido
 */
let allowedOriginsCache: string[] | null = null;

/**
 * Obtém a lista de origens adicionais permitidas via variável de ambiente
 * Formato: "http://example.com,https://another.com"
 *
 * @returns Lista de origens adicionais permitidas
 */
function getAllowedOrigins(): string[] {
  if (allowedOriginsCache === null) {
    const envOrigins = process.env.ALLOWED_ORIGINS;
    if (envOrigins) {
      allowedOriginsCache = envOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

      if (allowedOriginsCache.length > 0) {
        logger.info('Origens adicionais configuradas', {
          origins: allowedOriginsCache,
        });
      }
    } else {
      allowedOriginsCache = [];
    }
  }
  return allowedOriginsCache;
}

/**
 * Verifica se uma origem é de rede local
 *
 * @param origin - Valor do header Origin da requisição
 * @returns true se origem é local, false caso contrário
 */
function matchesLocalPattern(origin: string): boolean {
  return LOCAL_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * Verifica se uma origem está na lista de origens adicionais permitidas
 *
 * @param origin - Valor do header Origin da requisição
 * @returns true se origem está na lista permitida
 */
function matchesAllowedOrigins(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

/**
 * Valida se uma origem é permitida pelo CORS
 *
 * Regras de validação:
 * 1. Requisições same-origin (sem Origin header) são sempre permitidas
 * 2. Localhost e 127.0.0.1 são sempre permitidos
 * 3. IPs de rede local privada são permitidos
 * 4. Origens configuradas em ALLOWED_ORIGINS são permitidas
 *
 * @param origin - Valor do header Origin da requisição (undefined para same-origin)
 * @returns true se origem é permitida, false caso contrário
 *
 * @example
 * isLocalOrigin(undefined)                    // true (same-origin)
 * isLocalOrigin('http://localhost:3000')      // true
 * isLocalOrigin('http://192.168.1.100:8080')  // true
 * isLocalOrigin('https://evil.com')           // false
 */
export function isLocalOrigin(origin: string | undefined): boolean {
  // Requisições same-origin não têm header Origin (undefined)
  // String vazia não é um valor válido de Origin, deve ser bloqueada
  if (origin === undefined) {
    return true;
  }

  if (origin === '') {
    return false;
  }

  // Verificar padrões de rede local
  if (matchesLocalPattern(origin)) {
    return true;
  }

  // Verificar lista de origens adicionais
  if (matchesAllowedOrigins(origin)) {
    return true;
  }

  // Origem não permitida - logar para auditoria
  logger.warn('Origem CORS bloqueada', { origin });
  return false;
}

/**
 * Reseta o cache de origens permitidas
 * Útil para testes ou quando ALLOWED_ORIGINS muda em runtime
 */
export function resetAllowedOriginsCache(): void {
  allowedOriginsCache = null;
}

/**
 * Callback de validação de origem para o middleware CORS
 *
 * Implementa a interface esperada pelo pacote cors:
 * (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void
 *
 * @param origin - Valor do header Origin
 * @param callback - Callback para informar se origem é permitida
 */
export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (isLocalOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Origem não permitida pelo CORS'));
  }
}
