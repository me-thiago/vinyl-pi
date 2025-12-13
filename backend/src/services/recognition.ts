/**
 * Recognition Service (V2-05, V2-06)
 *
 * Serviço de reconhecimento musical via AudD.
 * Captura samples de áudio do Ring Buffer e envia para identificação.
 *
 * Funcionalidades:
 * - Captura INSTANTÂNEA de sample do Ring Buffer (sem espera!)
 * - Conversão para WAV mono 44100Hz para API
 * - Integração AudD (API simples com key)
 * - Fail gracefully em caso de erro
 * - Persistência de Track no banco
 * - Emissão de evento track.recognized
 * - Fuzzy matching contra coleção de álbuns (V2-06)
 *
 * Arquitetura:
 * ALSA → FFmpeg #1 → FIFO2 → FFmpeg #3 → Ring Buffer (20s)
 *                                              ↓
 *                                    Recognition Service
 *                                              ↓
 *                                    WAV file → AudD
 */

import { spawn } from 'child_process';
import { createReadStream, unlink, existsSync, writeFileSync, statSync } from 'fs';
import { promisify } from 'util';
import axios from 'axios';
import FormData from 'form-data';
import prisma from '../prisma/client';
import { eventBus } from '../utils/event-bus';
import { createLogger } from '../utils/logger';
import { findMatches, THRESHOLDS } from './collection-matcher';
import type { AudioManager } from './audio-manager';
import type { RecognitionSource } from '@prisma/client';

const unlinkAsync = promisify(unlink);
const logger = createLogger('Recognition');

/**
 * Configuração do serviço de reconhecimento
 */
export interface RecognitionConfig {
  /** API Key do AudD */
  auddApiKey: string;
  /** Device ALSA para captura */
  audioDevice: string;
  /** Sample rate do device */
  sampleRate: number;
  /** Número de canais do device */
  channels: number;
  /** Timeout para API em ms */
  apiTimeout: number;
}

/**
 * Opções para reconhecimento
 */
export interface RecognizeOptions {
  /** Duração do sample em segundos (5-15) */
  sampleDuration: number;
  /** Trigger: manual ou automatic */
  trigger: 'manual' | 'automatic';
  /** ID da sessão ativa */
  sessionId: string;
  /** AudioManager para controlar o drain do FIFO */
  audioManager: AudioManager;
}

/**
 * Resultado de um match individual de álbum
 */
export interface AlbumMatchItem {
  albumId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  confidence: number;
}

/**
 * Resultado do matching de álbum (com todos os matches)
 */
export interface AlbumMatchResult {
  albumId: string;
  albumTitle: string;
  matchConfidence: number;
  needsConfirmation: boolean;
  /** Lista de todos os matches possíveis (até 5) */
  matches: AlbumMatchItem[];
}

/**
 * Resultado do reconhecimento
 */
export interface RecognitionResult {
  success: boolean;
  track?: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    albumArt: string | null;
    year: number | null;
    durationSeconds: number | null;
    confidence: number;
    source: RecognitionSource;
    albumMatch: AlbumMatchResult | null;
  };
  nextRecognitionIn?: number;
  error?: string;
  errorCode?: string;
}

/**
 * Response bruta do AudD
 */
interface AudDResponse {
  status: 'success' | 'error';
  result?: {
    title: string;
    artist: string;
    album?: string;
    release_date?: string;
    label?: string;
    timecode?: string;
    song_link?: string;
    spotify?: {
      album?: {
        images?: Array<{ url: string; width: number; height: number }>;
      };
    };
    apple_music?: {
      artwork?: {
        url?: string;
      };
    };
    deezer?: {
      album?: {
        cover_big?: string;
      };
    };
  } | null;
  error?: {
    error_code: number;
    error_message: string;
  };
}

/**
 * Erros específicos do Recognition
 */
export class RecognitionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RecognitionError';
  }
}

export class NoSessionError extends RecognitionError {
  constructor() {
    super('Nenhuma sessão ativa', 'NO_ACTIVE_SESSION');
  }
}

export class CaptureError extends RecognitionError {
  constructor(details?: string) {
    super('Falha ao capturar sample de áudio', 'CAPTURE_ERROR', details);
  }
}

export class AudDError extends RecognitionError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
    this.name = 'AudDError';
  }
}

export class NotConfiguredError extends RecognitionError {
  constructor() {
    super(
      'Reconhecimento musical não configurado. Configure AUDD_API_KEY.',
      'RECOGNITION_NOT_CONFIGURED'
    );
  }
}

// Legacy exports for compatibility
export { AudDError as ACRCloudError };

/**
 * Verifica se o serviço está configurado
 */
export function isConfigured(): boolean {
  return !!process.env.AUDD_API_KEY;
}

/**
 * Obtém configuração do ambiente
 */
function getConfig(): RecognitionConfig {
  if (!isConfigured()) {
    throw new NotConfiguredError();
  }

  return {
    auddApiKey: process.env.AUDD_API_KEY!,
    audioDevice: process.env.AUDIO_DEVICE || 'plughw:1,0',
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '48000'),
    channels: parseInt(process.env.AUDIO_CHANNELS || '2'),
    apiTimeout: 15000, // 15s timeout (AudD pode ser mais lento)
  };
}

/**
 * Captura sample de áudio do Ring Buffer (INSTANTÂNEO!)
 *
 * O Ring Buffer mantém os últimos 20 segundos de áudio continuamente.
 * Esta função lê do buffer e converte para WAV mono 44100Hz.
 *
 * @param durationSeconds Duração em segundos (max 20s)
 * @param audioManager AudioManager com o Ring Buffer
 * @param config Configuração do serviço
 * @returns Caminho do arquivo WAV temporário
 */
async function captureSample(
  durationSeconds: number,
  audioManager: AudioManager,
  config: RecognitionConfig
): Promise<string> {
  const tempPcmPath = `/tmp/recognition-sample-${Date.now()}.pcm`;
  const tempWavPath = `/tmp/recognition-sample-${Date.now()}.wav`;

  logger.info(`Captura do Ring Buffer: duration=${durationSeconds}s`);

  // Verificar se há áudio suficiente no buffer
  const availableSeconds = audioManager.getAvailableAudioSeconds();
  if (availableSeconds < durationSeconds) {
    logger.warn(`Buffer insuficiente: ${availableSeconds.toFixed(1)}s disponíveis, ${durationSeconds}s necessários`);

    // Se tiver pelo menos 3 segundos, usar o que tiver
    if (availableSeconds >= 3) {
      durationSeconds = Math.floor(availableSeconds);
      logger.info(`Usando ${durationSeconds}s disponíveis`);
    } else {
      throw new CaptureError(`Buffer insuficiente: apenas ${availableSeconds.toFixed(1)}s disponíveis`);
    }
  }

  // Captura INSTANTÂNEA do Ring Buffer
  const pcmData = audioManager.captureFromBuffer(durationSeconds);
  if (!pcmData) {
    throw new CaptureError('Falha ao ler do Ring Buffer');
  }

  logger.info(`Capturados ${pcmData.length} bytes (${(pcmData.length / 192000).toFixed(1)}s) do Ring Buffer`);

  // Salvar PCM temporário
  writeFileSync(tempPcmPath, pcmData);

  // Converter PCM para WAV mono 44100Hz usando FFmpeg
  return new Promise((resolve, reject) => {
    const args = [
      '-y', // Sobrescrever arquivo
      '-loglevel', 'error',
      '-f', 's16le', // Formato RAW PCM
      '-ar', config.sampleRate.toString(), // 48000Hz do buffer
      '-ac', config.channels.toString(), // 2 canais (stereo)
      '-i', tempPcmPath, // Lê do arquivo PCM
      '-acodec', 'pcm_s16le',
      '-ar', '44100', // APIs preferem 44100Hz
      '-ac', '1', // Mono (APIs preferem mono)
      tempWavPath,
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let stderrOutput = '';

    ffmpeg.stderr?.on('data', (data) => {
      stderrOutput += data.toString();
    });

    ffmpeg.on('error', (err) => {
      logger.error('FFmpeg spawn error', { error: err.message });
      cleanupTempFile(tempPcmPath);
      reject(new CaptureError(err.message));
    });

    ffmpeg.on('close', (code) => {
      cleanupTempFile(tempPcmPath);

      if (code === 0) {
        logger.info(`Conversão concluída: ${tempWavPath}`);
        resolve(tempWavPath);
      } else {
        logger.error(`FFmpeg falhou com código ${code}`, { stderr: stderrOutput });
        reject(new CaptureError(`FFmpeg exit code: ${code}`));
      }
    });

    // Timeout de segurança (5s para conversão)
    const timeout = setTimeout(() => {
      ffmpeg.kill('SIGKILL');
      reject(new CaptureError('Timeout na conversão de áudio'));
    }, 5000);

    ffmpeg.on('close', () => clearTimeout(timeout));
  });
}

/**
 * Envia sample para AudD e retorna resultado
 * Usa axios + form-data (método comprovado do vinyl-player)
 */
async function identifyWithAudD(
  samplePath: string,
  config: RecognitionConfig
): Promise<AudDResponse> {
  const form = new FormData();

  // Usar createReadStream como no projeto vinyl-player (funciona!)
  form.append('api_token', config.auddApiKey);
  form.append('file', createReadStream(samplePath));
  form.append('return', 'spotify,apple_music,deezer');

  const fileStats = statSync(samplePath);
  logger.info(`AudD request: file size: ${fileStats.size} bytes`);

  try {
    const response = await axios.post<AudDResponse>(
      'https://api.audd.io/',
      form,
      {
        headers: form.getHeaders(),
        timeout: config.apiTimeout,
      }
    );

    logger.info(`AudD response: status=${response.data.status}, result=${response.data.result ? 'found' : 'null'}`);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new AudDError('Timeout na requisição ao AudD', 'AUDD_TIMEOUT');
      }
      throw new AudDError(
        `HTTP ${error.response?.status}: ${error.message}`,
        'AUDD_HTTP_ERROR',
        { status: error.response?.status }
      );
    }

    throw new AudDError(
      'Falha na comunicação com AudD',
      'AUDD_NETWORK_ERROR',
      error
    );
  }
}

/**
 * Extrai capa do álbum dos metadados
 */
function extractAlbumArt(result: NonNullable<AudDResponse['result']>): string | null {
  // Tentar Spotify primeiro (geralmente melhor qualidade)
  const spotifyImages = result.spotify?.album?.images;
  if (spotifyImages && spotifyImages.length > 0) {
    // Pegar a maior imagem
    const sorted = [...spotifyImages].sort((a, b) => (b.width || 0) - (a.width || 0));
    return sorted[0].url;
  }

  // Tentar Apple Music
  if (result.apple_music?.artwork?.url) {
    // Template URL - substituir {w} e {h} por tamanho
    return result.apple_music.artwork.url.replace('{w}', '600').replace('{h}', '600');
  }

  // Fallback para Deezer
  if (result.deezer?.album?.cover_big) {
    return result.deezer.album.cover_big;
  }

  return null;
}

/**
 * Extrai ano do release_date
 */
function extractYear(releaseDate?: string): number | null {
  if (!releaseDate) return null;

  // Formato: "YYYY-MM-DD" ou "YYYY"
  const match = releaseDate.match(/^(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Remove arquivo temporário de forma segura
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    if (existsSync(filePath)) {
      await unlinkAsync(filePath);
      logger.debug(`Arquivo temporário removido: ${filePath}`);
    }
  } catch (err) {
    logger.warn(`Falha ao remover arquivo temporário: ${filePath}`, { error: err });
  }
}

/**
 * Executa reconhecimento musical
 *
 * @param options Opções de reconhecimento
 * @returns Resultado do reconhecimento
 */
export async function recognize(options: RecognizeOptions): Promise<RecognitionResult> {
  const { sampleDuration, trigger, sessionId, audioManager } = options;
  let samplePath: string | null = null;

  logger.info(`Reconhecimento iniciado: trigger=${trigger}, sessionId=${sessionId}`);

  try {
    const config = getConfig();

    // 1. Capturar sample do Ring Buffer
    samplePath = await captureSample(sampleDuration, audioManager, config);

    // 2. Enviar para AudD
    const auddResponse = await identifyWithAudD(samplePath, config);

    // 3. Processar resposta
    if (auddResponse.status === 'error') {
      const errorMsg = auddResponse.error?.error_message || 'Erro desconhecido';
      const errorCode = auddResponse.error?.error_code || 0;

      logger.warn(`AudD error: code=${errorCode}, msg=${errorMsg}`);
      return {
        success: false,
        error: `AudD: ${errorMsg}`,
        errorCode: `AUDD_${errorCode}`,
      };
    }

    // Sem resultado = música não identificada
    if (!auddResponse.result) {
      logger.info('AudD: Música não identificada');
      return {
        success: false,
        error: 'Música não identificada',
        errorCode: 'NOT_FOUND',
      };
    }

    // 4. Extrair metadados
    const result = auddResponse.result;
    const title = result.title;
    const artist = result.artist;
    const albumName = result.album || null;
    const albumArt = extractAlbumArt(result);
    const year = extractYear(result.release_date);
    const durationSeconds: number | null = null; // AudD não retorna duração
    const confidence = 1.0; // AudD não retorna score, assumir 100%

    logger.info(`AudD identificou: "${title}" - ${artist}`);

    // 5. Fuzzy matching contra coleção (V2-06, V2-07)
    let albumMatch: AlbumMatchResult | null = null;
    let linkedAlbumId: string | null = null;

    if (albumName) {
      const matches = await findMatches({ artist, album: albumName });

      if (matches.length > 0) {
        const bestMatch = matches[0];
        
        // Mapear todos os matches para o formato da API (V2-07)
        const allMatches: AlbumMatchItem[] = matches.map((m) => ({
          albumId: m.album.id,
          title: m.album.title,
          artist: m.album.artist,
          coverUrl: m.album.coverUrl,
          confidence: m.confidence,
        }));

        albumMatch = {
          albumId: bestMatch.album.id,
          albumTitle: bestMatch.album.title,
          matchConfidence: bestMatch.confidence,
          needsConfirmation: bestMatch.needsConfirmation,
          matches: allMatches,
        };

        // Vinculação automática se score >= 0.8
        if (bestMatch.confidence >= THRESHOLDS.AUTO_LINK) {
          linkedAlbumId = bestMatch.album.id;
          logger.info(
            `Vinculação automática: albumId=${linkedAlbumId}, confidence=${(bestMatch.confidence * 100).toFixed(1)}%`
          );
        } else {
          logger.info(
            `Match encontrado (confirmação necessária): albumId=${bestMatch.album.id}, confidence=${(bestMatch.confidence * 100).toFixed(1)}%, total matches=${matches.length}`
          );
        }
      }
    }

    // 6. Persistir Track no banco
    const trackMetadata = {
      song_link: result.song_link || null,
      label: result.label || null,
      trigger,
    };

    const track = await prisma.track.create({
      data: {
        sessionId,
        albumId: linkedAlbumId,
        title,
        artist,
        albumName,
        albumArtUrl: albumArt,
        year,
        isrc: null, // AudD não retorna ISRC diretamente
        durationSeconds,
        confidence,
        recognitionSource: 'audd' as RecognitionSource,
        metadata: trackMetadata,
      },
    });

    logger.info(`Track persistido: id=${track.id}, albumId=${linkedAlbumId}`);

    // V3a-09: Criar SessionAlbum se houve vinculação automática
    if (linkedAlbumId) {
      try {
        await prisma.sessionAlbum.upsert({
          where: {
            sessionId_albumId: {
              sessionId,
              albumId: linkedAlbumId,
            },
          },
          create: {
            sessionId,
            albumId: linkedAlbumId,
            source: 'recognition',
          },
          update: {}, // Não atualiza se já existe
        });
        logger.info(`SessionAlbum criado/existente: sessionId=${sessionId}, albumId=${linkedAlbumId}`);
      } catch (err) {
        // Não falhar o reconhecimento se SessionAlbum falhar
        logger.warn('Falha ao criar SessionAlbum', { error: err });
      }
    }

    // 7. Emitir evento track.recognized
    await eventBus.publish('track.recognized', {
      track: {
        id: track.id,
        title,
        artist,
        album: albumName,
        albumArt,
        year,
        durationSeconds,
        confidence,
        source: 'audd',
      },
      albumMatch,
      sessionId,
      timestamp: new Date().toISOString(),
    });

    // 8. AudD não retorna duração, então não podemos calcular próximo reconhecimento
    return {
      success: true,
      track: {
        id: track.id,
        title,
        artist,
        album: albumName,
        albumArt,
        year,
        durationSeconds,
        confidence,
        source: 'audd',
        albumMatch,
      },
    };
  } catch (error) {
    // Tratar erros conhecidos
    if (error instanceof RecognitionError) {
      logger.error(`Recognition error: ${error.code} - ${error.message}`);
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      };
    }

    // Erro desconhecido
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Unexpected recognition error: ${errorMsg}`);
    return {
      success: false,
      error: 'Erro inesperado no reconhecimento',
      errorCode: 'UNEXPECTED_ERROR',
    };
  } finally {
    // Cleanup arquivo temporário
    if (samplePath) {
      await cleanupTempFile(samplePath);
    }
  }
}

/**
 * Confirma o vínculo de um track a um álbum da coleção
 *
 * @param trackId ID do track
 * @param albumId ID do álbum (ou null para desvincular)
 * @returns Track atualizado
 */
export async function confirmTrackAlbum(
  trackId: string,
  albumId: string | null
): Promise<{
  id: string;
  title: string;
  artist: string;
  albumId: string | null;
}> {
  logger.info(`Confirmando vínculo: track=${trackId}, album=${albumId}`);

  // Verificar se track existe
  const track = await prisma.track.findUnique({
    where: { id: trackId },
  });

  if (!track) {
    throw new RecognitionError(
      `Track não encontrado: ${trackId}`,
      'TRACK_NOT_FOUND'
    );
  }

  // Se albumId fornecido, verificar se álbum existe
  if (albumId) {
    const album = await prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new RecognitionError(
        `Álbum não encontrado: ${albumId}`,
        'ALBUM_NOT_FOUND'
      );
    }
  }

  // Atualizar track
  const updated = await prisma.track.update({
    where: { id: trackId },
    data: { albumId },
  });

  logger.info(`Track atualizado: id=${updated.id}, albumId=${updated.albumId}`);

  return {
    id: updated.id,
    title: updated.title,
    artist: updated.artist,
    albumId: updated.albumId,
  };
}
