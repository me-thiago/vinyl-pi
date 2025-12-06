# Story V2-09: Histórico de Escuta Expandido

**Epic:** V2 - Coleção & Reconhecimento Musical  
**Status:** ready-for-dev

---

## User Story

Como usuário,  
quero ver o histórico completo de escuta com tracks reconhecidos por sessão,  
para que possa revisar o que escutei e acessar os álbuns correspondentes.

---

## Contexto Técnico

### Estado Atual

A página `SessionDetail` existe (V1-17) e mostra:
- Resumo da sessão (início, fim, duração, total de eventos)
- Timeline de eventos de áudio (clipping, silence, session_start/end)

**O que falta:** Não mostra tracks reconhecidos, apesar do model `Track` já existir com relacionamento `Track → Session`.

### O Que Esta Story Adiciona

1. **Backend:** Incluir tracks na resposta de `/api/sessions/:id`
2. **Frontend:** Seção de "Músicas Identificadas" na SessionDetail
3. **Links:** Track → Álbum na coleção (se vinculado)
4. **Stats:** Contador de tracks, álbuns únicos por sessão

---

## Critérios de Aceitação

### AC-1: Backend - Tracks na Sessão
- [ ] `GET /api/sessions/:id` inclui `tracks[]` na resposta
- [ ] Cada track inclui: `id`, `title`, `artist`, `albumName`, `albumArtUrl`, `recognizedAt`, `albumId` (se vinculado)
- [ ] Tracks ordenados por `recognizedAt` (mais recente primeiro)

### AC-2: UI - Seção de Músicas Identificadas
- [ ] Nova seção "Músicas Identificadas" abaixo do resumo da sessão
- [ ] Mostra lista de tracks com capa (thumbnail 48x48), título, artista
- [ ] Badge com hora do reconhecimento
- [ ] Mostra "Nenhuma música identificada" se lista vazia

### AC-3: Link para Álbum
- [ ] Se track tem `albumId`, mostra nome do álbum como link
- [ ] Click no link navega para `/collection/:albumId` (página de detalhes do álbum)
- [ ] Se não tem `albumId`, mostra "Não vinculado" em texto muted

### AC-4: Stats da Sessão
- [ ] Card de resumo mostra "Músicas identificadas: X"
- [ ] Mostra "Álbuns únicos: Y" (count distinct de albumId)
- [ ] Stats aparecem junto com duração e eventos

### AC-5: Lista de Sessões
- [ ] `GET /api/sessions` inclui `trackCount` por sessão
- [ ] Página Sessions mostra `trackCount` em cada card de sessão
- [ ] Ícone de música + número (ex: "🎵 5")

---

## Design da UI

### SessionDetail - Seção de Tracks

```
┌────────────────────────────────────────────────────────────────┐
│  🎵 Músicas Identificadas                              [5]     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────┐  Hey Jude                                   14:32:15   │
│  │ 🖼️ │  The Beatles                                           │
│  └────┘  → Hey Jude (1968)                          [Ver →]    │
│                                                                │
│  ┌────┐  Let It Be                                  14:28:42   │
│  │ 🖼️ │  The Beatles                                           │
│  └────┘  → Let It Be (1970)                         [Ver →]    │
│                                                                │
│  ┌────┐  Bohemian Rhapsody                          14:15:03   │
│  │ 🖼️ │  Queen                                                 │
│  └────┘  Não vinculado                                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Sessions List - Track Count

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Hoje, 14:00 - 16:30                                         │
│  Duração: 2h 30m  •  Eventos: 12  •  🎵 5 músicas               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação Técnica

### 1. Backend - Atualizar sessions.ts

```typescript
// GET /api/sessions/:id - adicionar tracks
include: {
  audioEvents: { ... },
  tracks: {
    orderBy: { recognizedAt: 'desc' },
    select: {
      id: true,
      title: true,
      artist: true,
      albumName: true,
      albumArtUrl: true,
      recognizedAt: true,
      albumId: true,
      album: {
        select: {
          id: true,
          title: true,
          year: true
        }
      }
    }
  }
}

// GET /api/sessions - adicionar trackCount
select: {
  ...existing,
  _count: { select: { tracks: true } }
}
```

### 2. Frontend - SessionDetail.tsx

```typescript
interface TrackItem {
  id: string;
  title: string;
  artist: string;
  albumName: string | null;
  albumArtUrl: string | null;
  recognizedAt: string;
  albumId: string | null;
  album: {
    id: string;
    title: string;
    year: number | null;
  } | null;
}

interface SessionDetail {
  // ... existing fields
  tracks: TrackItem[];
  trackCount: number;
  uniqueAlbumCount: number;
}
```

### 3. Novo Componente - TrackList.tsx

```
frontend/src/components/Sessions/
└── TrackList.tsx   ← Lista de tracks com links para álbuns
```

---

## i18n Keys

Adicionar ao `locales/pt-BR.json`:

```json
{
  "sessionDetail": {
    "tracksIdentified": "Músicas Identificadas",
    "noTracksIdentified": "Nenhuma música identificada nesta sessão",
    "trackAt": "às {{time}}",
    "linkedTo": "→ {{album}} ({{year}})",
    "notLinked": "Não vinculado",
    "viewAlbum": "Ver álbum",
    "uniqueAlbums": "Álbuns únicos"
  },
  "sessions": {
    "tracksCount": "{{count}} música",
    "tracksCount_plural": "{{count}} músicas"
  }
}
```

---

## Testes

### Unit Tests
- [ ] `sessions.test.ts`: Verificar tracks incluídos na resposta
- [ ] `TrackList.test.tsx`: Renderização, links para álbuns

### Integration Tests
- [ ] Sessão com tracks → Mostra lista
- [ ] Sessão sem tracks → Mostra mensagem vazia
- [ ] Click no link → Navega para álbum

---

## Pré-requisitos

- [x] V2-01: Schema Dados V2 (model Track)
- [x] V2-05: Reconhecimento Musical (cria tracks)
- [x] V2-06: Validação Contra Coleção (vincula track → album)
- [x] V2-07: UI de Matching/Confirmação (confirma vinculação)

> **Nota:** Dependência de V2-08 removida. A vinculação track→album já é feita em V2-07.

---

## Estimativa

- **Complexidade:** Baixa-Média
- **Pontos:** 3
- **Tempo estimado:** 2-3 horas

---

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.4 (UI Expandida - Histórico de Escuta)
- [Tech Spec V2](../tech-spec-epic-v2.md) - APIs/Tracks, AC-16, AC-17
- [Epics](../epics.md) - Epic V2
