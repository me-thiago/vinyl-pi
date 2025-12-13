# V3b-01: Tabela de Tracks por Álbum (AlbumTrack)

## Story

**Como** usuário do Vinyl-OS
**Quero** ter a tracklist completa de cada álbum da minha coleção
**Para** poder linkar gravações a faixas específicas e preparar chromaprints individuais

## Contexto

Atualmente temos:
- `Track` — registro de músicas **reconhecidas** durante sessões (histórico de escuta)
- `TrackMarker` — marcadores de tempo dentro de uma **gravação** FLAC

**O que falta:**
- `AlbumTrack` — a **tracklist estática** de cada álbum (lado A faixa 1, faixa 2, etc.)

Isso é fundamental para V3b (chromaprints por faixa) porque:
1. Precisamos saber quais faixas existem em cada álbum
2. Cada faixa terá seu próprio fingerprint
3. O editor de gravação poderá linkar TrackMarker → AlbumTrack

## Acceptance Criteria

### AC1: Schema AlbumTrack
- [ ] Nova model `AlbumTrack` no Prisma:
  ```prisma
  model AlbumTrack {
    id            String   @id @default(uuid())
    albumId       String
    album         Album    @relation(fields: [albumId], references: [id], onDelete: Cascade)

    position      String   // "A1", "A2", "B1", "B2" (formato Discogs)
    trackNumber   Int      // 1, 2, 3... (sequencial)
    title         String
    duration      String?  // "3:45" formato Discogs
    durationSec   Int?     // 225 (calculado)

    // V3b - Chromaprint
    chromaprint   String?  // fingerprint base64
    chromaprintAt DateTime?

    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    @@unique([albumId, position])
    @@index([albumId])
  }
  ```
- [ ] Relação Album 1:N AlbumTrack
- [ ] Migration Prisma

### AC2: API CRUD para AlbumTrack
- [ ] `GET /api/albums/:id/tracks` — Listar tracks do álbum
- [ ] `POST /api/albums/:id/tracks` — Adicionar track manual
- [ ] `PUT /api/albums/:id/tracks/:trackId` — Editar track
- [ ] `DELETE /api/albums/:id/tracks/:trackId` — Remover track

### AC3: UI na Página do Álbum
- [ ] Seção "Tracklist" na página `/albums/:id`
- [ ] Tabela com: Position | Title | Duration
- [ ] Botão "+ Add Track" para entrada manual
- [ ] Edição inline (click to edit)
- [ ] Drag-and-drop para reordenar (opcional)

### AC4: Integração com Editor de Gravação
- [ ] No editor de gravação, ao adicionar TrackMarker:
  - Dropdown para selecionar AlbumTrack do álbum vinculado
  - Se gravação não tem álbum vinculado, campo texto livre
- [ ] Adicionar `albumTrackId` opcional em TrackMarker

## Technical Notes

### Schema Changes
```prisma
// Adicionar em Album
model Album {
  // ... existing fields ...
  albumTracks  AlbumTrack[]
}

// Adicionar em TrackMarker
model TrackMarker {
  // ... existing fields ...
  albumTrackId String?
  albumTrack   AlbumTrack? @relation(fields: [albumTrackId], references: [id], onDelete: SetNull)
}
```

### Duration Parsing
```typescript
// Converter "3:45" → 225 segundos
function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}
```

## Out of Scope
- Importação automática de tracklist do Discogs (V3b-02)
- Geração de chromaprints (V3b-03+)

## Story Points
**5 pontos** — Schema + API + UI

## Dependencies
- V3a completo (gravação funcionando)
