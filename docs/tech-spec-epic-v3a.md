# Epic Technical Specification: Gravação & Fundação

Date: 2025-12-06
Author: Winston (Architect) + Thiago
Epic ID: v3a
Status: Draft

---

## Overview

O Epic V3a - Gravação & Fundação representa a primeira fase da evolução do Vinyl-OS de um sistema de streaming e reconhecimento para uma plataforma de arquivamento digital de alta qualidade. Este épico estabelece a infraestrutura de gravação que será base para reconhecimento offline (V3b) e análise de qualidade (V3c).

**Objetivos principais:**

1. **Quad-Path Architecture**: Adicionar quarto caminho FFmpeg para gravação FLAC sem impactar os três existentes (PCM frontend, MP3 Icecast, Ring Buffer recognition).

2. **Gravação FLAC Manual**: Sistema de gravação sob demanda - usuário controla início/fim, sem gravação automática.

3. **Editor de Áudio Básico**: Trim e marcação de faixas em arquivo FLAC único por álbum.

4. **Gestão de Gravações**: UI para visualizar, gerenciar e vincular gravações a álbuns da coleção.

5. **Monitoramento de Storage**: Alerta quando disco atingir 50% de capacidade.

**Filosofia:** Um arquivo FLAC por álbum com marcações de faixa (metadados) é mais limpo que múltiplos arquivos fragmentados. Quando gerar chromaprint (V3b), extraímos segmentos usando os offsets.

---

## Objectives and Scope

### In Scope (V3a)

**Arquitetura:**
- FFmpeg #4 dedicado para gravação FLAC via FIFO3
- Schema de dados V3 (recordings, track_markers)
- Integração não-intrusiva com pipeline existente

**Gravação:**
- Gravação FLAC manual (botão start/stop)
- Armazenamento organizado por mês (`data/recordings/YYYY-MM/`)
- Vinculação opcional a álbum da coleção
- Suporte a gravações "órfãs" (sem álbum associado)

**Editor:**
- Trim: cortar início/fim da gravação
- Marcação de faixas: definir início/fim de cada faixa (sem split)
- Persistência de marcações como metadados

**UI:**
- Botão Record/Stop no footer do player
- Página de listagem de gravações
- Página de detalhe do álbum expandida (com gravações)
- Editor de áudio integrado (waveform + marcações)

**Monitoramento:**
- Alerta de storage a 50% de capacidade
- Exibição de espaço usado/disponível

### Out of Scope (V3a)

- Gravação automática por sessão → Removido (complexidade desnecessária)
- Pré-roll (captura antes do comando) → Removido (overkill)
- Segmentação automática por silêncio → V3b/V3c
- Chromaprint / fingerprinting → V3b
- Análise de qualidade (SNR, clicks/pops) → V3c
- Health Score → V3c
- Reconhecimento offline → V3b

---

## System Architecture Alignment

### Arquitetura Atual (V2) - Triple-Path

```
ALSA → FFmpeg #1 (Main) → stdout (PCM → Express /stream.wav)
                        → FIFO1 (PCM → FFmpeg #2 → MP3 → Icecast)
                        → FIFO2 (PCM → FFmpeg #3 → Ring Buffer 30s)
```

### Arquitetura V3a - Quad-Path

```
ALSA → FFmpeg #1 (Main) → stdout (PCM → Express /stream.wav)
                        → FIFO1 (PCM → FFmpeg #2 → MP3 → Icecast)
                        → FIFO2 (PCM → FFmpeg #3 → Ring Buffer 30s)
                        → FIFO3 (PCM → FFmpeg #4 → FLAC → Arquivo)  ← NOVO
```

**Características do FFmpeg #4:**
- Inicia sob demanda (não permanente como #2 e #3)
- Lê do FIFO3 (Named Pipe dedicado)
- Encoding FLAC em tempo real
- Output direto para arquivo no filesystem
- Termina quando usuário para gravação

### Componentes Existentes Modificados

| Componente | Modificação |
|------------|-------------|
| `audio-manager.ts` | Adicionar FIFO3, métodos startRecording/stopRecording |
| `index.ts` (routes) | Novas rotas /api/recordings |
| Frontend Player | Botão Record no footer |

### Novos Componentes V3a

```
backend/src/
├── services/
│   ├── recording-manager.ts   # Gerencia FFmpeg #4 e arquivos FLAC
│   └── storage-monitor.ts     # Monitora espaço em disco
├── routes/
│   └── recordings.ts          # CRUD de gravações + controle rec
├── schemas/
│   └── recordings.schema.ts   # Validação Zod
└── utils/
    └── flac-editor.ts         # Trim e extração de segmentos via FFmpeg

frontend/src/
├── pages/
│   ├── Recordings.tsx         # Listagem de gravações
│   └── AlbumDetail.tsx        # Detalhe do álbum (expandido)
├── components/
│   ├── Recording/
│   │   ├── RecordButton.tsx   # Botão record/stop
│   │   ├── RecordingCard.tsx  # Card na listagem
│   │   └── RecordingStatus.tsx # Indicador de gravação ativa
│   └── Editor/
│       ├── WaveformEditor.tsx # Visualização waveform
│       ├── TrackMarkers.tsx   # Marcadores de faixa
│       └── TrimControls.tsx   # Controles de trim
└── hooks/
    ├── useRecording.ts        # Estado de gravação
    └── useWaveform.ts         # Renderização waveform
```

### Fluxo de Dados V3a

```
┌─────────────────────────────────────────────────────────────────┐
│                           Frontend                               │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  Player  │  │ Recordings │  │AlbumDetail│  │WaveformEdit │  │
│  │(+Record) │  │   List     │  │           │  │             │  │
│  └────┬─────┘  └─────┬──────┘  └─────┬─────┘  └──────┬──────┘  │
└───────┼──────────────┼───────────────┼───────────────┼──────────┘
        │ WS           │ REST          │ REST          │ REST
┌───────▼──────────────▼───────────────▼───────────────▼──────────┐
│                           Backend                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Recording  │  │ Recordings │  │   Albums   │  │   FLAC    │  │
│  │  Manager   │  │   Route    │  │   Route    │  │  Editor   │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  │
│        │               │               │               │         │
│        └───────┬───────┴───────┬───────┴───────────────┘         │
│                │               │                                  │
│         ┌──────▼──────┐  ┌─────▼──────┐  ┌────────────────┐     │
│         │   Prisma    │  │  EventBus  │  │ Storage Monitor│     │
│         │  (SQLite)   │  │            │  │                │     │
│         └─────────────┘  └────────────┘  └────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
        │                       │                    │
        ▼                       ▼                    ▼
┌───────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  SQLite DB    │    │   data/          │    │  Filesystem     │
│  recordings   │    │   recordings/    │    │  (df -h)        │
│  track_markers│    │   YYYY-MM/*.flac │    │                 │
└───────────────┘    └──────────────────┘    └─────────────────┘
```

---

## Detailed Design

### Services and Modules

| Service/Module | Responsabilidades | Inputs/Outputs | Localização |
|----------------|-------------------|----------------|-------------|
| `recording-manager.ts` | Controle do FFmpeg #4, start/stop recording | Commands → FLAC files | `backend/src/services/` |
| `storage-monitor.ts` | Monitorar espaço em disco, emitir alertas | Polling → Events | `backend/src/services/` |
| `flac-editor.ts` | Trim FLAC, extrair segmentos por offset | FLAC + offsets → FLAC | `backend/src/utils/` |
| `recordings.ts` (route) | CRUD de gravações, controle rec/stop | HTTP requests | `backend/src/routes/` |
| `recordings.schema.ts` | Validação Zod para gravações | Schema validation | `backend/src/schemas/` |
| `Recordings.tsx` | Página de listagem de gravações | React component | `frontend/src/pages/` |
| `AlbumDetail.tsx` | Página expandida do álbum | Props: albumId | `frontend/src/pages/` |
| `RecordButton.tsx` | Botão record/stop no footer | Props: isRecording, onClick | `frontend/src/components/` |
| `WaveformEditor.tsx` | Visualização e edição waveform | Props: recordingId | `frontend/src/components/` |
| `TrackMarkers.tsx` | Marcadores de faixa | Props: markers, onChange | `frontend/src/components/` |
| `useRecording.ts` | Hook para controle de gravação | start, stop, status | `frontend/src/hooks/` |
| `useWaveform.ts` | Hook para renderização waveform | audioUrl → waveform data | `frontend/src/hooks/` |

### Data Models and Contracts

**Prisma Schema V3a (adições ao schema existente):**

```prisma
// ============================================
// V3a Models - Gravação & Fundação
// ============================================

/// Status da gravação
enum RecordingStatus {
  recording    // Gravação em andamento
  completed    // Gravação finalizada
  processing   // Processando (trim, etc)
  error        // Erro durante gravação
}

model Recording {
  id               String          @id @default(uuid())
  albumId          String?         // Opcional - pode ser órfã
  album            Album?          @relation(fields: [albumId], references: [id], onDelete: SetNull)
  sessionId        String?         // Sessão em que foi gravada
  session          Session?        @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  // Arquivo
  filePath         String          // Caminho relativo: YYYY-MM/rec-{id}.flac
  fileName         String          // Nome amigável (ex: "Abbey Road - Lado A")
  format           String          @default("flac")
  sampleRate       Int             @default(48000)
  bitDepth         Int             @default(16)
  channels         Int             @default(2)

  // Metadados
  durationSeconds  Int?            // Duração total em segundos
  fileSizeBytes    Int?            // Tamanho do arquivo
  status           RecordingStatus @default(recording)
  notes            String?         // Notas do usuário

  // Timestamps
  startedAt        DateTime        @default(now())
  completedAt      DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  // Relacionamentos
  trackMarkers     TrackMarker[]

  @@index([albumId])
  @@index([sessionId])
  @@index([status])
  @@index([startedAt(sort: Desc)])
}

model TrackMarker {
  id               String          @id @default(uuid())
  recordingId      String
  recording        Recording       @relation(fields: [recordingId], references: [id], onDelete: Cascade)

  trackNumber      Int             // 1, 2, 3...
  title            String?         // Nome da faixa (opcional)
  startOffset      Float           // Início em segundos (ex: 0.0, 180.5)
  endOffset        Float           // Fim em segundos (ex: 180.5, 360.0)

  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@unique([recordingId, trackNumber])
  @@index([recordingId])
}

// Atualização do Album model para incluir recordings
model Album {
  // ... campos existentes V2 ...
  recordings       Recording[]     // NOVO: gravações vinculadas
}

// Atualização do Session model para incluir recordings
model Session {
  // ... campos existentes ...
  recordings       Recording[]     // NOVO: gravações da sessão
}
```

**Relacionamentos:**
- `Recording` N:1 `Album` (opcional - gravação pode ser órfã)
- `Recording` N:1 `Session` (opcional - contexto de quando foi gravada)
- `Recording` 1:N `TrackMarker` (marcações de faixa)

**Campos especiais:**
- `filePath`: Caminho relativo, ex: `2025-12/rec-abc123.flac`
- `startOffset`/`endOffset`: Offsets em segundos com precisão decimal para marcação de faixas
- `status`: Controla lifecycle da gravação

### APIs and Interfaces

**Recordings CRUD:**

```typescript
// POST /api/recordings/start - Iniciar gravação
Body: {
  albumId?: string;       // Vincular a álbum (opcional)
  fileName?: string;      // Nome amigável (default: timestamp)
}
Response: {
  data: {
    id: string;
    status: 'recording';
    startedAt: string;
    filePath: string;
  }
}

// POST /api/recordings/stop - Parar gravação
Body: {
  recordingId: string;
}
Response: {
  data: Recording;        // Com durationSeconds e fileSizeBytes preenchidos
}

// GET /api/recordings - Listar gravações
Query: {
  limit?: number;         // default: 20
  offset?: number;        // default: 0
  albumId?: string;       // Filtrar por álbum
  status?: RecordingStatus;
  sort?: 'startedAt' | 'durationSeconds' | 'fileSizeBytes';
  order?: 'asc' | 'desc';
}
Response: {
  data: Recording[];
  meta: { total: number; limit: number; offset: number; }
}

// GET /api/recordings/:id - Buscar gravação
Response: {
  data: Recording;        // Inclui trackMarkers
}

// PUT /api/recordings/:id - Atualizar gravação
Body: {
  fileName?: string;
  albumId?: string | null;  // null para desvincular
  notes?: string;
}
Response: { data: Recording }

// DELETE /api/recordings/:id - Deletar gravação
Response: { success: true }
// NOTA: Remove arquivo FLAC do filesystem também

// GET /api/recordings/:id/stream - Stream do arquivo FLAC
Response: audio/flac (streaming)

// GET /api/recordings/:id/waveform - Dados para renderização waveform
Query: {
  resolution?: number;    // Pontos por segundo (default: 10)
}
Response: {
  data: {
    peaks: number[];      // Array de picos normalizados 0-1
    duration: number;     // Duração em segundos
    sampleRate: number;
  }
}
```

**Track Markers:**

```typescript
// GET /api/recordings/:id/markers - Listar marcadores
Response: {
  data: TrackMarker[];
}

// POST /api/recordings/:id/markers - Criar marcador
Body: {
  trackNumber: number;
  title?: string;
  startOffset: number;    // Em segundos
  endOffset: number;
}
Response: { data: TrackMarker }

// PUT /api/recordings/:recordingId/markers/:markerId - Atualizar marcador
Body: {
  title?: string;
  startOffset?: number;
  endOffset?: number;
}
Response: { data: TrackMarker }

// DELETE /api/recordings/:recordingId/markers/:markerId - Deletar marcador
Response: { success: true }

// POST /api/recordings/:id/markers/auto-detect - Detectar faixas por silêncio
Response: {
  data: {
    suggestedMarkers: Array<{
      trackNumber: number;
      startOffset: number;
      endOffset: number;
    }>;
  }
}
// NOTA: Apenas sugere, não cria automaticamente
```

**Editor/Trim:**

```typescript
// POST /api/recordings/:id/trim - Cortar início/fim
Body: {
  startOffset: number;    // Novo início em segundos
  endOffset: number;      // Novo fim em segundos
  createCopy?: boolean;   // Se true, cria novo arquivo. Default: false (modifica in-place)
}
Response: {
  data: Recording;        // Com durationSeconds atualizado
  previousDuration: number;
}

// POST /api/recordings/:id/extract-track - Extrair faixa como arquivo separado
Body: {
  markerId: string;       // ID do marcador da faixa
  outputFormat?: 'flac' | 'wav';  // Default: flac
}
Response: {
  data: {
    filePath: string;     // Caminho do arquivo extraído
    duration: number;
  }
}
// NOTA: Usado principalmente para V3b (chromaprint de faixa individual)
```

**Storage:**

```typescript
// GET /api/system/storage - Informações de storage
Response: {
  data: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usedPercent: number;
    recordingsBytes: number;  // Espaço usado por gravações
    recordingsCount: number;
    alertThreshold: number;   // 50
    alertActive: boolean;     // true se usedPercent >= 50
  }
}
```

**Recording Status (WebSocket):**

```typescript
// GET /api/recordings/status - Status atual de gravação
Response: {
  data: {
    isRecording: boolean;
    currentRecording?: {
      id: string;
      startedAt: string;
      durationSeconds: number;  // Atualizado em tempo real
      fileSizeBytes: number;
    };
  }
}
```

### Recording Manager Service

```typescript
// backend/src/services/recording-manager.ts

interface RecordingManager {
  // Controle de gravação
  startRecording(options: StartRecordingOptions): Promise<Recording>;
  stopRecording(): Promise<Recording>;
  getStatus(): RecordingStatus;

  // FIFO management
  ensureFifoExists(): Promise<void>;

  // FFmpeg #4 lifecycle
  spawnFFmpegRecorder(outputPath: string): ChildProcess;
  killFFmpegRecorder(): void;
}

interface StartRecordingOptions {
  albumId?: string;
  fileName?: string;
}

interface RecordingStatus {
  isRecording: boolean;
  currentRecording?: {
    id: string;
    startedAt: Date;
    durationSeconds: number;
  };
}
```

**FFmpeg #4 Command:**

```bash
ffmpeg -f s16le -ar 48000 -ac 2 -i /tmp/vinyl-flac.fifo \
  -c:a flac \
  -compression_level 5 \
  -y \
  /path/to/output.flac
```

**Parâmetros:**
- `-f s16le`: Input PCM signed 16-bit little endian
- `-ar 48000`: Sample rate 48kHz
- `-ac 2`: Stereo
- `-c:a flac`: Codec FLAC
- `-compression_level 5`: Balanço entre compressão e CPU (0-12, default 5)
- `-y`: Sobrescrever se existir

### Storage Monitor Service

```typescript
// backend/src/services/storage-monitor.ts

interface StorageMonitor {
  getStorageInfo(): Promise<StorageInfo>;
  startMonitoring(intervalMs: number): void;
  stopMonitoring(): void;
}

interface StorageInfo {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
  recordingsBytes: number;
  recordingsCount: number;
  alertActive: boolean;
}

// Implementação usa 'df -B1' para obter info do filesystem
// Alerta emitido via EventBus quando usedPercent >= 50
```

### FLAC Editor Utility

```typescript
// backend/src/utils/flac-editor.ts

interface FlacEditor {
  // Trim arquivo FLAC
  trim(inputPath: string, outputPath: string, startSeconds: number, endSeconds: number): Promise<void>;

  // Extrair segmento
  extractSegment(inputPath: string, outputPath: string, startSeconds: number, endSeconds: number): Promise<void>;

  // Obter duração
  getDuration(filePath: string): Promise<number>;

  // Gerar dados de waveform
  generateWaveformData(filePath: string, resolution: number): Promise<WaveformData>;
}

interface WaveformData {
  peaks: number[];      // Picos normalizados 0-1
  duration: number;
  sampleRate: number;
}
```

**FFmpeg para trim:**

```bash
ffmpeg -i input.flac \
  -ss 10.5 \           # Start offset
  -to 180.0 \          # End offset
  -c:a flac \
  -compression_level 5 \
  output.flac
```

**FFmpeg para waveform data:**

```bash
ffmpeg -i input.flac \
  -filter_complex "aformat=channel_layouts=mono,compand,showwavespic=s=1800x140:colors=white" \
  -frames:v 1 \
  waveform.png

# Ou para dados numéricos:
ffmpeg -i input.flac \
  -af "aresample=8000,asetnsamples=n=800" \
  -f f32le - | node parseFloats.js
```

### Workflows and Sequencing

**Workflow 1: Iniciar Gravação**

```
1. Usuário clica botão "Record" no footer
2. Frontend POST /api/recordings/start { albumId? }
3. Backend (RecordingManager):
   a. Criar registro Recording no banco (status: 'recording')
   b. Criar diretório YYYY-MM se não existir
   c. Garantir FIFO3 existe (mkfifo se necessário)
   d. Spawnar FFmpeg #4 lendo FIFO3, escrevendo no arquivo FLAC
   e. FFmpeg #1 já está escrevendo no FIFO3 (sempre ativo quando streaming)
4. Retorna recording com id e status
5. Frontend atualiza UI (botão muda para "Stop", indicador de gravação)
6. WebSocket broadcast 'recording_started'
```

**Workflow 2: Parar Gravação**

```
1. Usuário clica botão "Stop"
2. Frontend POST /api/recordings/stop { recordingId }
3. Backend (RecordingManager):
   a. Enviar SIGTERM para FFmpeg #4
   b. Aguardar FFmpeg finalizar (graceful shutdown)
   c. Calcular duração e tamanho do arquivo
   d. Atualizar Recording (status: 'completed', durationSeconds, fileSizeBytes)
4. Retorna recording atualizado
5. Frontend atualiza UI (botão volta para "Record")
6. WebSocket broadcast 'recording_stopped'
7. Opcional: Frontend navega para página de edição
```

**Workflow 3: Editar Gravação (Trim)**

```
1. Usuário abre página de edição de gravação
2. Frontend GET /api/recordings/:id/waveform
3. Renderiza waveform com wavesurfer.js ou peaks.js
4. Usuário arrasta handles para definir novo início/fim
5. Usuário clica "Aplicar Trim"
6. Frontend POST /api/recordings/:id/trim { startOffset, endOffset }
7. Backend (FlacEditor):
   a. Criar arquivo temporário com segmento trimmed
   b. Substituir arquivo original pelo trimmed
   c. Atualizar Recording.durationSeconds
   d. Ajustar TrackMarkers (subtrair startOffset de todos offsets)
8. Retorna recording atualizado
9. Frontend recarrega waveform
```

**Workflow 4: Marcar Faixas**

```
1. Usuário visualiza waveform da gravação
2. Clica em ponto da waveform para adicionar marcador
3. Frontend POST /api/recordings/:id/markers { trackNumber, startOffset, endOffset }
4. Backend cria TrackMarker
5. Marcador aparece visualmente na waveform
6. Usuário pode arrastar marcador para ajustar
7. PUT /api/recordings/:id/markers/:markerId atualiza offsets
8. Repeat para todas as faixas
```

**Workflow 5: Vincular Gravação a Álbum**

```
1. Na página de edição ou listagem
2. Usuário seleciona álbum do dropdown
3. Frontend PUT /api/recordings/:id { albumId }
4. Backend atualiza Recording.albumId
5. Gravação aparece na página de detalhe do álbum
```

**Workflow 6: Alerta de Storage**

```
1. StorageMonitor verifica storage a cada 5 minutos
2. Se usedPercent >= 50%:
   a. EventBus emit 'storage.alert'
   b. WebSocket broadcast 'storage_alert'
3. Frontend mostra banner/toast de alerta
4. Alerta persiste até storage < 50% ou usuário dismissar
```

**Sequência de Eventos (EventBus):**

```typescript
// Novos eventos V3a
'recording.started'       // Payload: { recording }
'recording.stopped'       // Payload: { recording }
'recording.deleted'       // Payload: { recordingId }
'recording.trimmed'       // Payload: { recording, previousDuration }
'storage.alert'           // Payload: { usedPercent, availableBytes }
'storage.ok'              // Payload: { usedPercent } (quando volta ao normal)
```

**WebSocket Events (Socket.io):**

```typescript
// Server → Client
{ type: 'recording_started', data: { recording } }
{ type: 'recording_stopped', data: { recording } }
{ type: 'recording_progress', data: { recordingId, durationSeconds, fileSizeBytes } }
{ type: 'storage_alert', data: { usedPercent, availableBytes, message } }
```

---

## Non-Functional Requirements

### Performance

| Métrica | Target | Notas |
|---------|--------|-------|
| Overhead de gravação no streaming | < 5% CPU | FFmpeg #4 não deve impactar #1, #2, #3 |
| Latência início de gravação | < 2s | Do clique até FFmpeg #4 rodando |
| Trim de 45min FLAC | < 30s | FFmpeg com seek otimizado |
| Geração de waveform (45min) | < 10s | Cache de waveform data |
| Listagem de gravações (100 itens) | < 200ms | Paginação obrigatória |

**Otimizações:**
- FIFO3 sempre existe (criado no startup)
- FFmpeg #4 usa `-compression_level 5` (balanço CPU/size)
- Waveform data cacheada após primeira geração
- Índices no banco para queries frequentes

### Storage

| Aspecto | Especificação |
|---------|---------------|
| Formato | FLAC (lossless, ~50-60% do tamanho WAV) |
| Sample Rate | 48kHz (match com input ALSA) |
| Bit Depth | 16-bit |
| Channels | Stereo |
| Tamanho estimado | ~200-250MB por álbum de 45min |
| Organização | `data/recordings/YYYY-MM/rec-{id}.flac` |
| Alerta | 50% de uso do disco |

**Estimativas de storage:**
- 100 álbuns gravados ≈ 20-25GB
- SD Card 64GB: ~150 álbuns antes de alerta

### Security

| Aspecto | Implementação |
|---------|---------------|
| Validação de input | Zod schemas para todos endpoints |
| Path traversal | Sanitizar filePath, usar apenas IDs |
| File access | Apenas dentro de `data/recordings/` |
| Rate limiting | Mantido de V1.5 |

### Reliability

| Cenário | Comportamento |
|---------|---------------|
| FFmpeg #4 crash durante gravação | Detectar, marcar como 'error', limpar arquivo parcial |
| Disco cheio durante gravação | FFmpeg falha, detectar, marcar como 'error', alertar |
| Sistema reinicia durante gravação | Orphan file cleanup no startup |
| Browser fecha durante gravação | Gravação continua, pode ser parada via API |

**Graceful Degradation:**
- Gravação é feature opcional - streaming continua funcionando
- Se FFmpeg #4 falhar, não afeta outros caminhos
- Arquivos parciais são limpos automaticamente

### Observability

| Sinal | Implementação |
|-------|---------------|
| Logs de gravação | `[Recording] start/stop: id, duration, size` |
| Logs de storage | `[Storage] check: used%, available` |
| Métricas | Contador de gravações, duração total, espaço usado |
| Erros | Sentry para falhas de FFmpeg e I/O |

---

## Dependencies and Integrations

### Novas Dependências Backend

```json
{
  "dependencies": {
    // Nenhuma nova dependência necessária
    // FFmpeg já está instalado
    // Node.js fs/child_process para operações
  }
}
```

### Novas Dependências Frontend

```json
{
  "dependencies": {
    "wavesurfer.js": "^7.x"  // Visualização e edição de waveform
  }
}
```

**Por que wavesurfer.js?**
- Mais popular e bem documentado que peaks.js
- Suporte a plugins (regions, markers, timeline)
- Renderização canvas otimizada
- API simples para marcadores e regions

### FFmpeg (existente)

Já instalado, usado para:
- Encoding FLAC em tempo real
- Trim e extração de segmentos
- Geração de waveform data

---

## Acceptance Criteria

### Arquitetura (V3-01, V3-02)

**AC-01**: FIFO3 criado no startup
- Given: Sistema iniciando
- When: Backend carrega
- Then: `/tmp/vinyl-flac.fifo` existe

**AC-02**: FFmpeg #1 escreve no FIFO3 quando streaming ativo
- Given: Streaming ativo
- When: Áudio sendo processado
- Then: Dados PCM fluem para FIFO3

**AC-03**: Schema V3 migrado
- Given: Banco de dados V2
- When: Migration executada
- Then: Tabelas `Recording` e `TrackMarker` existem

### Gravação (V3-03)

**AC-04**: Iniciar gravação funciona
- Given: Streaming ativo
- When: POST /api/recordings/start
- Then: FFmpeg #4 rodando, arquivo FLAC sendo escrito

**AC-05**: Parar gravação funciona
- Given: Gravação em andamento
- When: POST /api/recordings/stop
- Then: FFmpeg #4 finalizado, arquivo FLAC completo, durationSeconds calculado

**AC-06**: Gravação vinculada a álbum
- Given: Álbum existente
- When: POST /api/recordings/start { albumId }
- Then: Recording.albumId preenchido

**AC-07**: Gravação órfã permitida
- Given: Nenhum álbum especificado
- When: POST /api/recordings/start {}
- Then: Recording criado com albumId = null

**AC-08**: Múltiplas gravações não permitidas
- Given: Gravação em andamento
- When: POST /api/recordings/start
- Then: Response 409 "Gravação já em andamento"

### UI Gravação (V3-04)

**AC-09**: Botão Record no footer
- Given: Player visível
- When: Olhar footer
- Then: Botão de gravação visível

**AC-10**: Indicador de gravação ativa
- Given: Gravação em andamento
- When: Olhar UI
- Then: Indicador visual (ícone pulsante, duração contando)

**AC-11**: Listagem de gravações
- Given: 5 gravações existentes
- When: GET /api/recordings
- Then: Lista com 5 itens, ordenadas por data desc

### Editor (V3-06)

**AC-12**: Waveform renderizado
- Given: Gravação completa
- When: Abrir editor
- Then: Waveform visível com duration correta

**AC-13**: Trim funciona
- Given: Gravação de 10min
- When: POST /api/recordings/:id/trim { startOffset: 60, endOffset: 540 }
- Then: Arquivo tem 8min, durationSeconds = 480

**AC-14**: Marcador de faixa funciona
- Given: Gravação sem marcadores
- When: POST /api/recordings/:id/markers { trackNumber: 1, startOffset: 0, endOffset: 180 }
- Then: TrackMarker criado

**AC-15**: Marcadores ajustados após trim
- Given: Gravação com marcador em offset 120s
- When: Trim com startOffset: 60
- Then: Marcador ajustado para offset 60s

### Storage (V3-03)

**AC-16**: Alerta de storage a 50%
- Given: Storage em 51% de uso
- When: StorageMonitor verifica
- Then: WebSocket broadcast 'storage_alert'

**AC-17**: Info de storage disponível
- Given: Sistema rodando
- When: GET /api/system/storage
- Then: Retorna bytes used, available, percent, alert status

### Álbum Detail (V3-05)

**AC-18**: Gravações listadas na página do álbum
- Given: Álbum com 2 gravações vinculadas
- When: Abrir página do álbum
- Then: Lista de gravações visível

**AC-19**: Link para editor da gravação
- Given: Gravação listada
- When: Clicar na gravação
- Then: Navega para página de edição

---

## Stories Breakdown

| # | Story ID | Título | Descrição | Risco |
|---|----------|--------|-----------|-------|
| 1 | V3-01 | Schema Dados V3 | Criar tabelas Recording e TrackMarker | 🟢 Baixo |
| 2 | V3-02 | Quad-Path Architecture | FIFO3 + FFmpeg #4 integration | 🟡 Médio |
| 3 | V3-03 | Gravação FLAC Manual | API start/stop + RecordingManager | 🟡 Médio |
| 4 | V3-04 | UI Gravações | Listagem + botão Record no footer | 🟢 Baixo |
| 5 | V3-05 | UI Detalhe Álbum | Página expandida com gravações | 🟢 Baixo |
| 6 | V3-06 | Editor de Áudio | Waveform + trim + marcadores | 🟡 Médio |

### Dependências entre Stories

```
V3-01 (Schema)
   ↓
V3-02 (Architecture)
   ↓
V3-03 (Gravação)
   ↓
   ├── V3-04 (UI Gravações)
   │      ↓
   │   V3-05 (UI Álbum Detail)
   │
   └── V3-06 (Editor)
```

---

## Risks, Assumptions, Open Questions

### Risks

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | FIFO3 blocking outros caminhos | Baixa | Alto | FIFO não-bloqueante, monitorar em dev |
| R2 | FFmpeg #4 consome muito CPU | Média | Médio | Testar no Pi, ajustar compression_level |
| R3 | SD Card espaço insuficiente | Alta | Alto | Alerta a 50%, UI clara de storage |
| R4 | Waveform lento para arquivos grandes | Média | Baixo | Cache, renderização progressiva |
| R5 | Editor complexo demais | Média | Médio | Manter MVP (trim + markers básicos) |

### Assumptions

| # | Assumption | Validação |
|---|------------|-----------|
| A1 | FFmpeg consegue múltiplos outputs sem degradação | Já validado com 3 caminhos |
| A2 | FLAC compression level 5 é aceitável no Pi | Testar CPU durante gravação |
| A3 | wavesurfer.js funciona bem com arquivos de 45min | Testar performance |
| A4 | Usuário prefere 1 arquivo com marcadores vs múltiplos arquivos | Decisão tomada com Thiago |

### Open Questions

| # | Questão | Status | Decisão |
|---|---------|--------|---------|
| Q1 | Gravação automática por sessão? | **Decidido** | Não - apenas manual |
| Q2 | Pré-roll necessário? | **Decidido** | Não - usuário inicia e coloca disco |
| Q3 | Split automático por silêncio? | **Decidido** | Não para V3a - marcação manual |
| Q4 | Qual lib de waveform? | **Decidido** | wavesurfer.js |
| Q5 | FIFO permanente ou sob demanda? | Aberto | Sugestão: permanente (simplifica) |

---

## Test Strategy Summary

### Unit Tests

**Backend (Jest):**
```
backend/src/services/__tests__/
├── recording-manager.test.ts    # Mock FFmpeg spawn/kill
├── storage-monitor.test.ts      # Mock df command
└── flac-editor.test.ts          # Mock FFmpeg trim

backend/src/routes/__tests__/
├── recordings.test.ts           # CRUD + start/stop
└── track-markers.test.ts        # Markers CRUD
```

**Frontend (Vitest):**
```
frontend/src/hooks/__tests__/
├── useRecording.test.ts
└── useWaveform.test.ts

frontend/src/components/__tests__/
├── RecordButton.test.tsx
└── WaveformEditor.test.tsx
```

### Integration Tests

| Teste | Descrição |
|-------|-----------|
| Recording lifecycle | Start → Stop → Verify file exists |
| Trim workflow | Create → Trim → Verify new duration |
| Markers CRUD | Create → Update → Delete markers |
| Album linking | Create recording → Link to album → Verify in album detail |

### Coverage Targets

| Módulo | Target |
|--------|--------|
| recording-manager.ts | ≥ 85% |
| storage-monitor.ts | ≥ 80% |
| flac-editor.ts | ≥ 80% |
| Routes | ≥ 75% |
| Frontend hooks | ≥ 70% |

---

## Preparation Tasks

Antes de iniciar desenvolvimento:

| Task | Responsável | Estimativa | Priority |
|------|-------------|------------|----------|
| Documentar arquitetura FFmpeg atual (3 processos) | Dev | 1h | 🔴 Crítico |
| Spike: FFmpeg #4 FLAC via FIFO | Dev | 2h | 🔴 Crítico |
| Design: UI Recording (botão + listagem + editor) | Thiago | 2h | 🔴 Crítico |

---

**Última revisão:** 2025-12-06
**Próxima revisão:** Após implementação das primeiras stories V3a
