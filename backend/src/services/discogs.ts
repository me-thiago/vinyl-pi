/**
 * Discogs API Service
 *
 * Integração com a API do Discogs para busca e importação de metadados de álbuns.
 *
 * Features:
 * - Busca por número de catálogo ou barcode
 * - Busca por release ID direto
 * - Throttling respeitando rate limit (60 req/min)
 * - Timeout de 10s por request
 * - Mapeamento de formatos para enum AlbumFormat
 *
 * @see https://www.discogs.com/developers/
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('DiscogsService');

// ============================================
// Types
// ============================================

/**
 * Resultado de busca do Discogs
 */
export interface DiscogsSearchResult {
  id: number;
  title: string;
  year: string;
  country: string;
  format: string[];
  label: string[];
  genre: string[];
  style: string[];
  thumb: string;
  cover_image: string;
  resource_url: string;
  type: 'release' | 'master' | 'artist' | 'label';
}

/**
 * Resposta de busca do Discogs
 */
interface DiscogsSearchResponse {
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    items: number;
  };
  results: DiscogsSearchResult[];
}

/**
 * Item da coleção do Discogs (versão simplificada)
 */
interface DiscogsCollectionItem {
  id: number;
  instance_id: number;
  folder_id: number;
  rating: number;
  basic_information: {
    id: number;
    title: string;
    year: number;
    resource_url: string;
    thumb: string;
    cover_image: string;
    formats: DiscogsFormat[];
    labels: { name: string; catno: string; id: number }[];
    artists: { name: string; id: number }[];
    genres: string[];
    styles: string[];
  };
}

/**
 * Resposta da API de coleção do Discogs
 */
interface DiscogsCollectionResponse {
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    items: number;
  };
  releases: DiscogsCollectionItem[];
}

/**
 * Artista de um release
 */
interface DiscogsArtist {
  name: string;
  anv: string; // Artist Name Variation
  join: string;
  role: string;
  id: number;
}

/**
 * Label de um release
 */
interface DiscogsLabel {
  name: string;
  catno: string;
  entity_type: string;
  id: number;
}

/**
 * Formato de um release
 */
interface DiscogsFormat {
  name: string;
  qty: string;
  descriptions?: string[];
}

/**
 * Imagem de um release
 */
interface DiscogsImage {
  type: 'primary' | 'secondary';
  uri: string;
  resource_url: string;
  uri150: string;
  width: number;
  height: number;
}

/**
 * Release completo do Discogs
 */
export interface DiscogsRelease {
  id: number;
  title: string;
  artists: DiscogsArtist[];
  year: number;
  labels: DiscogsLabel[];
  formats: DiscogsFormat[];
  images?: DiscogsImage[];
  genres: string[];
  styles: string[];
  country: string;
  notes?: string;
  uri: string;
}

/**
 * Álbum formatado para criação no banco
 */
export interface DiscogsAlbumData {
  title: string;
  artist: string;
  year: number | null;
  label: string | null;
  format: string | null;
  coverUrl: string | null;
  discogsId: number;
  discogsUrl: string;
}

/**
 * Opções de busca
 */
export interface DiscogsSearchOptions {
  catalogNumber?: string;
  barcode?: string;
  releaseId?: number;
}

// ============================================
// Constants
// ============================================

const DISCOGS_API_BASE = 'https://api.discogs.com';
const REQUEST_TIMEOUT = 10000; // 10 segundos
const RATE_LIMIT_DELAY = 1100; // ~60 req/min = 1 req/segundo + margem

// Mapeamento de formatos Discogs → AlbumFormat enum
const FORMAT_MAPPING: Record<string, string> = {
  'LP': 'LP',
  'Album': 'LP',
  '12"': 'SINGLE_12',
  '7"': 'SINGLE_7',
  'EP': 'EP',
  '2xLP': 'DOUBLE_LP',
  '3xLP': 'DOUBLE_LP', // Tratamos 3xLP como DOUBLE_LP
  'Box Set': 'BOX_SET',
};

// ============================================
// State
// ============================================

let lastRequestTime = 0;

// ============================================
// Helpers
// ============================================

/**
 * Aguarda para respeitar rate limit do Discogs
 */
async function throttle(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
    logger.debug(`Throttling: aguardando ${waitTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Cria headers de autenticação para Discogs
 *
 * Suporta dois modos de autenticação:
 * 1. Personal Access Token (DISCOGS_TOKEN) - Recomendado para acesso à própria coleção
 * 2. Consumer Key/Secret - Para apps públicos
 *
 * @see https://www.discogs.com/settings/developers
 */
function getAuthHeaders(): Record<string, string> {
  const personalToken = process.env.DISCOGS_TOKEN;
  const consumerKey = process.env.DISCOGS_CONSUMER_KEY;
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET;

  // Priorizar Personal Access Token (melhor para acesso à própria coleção)
  if (personalToken) {
    return {
      'Authorization': `Discogs token=${personalToken}`,
      'User-Agent': 'VinylOS/2.0 +https://github.com/vinyl-os/vinyl-os',
      'Accept': 'application/json',
    };
  }

  // Fallback para Consumer Key/Secret
  if (!consumerKey || !consumerSecret) {
    throw new Error('DISCOGS_TOKEN ou (DISCOGS_CONSUMER_KEY + DISCOGS_CONSUMER_SECRET) são obrigatórios');
  }

  return {
    'Authorization': `Discogs key=${consumerKey}, secret=${consumerSecret}`,
    'User-Agent': 'VinylOS/2.0 +https://github.com/vinyl-os/vinyl-os',
    'Accept': 'application/json',
  };
}

/**
 * Faz request para API do Discogs com timeout e throttling
 */
async function discogsRequest<T>(endpoint: string): Promise<T> {
  await throttle();

  const url = `${DISCOGS_API_BASE}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    logger.debug(`Request: ${url}`);

    const response = await fetch(url, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new DiscogsNotFoundError('Release não encontrado no Discogs');
      }
      if (response.status === 429) {
        throw new DiscogsRateLimitError('Rate limit do Discogs excedido');
      }
      throw new Error(`Discogs API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new DiscogsTimeoutError('Timeout na requisição ao Discogs');
    }

    throw error;
  }
}

/**
 * Extrai o artista principal de um release
 */
function extractArtist(artists: DiscogsArtist[]): string {
  if (!artists || artists.length === 0) {
    return 'Unknown Artist';
  }

  // Usar ANV (Artist Name Variation) se disponível, senão nome original
  const mainArtist = artists[0];
  let name = mainArtist.anv || mainArtist.name;

  // Remover sufixos numéricos do Discogs (ex: "The Beatles (2)")
  name = name.replace(/\s*\(\d+\)$/, '');

  // Se múltiplos artistas, juntar com separador
  if (artists.length > 1) {
    const names = artists.map((a) => (a.anv || a.name).replace(/\s*\(\d+\)$/, ''));
    // Usar join fornecido pelo Discogs ou ", "
    name = names.join(artists[0].join || ', ');
  }

  return name;
}

/**
 * Extrai a label principal de um release
 */
function extractLabel(labels: DiscogsLabel[]): string | null {
  if (!labels || labels.length === 0) {
    return null;
  }

  // Usar primeira label
  let name = labels[0].name;

  // Remover sufixos numéricos
  name = name.replace(/\s*\(\d+\)$/, '');

  return name;
}

/**
 * Mapeia formato Discogs para enum AlbumFormat
 */
function mapFormat(formats: DiscogsFormat[]): string | null {
  if (!formats || formats.length === 0) {
    return null;
  }

  const format = formats[0];
  const qty = parseInt(format.qty, 10) || 1;

  // Verificar 2xLP, 3xLP
  if (format.name === 'Vinyl' && qty >= 2) {
    return 'DOUBLE_LP';
  }

  // Verificar descrições para mais detalhes
  const descriptions = format.descriptions || [];
  for (const desc of descriptions) {
    if (FORMAT_MAPPING[desc]) {
      return FORMAT_MAPPING[desc];
    }
  }

  // Mapear nome principal
  if (FORMAT_MAPPING[format.name]) {
    return FORMAT_MAPPING[format.name];
  }

  // Default para Vinyl
  if (format.name === 'Vinyl') {
    return 'LP';
  }

  return null;
}

/**
 * Extrai URL da capa de maior resolução
 */
function extractCoverUrl(images?: DiscogsImage[]): string | null {
  if (!images || images.length === 0) {
    return null;
  }

  // Priorizar imagem primary
  const primary = images.find((img) => img.type === 'primary');
  if (primary) {
    return primary.uri;
  }

  // Fallback para primeira imagem
  return images[0].uri;
}

// ============================================
// Errors
// ============================================

export class DiscogsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscogsError';
  }
}

export class DiscogsNotFoundError extends DiscogsError {
  constructor(message: string = 'Release não encontrado') {
    super(message);
    this.name = 'DiscogsNotFoundError';
  }
}

export class DiscogsRateLimitError extends DiscogsError {
  constructor(message: string = 'Rate limit excedido') {
    super(message);
    this.name = 'DiscogsRateLimitError';
  }
}

export class DiscogsTimeoutError extends DiscogsError {
  constructor(message: string = 'Timeout na requisição') {
    super(message);
    this.name = 'DiscogsTimeoutError';
  }
}

export class DiscogsConfigError extends DiscogsError {
  constructor(message: string = 'Configuração do Discogs inválida') {
    super(message);
    this.name = 'DiscogsConfigError';
  }
}

// ============================================
// Service Functions
// ============================================

/**
 * Busca releases no Discogs por catálogo ou barcode
 *
 * @param options - Opções de busca (catalogNumber ou barcode)
 * @returns Lista de resultados de busca
 */
export async function searchReleases(
  options: Omit<DiscogsSearchOptions, 'releaseId'>
): Promise<DiscogsSearchResult[]> {
  const { catalogNumber, barcode } = options;

  if (!catalogNumber && !barcode) {
    throw new Error('catalogNumber ou barcode é obrigatório');
  }

  // Construir query
  const params = new URLSearchParams();
  params.set('type', 'release');
  params.set('per_page', '10');

  if (catalogNumber) {
    params.set('catno', catalogNumber);
  }

  if (barcode) {
    params.set('barcode', barcode);
  }

  const endpoint = `/database/search?${params.toString()}`;

  try {
    const response = await discogsRequest<DiscogsSearchResponse>(endpoint);
    logger.info(`Busca Discogs: ${response.pagination.items} resultados`, {
      catalogNumber,
      barcode,
    });
    return response.results;
  } catch (error) {
    if (error instanceof DiscogsError) {
      throw error;
    }
    logger.error('Erro na busca Discogs', { error, catalogNumber, barcode });
    throw new DiscogsError(`Erro ao buscar no Discogs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Busca um release específico por ID
 *
 * @param releaseId - ID do release no Discogs
 * @returns Release completo
 */
export async function getRelease(releaseId: number): Promise<DiscogsRelease> {
  const endpoint = `/releases/${releaseId}`;

  try {
    const release = await discogsRequest<DiscogsRelease>(endpoint);
    logger.info(`Release obtido: ${release.title}`, { releaseId });
    return release;
  } catch (error) {
    if (error instanceof DiscogsError) {
      throw error;
    }
    logger.error('Erro ao obter release', { error, releaseId });
    throw new DiscogsError(`Erro ao obter release: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Converte um release Discogs para dados de álbum
 *
 * @param release - Release do Discogs
 * @returns Dados formatados para criação de álbum
 */
export function releaseToAlbumData(release: DiscogsRelease): DiscogsAlbumData {
  return {
    title: release.title,
    artist: extractArtist(release.artists),
    year: release.year || null,
    label: extractLabel(release.labels),
    format: mapFormat(release.formats),
    coverUrl: extractCoverUrl(release.images),
    discogsId: release.id,
    discogsUrl: release.uri,
  };
}

/**
 * Busca e retorna dados de álbum prontos para importação
 *
 * @param options - Opções de busca
 * @returns Dados de álbum ou lista de resultados para seleção
 */
export async function importAlbum(
  options: DiscogsSearchOptions
): Promise<{ album: DiscogsAlbumData } | { results: DiscogsSearchResult[] }> {
  // Se releaseId fornecido, buscar diretamente
  if (options.releaseId) {
    const release = await getRelease(options.releaseId);
    return { album: releaseToAlbumData(release) };
  }

  // Buscar por catálogo/barcode
  const results = await searchReleases(options);

  if (results.length === 0) {
    throw new DiscogsNotFoundError('Nenhum resultado encontrado');
  }

  // Se único resultado, importar automaticamente
  if (results.length === 1) {
    const release = await getRelease(results[0].id);
    return { album: releaseToAlbumData(release) };
  }

  // Múltiplos resultados - retornar lista para seleção
  return { results };
}

/**
 * Verifica se as credenciais do Discogs estão configuradas
 * Aceita Personal Token OU Consumer Key/Secret
 */
export function isConfigured(): boolean {
  const hasToken = !!process.env.DISCOGS_TOKEN;
  const hasConsumerAuth = !!(process.env.DISCOGS_CONSUMER_KEY && process.env.DISCOGS_CONSUMER_SECRET);
  return hasToken || hasConsumerAuth;
}

/**
 * Verifica se o username do Discogs está configurado
 */
export function isUsernameConfigured(): boolean {
  return !!process.env.DISCOGS_USERNAME;
}

/**
 * Retorna o username configurado
 */
export function getConfiguredUsername(): string | null {
  return process.env.DISCOGS_USERNAME || null;
}

/**
 * Converte um item de coleção para dados de álbum
 * (versão simplificada sem buscar release completo)
 */
function collectionItemToAlbumData(item: DiscogsCollectionItem): DiscogsAlbumData {
  const info = item.basic_information;

  // Extrair artista
  let artist = 'Unknown Artist';
  if (info.artists && info.artists.length > 0) {
    artist = info.artists.map((a) => a.name.replace(/\s*\(\d+\)$/, '')).join(', ');
  }

  // Extrair label
  let label: string | null = null;
  if (info.labels && info.labels.length > 0) {
    label = info.labels[0].name.replace(/\s*\(\d+\)$/, '');
  }

  // Mapear formato
  const format = mapFormat(info.formats);

  return {
    title: info.title,
    artist,
    year: info.year || null,
    label,
    format,
    coverUrl: info.cover_image || info.thumb || null,
    discogsId: info.id,
    discogsUrl: `https://www.discogs.com/release/${info.id}`,
  };
}

/**
 * Busca todos os releases da coleção de um usuário
 *
 * @param username - Nome de usuário do Discogs
 * @returns Lista de álbuns formatados para criação
 */
export async function getCollectionReleases(username: string): Promise<DiscogsAlbumData[]> {
  const albums: DiscogsAlbumData[] = [];
  let page = 1;
  let hasMore = true;

  logger.info(`Iniciando importação da coleção do usuário: ${username}`);

  while (hasMore) {
    const endpoint = `/users/${encodeURIComponent(username)}/collection/folders/0/releases?page=${page}&per_page=100`;

    try {
      const response = await discogsRequest<DiscogsCollectionResponse>(endpoint);

      logger.info(`Página ${page}/${response.pagination.pages}: ${response.releases.length} releases`);

      for (const item of response.releases) {
        const albumData = collectionItemToAlbumData(item);
        albums.push(albumData);
      }

      hasMore = page < response.pagination.pages;
      page++;
    } catch (error) {
      if (error instanceof DiscogsNotFoundError) {
        throw new DiscogsNotFoundError(`Usuário '${username}' não encontrado ou coleção privada`);
      }
      throw error;
    }
  }

  logger.info(`Importação concluída: ${albums.length} álbuns encontrados`);
  return albums;
}
