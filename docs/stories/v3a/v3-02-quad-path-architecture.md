# Story V3-02: Quad-Path Architecture

**Epic:** V3a - Gravação & Fundação
**Status:** done

**User Story:**
Como desenvolvedor,
quero adicionar um quarto caminho FFmpeg (FIFO3 + FFmpeg #4) para gravação FLAC,
para que o sistema possa gravar áudio lossless sem impactar o streaming existente.

## Critérios de Aceitação

### FIFO3

1. FIFO3 criado em `/tmp/vinyl-flac.fifo` no startup
2. FIFO3 é non-blocking para evitar travar FFmpeg #1
3. FIFO3 permanece ativo enquanto streaming estiver ativo

### FFmpeg #1 (Modificação)

4. FFmpeg #1 escreve no FIFO3 (além de stdout, FIFO1, FIFO2)
5. Output para FIFO3: mesmo formato PCM (s16le, 48kHz, stereo)
6. Streaming existente (PCM + MP3 + Ring Buffer) não é afetado

### FFmpeg #4 (Novo)

7. FFmpeg #4 é sob demanda (inicia quando gravação começa)
8. FFmpeg #4 lê do FIFO3
9. FFmpeg #4 codifica para FLAC (compression_level 5)
10. FFmpeg #4 escreve diretamente no arquivo de output
11. FFmpeg #4 termina quando gravação para (SIGTERM graceful)

### Arquitetura Final

```
ALSA → FFmpeg #1 (Main) → stdout (PCM → Express /stream.wav)
                        → FIFO1 (PCM → FFmpeg #2 → MP3 → Icecast)
                        → FIFO2 (PCM → FFmpeg #3 → Ring Buffer 30s)
                        → FIFO3 (PCM → FFmpeg #4 → FLAC → Arquivo)  ← NOVO
```

### Performance

12. CPU overhead com gravação ativa: < 5% adicional
13. Sem degradação na latência do stream PCM frontend
14. Sem impacto no Ring Buffer (reconhecimento continua funcionando)

### Robustez

15. Se FFmpeg #4 falhar, outros caminhos continuam funcionando
16. Se FFmpeg #4 não estiver rodando, FIFO3 não bloqueia FFmpeg #1
17. Cleanup de FIFO3 no shutdown do sistema

## Interface RecordingManager (stub)

```typescript
// backend/src/services/recording-manager.ts

interface RecordingManager {
  // FIFO management
  ensureFifoExists(): Promise<void>;
  
  // FFmpeg #4 lifecycle
  spawnFFmpegRecorder(outputPath: string): ChildProcess;
  killFFmpegRecorder(): void;
}
```

## Modificações em audio-manager.ts

```typescript
// Adicionar output para FIFO3 no comando FFmpeg #1
const ffmpegArgs = [
  // ... existente ...
  '-f', 's16le', '/tmp/vinyl-flac.fifo',  // NOVO: output para FIFO3
];
```

## Comando FFmpeg #4

```bash
ffmpeg -f s16le -ar 48000 -ac 2 -i /tmp/vinyl-flac.fifo \
  -c:a flac \
  -compression_level 5 \
  -y \
  /path/to/output.flac
```

## Pré-requisitos

- V3-01 - Schema Dados V3 (para Recording model)

## Notas de Implementação

- FIFO3 deve ser criado no startup do AudioManager
- FFmpeg #1 precisa `-f s16le /tmp/vinyl-flac.fifo` como output adicional
- FFmpeg #4 só spawna quando `startRecording()` é chamado
- Usar `spawn()` com pipes para monitorar stderr do FFmpeg #4
- Cleanup com timeout no SIGTERM (2s antes de SIGKILL)

## Testes

- [x] Criar FIFO3 no startup
- [x] FFmpeg #1 escreve no FIFO3 quando streaming ativo
- [x] FFmpeg #4 spawn funciona
- [x] FFmpeg #4 kill funciona (graceful)
- [x] Streaming não é afetado durante gravação (drain process mantém FIFO3 drenado)

### Testes Unitários Implementados (22 tests)

- `recording-manager.test.ts`:
  - constructor: inicialização, compression level default
  - startDrain: iniciar processo, não duplicar
  - stopDrain: parar processo, idempotente
  - startRecording: sucesso, albumId, fileName, erro se já gravando, para drain
  - stopRecording: sucesso, erro se não gravando, reinicia drain
  - getStatus: sem gravação, com gravação
  - getIsRecording: false/true
  - destroy: para gravação, para drain
  - events: recording_started, recording_stopped

## Referências

- [Tech Spec V3a](../../tech-spec-epic-v3a.md) - Seção System Architecture
- [Architecture](../../architecture.md) - Triple-Path (atual)
