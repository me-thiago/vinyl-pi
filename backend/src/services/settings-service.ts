import { PrismaClient } from '@prisma/client';
import { eventBus } from '../utils/event-bus';

/**
 * Definição de uma setting com metadata
 */
export interface SettingDefinition {
  key: string;
  defaultValue: number | string | boolean;
  type: 'number' | 'string' | 'boolean';
  label: string;
  description: string;
  min?: number;
  max?: number;
  unit?: string;
}

/**
 * Settings disponíveis no sistema
 */
export const SETTINGS_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'silence.threshold',
    defaultValue: -50,
    type: 'number',
    label: 'Silence Threshold',
    description: 'Nível de áudio abaixo do qual é considerado silêncio',
    min: -80,
    max: 0,
    unit: 'dB'
  },
  {
    key: 'silence.duration',
    defaultValue: 10,
    type: 'number',
    label: 'Silence Duration',
    description: 'Tempo de silêncio contínuo para disparar evento',
    min: 1,
    max: 60,
    unit: 's'
  },
  {
    key: 'clipping.threshold',
    defaultValue: -3,
    type: 'number',
    label: 'Clipping Threshold',
    description: 'Nível de áudio acima do qual é considerado clipping',
    min: -10,
    max: 0,
    unit: 'dB'
  },
  {
    key: 'clipping.cooldown',
    defaultValue: 1000,
    type: 'number',
    label: 'Clipping Cooldown',
    description: 'Tempo mínimo entre detecções de clipping',
    min: 100,
    max: 10000,
    unit: 'ms'
  },
  {
    key: 'session.timeout',
    defaultValue: 1800,
    type: 'number',
    label: 'Session Timeout',
    description: 'Tempo de silêncio para encerrar sessão automaticamente',
    min: 60,
    max: 7200,
    unit: 's'
  }
];

/**
 * Cache de settings em memória para acesso rápido
 */
interface SettingsCache {
  [key: string]: number | string | boolean;
}

/**
 * SettingsService - Gerencia configurações persistidas no banco
 *
 * Features:
 * - CRUD de settings via Prisma
 * - Cache em memória para leitura rápida
 * - Emite evento 'settings.changed' quando alterado
 * - Inicialização com valores default do .env como fallback
 */
export class SettingsService {
  private prisma: PrismaClient;
  private cache: SettingsCache = {};
  private initialized = false;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Inicializa o serviço carregando settings do banco
   * Se não existirem, cria com valores default (do .env ou hardcoded)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('⚙️  SettingsService initializing...');

    // Carregar ou criar cada setting
    for (const def of SETTINGS_DEFINITIONS) {
      const existing = await this.prisma.setting.findUnique({
        where: { key: def.key }
      });

      if (existing) {
        // Usar valor do banco
        this.cache[def.key] = this.parseValue(existing.value, def.type);
      } else {
        // Criar com valor default (verificar .env primeiro)
        const envValue = this.getEnvValue(def.key);
        const value = envValue !== undefined ? envValue : def.defaultValue;

        await this.prisma.setting.create({
          data: {
            key: def.key,
            value: String(value),
            type: def.type
          }
        });

        this.cache[def.key] = value;
        console.log(`  ✓ Created setting: ${def.key} = ${value}`);
      }
    }

    this.initialized = true;
    console.log('⚙️  SettingsService ready');
  }

  /**
   * Obtém valor de uma setting (do cache)
   */
  get<T = number | string | boolean>(key: string): T {
    if (!this.initialized) {
      throw new Error('SettingsService not initialized');
    }

    const value = this.cache[key];
    if (value === undefined) {
      const def = SETTINGS_DEFINITIONS.find(d => d.key === key);
      if (def) {
        return def.defaultValue as T;
      }
      throw new Error(`Unknown setting: ${key}`);
    }

    return value as T;
  }

  /**
   * Obtém valor numérico de uma setting
   */
  getNumber(key: string): number {
    return this.get<number>(key);
  }

  /**
   * Obtém todas as settings com seus valores e metadata
   */
  async getAll(): Promise<Array<SettingDefinition & { value: number | string | boolean }>> {
    if (!this.initialized) {
      await this.initialize();
    }

    return SETTINGS_DEFINITIONS.map(def => ({
      ...def,
      value: this.cache[def.key] ?? def.defaultValue
    }));
  }

  /**
   * Atualiza uma ou mais settings
   */
  async update(updates: Record<string, number | string | boolean>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const changedSettings: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const def = SETTINGS_DEFINITIONS.find(d => d.key === key);
      if (!def) {
        console.warn(`⚙️  Unknown setting: ${key}`);
        continue;
      }

      // Validar tipo
      if (def.type === 'number' && typeof value !== 'number') {
        throw new Error(`Setting ${key} must be a number`);
      }

      // Validar range para números
      if (def.type === 'number' && typeof value === 'number') {
        if (def.min !== undefined && value < def.min) {
          throw new Error(`Setting ${key} must be >= ${def.min}`);
        }
        if (def.max !== undefined && value > def.max) {
          throw new Error(`Setting ${key} must be <= ${def.max}`);
        }
      }

      // Atualizar no banco
      await this.prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value), type: def.type }
      });

      // Atualizar cache
      const oldValue = this.cache[key];
      this.cache[key] = value;

      if (oldValue !== value) {
        changedSettings.push(key);
        console.log(`⚙️  Setting updated: ${key} = ${value}`);
      }
    }

    // Emitir evento se houve mudanças
    if (changedSettings.length > 0) {
      await eventBus.publish('settings.changed' as any, {
        keys: changedSettings,
        settings: this.cache,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Reseta uma setting para o valor default
   */
  async reset(key: string): Promise<void> {
    const def = SETTINGS_DEFINITIONS.find(d => d.key === key);
    if (!def) {
      throw new Error(`Unknown setting: ${key}`);
    }

    await this.update({ [key]: def.defaultValue });
  }

  /**
   * Reseta todas as settings para valores default
   */
  async resetAll(): Promise<void> {
    const updates: Record<string, number | string | boolean> = {};
    for (const def of SETTINGS_DEFINITIONS) {
      updates[def.key] = def.defaultValue;
    }
    await this.update(updates);
  }

  /**
   * Obtém valor do .env para uma setting (migração)
   */
  private getEnvValue(key: string): number | string | boolean | undefined {
    const envMap: Record<string, string> = {
      'silence.threshold': 'SILENCE_THRESHOLD',
      'silence.duration': 'SILENCE_DURATION',
      'clipping.threshold': 'CLIPPING_THRESHOLD',
      'clipping.cooldown': 'CLIPPING_COOLDOWN',
      'session.timeout': 'SESSION_TIMEOUT'
    };

    const envKey = envMap[key];
    if (!envKey) return undefined;

    const envValue = process.env[envKey];
    if (!envValue) return undefined;

    const def = SETTINGS_DEFINITIONS.find(d => d.key === key);
    if (!def) return undefined;

    return this.parseValue(envValue, def.type);
  }

  /**
   * Converte string do banco para o tipo correto
   */
  private parseValue(value: string, type: string): number | string | boolean {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true';
      default:
        return value;
    }
  }
}
