# Story V2-01: Schema de Dados V2 (Albums e Tracks)

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** drafted

**User Story:**
Como desenvolvedor,
quero ter as tabelas de álbuns e tracks no banco de dados,
para que possa persistir dados da coleção e reconhecimentos.

## Critérios de Aceitação

1. Enums criados no Prisma: `AlbumFormat`, `AlbumCondition`, `RecognitionSource`
2. Model `Album` criado com campos:
   - Obrigatórios: id, title, artist, createdAt, updatedAt
   - Opcionais: year, label, format (enum), coverUrl, discogsId (unique), condition (enum), tags (Json), notes
   - Flags: `archived` (default: false), `discogsAvailable` (default: true)
3. Model `Track` criado com campos:
   - Obrigatórios: id, sessionId, title, artist, recognizedAt
   - Opcionais: albumId, albumName, albumArtUrl, year, label, isrc, durationSeconds, metadata (Json)
   - Enums: recognitionSource (default: manual), confidence (Float)
4. Relacionamentos: Album 1:N Track, Session 1:N Track, Track N:1 Album (opcional)
5. Índices criados: Album(artist, title, year, archived), Track(sessionId, albumId, recognizedAt, artist+title)
6. Migration aplicada e testada com rollback funcional
7. Prisma Client regenerado

## Detalhes Técnicos

```prisma
enum AlbumFormat { LP, EP, SINGLE_7, SINGLE_12, DOUBLE_LP, BOX_SET }
enum AlbumCondition { mint, near_mint, vg_plus, vg, good, fair, poor }
enum RecognitionSource { acrcloud, audd, manual }
```

## Pré-requisitos

- V1.5 completo

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Data Models
- [PRD v3.0](../prd-v3.md) - Seção 5.2.3

