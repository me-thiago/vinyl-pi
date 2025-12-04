/**
 * Icecast Stats Service
 *
 * Consulta o endpoint de estatísticas do Icecast2 para obter
 * informações como número de listeners conectados.
 *
 * Características:
 * - Cache com TTL de 5 segundos para evitar queries excessivas
 * - Fallback para cache antigo quando Icecast não está acessível
 * - Timeout de 3 segundos para não bloquear requisições
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('IcecastStats');

/**
 * Estatísticas do Icecast
 */
export interface IcecastStats {
  /** Número de ouvintes conectados */
  listeners: number;
  /** Nome do mount point */
  source: string;
  /** Bitrate do stream */
  bitrate: number;
  /** Nome do servidor */
  serverName: string;
}

// Cache de estatísticas
let cachedStats: IcecastStats | null = null;
let lastFetch = 0;
const CACHE_TTL_MS = 5000; // 5 segundos

/**
 * Obtém estatísticas do Icecast2
 *
 * @returns Estatísticas ou null se não disponível
 */
export async function getIcecastStats(): Promise<IcecastStats | null> {
  const now = Date.now();

  // Retornar cache se ainda válido
  if (cachedStats && now - lastFetch < CACHE_TTL_MS) {
    return cachedStats;
  }

  const icecastHost = process.env.ICECAST_HOST || 'localhost';
  const icecastPort = process.env.ICECAST_PORT || '8000';
  const url = `http://${icecastHost}:${icecastPort}/status-json.xsl`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Icecast stats returned ${response.status}`);
    }

    const data = await response.json() as {
      icestats?: {
        host?: string;
        source?: {
          listeners?: number;
          server_name?: string;
          listenurl?: string;
          bitrate?: number;
        } | Array<{
          listeners?: number;
          server_name?: string;
          listenurl?: string;
          bitrate?: number;
        }>;
      };
    };
    const source = data.icestats?.source;

    // Icecast pode retornar source como array ou objeto único
    // Array quando há múltiplos mount points, objeto quando há apenas um
    const sourceData = Array.isArray(source) ? source[0] : source;

    // Se não há source, o stream não está ativo
    if (!sourceData) {
      cachedStats = {
        listeners: 0,
        source: '',
        bitrate: 0,
        serverName: data.icestats?.host || 'Vinyl-OS',
      };
    } else {
      cachedStats = {
        listeners: sourceData.listeners || 0,
        source: sourceData.server_name || sourceData.listenurl || '/stream',
        bitrate: sourceData.bitrate || 128,
        serverName: data.icestats?.host || 'Vinyl-OS',
      };
    }

    lastFetch = now;
    logger.debug(`Icecast stats: ${cachedStats.listeners} listeners`);

    return cachedStats;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Não logar erro se é apenas timeout/conexão recusada (Icecast pode estar offline)
    if (!errorMsg.includes('abort') && !errorMsg.includes('ECONNREFUSED')) {
      logger.warn(`Falha ao obter stats do Icecast: ${errorMsg}`);
    }

    // Retorna cache antigo se disponível, senão null
    return cachedStats;
  }
}

/**
 * Obtém apenas o número de listeners
 *
 * @returns Número de listeners ou 0 se não disponível
 */
export async function getListenerCount(): Promise<number> {
  const stats = await getIcecastStats();
  return stats?.listeners ?? 0;
}

/**
 * Limpa o cache (útil para testes)
 */
export function clearCache(): void {
  cachedStats = null;
  lastFetch = 0;
}
