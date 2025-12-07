# Story V3a-07: Refatoração AudioManager - Arquitetura Modular

**Epic:** V3a - Gravação & Fundação
**Status:** drafted
**Tipo:** Tech Debt / Refatoração
**Prioridade:** Baixa (executar após V3-06, antes de V3b)

## Contexto

O `audio-manager.ts` cresceu para **1224 linhas** com ~9 responsabilidades, incluindo:
- Gerenciamento de 3 processos FFmpeg (#1, #2, #3)
- Criação/limpeza de 3 FIFOs
- Ring Buffer para recognition
- Validação de device ALSA
- Retry/recovery logic
- Rate limiting de logs

A duplicação de código é significativa:
- `setupProcessHandlers()`, `setupMp3ProcessHandlers()`, `setupRecognitionProcessHandlers()` são ~90% idênticos
- `buildStreamingFFmpegArgs()`, `buildMp3FFmpegArgs()`, `buildRecognitionFFmpegArgs()` têm padrões similares
- Lógica de stop (SIGTERM → timeout → SIGKILL) repetida 3x

## Objetivo

Extrair responsabilidades em classes menores e reutilizáveis, mantendo `AudioManager` como orquestrador.

**Resultado esperado:**
- De 1 arquivo com 1224 linhas → 4+ arquivos com ~300 linhas cada
- Handlers unificados em uma classe
- Lógica de FIFO isolada
- Testabilidade melhorada

## Critérios de Aceitação

### 1. FFmpegProcessManager Extraído

1. Nova classe `FFmpegProcessManager` em `backend/src/utils/ffmpeg-process.ts`
2. Gerencia lifecycle de UM processo FFmpeg
3. Métodos: `start()`, `stop()`, `isRunning()`
4. Encapsula lógica de SIGTERM → timeout → SIGKILL
5. Handlers de stdout/stderr configuráveis
6. Usado por AudioManager para #1, #2, #3

```typescript
// backend/src/utils/ffmpeg-process.ts
export interface FFmpegProcessConfig {
  name: string;                              // Nome para logs
  args: string[];                            // Argumentos FFmpeg
  onStdout?: (data: Buffer) => void;         // Handler de stdout
  onStderr?: (data: string) => void;         // Handler de stderr
  onExit?: (code: number | null, signal: string | null) => void;
  onError?: (error: Error) => void;
  stopTimeoutMs?: number;                    // Default: 2000
}

export class FFmpegProcessManager {
  private process: ChildProcess | null = null;
  private config: FFmpegProcessConfig;
  
  constructor(config: FFmpegProcessConfig) { }
  
  async start(): Promise<void> { }
  async stop(): Promise<void> { }
  isRunning(): boolean { }
  getProcess(): ChildProcess | null { }
}
```

### 2. FifoManager Extraído

7. Nova classe `FifoManager` em `backend/src/utils/fifo-manager.ts`
8. Métodos: `create(paths: string[])`, `cleanup(paths: string[])`
9. Lida com verificação de existência e remoção prévia
10. Ajusta permissões automaticamente

```typescript
// backend/src/utils/fifo-manager.ts
export class FifoManager {
  async create(paths: string[]): Promise<void> { }
  async cleanup(paths: string[]): Promise<void> { }
  async exists(path: string): Promise<boolean> { }
}
```

### 3. FFmpegArgsBuilder Extraído

11. Nova classe/módulo `FFmpegArgsBuilder` em `backend/src/utils/ffmpeg-args.ts`
12. Métodos estáticos para cada tipo de FFmpeg
13. Recebe config e retorna array de argumentos
14. Centraliza conhecimento de formatos e flags

```typescript
// backend/src/utils/ffmpeg-args.ts
export interface AudioConfig {
  device: string;
  sampleRate: number;
  channels: number;
}

export interface StreamingConfig {
  icecastHost: string;
  icecastPort: number;
  icecastPassword: string;
  mountPoint: string;
  bitrate: number;
}

export class FFmpegArgsBuilder {
  static buildMainArgs(audio: AudioConfig, fifoPaths: string[]): string[] { }
  static buildMp3Args(audio: AudioConfig, streaming: StreamingConfig, fifoPath: string): string[] { }
  static buildRecognitionArgs(audio: AudioConfig, fifoPath: string): string[] { }
}
```

### 4. AudioManager Simplificado

15. AudioManager usa as novas classes
16. Reduzido para ~400 linhas (orquestração apenas)
17. Estado e config permanecem no AudioManager
18. Ring Buffer permanece no AudioManager (ou extrair se ficar grande)

```typescript
// audio-manager.ts simplificado
export class AudioManager extends EventEmitter {
  private ffmpegMain: FFmpegProcessManager;
  private ffmpegMp3: FFmpegProcessManager;
  private ffmpegRecognition: FFmpegProcessManager;
  private fifoManager: FifoManager;
  private recognitionBuffer: AudioRingBuffer;
  
  async startStreaming(config: StreamingConfig): Promise<void> {
    await this.fifoManager.create([...]);
    
    // Iniciar leitores primeiro
    await this.ffmpegMp3.start();
    await this.ffmpegRecognition.start();
    await this.ffmpegMain.start();
  }
  
  async stopStreaming(): Promise<void> {
    await this.ffmpegMain.stop();
    await this.ffmpegMp3.stop();
    await this.ffmpegRecognition.stop();
    await this.fifoManager.cleanup([...]);
  }
}
```

### 5. Testes

19. Testes unitários para `FFmpegProcessManager`
20. Testes unitários para `FifoManager`
21. Testes unitários para `FFmpegArgsBuilder`
22. Testes de integração para `AudioManager` (mock das dependências)

### 6. Documentação

23. JSDoc em todas as novas classes
24. Atualizar `docs/architecture.md` com novo diagrama
25. Atualizar `docs/technical-decisions.md` com ADR da refatoração

## Arquitetura Final

```
backend/src/
├── services/
│   └── audio-manager.ts          # ~400 linhas (orquestrador)
├── utils/
│   ├── ffmpeg-process.ts         # ~150 linhas (lifecycle de 1 processo)
│   ├── ffmpeg-args.ts            # ~100 linhas (builder de argumentos)
│   ├── fifo-manager.ts           # ~50 linhas (CRUD de FIFOs)
│   └── ring-buffer.ts            # (já existe)
```

## Plano de Execução (PRs Incrementais)

### PR 1: Extrair FFmpegProcessManager (~2h)

1. Criar `ffmpeg-process.ts` com a classe
2. Criar testes unitários
3. **NÃO** integrar ao AudioManager ainda
4. Validar que testes passam isoladamente

### PR 2: Extrair FifoManager (~1h)

1. Criar `fifo-manager.ts` com a classe
2. Criar testes unitários
3. **NÃO** integrar ao AudioManager ainda

### PR 3: Extrair FFmpegArgsBuilder (~1h)

1. Criar `ffmpeg-args.ts` com métodos estáticos
2. Criar testes unitários para cada builder
3. **NÃO** integrar ao AudioManager ainda

### PR 4: Integrar ao AudioManager (~3h)

1. Refatorar AudioManager para usar novas classes
2. Remover código duplicado
3. Manter testes de integração existentes passando
4. Validar streaming funciona end-to-end

### PR 5: Cleanup e Documentação (~1h)

1. Remover código morto
2. Atualizar documentação
3. Code review final

**Total estimado: ~8h de trabalho**

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Quebrar streaming em produção | Média | PRs incrementais, testar cada um |
| Race conditions novos | Baixa | Manter mesma ordem de start/stop |
| Regressão de performance | Baixa | Sem mudança de lógica, apenas estrutura |

## Critérios de Não-Aceitação (O que NÃO fazer)

- ❌ NÃO criar ProcessPool/registro dinâmico (over-engineering)
- ❌ NÃO mudar comportamento externo do AudioManager
- ❌ NÃO adicionar novas features junto com refatoração
- ❌ NÃO refatorar RecordingManager junto (já está bem estruturado)

## Pré-requisitos

- V3-06 (Editor de Áudio) completo
- Todos os testes existentes passando
- Nenhuma gravação em andamento no ambiente de dev

## Definition of Done

- [ ] FFmpegProcessManager extraído e testado
- [ ] FifoManager extraído e testado
- [ ] FFmpegArgsBuilder extraído e testado
- [ ] AudioManager usando novas classes
- [ ] Todos os testes passando
- [ ] Streaming funciona end-to-end (manual test)
- [ ] Documentação atualizada
- [ ] Code review aprovado
- [ ] `npm run validate` passa

## Referências

- Discussão original: Conversa com Claude sobre refatoração
- Arquivo atual: `backend/src/services/audio-manager.ts` (1224 linhas)
- Padrão de referência: `backend/src/services/recording-manager.ts` (bem estruturado)
