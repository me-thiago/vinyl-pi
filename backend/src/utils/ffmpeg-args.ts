/**
 * Configuração de áudio (input ALSA)
 */
export interface AudioConfig {
  /** Device ALSA (ex: "plughw:1,0") */
  device: string;
  /** Sample rate em Hz (ex: 48000) */
  sampleRate: number;
  /** Número de canais (1=mono, 2=stereo) */
  channels: number;
}

/**
 * Configuração de streaming para Icecast2
 */
export interface StreamingConfig {
  /** Host do Icecast2 (ex: "localhost") */
  icecastHost: string;
  /** Porta do Icecast2 (ex: 8000) */
  icecastPort: number;
  /** Password do source */
  icecastPassword: string;
  /** Mount point (ex: "/stream") */
  mountPoint: string;
  /** Bitrate MP3 em kbps (ex: 128) */
  bitrate: number;
}

/**
 * Caminhos dos FIFOs para output
 */
export interface FifoPaths {
  /** FIFO para MP3 encoder (FFmpeg #2) */
  mp3Fifo: string;
  /** FIFO para recognition passthrough (FFmpeg #3) */
  recognitionFifo: string;
  /** FIFO para FLAC recording (FFmpeg #4) */
  flacFifo: string;
}

/**
 * Builder de argumentos FFmpeg
 *
 * Esta classe centraliza a construção de argumentos para os diferentes
 * processos FFmpeg usados no vinyl-os:
 *
 * - **Main (FFmpeg #1)**: ALSA → stdout + 3 FIFOs
 * - **MP3 (FFmpeg #2)**: FIFO → MP3 → Icecast2
 * - **Recognition (FFmpeg #3)**: FIFO → stdout (passthrough)
 *
 * @example
 * ```typescript
 * const audioConfig = { device: 'plughw:1,0', sampleRate: 48000, channels: 2 };
 * const fifoPaths = {
 *   mp3Fifo: '/tmp/vinyl-audio.fifo',
 *   recognitionFifo: '/tmp/vinyl-recognition.fifo',
 *   flacFifo: '/tmp/vinyl-flac.fifo',
 * };
 *
 * const mainArgs = FFmpegArgsBuilder.buildMainArgs(audioConfig, fifoPaths);
 * ```
 */
export class FFmpegArgsBuilder {
  /**
   * Argumentos base comuns a todos os processos
   */
  private static baseArgs(): string[] {
    return [
      '-y',              // Sobrescrever arquivos automaticamente
      '-loglevel', 'error',  // Log apenas erros
    ];
  }

  /**
   * Argumentos de input PCM (para leitura de FIFO)
   */
  private static pcmInputArgs(sampleRate: number, channels: number): string[] {
    return [
      '-f', 's16le',
      '-ar', sampleRate.toString(),
      '-ac', channels.toString(),
    ];
  }

  /**
   * Argumentos de output PCM
   */
  private static pcmOutputArgs(): string[] {
    return [
      '-c:a', 'pcm_s16le',
      '-f', 's16le',
    ];
  }

  /**
   * Constrói argumentos para FFmpeg #1 (Main)
   *
   * ALSA → stdout (pipe:1) + 3 FIFOs
   *
   * Usado pelo AudioManager para captura principal.
   * O stdout é servido pelo endpoint /stream.wav.
   * Os FIFOs alimentam FFmpeg #2 (MP3), #3 (recognition), #4 (FLAC).
   *
   * @param audio Configuração de áudio (device, sampleRate, channels)
   * @param fifoPaths Caminhos dos 3 FIFOs
   * @returns Array de argumentos FFmpeg
   */
  static buildMainArgs(audio: AudioConfig, fifoPaths: FifoPaths): string[] {
    const args: string[] = [];

    // Base args
    args.push(...this.baseArgs());

    // Input ALSA
    args.push('-f', 'alsa');
    args.push('-i', audio.device);
    args.push('-ar', audio.sampleRate.toString());
    args.push('-ac', audio.channels.toString());

    // Output 1: Raw PCM → stdout (pipe:1)
    args.push('-map', '0:a');
    args.push(...this.pcmOutputArgs());
    args.push('pipe:1');

    // Output 2: Raw PCM → FIFO MP3
    args.push('-map', '0:a');
    args.push(...this.pcmOutputArgs());
    args.push(fifoPaths.mp3Fifo);

    // Output 3: Raw PCM → FIFO Recognition
    args.push('-map', '0:a');
    args.push(...this.pcmOutputArgs());
    args.push(fifoPaths.recognitionFifo);

    // Output 4: Raw PCM → FIFO FLAC
    args.push('-map', '0:a');
    args.push(...this.pcmOutputArgs());
    args.push(fifoPaths.flacFifo);

    return args;
  }

  /**
   * Constrói argumentos para FFmpeg #2 (MP3)
   *
   * FIFO → MP3 → Icecast2
   *
   * Usado pelo AudioManager para streaming MP3.
   * Lê PCM do FIFO e envia MP3 para Icecast2.
   *
   * @param fifoPath Caminho do FIFO de entrada (mp3Fifo)
   * @param audio Configuração de áudio (sampleRate, channels)
   * @param streaming Configuração de streaming (host, port, password, mountPoint, bitrate)
   * @returns Array de argumentos FFmpeg
   */
  static buildMp3Args(
    fifoPath: string,
    audio: Pick<AudioConfig, 'sampleRate' | 'channels'>,
    streaming: StreamingConfig
  ): string[] {
    const args: string[] = [];

    // Base args
    args.push(...this.baseArgs());

    // Input: FIFO com raw PCM
    args.push(...this.pcmInputArgs(audio.sampleRate, audio.channels));
    args.push('-i', fifoPath);

    // Output: MP3 → Icecast2
    args.push('-c:a', 'libmp3lame');
    args.push('-b:a', `${streaming.bitrate}k`);
    args.push('-f', 'mp3');
    args.push('-content_type', 'audio/mpeg');

    // URL Icecast2
    const icecastUrl = `icecast://source:${streaming.icecastPassword}@${streaming.icecastHost}:${streaming.icecastPort}${streaming.mountPoint}`;
    args.push(icecastUrl);

    return args;
  }

  /**
   * Constrói argumentos para FFmpeg #3 (Recognition)
   *
   * FIFO → stdout (passthrough)
   *
   * Usado pelo AudioManager para alimentar o Ring Buffer.
   * Apenas lê PCM do FIFO e escreve no stdout sem processamento.
   *
   * @param fifoPath Caminho do FIFO de entrada (recognitionFifo)
   * @param audio Configuração de áudio (sampleRate, channels)
   * @returns Array de argumentos FFmpeg
   */
  static buildRecognitionArgs(
    fifoPath: string,
    audio: Pick<AudioConfig, 'sampleRate' | 'channels'>
  ): string[] {
    const args: string[] = [];

    // Base args
    args.push(...this.baseArgs());

    // Input: FIFO com raw PCM
    args.push(...this.pcmInputArgs(audio.sampleRate, audio.channels));
    args.push('-i', fifoPath);

    // Output: PCM → stdout (passthrough, sem re-encoding)
    args.push('-c:a', 'copy');
    args.push('-f', 's16le');
    args.push('pipe:1');

    return args;
  }

  /**
   * Constrói argumentos para captura simples (sem streaming)
   *
   * ALSA → stdout
   *
   * Usado pelo método start() do AudioManager quando não há streaming.
   *
   * @param audio Configuração de áudio
   * @param bufferSize Buffer size em samples
   * @returns Array de argumentos FFmpeg
   */
  static buildCaptureArgs(audio: AudioConfig, bufferSize: number): string[] {
    return [
      '-f', 'alsa',
      '-i', audio.device,
      '-ar', audio.sampleRate.toString(),
      '-ac', audio.channels.toString(),
      '-f', 's16le',
      '-bufsize', bufferSize.toString(),
      '-',  // Output para stdout
    ];
  }
}
