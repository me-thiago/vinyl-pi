# Story V3-01: Schema Dados V3

**Epic:** V3a - Gravação & Fundação
**Status:** done

**User Story:**
Como desenvolvedor,
quero criar as tabelas Recording e TrackMarker no banco de dados,
para que o sistema possa persistir gravações FLAC e marcações de faixas.

## Critérios de Aceitação

### Prisma Schema

1. Model `Recording` criado com campos:
   - `id`, `albumId?`, `sessionId?`
   - `filePath`, `fileName`, `format`, `sampleRate`, `bitDepth`, `channels`
   - `durationSeconds?`, `fileSizeBytes?`, `status`, `notes?`
   - `startedAt`, `completedAt?`, `createdAt`, `updatedAt`

2. Enum `RecordingStatus` criado:
   - `recording`, `completed`, `processing`, `error`

3. Model `TrackMarker` criado com campos:
   - `id`, `recordingId`, `trackNumber`, `title?`
   - `startOffset` (Float), `endOffset` (Float)
   - `createdAt`, `updatedAt`

4. Constraint unique: `[recordingId, trackNumber]` em TrackMarker

### Relacionamentos

5. `Recording` N:1 `Album` (opcional - gravação pode ser órfã)
6. `Recording` N:1 `Session` (opcional)
7. `Recording` 1:N `TrackMarker` (cascade delete)
8. `Album.recordings` relação inversa adicionada
9. `Session.recordings` relação inversa adicionada

### Índices

10. Índice em `Recording.albumId`
11. Índice em `Recording.sessionId`
12. Índice em `Recording.status`
13. Índice em `Recording.startedAt DESC`
14. Índice em `TrackMarker.recordingId`

### Migration

15. Migration criada e aplicada sem erros
16. `npx prisma generate` atualiza client
17. Testes existentes continuam passando

## Prisma Schema

```prisma
enum RecordingStatus {
  recording
  completed
  processing
  error
}

model Recording {
  id               String          @id @default(uuid())
  albumId          String?
  album            Album?          @relation(fields: [albumId], references: [id], onDelete: SetNull)
  sessionId        String?
  session          Session?        @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  filePath         String
  fileName         String
  format           String          @default("flac")
  sampleRate       Int             @default(48000)
  bitDepth         Int             @default(16)
  channels         Int             @default(2)

  durationSeconds  Int?
  fileSizeBytes    Int?
  status           RecordingStatus @default(recording)
  notes            String?

  startedAt        DateTime        @default(now())
  completedAt      DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

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

  trackNumber      Int
  title            String?
  startOffset      Float
  endOffset        Float

  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@unique([recordingId, trackNumber])
  @@index([recordingId])
}
```

## Pré-requisitos

- Nenhum (primeira story do épico)

## Notas de Implementação

- Adicionar `recordings Recording[]` no model `Album`
- Adicionar `recordings Recording[]` no model `Session`
- `filePath` é relativo: `YYYY-MM/rec-{id}.flac`
- `startOffset` e `endOffset` em segundos com precisão decimal (Float)

## Referências

- [Tech Spec V3a](../../tech-spec-epic-v3a.md) - Seção Data Models
- [Epic V3 Vision](../../epic-v3-vision.md) - Decisão sobre schema
