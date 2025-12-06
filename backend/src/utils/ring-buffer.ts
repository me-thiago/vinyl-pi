/**
 * Ring Buffer para áudio PCM
 *
 * Buffer circular em memória que mantém os últimos N segundos de áudio.
 * Usado para captura instantânea de samples para reconhecimento musical.
 *
 * Benefícios:
 * - Zero latência: áudio já disponível no momento do trigger
 * - Pré-roll: captura áudio de ANTES do trigger
 * - Retry sem espera: múltiplas tentativas instantâneas
 * - Multi-uso: recognition, QA analysis, visualization
 *
 * Formato do áudio:
 * - PCM s16le (signed 16-bit little-endian)
 * - 48000 Hz sample rate
 * - 2 canais (stereo)
 * - Byte rate: 192 KB/s
 *
 * @example
 * ```typescript
 * const buffer = new AudioRingBuffer({
 *   durationSeconds: 20,
 *   sampleRate: 48000,
 *   channels: 2,
 *   bytesPerSample: 2
 * });
 *
 * // Escrever dados continuamente
 * buffer.write(chunk);
 *
 * // Capturar últimos 10 segundos
 * const sample = buffer.read(10);
 * ```
 */

import { createLogger } from './logger';

const logger = createLogger('RingBuffer');

/**
 * Configuração do Ring Buffer
 */
export interface RingBufferConfig {
  /** Duração máxima do buffer em segundos */
  durationSeconds: number;
  /** Sample rate em Hz (ex: 48000) */
  sampleRate: number;
  /** Número de canais (1=mono, 2=stereo) */
  channels: number;
  /** Bytes por sample (2 para 16-bit) */
  bytesPerSample: number;
}

/**
 * Estatísticas do Ring Buffer
 */
export interface RingBufferStats {
  /** Capacidade total em bytes */
  capacity: number;
  /** Bytes atualmente no buffer */
  filled: number;
  /** Porcentagem de preenchimento */
  fillPercent: number;
  /** Segundos de áudio disponíveis */
  availableSeconds: number;
  /** Total de bytes escritos desde o início */
  totalWritten: number;
  /** Total de bytes lidos desde o início */
  totalRead: number;
}

/**
 * Ring Buffer para áudio PCM
 *
 * Implementação eficiente de buffer circular usando um único Buffer
 * com ponteiros de escrita (writePos) e tracking de preenchimento.
 *
 * Características:
 * - Escrita O(1) - apenas copia bytes e atualiza ponteiro
 * - Leitura O(n) - copia bytes para novo buffer
 * - Sem alocações durante operação normal
 * - Thread-safe para single writer / single reader
 */
export class AudioRingBuffer {
  private buffer: Buffer;
  private writePos: number = 0;
  private filled: number = 0;
  private readonly capacity: number;
  private readonly byteRate: number;
  private totalWritten: number = 0;
  private totalRead: number = 0;

  constructor(private readonly config: RingBufferConfig) {
    // Calcular capacidade em bytes
    this.byteRate = config.sampleRate * config.channels * config.bytesPerSample;
    this.capacity = this.byteRate * config.durationSeconds;

    // Alocar buffer
    this.buffer = Buffer.alloc(this.capacity);

    logger.info(
      `Ring buffer inicializado: ${config.durationSeconds}s, ` +
        `${(this.capacity / 1024 / 1024).toFixed(2)}MB, ` +
        `${(this.byteRate / 1024).toFixed(1)}KB/s`
    );
  }

  /**
   * Escreve dados no buffer circular
   *
   * Se os dados excederem a capacidade, sobrescreve os dados mais antigos.
   * Esta é a operação mais frequente e deve ser O(1) amortizado.
   *
   * @param data Dados PCM para escrever
   */
  write(data: Buffer): void {
    const dataLen = data.length;

    if (dataLen === 0) return;

    // Se dados maiores que capacidade, usar apenas os últimos bytes
    if (dataLen >= this.capacity) {
      data.copy(this.buffer, 0, dataLen - this.capacity);
      this.writePos = 0;
      this.filled = this.capacity;
      this.totalWritten += dataLen;
      return;
    }

    // Calcular quanto cabe sem wrap
    const spaceToEnd = this.capacity - this.writePos;

    if (dataLen <= spaceToEnd) {
      // Cabe sem wrap - cópia simples
      data.copy(this.buffer, this.writePos);
      this.writePos += dataLen;

      // Wrap se chegou no final
      if (this.writePos >= this.capacity) {
        this.writePos = 0;
      }
    } else {
      // Precisa wrap - duas cópias
      data.copy(this.buffer, this.writePos, 0, spaceToEnd);
      data.copy(this.buffer, 0, spaceToEnd);
      this.writePos = dataLen - spaceToEnd;
    }

    // Atualizar preenchimento
    this.filled = Math.min(this.filled + dataLen, this.capacity);
    this.totalWritten += dataLen;
  }

  /**
   * Lê os últimos N segundos do buffer
   *
   * Retorna um novo Buffer com os dados mais recentes.
   * Não remove os dados do buffer (pode ser lido múltiplas vezes).
   *
   * @param seconds Segundos de áudio para ler
   * @returns Buffer com dados PCM ou null se não houver dados suficientes
   */
  read(seconds: number): Buffer | null {
    const bytesNeeded = Math.floor(seconds * this.byteRate);

    // Verificar se há dados suficientes
    if (this.filled < bytesNeeded) {
      logger.warn(
        `Dados insuficientes: pedido ${seconds}s (${bytesNeeded} bytes), ` +
          `disponível ${(this.filled / this.byteRate).toFixed(1)}s (${this.filled} bytes)`
      );
      return null;
    }

    // Criar buffer de saída
    const output = Buffer.alloc(bytesNeeded);

    // Calcular posição de início da leitura (bytesNeeded antes de writePos)
    let readPos = this.writePos - bytesNeeded;
    if (readPos < 0) {
      readPos += this.capacity;
    }

    // Calcular quanto podemos ler até o fim do buffer
    const bytesToEnd = this.capacity - readPos;

    if (bytesNeeded <= bytesToEnd) {
      // Leitura simples - sem wrap
      this.buffer.copy(output, 0, readPos, readPos + bytesNeeded);
    } else {
      // Leitura com wrap - duas cópias
      this.buffer.copy(output, 0, readPos, this.capacity);
      this.buffer.copy(output, bytesToEnd, 0, bytesNeeded - bytesToEnd);
    }

    this.totalRead += bytesNeeded;

    logger.debug(`Lidos ${seconds}s (${bytesNeeded} bytes) do ring buffer`);

    return output;
  }

  /**
   * Retorna quantos segundos de áudio estão disponíveis
   */
  getAvailableSeconds(): number {
    return this.filled / this.byteRate;
  }

  /**
   * Verifica se há dados suficientes para N segundos
   */
  hasEnoughData(seconds: number): boolean {
    return this.filled >= seconds * this.byteRate;
  }

  /**
   * Limpa o buffer
   */
  clear(): void {
    this.writePos = 0;
    this.filled = 0;
    logger.debug('Ring buffer limpo');
  }

  /**
   * Retorna estatísticas do buffer
   */
  getStats(): RingBufferStats {
    return {
      capacity: this.capacity,
      filled: this.filled,
      fillPercent: (this.filled / this.capacity) * 100,
      availableSeconds: this.filled / this.byteRate,
      totalWritten: this.totalWritten,
      totalRead: this.totalRead,
    };
  }

  /**
   * Retorna a configuração do buffer
   */
  getConfig(): RingBufferConfig {
    return { ...this.config };
  }

  /**
   * Retorna o byte rate (bytes por segundo)
   */
  getByteRate(): number {
    return this.byteRate;
  }
}

/**
 * Configuração padrão para áudio PCM do Vinyl-OS
 */
export const DEFAULT_RING_BUFFER_CONFIG: RingBufferConfig = {
  durationSeconds: 30, // 30 segundos de histórico (preparado para V3 pré-roll)
  sampleRate: 48000,
  channels: 2,
  bytesPerSample: 2, // 16-bit
};

/**
 * Cria um Ring Buffer com configuração padrão
 */
export function createDefaultRingBuffer(): AudioRingBuffer {
  return new AudioRingBuffer(DEFAULT_RING_BUFFER_CONFIG);
}
