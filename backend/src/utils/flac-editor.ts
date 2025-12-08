/**
 * FLAC Editor Utility
 *
 * Utilitário para manipulação de arquivos FLAC usando FFmpeg.
 * Suporta: trim, geração de waveform, obtenção de duração.
 *
 * @module utils/flac-editor
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from './logger';

const logger = createLogger('FlacEditor');

/**
 * Dados de waveform para renderização
 */
export interface WaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
}

/**
 * Resultado de operação de trim
 */
export interface TrimResult {
  newDuration: number;
  previousDuration: number;
  outputPath: string;
}

/**
 * Metadados de arquivo de áudio
 */
export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  format: string;
}

/**
 * Executa comando FFmpeg e retorna stdout
 */
function runFFmpeg(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args);
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];

    process.stdout.on('data', (chunk) => chunks.push(chunk));
    process.stderr.on('data', (chunk) => errorChunks.push(chunk));

    process.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        const error = Buffer.concat(errorChunks).toString();
        reject(new Error(`FFmpeg error (code ${code}): ${error}`));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Executa ffprobe e retorna stdout como string
 */
function runFFprobe(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffprobe', args);
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];

    process.stdout.on('data', (chunk) => chunks.push(chunk));
    process.stderr.on('data', (chunk) => errorChunks.push(chunk));

    process.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString().trim());
      } else {
        // ffprobe envia info para stderr, então tentamos extrair de lá também
        const stderr = Buffer.concat(errorChunks).toString();
        // Se o código é 0 ou temos dados, consideramos sucesso
        const stdout = Buffer.concat(chunks).toString().trim();
        if (stdout) {
          resolve(stdout);
        } else {
          reject(new Error(`FFprobe error (code ${code}): ${stderr}`));
        }
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to spawn FFprobe: ${err.message}`));
    });
  });
}

/**
 * Obtém a duração de um arquivo de áudio em segundos
 *
 * Tenta primeiro via ffprobe (rápido), mas se o arquivo não tiver
 * metadados de duração (comum em FLAC gerados via streaming),
 * faz fallback para decodificação completa com ffmpeg.
 */
export async function getDuration(filePath: string): Promise<number> {
  logger.debug('Obtendo duração', { filePath });

  // Método 1: Tentar via ffprobe (rápido)
  try {
    const args = [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ];

    const output = await runFFprobe(args);
    const duration = parseFloat(output);

    if (!isNaN(duration) && duration > 0) {
      logger.debug('Duração obtida via ffprobe', { filePath, duration });
      return duration;
    }
  } catch (err) {
    logger.debug('ffprobe falhou, tentando fallback', { filePath, err });
  }

  // Método 2: Fallback - decodificar o arquivo com ffmpeg
  // Necessário para FLAC gerados via streaming (sem metadados de duração)
  logger.debug('Usando fallback de decodificação para obter duração', { filePath });

  const duration = await getDurationByDecoding(filePath);

  if (duration <= 0) {
    throw new Error(`Não foi possível obter duração de: ${filePath}`);
  }

  logger.debug('Duração obtida via decodificação', { filePath, duration });
  return duration;
}

/**
 * Obtém duração decodificando o arquivo (mais lento, mas funciona sempre)
 * Usado como fallback para arquivos sem metadados de duração
 */
async function getDurationByDecoding(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', [
      '-i', filePath,
      '-f', 'null',
      '-',
    ]);

    let stderr = '';

    process.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    process.on('close', (code) => {
      // FFmpeg escreve "time=HH:MM:SS.ss" no stderr durante processamento
      // Pegamos o último time= que é a duração total
      const timeMatches = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/g);

      if (timeMatches && timeMatches.length > 0) {
        const lastTime = timeMatches[timeMatches.length - 1];
        const match = lastTime.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);

        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseInt(match[3], 10);
          const centiseconds = parseInt(match[4], 10);

          const totalSeconds = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
          resolve(totalSeconds);
          return;
        }
      }

      // Se não encontrou, retorna 0
      resolve(0);
    });

    process.on('error', (err) => {
      reject(new Error(`Falha ao decodificar arquivo: ${err.message}`));
    });
  });
}

/**
 * Obtém metadados completos de um arquivo de áudio
 */
export async function getMetadata(filePath: string): Promise<AudioMetadata> {
  logger.debug('Obtendo metadados', { filePath });

  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration,format_name:stream=sample_rate,channels,bits_per_sample',
    '-of',
    'json',
    filePath,
  ];

  const output = await runFFprobe(args);
  const data = JSON.parse(output);

  const stream = data.streams?.[0] || {};
  const format = data.format || {};

  return {
    duration: parseFloat(format.duration) || 0,
    sampleRate: parseInt(stream.sample_rate) || 48000,
    channels: parseInt(stream.channels) || 2,
    bitDepth: parseInt(stream.bits_per_sample) || 16,
    format: format.format_name || 'unknown',
  };
}

/**
 * Gera dados de waveform para visualização
 *
 * @param filePath - Caminho do arquivo FLAC
 * @param resolution - Pontos por segundo (padrão: 10)
 * @returns Dados de waveform com peaks normalizados (-1 a 1)
 */
export async function generateWaveformData(
  filePath: string,
  resolution: number = 10
): Promise<WaveformData> {
  logger.info('Gerando waveform', { filePath, resolution });

  // Primeiro, obter duração
  const duration = await getDuration(filePath);
  const totalPoints = Math.ceil(duration * resolution);

  // Limitar pontos para evitar problemas de memória
  const maxPoints = 10000;
  const actualPoints = Math.min(totalPoints, maxPoints);
  const actualResolution = actualPoints / duration;

  // Calcular samples per point
  // Usamos resample para reduzir a quantidade de dados
  const targetSampleRate = Math.ceil(actualResolution * 2); // Nyquist

  const args = [
    '-i',
    filePath,
    '-ac',
    '1', // Mono para simplificar
    '-ar',
    targetSampleRate.toString(),
    '-f',
    'f32le', // Float32 little-endian
    '-', // Output para stdout
  ];

  const buffer = await runFFmpeg(args);

  // Converter buffer para Float32Array
  const float32 = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.length / 4
  );

  // Calcular peaks (min/max por segmento)
  const samplesPerPeak = Math.max(1, Math.floor(float32.length / actualPoints));
  const peaks: number[] = [];

  for (let i = 0; i < actualPoints; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, float32.length);

    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(float32[j]);
      if (abs > max) max = abs;
    }

    // Normalizar para 0-1
    peaks.push(Math.min(1, max));
  }

  logger.info('Waveform gerado', {
    filePath,
    points: peaks.length,
    duration,
  });

  return {
    peaks,
    duration,
    sampleRate: 48000, // Original sample rate do sistema
  };
}

/**
 * Aplica trim (corte) em um arquivo FLAC
 *
 * @param inputPath - Caminho do arquivo original
 * @param outputPath - Caminho do arquivo de saída (pode ser o mesmo para sobrescrever)
 * @param startOffset - Ponto de início em segundos
 * @param endOffset - Ponto de fim em segundos
 * @returns Resultado com durações anterior e nova
 */
export async function trim(
  inputPath: string,
  outputPath: string,
  startOffset: number,
  endOffset: number
): Promise<TrimResult> {
  logger.info('Aplicando trim', { inputPath, startOffset, endOffset });

  // Obter duração original
  const previousDuration = await getDuration(inputPath);

  // Validar offsets
  if (startOffset < 0) {
    throw new Error('startOffset não pode ser negativo');
  }
  if (endOffset <= startOffset) {
    throw new Error('endOffset deve ser maior que startOffset');
  }
  if (endOffset > previousDuration) {
    throw new Error(`endOffset (${endOffset}) excede duração do arquivo (${previousDuration})`);
  }

  // Se output é igual a input, usar arquivo temporário
  const isSameFile = path.resolve(inputPath) === path.resolve(outputPath);
  const actualOutput = isSameFile
    ? `${inputPath}.tmp.flac`
    : outputPath;

  const args = [
    '-i',
    inputPath,
    '-ss',
    startOffset.toString(),
    '-to',
    endOffset.toString(),
    '-c:a',
    'flac', // Codec FLAC
    '-y', // Sobrescrever se existir
    actualOutput,
  ];

  await runFFmpeg(args);

  // Se era mesmo arquivo, substituir original
  if (isSameFile) {
    await fs.rename(actualOutput, outputPath);
  }

  const newDuration = endOffset - startOffset;

  logger.info('Trim aplicado', {
    inputPath,
    outputPath,
    previousDuration,
    newDuration,
  });

  return {
    newDuration,
    previousDuration,
    outputPath,
  };
}

/**
 * Verifica se FFmpeg está disponível no sistema
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    await runFFprobe(['-version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtém caminho para arquivo de cache de waveform
 */
export function getWaveformCachePath(flacPath: string): string {
  const dir = path.dirname(flacPath);
  const name = path.basename(flacPath, path.extname(flacPath));
  return path.join(dir, `${name}.waveform.json`);
}

/**
 * Carrega waveform do cache se existir
 */
export async function loadWaveformCache(
  flacPath: string
): Promise<WaveformData | null> {
  const cachePath = getWaveformCachePath(flacPath);

  try {
    const data = await fs.readFile(cachePath, 'utf-8');
    return JSON.parse(data) as WaveformData;
  } catch {
    return null;
  }
}

/**
 * Salva waveform no cache
 */
export async function saveWaveformCache(
  flacPath: string,
  data: WaveformData
): Promise<void> {
  const cachePath = getWaveformCachePath(flacPath);

  try {
    await fs.writeFile(cachePath, JSON.stringify(data));
    logger.debug('Waveform cache salvo', { cachePath });
  } catch (err) {
    logger.warn('Falha ao salvar cache de waveform', { cachePath, err });
  }
}

/**
 * Invalida cache de waveform (após trim)
 */
export async function invalidateWaveformCache(flacPath: string): Promise<void> {
  const cachePath = getWaveformCachePath(flacPath);

  try {
    await fs.unlink(cachePath);
    logger.debug('Waveform cache invalidado', { cachePath });
  } catch {
    // Ignora se não existir
  }
}

/**
 * Gera waveform com cache inteligente
 */
export async function generateWaveformWithCache(
  filePath: string,
  resolution: number = 10
): Promise<WaveformData> {
  // Tentar carregar do cache
  const cached = await loadWaveformCache(filePath);
  if (cached) {
    logger.debug('Usando waveform do cache', { filePath });
    return cached;
  }

  // Gerar novo
  const data = await generateWaveformData(filePath, resolution);

  // Salvar no cache
  await saveWaveformCache(filePath, data);

  return data;
}
