import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import winston from 'winston';
import { AudioManager, StreamingConfig } from './audio-manager';

const execAsync = promisify(exec);

// Configurar logger Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/health-monitor.log' })
  ]
});

/**
 * Configuração do Health Monitor
 */
export interface HealthMonitorConfig {
  checkIntervalMs: number;      // Intervalo entre checks (padrão: 30s)
  memoryThresholdMb: number;    // Limite de memória antes de alertar (padrão: 500MB)
  memoryLeakRateMbMin: number;  // Taxa de crescimento para detectar leak (padrão: 50MB/min)
  maxOrphanProcesses: number;   // Máximo de processos FFmpeg órfãos (padrão: 2)
}

/**
 * Health Monitor Service
 * 
 * Monitora a saúde do sistema:
 * - Uso de memória do processo Node
 * - Detecção de memory leaks
 * - Processos FFmpeg órfãos
 * - Emite eventos de alerta
 */
export class HealthMonitor extends EventEmitter {
  private config: HealthMonitorConfig;
  private audioManager: AudioManager;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Tracking de memória
  private memoryHistory: Array<{ timestamp: number; memoryMb: number }> = [];
  private lastMemoryMb: number = 0;

  // Configuração de streaming (para auto-restart)
  private lastStreamingConfig?: StreamingConfig;
  
  /**
   * Cria uma instância do HealthMonitor
   */
  constructor(audioManager: AudioManager, config?: Partial<HealthMonitorConfig>) {
    super();
    
    this.audioManager = audioManager;
    this.config = {
      checkIntervalMs: config?.checkIntervalMs || 30000,      // 30s
      memoryThresholdMb: config?.memoryThresholdMb || 500,    // 500MB
      memoryLeakRateMbMin: config?.memoryLeakRateMbMin || 50, // 50MB/min
      maxOrphanProcesses: config?.maxOrphanProcesses || 2     // 2 processos
    };
    
    logger.info(`HealthMonitor initialized with config: ${JSON.stringify(this.config)}`);
  }
  
  /**
   * Configura a configuração de streaming para auto-restart
   * @param config Configuração de streaming
   */
  setStreamingConfig(config: StreamingConfig): void {
    this.lastStreamingConfig = config;
    logger.info('Streaming config updated for health monitoring');
  }

  /**
   * Inicia o monitoramento
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('HealthMonitor already running');
      return;
    }
    
    this.isRunning = true;
    
    // Executar primeiro check imediatamente
    this.performHealthCheck().catch(err => {
      logger.error(`Health check failed: ${err}`);
    });
    
    // Agendar checks periódicos
    this.intervalId = setInterval(() => {
      this.performHealthCheck().catch(err => {
        logger.error(`Health check failed: ${err}`);
      });
    }, this.config.checkIntervalMs);
    
    logger.info('HealthMonitor started');
    this.emit('started');
  }
  
  /**
   * Para o monitoramento
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('HealthMonitor not running');
      return;
    }
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    logger.info('HealthMonitor stopped');
    this.emit('stopped');
  }
  
  /**
   * Executa check de saúde completo
   * @private
   */
  private async performHealthCheck(): Promise<void> {
    const timestamp = Date.now();

    // Check 1: Uso de memória
    const memoryMb = this.checkMemoryUsage();

    // Check 2: Memory leak detection
    this.checkMemoryLeak(timestamp, memoryMb);

    // Check 3: Processos FFmpeg órfãos
    await this.checkOrphanProcesses();

    // Check 4: Streaming health (NOVO)
    await this.checkStreamingHealth();

    // Atualizar histórico
    this.memoryHistory.push({ timestamp, memoryMb });

    // Manter apenas últimos 10 minutos de histórico
    const tenMinutesAgo = timestamp - (10 * 60 * 1000);
    this.memoryHistory = this.memoryHistory.filter(
      entry => entry.timestamp > tenMinutesAgo
    );

    this.lastMemoryMb = memoryMb;
  }
  
  /**
   * Verifica uso de memória do processo Node
   * @private
   */
  private checkMemoryUsage(): number {
    const usage = process.memoryUsage();
    const memoryMb = Math.round(usage.heapUsed / 1024 / 1024);
    
    logger.info(`Memory usage: ${memoryMb}MB (RSS: ${Math.round(usage.rss / 1024 / 1024)}MB)`);
    
    // Alertar se acima do threshold
    if (memoryMb > this.config.memoryThresholdMb) {
      logger.warn(`Memory usage HIGH: ${memoryMb}MB > ${this.config.memoryThresholdMb}MB threshold`);
      this.emit('memory_high', {
        currentMb: memoryMb,
        thresholdMb: this.config.memoryThresholdMb,
        rss: Math.round(usage.rss / 1024 / 1024)
      });
    }
    
    return memoryMb;
  }
  
  /**
   * Detecta memory leaks baseado em taxa de crescimento
   * @private
   */
  private checkMemoryLeak(timestamp: number, currentMemoryMb: number): void {
    if (this.memoryHistory.length < 2) {
      return; // Precisa de ao menos 2 pontos para calcular taxa
    }
    
    // Calcular taxa de crescimento nos últimos 2 minutos
    const twoMinutesAgo = timestamp - (2 * 60 * 1000);
    const recentHistory = this.memoryHistory.filter(
      entry => entry.timestamp > twoMinutesAgo
    );
    
    if (recentHistory.length < 2) {
      return;
    }
    
    const oldestRecent = recentHistory[0];
    const memoryGrowthMb = currentMemoryMb - oldestRecent.memoryMb;
    const timeElapsedMin = (timestamp - oldestRecent.timestamp) / 1000 / 60;
    const growthRateMbMin = memoryGrowthMb / timeElapsedMin;
    
    if (growthRateMbMin > this.config.memoryLeakRateMbMin) {
      logger.warn(`Potential memory leak detected: ${growthRateMbMin.toFixed(2)}MB/min growth`);
      this.emit('memory_leak_detected', {
        growthRateMbMin: growthRateMbMin.toFixed(2),
        thresholdMbMin: this.config.memoryLeakRateMbMin,
        currentMemoryMb,
        timeWindowMin: timeElapsedMin.toFixed(2)
      });
    }
  }
  
  /**
   * Verifica processos FFmpeg órfãos
   * @private
   */
  private async checkOrphanProcesses(): Promise<void> {
    try {
      const { stdout } = await execAsync('ps aux | grep ffmpeg | grep -v grep | wc -l');
      const ffmpegCount = parseInt(stdout.trim(), 10);

      if (ffmpegCount > this.config.maxOrphanProcesses) {
        logger.warn(`Orphan FFmpeg processes detected: ${ffmpegCount} > ${this.config.maxOrphanProcesses}`);

        // Listar processos para debug
        try {
          const { stdout: processes } = await execAsync('ps aux | grep ffmpeg | grep -v grep');
          logger.info(`FFmpeg processes:\n${processes}`);
        } catch (err) {
          // Ignorar erro ao listar processos
        }

        this.emit('orphan_processes', {
          count: ffmpegCount,
          threshold: this.config.maxOrphanProcesses
        });
      } else {
        logger.info(`FFmpeg processes: ${ffmpegCount} (OK)`);
      }
    } catch (err) {
      logger.error(`Failed to check orphan processes: ${err}`);
    }
  }

  /**
   * Verifica se streaming está ativo e tenta restart se necessário
   * @private
   */
  private async checkStreamingHealth(): Promise<void> {
    const status = this.audioManager.getStreamingStatus();

    if (!status.active) {
      logger.warn('Streaming is down, attempting auto-restart...');

      // Verificar se temos configuração para restart
      if (!this.lastStreamingConfig) {
        logger.error('Cannot auto-restart streaming: no configuration available');
        this.emit('streaming_failed', { error: 'No streaming configuration' });
        return;
      }

      try {
        await this.audioManager.startStreaming(this.lastStreamingConfig);

        logger.info('✅ Streaming auto-restarted successfully');
        this.emit('streaming_recovered', {
          host: this.lastStreamingConfig.icecastHost,
          port: this.lastStreamingConfig.icecastPort,
          mountPoint: this.lastStreamingConfig.mountPoint
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to auto-restart streaming: ${errorMsg}`);
        this.emit('streaming_failed', { error: errorMsg });
      }
    } else {
      logger.info('Streaming health: OK');
    }
  }

  /**
   * Retorna estatísticas de saúde atuais
   */
  getHealthStats() {
    const usage = process.memoryUsage();
    const memoryMb = Math.round(usage.heapUsed / 1024 / 1024);
    
    return {
      isRunning: this.isRunning,
      memoryMb,
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      uptime: Math.round(process.uptime()),
      historySize: this.memoryHistory.length
    };
  }
}

