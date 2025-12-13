import {
  FFmpegArgsBuilder,
  AudioConfig,
  StreamingConfig,
  FifoPaths,
} from '../../utils/ffmpeg-args';

describe('FFmpegArgsBuilder', () => {
  const defaultAudioConfig: AudioConfig = {
    device: 'plughw:1,0',
    sampleRate: 48000,
    channels: 2,
  };

  const defaultStreamingConfig: StreamingConfig = {
    icecastHost: 'localhost',
    icecastPort: 8000,
    icecastPassword: 'hackme',
    mountPoint: '/stream',
    bitrate: 128,
  };

  const defaultFifoPaths: FifoPaths = {
    mp3Fifo: '/tmp/vinyl-audio.fifo',
    recognitionFifo: '/tmp/vinyl-recognition.fifo',
    flacFifo: '/tmp/vinyl-flac.fifo',
  };

  describe('buildMainArgs()', () => {
    it('should build main FFmpeg args with all outputs', () => {
      const args = FFmpegArgsBuilder.buildMainArgs(
        defaultAudioConfig,
        defaultFifoPaths
      );

      // Base args
      expect(args).toContain('-y');
      expect(args).toContain('-loglevel');
      expect(args).toContain('error');

      // Input ALSA
      expect(args).toContain('-f');
      expect(args).toContain('alsa');
      expect(args).toContain('-i');
      expect(args).toContain('plughw:1,0');
      expect(args).toContain('-ar');
      expect(args).toContain('48000');
      expect(args).toContain('-ac');
      expect(args).toContain('2');

      // Output 1: stdout
      expect(args).toContain('pipe:1');

      // Output 2: MP3 FIFO
      expect(args).toContain('/tmp/vinyl-audio.fifo');

      // Output 3: Recognition FIFO
      expect(args).toContain('/tmp/vinyl-recognition.fifo');

      // Output 4: FLAC FIFO
      expect(args).toContain('/tmp/vinyl-flac.fifo');

      // Should have 4 map entries (one per output)
      const mapCount = args.filter((arg) => arg === '-map').length;
      expect(mapCount).toBe(4);
    });

    it('should use custom audio config', () => {
      const customAudio: AudioConfig = {
        device: 'hw:2,1',
        sampleRate: 44100,
        channels: 1,
      };

      const args = FFmpegArgsBuilder.buildMainArgs(customAudio, defaultFifoPaths);

      expect(args).toContain('hw:2,1');
      expect(args).toContain('44100');
      expect(args).toContain('1');
    });

    it('should use custom FIFO paths', () => {
      const customFifos: FifoPaths = {
        mp3Fifo: '/custom/mp3.fifo',
        recognitionFifo: '/custom/recognition.fifo',
        flacFifo: '/custom/flac.fifo',
      };

      const args = FFmpegArgsBuilder.buildMainArgs(defaultAudioConfig, customFifos);

      expect(args).toContain('/custom/mp3.fifo');
      expect(args).toContain('/custom/recognition.fifo');
      expect(args).toContain('/custom/flac.fifo');
    });

    it('should output PCM s16le format', () => {
      const args = FFmpegArgsBuilder.buildMainArgs(
        defaultAudioConfig,
        defaultFifoPaths
      );

      expect(args).toContain('-c:a');
      expect(args).toContain('pcm_s16le');
      expect(args).toContain('s16le');
    });
  });

  describe('buildMp3Args()', () => {
    it('should build MP3 FFmpeg args', () => {
      const args = FFmpegArgsBuilder.buildMp3Args(
        '/tmp/vinyl-audio.fifo',
        { sampleRate: 48000, channels: 2 },
        defaultStreamingConfig
      );

      // Base args
      expect(args).toContain('-y');
      expect(args).toContain('-loglevel');
      expect(args).toContain('error');

      // Input from FIFO
      expect(args).toContain('-f');
      expect(args).toContain('s16le');
      expect(args).toContain('-i');
      expect(args).toContain('/tmp/vinyl-audio.fifo');
      expect(args).toContain('-ar');
      expect(args).toContain('48000');
      expect(args).toContain('-ac');
      expect(args).toContain('2');

      // Output MP3
      expect(args).toContain('-c:a');
      expect(args).toContain('libmp3lame');
      expect(args).toContain('-b:a');
      expect(args).toContain('128k');
      expect(args).toContain('mp3');
      expect(args).toContain('-content_type');
      expect(args).toContain('audio/mpeg');
    });

    it('should build correct Icecast URL', () => {
      const args = FFmpegArgsBuilder.buildMp3Args(
        '/tmp/vinyl-audio.fifo',
        { sampleRate: 48000, channels: 2 },
        defaultStreamingConfig
      );

      const icecastUrl = args.find((arg) => arg.startsWith('icecast://'));
      expect(icecastUrl).toBe(
        'icecast://source:hackme@localhost:8000/stream'
      );
    });

    it('should use custom streaming config', () => {
      const customStreaming: StreamingConfig = {
        icecastHost: '192.168.1.100',
        icecastPort: 8080,
        icecastPassword: 'secretpass',
        mountPoint: '/vinyl',
        bitrate: 256,
      };

      const args = FFmpegArgsBuilder.buildMp3Args(
        '/tmp/test.fifo',
        { sampleRate: 44100, channels: 1 },
        customStreaming
      );

      expect(args).toContain('256k');
      expect(args).toContain('44100');
      expect(args).toContain('1');

      const icecastUrl = args.find((arg) => arg.startsWith('icecast://'));
      expect(icecastUrl).toBe(
        'icecast://source:secretpass@192.168.1.100:8080/vinyl'
      );
    });

    it('should handle different bitrates', () => {
      const configs = [
        { bitrate: 64, expected: '64k' },
        { bitrate: 128, expected: '128k' },
        { bitrate: 192, expected: '192k' },
        { bitrate: 256, expected: '256k' },
        { bitrate: 320, expected: '320k' },
      ];

      for (const { bitrate, expected } of configs) {
        const streaming = { ...defaultStreamingConfig, bitrate };
        const args = FFmpegArgsBuilder.buildMp3Args(
          '/tmp/test.fifo',
          { sampleRate: 48000, channels: 2 },
          streaming
        );

        expect(args).toContain(expected);
      }
    });
  });

  describe('buildRecognitionArgs()', () => {
    it('should build recognition FFmpeg args', () => {
      const args = FFmpegArgsBuilder.buildRecognitionArgs(
        '/tmp/vinyl-recognition.fifo',
        { sampleRate: 48000, channels: 2 }
      );

      // Base args
      expect(args).toContain('-y');
      expect(args).toContain('-loglevel');
      expect(args).toContain('error');

      // Input from FIFO
      expect(args).toContain('-f');
      expect(args).toContain('s16le');
      expect(args).toContain('-i');
      expect(args).toContain('/tmp/vinyl-recognition.fifo');
      expect(args).toContain('-ar');
      expect(args).toContain('48000');
      expect(args).toContain('-ac');
      expect(args).toContain('2');

      // Output passthrough to stdout
      expect(args).toContain('-c:a');
      expect(args).toContain('copy');
      expect(args).toContain('pipe:1');
    });

    it('should use copy codec for passthrough', () => {
      const args = FFmpegArgsBuilder.buildRecognitionArgs(
        '/tmp/test.fifo',
        { sampleRate: 48000, channels: 2 }
      );

      const codecIndex = args.indexOf('-c:a');
      expect(codecIndex).toBeGreaterThan(-1);
      expect(args[codecIndex + 1]).toBe('copy');
    });

    it('should output to stdout', () => {
      const args = FFmpegArgsBuilder.buildRecognitionArgs(
        '/tmp/test.fifo',
        { sampleRate: 48000, channels: 2 }
      );

      expect(args[args.length - 1]).toBe('pipe:1');
    });
  });

  describe('buildCaptureArgs()', () => {
    it('should build capture FFmpeg args', () => {
      const args = FFmpegArgsBuilder.buildCaptureArgs(defaultAudioConfig, 1024);

      // Input ALSA
      expect(args).toContain('-f');
      expect(args).toContain('alsa');
      expect(args).toContain('-i');
      expect(args).toContain('plughw:1,0');
      expect(args).toContain('-ar');
      expect(args).toContain('48000');
      expect(args).toContain('-ac');
      expect(args).toContain('2');

      // Buffer size
      expect(args).toContain('-bufsize');
      expect(args).toContain('1024');

      // Output to stdout
      expect(args).toContain('-');
    });

    it('should use custom buffer size', () => {
      const args = FFmpegArgsBuilder.buildCaptureArgs(defaultAudioConfig, 2048);

      expect(args).toContain('2048');
    });

    it('should output s16le format', () => {
      const args = FFmpegArgsBuilder.buildCaptureArgs(defaultAudioConfig, 1024);

      expect(args).toContain('s16le');
    });
  });

  describe('arg order and structure', () => {
    it('should place base args at the beginning', () => {
      const args = FFmpegArgsBuilder.buildMainArgs(
        defaultAudioConfig,
        defaultFifoPaths
      );

      expect(args[0]).toBe('-y');
      expect(args[1]).toBe('-loglevel');
      expect(args[2]).toBe('error');
    });

    it('should place input args before output args', () => {
      const args = FFmpegArgsBuilder.buildMp3Args(
        '/tmp/test.fifo',
        { sampleRate: 48000, channels: 2 },
        defaultStreamingConfig
      );

      const inputIndex = args.indexOf('-i');
      const outputIndex = args.indexOf('libmp3lame');

      expect(inputIndex).toBeLessThan(outputIndex);
    });

    it('should return array of strings', () => {
      const mainArgs = FFmpegArgsBuilder.buildMainArgs(
        defaultAudioConfig,
        defaultFifoPaths
      );
      const mp3Args = FFmpegArgsBuilder.buildMp3Args(
        '/tmp/test.fifo',
        { sampleRate: 48000, channels: 2 },
        defaultStreamingConfig
      );
      const recognitionArgs = FFmpegArgsBuilder.buildRecognitionArgs(
        '/tmp/test.fifo',
        { sampleRate: 48000, channels: 2 }
      );
      const captureArgs = FFmpegArgsBuilder.buildCaptureArgs(
        defaultAudioConfig,
        1024
      );

      expect(Array.isArray(mainArgs)).toBe(true);
      expect(Array.isArray(mp3Args)).toBe(true);
      expect(Array.isArray(recognitionArgs)).toBe(true);
      expect(Array.isArray(captureArgs)).toBe(true);

      mainArgs.forEach((arg) => expect(typeof arg).toBe('string'));
      mp3Args.forEach((arg) => expect(typeof arg).toBe('string'));
      recognitionArgs.forEach((arg) => expect(typeof arg).toBe('string'));
      captureArgs.forEach((arg) => expect(typeof arg).toBe('string'));
    });
  });

  describe('consistency between builders', () => {
    it('should use consistent sample rate format', () => {
      const mainArgs = FFmpegArgsBuilder.buildMainArgs(
        { device: 'test', sampleRate: 44100, channels: 2 },
        defaultFifoPaths
      );
      const mp3Args = FFmpegArgsBuilder.buildMp3Args(
        '/tmp/test.fifo',
        { sampleRate: 44100, channels: 2 },
        defaultStreamingConfig
      );
      const recognitionArgs = FFmpegArgsBuilder.buildRecognitionArgs(
        '/tmp/test.fifo',
        { sampleRate: 44100, channels: 2 }
      );

      // All should contain '44100' as string
      expect(mainArgs).toContain('44100');
      expect(mp3Args).toContain('44100');
      expect(recognitionArgs).toContain('44100');
    });

    it('should use consistent PCM format', () => {
      const mainArgs = FFmpegArgsBuilder.buildMainArgs(
        defaultAudioConfig,
        defaultFifoPaths
      );
      const mp3Args = FFmpegArgsBuilder.buildMp3Args(
        '/tmp/test.fifo',
        { sampleRate: 48000, channels: 2 },
        defaultStreamingConfig
      );
      const recognitionArgs = FFmpegArgsBuilder.buildRecognitionArgs(
        '/tmp/test.fifo',
        { sampleRate: 48000, channels: 2 }
      );

      // All should use s16le for input/output PCM
      expect(mainArgs).toContain('s16le');
      expect(mp3Args).toContain('s16le');
      expect(recognitionArgs).toContain('s16le');
    });
  });
});
