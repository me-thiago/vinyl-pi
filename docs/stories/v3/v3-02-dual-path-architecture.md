# Story V3.2: Dual-Path Architecture - Recording Path

**Epic:** V3 - Gravação & Análise
**Status:** backlog (parcialmente implementado em V1.6)

---

## ⚠️ NOTA IMPORTANTE - Trabalho Já Realizado

**Data:** 2025-11-07  
**Contexto:** Durante implementação de V1.6 (Frontend Player), a arquitetura dual-path foi parcialmente adiantada.

### O Que Já Está Implementado (80%)

✅ **Dual FFmpeg Processes:**
- FFmpeg #1 (Producer): ALSA → stdout (RAW PCM) + FIFO (RAW PCM)
- FFmpeg #2 (Consumer): FIFO → MP3 encoding → Icecast2

✅ **Named Pipe (FIFO) para comunicação inter-processo:**
- Localização: `/tmp/vinyl-audio.fifo`
- Formato: RAW PCM s16le, 48kHz, stereo
- Não bloqueia quando consumidor desconecta

✅ **Sincronização sample-accurate:**
- Ambos processos leem do mesmo ALSA input (indiretamente via FIFO)
- Timestamps preservados

✅ **Overhead mínimo no stream path:**
- Validado: <5% impacto no streaming principal
- CPU usage: ~35% FFmpeg #1 + ~35% FFmpeg #2 = ~70% total (aceitável)

### O Que Falta Implementar (20%)

⏳ **Recording path (FLAC):**
- Adicionar terceiro output no FFmpeg #1: FLAC via novo FIFO
- FFmpeg #3 para consumir FIFO de recording e gravar FLAC

⏳ **Buffer circular para pré-roll (30s):**
- Implementar buffer em memória compartilhado
- Capturar últimos 30s antes de comando de gravação manual

⏳ **Service `recording.ts`:**
- Lógica de gerenciamento de gravações
- Start/stop recording com pré-roll
- Metadata embedding

### Arquitetura Atual (V1.6)

```
ALSA Input (plughw:1,0)
        ↓
  ┌─────────────┐
  │  FFmpeg #1  │
  │  Producer   │
  └──┬───────┬──┘
     │       │
  stdout   FIFO #1
  (PCM)    (PCM)
     │       │
     ↓       ↓
 Express  FFmpeg #2
Broadcast  (MP3)
     │       │
     ↓       ↓
Frontend  Icecast2
~150ms    ~2-5s
```

### Arquitetura Target (V3.2)

```
ALSA Input (plughw:1,0)
        ↓
  ┌─────────────┐
  │  FFmpeg #1  │
  │  Producer   │
  └──┬───┬───┬──┘
     │   │   │
  stdout │ FIFO #2 ← NOVO (FLAC)
  (PCM)  │ (PCM)
     │ FIFO #1
     │ (PCM)
     ↓   ↓   ↓
 Express │ FFmpeg #3 ← NOVO
Broadcast│  (FLAC)
     │   │   │
     │   ↓   ↓
     │ FFmpeg #2  Recording
     │  (MP3)     Service
     ↓   ↓
Frontend Icecast2
~150ms  ~2-5s
```

### Referências da Implementação Atual

- **Código:** `backend/src/services/audio-manager.ts` (linhas 300-460)
- **Arquitetura detalhada:** `docs/dual-streaming-architecture.md` (1380 linhas!)
- **Decisões técnicas:** `docs/technical-decisions.md`
- **Story V1.6:** `docs/stories/v1/v1-06-frontend-player-basico.md`

### Quando Implementar V3.2

1. **Leia primeiro:**
   - `docs/dual-streaming-architecture.md` (compreensão completa)
   - `backend/src/services/audio-manager.ts` (código existente)

2. **Adicione terceiro output no FFmpeg #1:**
   ```typescript
   // Em buildStreamingFFmpegArgs()
   args.push('-map', '0:a');
   args.push('-c:a', 'flac');
   args.push('-f', 'flac');
   args.push('/tmp/vinyl-recording.fifo');
   ```

3. **Implemente buffer circular:**
   ```typescript
   class CircularBuffer {
     private buffer: Buffer[] = [];
     private maxDuration: number = 30; // seconds
     // ... métodos push(), getPastSeconds(30)
   }
   ```

4. **Crie FFmpeg #3 (recording):**
   ```typescript
   this.ffmpegRecordingProcess = spawn('ffmpeg', [
     '-f', 'flac',
     '-i', '/tmp/vinyl-recording.fifo',
     '-c:a', 'copy',
     `recordings/${sessionId}.flac`
   ]);
   ```

5. **Implemente `recording.ts` service:**
   - startRecording(sessionId, withPreroll = false)
   - stopRecording()
   - getRecordings()

### Estimativa de Esforço

**Original (sem trabalho prévio):** 8-12 horas  
**Atual (com dual-path já feito):** 2-4 horas

**Redução:** ~70% do trabalho já concluído! 🎉

---

## User Story (Original)

Como desenvolvedor,  
quero ter um segundo processo FFmpeg para gravação paralela,  
para que possa gravar sem degradar o streaming.

## Critérios de Aceitação

1. Recording path paralelo implementado em `recording.ts`
2. Dois processos FFmpeg separados (stream path + recording path)
3. Buffer circular compartilhado para sincronização
4. Sincronização sample-accurate entre paths
5. Pré-roll de 30s via buffer circular
6. Overhead <5% no stream path (validado com testes)

## Pré-requisitos

- V3.1 - Schema de Dados V3
- V1.5 - Pipeline FFmpeg → Icecast

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.3.1 (Dual-Path Architecture)
- [PRD v3.0](../prd-v3.md) - Seção 6.2 (Arquitetura de Componentes - V3)
- [Epics](../epics.md) - Epic V3

