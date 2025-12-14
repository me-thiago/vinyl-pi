# V3b-02: Importação de Tracklist do Discogs

## Story

**Como** usuário do Vinyl-OS
**Quero** importar automaticamente a tracklist dos meus álbuns do Discogs
**Para** não precisar digitar manualmente todas as faixas

## Contexto

A API do Discogs já retorna a tracklist completa de cada release. Atualmente, no import de coleção, estamos ignorando esse dado. Esta story aproveita o mesmo endpoint para popular a tabela `AlbumTrack`.

**Resposta atual do Discogs (já temos acesso):**
```json
{
  "tracklist": [
    { "position": "A1", "title": "Song One", "duration": "3:45" },
    { "position": "A2", "title": "Song Two", "duration": "4:12" },
    { "position": "B1", "title": "Song Three", "duration": "5:01" }
  ]
}
```

## Acceptance Criteria

### AC1: Importar Tracklist no Import de Álbum
- [ ] Ao importar álbum do Discogs (`POST /api/albums/import-discogs`):
  - Já busca release details (existente)
  - Agora também cria `AlbumTrack` para cada item da tracklist
- [ ] Ignorar entries sem position ou title (headers, subtítulos)

### AC2: Sync Tracklist de Álbuns Existentes
- [ ] Novo endpoint: `POST /api/albums/:id/sync-tracklist`
- [ ] Busca tracklist do Discogs pelo `discogsId`
- [ ] Merge strategy: apenas adicionar tracks novos (não sobrescreve)
- [ ] Retorna: `{ added: N, skipped: N }`

### AC3: Sync em Batch (Coleção Inteira)
- [ ] Novo endpoint: `POST /api/albums/sync-all-tracklists`
- [ ] Processa álbuns com `discogsId` que ainda não têm `AlbumTrack`
- [ ] Rate limiting: 1 request/segundo para Discogs
- [ ] Progress via WebSocket ou polling
- [ ] Retorna: `{ processed: N, failed: N, skipped: N }`

### AC4: UI
- [ ] Na página do álbum, se não tem tracks:
  - Botão "Import from Discogs" (se tem discogsId)
  - Ou "Add manually" (se não tem discogsId)
- [ ] Na página de coleção:
  - Botão "Sync All Tracklists" com progress indicator

## Technical Notes

### Discogs Service Update
```typescript
// backend/src/services/discogs.ts

interface DiscogsTrack {
  position: string;
  title: string;
  duration?: string;
}

async function getTracklist(releaseId: number): Promise<DiscogsTrack[]> {
  const release = await this.getRelease(releaseId);
  return release.tracklist
    .filter(t => t.position && t.title && t.type_ === 'track')
    .map(t => ({
      position: t.position,
      title: t.title,
      duration: t.duration || null,
    }));
}
```

### Import Flow
```typescript
// No import de álbum, adicionar:
const tracklist = await discogsService.getTracklist(discogsId);

await prisma.albumTrack.createMany({
  data: tracklist.map((track, index) => ({
    albumId: album.id,
    // Discogs: position (ex. "A1") é opcional no schema, mas deve vir aqui quando disponível
    position: track.position,
    trackNumber: index + 1,
    title: track.title,
    duration: track.duration,
    durationSec: parseDuration(track.duration),
  })),
  skipDuplicates: true,
});
```

## Out of Scope
- Edição manual de tracklist (V3b-01)
- Chromaprints (V3b-03+)

## Story Points
**3 pontos** — Majoritariamente backend, API já integrada

## Dependencies
- V3b-01 (schema AlbumTrack)
- V2-04 (integração Discogs existente)
