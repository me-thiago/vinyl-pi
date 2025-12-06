/**
 * Collection Matcher Service (V2-06)
 *
 * Serviço de fuzzy matching para validar reconhecimentos musicais
 * contra a coleção de álbuns do usuário.
 *
 * Utiliza algoritmo Levenshtein para calcular similaridade entre strings,
 * com pesos configuráveis para artista (60%) e álbum (40%).
 *
 * Thresholds:
 * - score >= 0.8: vinculação automática (needsConfirmation=false)
 * - 0.5 <= score < 0.8: confirmação necessária (needsConfirmation=true)
 * - score < 0.5: descartado (não retornado)
 */

import { distance } from 'fastest-levenshtein';
import prisma from '../prisma/client';
import { createLogger } from '../utils/logger';
import type { Album } from '@prisma/client';

const logger = createLogger('CollectionMatcher');

/**
 * Thresholds de confiança para matching
 */
export const THRESHOLDS = {
  /** Score mínimo para considerar como match */
  MIN_MATCH: 0.5,
  /** Score mínimo para vinculação automática (sem confirmação) */
  AUTO_LINK: 0.8,
  /** Máximo de matches a retornar */
  MAX_RESULTS: 5,
} as const;

/**
 * Pesos para cálculo do score combinado
 */
export const WEIGHTS = {
  /** Peso do match de artista */
  ARTIST: 0.6,
  /** Peso do match de álbum */
  ALBUM: 0.4,
} as const;

/**
 * Tipo de match encontrado
 */
export type MatchType = 'artist+album' | 'artist' | 'album';

/**
 * Resultado de um match de álbum
 */
export interface AlbumMatch {
  /** Álbum da coleção que fez match */
  album: Album;
  /** Score de confiança (0-1) */
  confidence: number;
  /** Tipo de match encontrado */
  matchedOn: MatchType;
  /** Se precisa confirmação do usuário */
  needsConfirmation: boolean;
}

/**
 * Input para busca de matches
 */
export interface TrackInput {
  /** Nome do artista retornado pelo reconhecimento */
  artist: string;
  /** Nome do álbum retornado pelo reconhecimento */
  album: string;
}

/**
 * Normaliza string para comparação
 *
 * - Converte para minúsculas
 * - Remove acentos
 * - Remove caracteres especiais
 * - Remove espaços extras
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ' ') // Remove pontuação
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
}

/**
 * Calcula similaridade entre duas strings usando Levenshtein
 *
 * @param a Primeira string
 * @param b Segunda string
 * @returns Score de similaridade (0-1)
 */
export function calculateSimilarity(a: string, b: string): number {
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);

  // Strings vazias
  if (!normalizedA && !normalizedB) return 1;
  if (!normalizedA || !normalizedB) return 0;

  // Strings idênticas
  if (normalizedA === normalizedB) return 1;

  // Calcular distância Levenshtein
  const dist = distance(normalizedA, normalizedB);
  const maxLen = Math.max(normalizedA.length, normalizedB.length);

  // Similaridade = 1 - (distância / comprimento máximo)
  return 1 - dist / maxLen;
}

/**
 * Determina o tipo de match baseado nos scores individuais
 */
function determineMatchType(artistScore: number, albumScore: number): MatchType {
  const artistMatched = artistScore >= THRESHOLDS.MIN_MATCH;
  const albumMatched = albumScore >= THRESHOLDS.MIN_MATCH;

  if (artistMatched && albumMatched) return 'artist+album';
  if (artistMatched) return 'artist';
  return 'album';
}

/**
 * Busca álbuns da coleção que fazem match com o track reconhecido
 *
 * @param track Dados do track reconhecido (artist, album)
 * @param threshold Threshold mínimo de confiança (default: 0.5)
 * @returns Lista de matches ordenados por confiança (máx 5)
 */
export async function findMatches(
  track: TrackInput,
  threshold: number = THRESHOLDS.MIN_MATCH
): Promise<AlbumMatch[]> {
  logger.info(`Buscando matches para: "${track.artist}" - "${track.album}"`);

  // Buscar álbuns não arquivados
  const albums = await prisma.album.findMany({
    where: { archived: false },
  });

  if (albums.length === 0) {
    logger.info('Nenhum álbum na coleção');
    return [];
  }

  logger.debug(`Comparando com ${albums.length} álbuns da coleção`);

  // Calcular scores para cada álbum
  const matches: AlbumMatch[] = [];

  for (const album of albums) {
    const artistScore = calculateSimilarity(track.artist, album.artist);
    const albumScore = calculateSimilarity(track.album || '', album.title);

    // Score combinado: 60% artista + 40% álbum
    const combinedScore = artistScore * WEIGHTS.ARTIST + albumScore * WEIGHTS.ALBUM;

    // Filtrar por threshold
    if (combinedScore >= threshold) {
      matches.push({
        album,
        confidence: combinedScore,
        matchedOn: determineMatchType(artistScore, albumScore),
        needsConfirmation: combinedScore < THRESHOLDS.AUTO_LINK,
      });
    }
  }

  // Ordenar por confiança (desc) e limitar resultados
  matches.sort((a, b) => b.confidence - a.confidence);
  const topMatches = matches.slice(0, THRESHOLDS.MAX_RESULTS);

  if (topMatches.length > 0) {
    logger.info(
      `Encontrados ${topMatches.length} matches. ` +
        `Melhor: "${topMatches[0].album.title}" (${(topMatches[0].confidence * 100).toFixed(1)}%)`
    );
  } else {
    logger.info('Nenhum match encontrado');
  }

  return topMatches;
}

/**
 * Busca o melhor match para vinculação automática
 *
 * Retorna o match apenas se score >= AUTO_LINK (0.8)
 *
 * @param track Dados do track reconhecido
 * @returns Melhor match ou null se nenhum atender threshold
 */
export async function findBestMatch(track: TrackInput): Promise<AlbumMatch | null> {
  const matches = await findMatches(track, THRESHOLDS.AUTO_LINK);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Formata AlbumMatch para resposta da API
 */
export function formatMatchForApi(match: AlbumMatch): {
  albumId: string;
  albumTitle: string;
  matchConfidence: number;
  needsConfirmation: boolean;
} {
  return {
    albumId: match.album.id,
    albumTitle: match.album.title,
    matchConfidence: match.confidence,
    needsConfirmation: match.needsConfirmation,
  };
}
