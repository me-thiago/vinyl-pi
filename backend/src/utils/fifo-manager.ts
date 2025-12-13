import { unlink, access } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './logger';

const execAsync = promisify(exec);
const unlinkAsync = promisify(unlink);
const accessAsync = promisify(access);

const logger = createLogger('FifoManager');

/**
 * Gerenciador de Named Pipes (FIFOs)
 *
 * Esta classe encapsula a criação e limpeza de FIFOs Unix,
 * usados para comunicação inter-processo entre múltiplos FFmpegs.
 *
 * @example
 * ```typescript
 * const fifoManager = new FifoManager();
 *
 * // Criar FIFOs
 * await fifoManager.create([
 *   '/tmp/vinyl-audio.fifo',
 *   '/tmp/vinyl-recognition.fifo',
 * ]);
 *
 * // ... uso ...
 *
 * // Limpar FIFOs
 * await fifoManager.cleanup([
 *   '/tmp/vinyl-audio.fifo',
 *   '/tmp/vinyl-recognition.fifo',
 * ]);
 * ```
 */
export class FifoManager {
  /**
   * Cria múltiplos FIFOs
   *
   * Para cada path:
   * 1. Remove FIFO existente se houver
   * 2. Cria novo FIFO com mkfifo
   * 3. Ajusta permissões para 666
   *
   * @param paths Array de caminhos para os FIFOs
   * @throws Error se falhar em criar algum FIFO
   */
  async create(paths: string[]): Promise<void> {
    for (const fifoPath of paths) {
      await this.createSingle(fifoPath);
    }
  }

  /**
   * Cria um único FIFO
   *
   * @param fifoPath Caminho para o FIFO
   * @throws Error se falhar em criar
   */
  async createSingle(fifoPath: string): Promise<void> {
    // Verificar se FIFO já existe e remover
    try {
      await accessAsync(fifoPath);
      await unlinkAsync(fifoPath);
      logger.debug(`Removed existing FIFO at ${fifoPath}`);
    } catch {
      // Não existe, OK
    }

    // Criar FIFO usando comando mkfifo do sistema
    try {
      await execAsync(`mkfifo ${fifoPath}`);
      // Ajustar permissões para leitura/escrita por todos
      await execAsync(`chmod 666 ${fifoPath}`);
      logger.info(`Created FIFO at ${fifoPath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create FIFO ${fifoPath}: ${errorMsg}`);
      throw new Error(`Failed to create FIFO ${fifoPath}: ${errorMsg}`);
    }
  }

  /**
   * Remove múltiplos FIFOs
   *
   * Ignora erros silenciosamente (FIFO pode não existir)
   *
   * @param paths Array de caminhos para os FIFOs
   */
  async cleanup(paths: string[]): Promise<void> {
    for (const fifoPath of paths) {
      await this.cleanupSingle(fifoPath);
    }
  }

  /**
   * Remove um único FIFO
   *
   * @param fifoPath Caminho para o FIFO
   */
  async cleanupSingle(fifoPath: string): Promise<void> {
    try {
      await unlinkAsync(fifoPath);
      logger.debug(`Cleaned up FIFO at ${fifoPath}`);
    } catch {
      // Ignorar erro se não existir
      logger.debug(`FIFO cleanup (may not exist): ${fifoPath}`);
    }
  }

  /**
   * Verifica se um FIFO existe
   *
   * @param fifoPath Caminho para o FIFO
   * @returns true se existe, false caso contrário
   */
  async exists(fifoPath: string): Promise<boolean> {
    try {
      await accessAsync(fifoPath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Instância singleton do FifoManager
 *
 * Use esta instância para evitar criar múltiplas instâncias desnecessárias.
 */
export const fifoManager = new FifoManager();
