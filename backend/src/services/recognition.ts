/**
 * Recognition Service (V2-05)
 *
 * Serviço de reconhecimento musical via ACRCloud.
 * Captura samples de áudio via FFmpeg e envia para identificação.
 *
 * Funcionalidades:
 * - Captura de sample WAV via FFmpeg (mono, 44100Hz)
 * - Integração ACRCloud com autenticação HMAC-SHA1
 * - Fail gracefully em caso de erro (sem fallback AudD)
 * - Persistência de Track no banco
 * - Emissão de evento track.recognized
 *
 * NOTA: albumMatch é sempre null nesta versão. A lógica de
 * fuzzy matching será implementada em V2-06.
 */

import { spawn } from 'child_process';
import { createReadStream, unlink, existsSync } from 'fs';
import { promisify } from 'util';
import * as crypto from 'crypto';
import FormData from 'form-data';
import prisma from '../prisma/client';
import { eventBus } from '../utils/event-bus';
import { createLogger } from '../utils/logger';
import type { RecognitionSource } from '@prisma/client';

const unlinkAsync = promisify(unlink);
const logger = createLogger('Recognition');

/**
 * Configuração do serviço de reconhecimento
 */
export interface RecognitionConfig {
  /** Host ACRCloud (ex: identify-us-west-2.acrcloud.com) */
  acrcloudHost: string;
  /** Access Key ACRCloud */
  acrcloudAccessKey: string;
  /** Access Secret ACRCloud */
  acrcloudAccessSecret: string;
  /** Device ALSA para captura */
  audioDevice: string;
  /** Sample rate do device */
  sampleRate: number;
  /** Número de canais do device */
  channels: number;
  /** Timeout para API ACRCloud em ms */
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
    albumMatch: null; // V2-06 implementará fuzzy matching
  };
  nextRecognitionIn?: number;
  error?: string;
  errorCode?: string;
}

/**
 * Response bruta do ACRCloud
 */
interface ACRCloudResponse {
  status: {
    msg: string;
    code: number;
    version: string;
  };
  metadata?: {
    music?: Array<{
      title: string;
      artists?: Array<{ name: string }>;
      album?: { name: string };
      release_date?: string;
      duration_ms?: number;
      external_metadata?: {
        spotify?: { album?: { cover?: Array<{ url: string }> } };
        deezer?: { album?: { cover_big?: string } };
      };
      score?: number;
      acrid?: string;
      external_ids?: {
        isrc?: string;
      };
    }>;
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

export class ACRCloudError extends RecognitionError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ACRCloudError';
  }
}

export class NotConfiguredError extends RecognitionError {
  constructor() {
    super(
      'Reconhecimento musical não configurado. Configure ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY e ACRCLOUD_ACCESS_SECRET.',
      'RECOGNITION_NOT_CONFIGURED'
    );
  }
}

/**
 * Verifica se o serviço ACRCloud está configurado
 */
export function isConfigured(): boolean {
  return !!(
    process.env.ACRCLOUD_HOST &&
    process.env.ACRCLOUD_ACCESS_KEY &&
    process.env.ACRCLOUD_ACCESS_SECRET
  );
}

/**
 * Obtém configuração do ambiente
 */
function getConfig(): RecognitionConfig {
  if (!isConfigured()) {
    throw new NotConfiguredError();
  }

  return {
    acrcloudHost: process.env.ACRCLOUD_HOST!,
    acrcloudAccessKey: process.env.ACRCLOUD_ACCESS_KEY!,
    acrcloudAccessSecret: process.env.ACRCLOUD_ACCESS_SECRET!,
    audioDevice: process.env.AUDIO_DEVICE || 'plughw:1,0',
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '48000'),
    channels: parseInt(process.env.AUDIO_CHANNELS || '2'),
    apiTimeout: 10000, // 10s timeout
  };
}

/**
 * Captura sample de áudio via FFmpeg
 *
 * @param durationSeconds Duração em segundos
 * @returns Caminho do arquivo WAV temporário
 */
async function captureSample(durationSeconds: number): Promise<string> {
  const config = getConfig();
  const tempPath = `/tmp/recognition-sample-${Date.now()}.wav`;

  logger.info(`Captura iniciada: duration=${durationSeconds}s, device=${config.audioDevice}`);

  return new Promise((resolve, reject) => {
    // FFmpeg: captura do ALSA, converte para mono 44100Hz WAV
    const args = [
      '-y', // Sobrescrever arquivo
      '-loglevel', 'error',
      '-f', 'alsa',
      '-i', config.audioDevice,
      '-t', durationSeconds.toString(),
      '-acodec', 'pcm_s16le',
      '-ar', '44100', // APIs preferem 44100Hz
      '-ac', '1', // Mono (APIs preferem mono)
      tempPath,
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let stderrOutput = '';

    ffmpeg.stderr?.on('data', (data) => {
      stderrOutput += data.toString();
    });

    ffmpeg.on('error', (err) => {
      logger.error('FFmpeg spawn error', { error: err.message });
      reject(new CaptureError(err.message));
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logger.info(`Captura concluída: ${tempPath}`);
        resolve(tempPath);
      } else {
        logger.error(`FFmpeg falhou com código ${code}`, { stderr: stderrOutput });
        reject(new CaptureError(`FFmpeg exit code: ${code}`));
      }
    });

    // Timeout de segurança (duração + 5s)
    const timeout = setTimeout(() => {
      ffmpeg.kill('SIGKILL');
      reject(new CaptureError('Timeout na captura de áudio'));
    }, (durationSeconds + 5) * 1000);

    ffmpeg.on('close', () => clearTimeout(timeout));
  });
}

/**
 * Gera assinatura HMAC-SHA1 para ACRCloud
 */
function generateACRCloudSignature(
  accessKey: string,
  accessSecret: string,
  timestamp: string
): string {
  const stringToSign = [
    'POST',
    '/v1/identify',
    accessKey,
    'audio',
    '1',
    timestamp,
  ].join('\n');

  return crypto
    .createHmac('sha1', accessSecret)
    .update(stringToSign)
    .digest('base64');
}

/**
 * Envia sample para ACRCloud e retorna resultado
 */
async function identifyWithACRCloud(
  samplePath: string,
  config: RecognitionConfig
): Promise<ACRCloudResponse> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = generateACRCloudSignature(
    config.acrcloudAccessKey,
    config.acrcloudAccessSecret,
    timestamp
  );

  // Criar FormData com arquivo
  const form = new FormData();
  form.append('sample', createReadStream(samplePath));
  form.append('access_key', config.acrcloudAccessKey);
  form.append('data_type', 'audio');
  form.append('signature_version', '1');
  form.append('signature', signature);
  form.append('sample_bytes', '0'); // Auto-detect
  form.append('timestamp', timestamp);

  const url = `https://${config.acrcloudHost}/v1/identify`;

  logger.info(`ACRCloud request: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.apiTimeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: form as unknown as globalThis.FormData,
      headers: form.getHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ACRCloudError(
        `HTTP ${response.status}: ${response.statusText}`,
        'ACRCLOUD_HTTP_ERROR',
        { status: response.status }
      );
    }

    const data = (await response.json()) as ACRCloudResponse;

    logger.info(`ACRCloud response: code=${data.status.code}, msg=${data.status.msg}`);

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ACRCloudError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ACRCloudError('Timeout na requisição ao ACRCloud', 'ACRCLOUD_TIMEOUT');
    }

    throw new ACRCloudError(
      'Falha na comunicação com ACRCloud',
      'ACRCLOUD_NETWORK_ERROR',
      error
    );
  }
}

/**
 * Extrai capa do álbum dos metadados externos
 */
function extractAlbumArt(music: NonNullable<NonNullable<ACRCloudResponse['metadata']>['music']>[0]): string | null {
  const external = music.external_metadata;

  // Tentar Spotify primeiro (geralmente melhor qualidade)
  const spotifyCovers = external?.spotify?.album?.cover;
  if (spotifyCovers && spotifyCovers.length > 0) {
    return spotifyCovers[0].url;
  }

  // Fallback para Deezer
  if (external?.deezer?.album?.cover_big) {
    return external.deezer.album.cover_big;
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
  const { sampleDuration, trigger, sessionId } = options;
  let samplePath: string | null = null;

  logger.info(`Reconhecimento iniciado: trigger=${trigger}, sessionId=${sessionId}`);

  try {
    const config = getConfig();

    // 1. Capturar sample
    samplePath = await captureSample(sampleDuration);

    // 2. Enviar para ACRCloud
    const acrResponse = await identifyWithACRCloud(samplePath, config);

    // 3. Processar resposta
    if (acrResponse.status.code !== 0) {
      // Códigos de erro ACRCloud:
      // 1001 = No result
      // 2000 = Recording is too short
      // 3000 = HTTP error
      // 3001 = Access key error
      // 3003 = Service error
      // 3006 = Invalid signature

      if (acrResponse.status.code === 1001) {
        logger.info('ACRCloud: Música não identificada');
        return {
          success: false,
          error: 'Música não identificada',
          errorCode: 'NOT_FOUND',
        };
      }

      logger.warn(`ACRCloud error: code=${acrResponse.status.code}, msg=${acrResponse.status.msg}`);
      return {
        success: false,
        error: `ACRCloud: ${acrResponse.status.msg}`,
        errorCode: `ACRCLOUD_${acrResponse.status.code}`,
      };
    }

    // 4. Extrair metadados
    const music = acrResponse.metadata?.music?.[0];
    if (!music) {
      return {
        success: false,
        error: 'Resposta ACRCloud sem metadados',
        errorCode: 'NO_METADATA',
      };
    }

    const title = music.title;
    const artist = music.artists?.map((a) => a.name).join(', ') || 'Artista Desconhecido';
    const albumName = music.album?.name || null;
    const albumArt = extractAlbumArt(music);
    const year = extractYear(music.release_date);
    const durationMs = music.duration_ms;
    const durationSeconds = durationMs ? Math.round(durationMs / 1000) : null;
    const confidence = (music.score || 100) / 100; // Normalizar para 0-1
    const isrc = music.external_ids?.isrc || null;

    logger.info(`ACRCloud identificou: "${title}" - ${artist} (confidence: ${confidence})`);

    // 5. Persistir Track no banco
    // Nota: metadata é Json no Prisma, precisamos cast explícito
    const trackMetadata = {
      acrid: music.acrid || null,
      trigger,
      acrcloud_code: acrResponse.status.code,
    };

    const track = await prisma.track.create({
      data: {
        sessionId,
        title,
        artist,
        albumName,
        albumArtUrl: albumArt,
        year,
        isrc,
        durationSeconds,
        confidence,
        recognitionSource: 'acrcloud' as RecognitionSource,
        metadata: trackMetadata,
      },
    });

    logger.info(`Track persistido: id=${track.id}`);

    // 6. Emitir evento track.recognized
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
        source: 'acrcloud',
      },
      albumMatch: null, // V2-06 implementará
      sessionId,
      timestamp: new Date().toISOString(),
    });

    // 7. Calcular próximo reconhecimento sugerido
    // Se temos duração, sugerir (duração - 30s) para pegar próxima música
    // Mínimo de 60s entre reconhecimentos
    let nextRecognitionIn: number | undefined;
    if (durationSeconds && durationSeconds > 60) {
      nextRecognitionIn = Math.max(60, durationSeconds - 30);
    }

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
        source: 'acrcloud',
        albumMatch: null, // V2-06
      },
      nextRecognitionIn,
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
