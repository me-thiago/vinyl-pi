# Story V2-09: Histórico de Escuta Expandido

**Epic:** V2 - Coleção & Reconhecimento Musical  
**Status:** done

---

## User Story

Como usuário,  
quero ver os álbuns tocados por sessão e o histórico de escuta por álbum,  
para que possa revisar o que escutei e acompanhar meus hábitos de audição.

---

## Contexto Técnico

### Mudança de Escopo (Revisão 2025-12-06)

**Decisão arquitetural**: Focar em **álbuns** em vez de tracks individuais.

**Justificativa**:
1. Sem gravação contínua + fingerprinting offline, não conseguimos capturar todas as faixas
2. O usuário tipicamente escuta um álbum inteiro, não faixas isoladas
3. O botão [🎵] faz mais sentido como "registrar que estou escutando este álbum"
4. Informação mais útil: "escutei Dark Side of the Moon em 5 sessões" vs "reconheci 'Money' mas não sei as outras faixas"

**Abordagem**: O model `Track` existente já tem `albumId`. Agrupamos tracks por álbum para mostrar "Álbuns Tocados".

### Estado Atual

- Página `SessionDetail` existe (V1-17) e mostra resumo + timeline de eventos
- Página `CollectionDetail` tem placeholder "Play History" (linhas 369-382)
- Model `Track` existe com relacionamento `Track → Session` e `Track → Album`
- **O que falta:** Exibir álbuns escutados por sessão e sessões por álbum

### O Que Esta Story Adiciona

1. **Backend:** Incluir álbuns agrupados na resposta de `/api/sessions/:id`
2. **Backend:** Endpoint `/api/albums/:id/sessions` para histórico do álbum
3. **Frontend:** Seção "Álbuns Tocados" na SessionDetail
4. **Frontend:** Seção "Histórico de Escuta" na CollectionDetail (substituir placeholder)
5. **Stats:** Contador de álbuns por sessão, sessões por álbum

---

## Critérios de Aceitação

### AC-1: Backend - Álbuns na Sessão
- [x] `GET /api/sessions/:id` inclui `albums[]` na resposta
- [x] Álbuns são agrupados dos tracks vinculados (apenas tracks com `albumId`)
- [x] Cada álbum inclui: `id`, `title`, `artist`, `year`, `coverUrl`
- [x] Inclui `recognizedTrack`: info da faixa usada para identificar (título, hora)
- [x] Álbuns ordenados por primeiro reconhecimento na sessão

### AC-2: Backend - Sessões no Álbum
- [x] `GET /api/albums/:id/sessions` retorna sessões onde álbum foi escutado
- [x] Cada sessão inclui: `id`, `startedAt`, `endedAt`, `durationSeconds`
- [x] Inclui `recognizedTrack`: info da faixa usada para identificar
- [x] Ordenado por data (mais recente primeiro)
- [x] Inclui `totalSessions` no response

### AC-3: UI - Seção "Álbuns Tocados" na SessionDetail
- [x] Nova seção abaixo do resumo da sessão
- [x] Card por álbum com capa (thumbnail 64x64), título, artista, ano
- [x] Mostra faixa identificada e horário do reconhecimento
- [x] Link "Ver →" navega para `/collection/:albumId`
- [x] Mostra "Nenhum álbum identificado" se lista vazia

### AC-4: UI - Histórico de Escuta na CollectionDetail
- [x] Substituir placeholder atual pelo histórico real
- [x] Lista de sessões com: data formatada, duração, faixa identificada
- [x] Link "Ver →" navega para `/sessions/:sessionId`
- [x] Stats: "X sessões" total
- [x] Mostra "Nenhuma sessão registrada" se lista vazia

### AC-5: Lista de Sessões
- [x] `GET /api/sessions` inclui `albumCount` por sessão
- [x] Página Sessions mostra `albumCount` em cada card de sessão
- [x] Ícone + número (ex: "💿 2")

---

## Design da UI

### SessionDetail - Seção de Álbuns Tocados

```
┌────────────────────────────────────────────────────────────────┐
│  💿 Álbuns Tocados                                       [2]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────┐  Dark Side of the Moon                                 │
│  │ 🖼️ │  Pink Floyd (1973)                                     │
│  └────┘  Identificado às 14:32 • "Money"             [Ver →]   │
│                                                                │
│  ┌────┐  Abbey Road                                            │
│  │ 🖼️ │  The Beatles (1969)                                    │
│  └────┘  Identificado às 15:45 • "Here Comes the Sun" [Ver →]  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### CollectionDetail - Histórico de Escuta

```
┌────────────────────────────────────────────────────────────────┐
│  📅 Histórico de Escuta                                  [5]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  📍 Hoje, 14:00 - 16:30                                [Ver →] │
│     Duração: 2h 30m • Identificado via "Money"                 │
│                                                                │
│  📍 Ontem, 20:15 - 22:00                               [Ver →] │
│     Duração: 1h 45m • Identificado via "Time"                  │
│                                                                │
│  📍 03/12, 10:30 - 12:00                               [Ver →] │
│     Duração: 1h 30m • Identificado via "Breathe"               │
│                                                                │
│  ─────────────────────────────────────────────────────────     │
│  Total: 5 sessões                                              │
└────────────────────────────────────────────────────────────────┘
```

### Sessions List - Album Count

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Hoje, 14:00 - 16:30                                         │
│  Duração: 2h 30m  •  Eventos: 12  •  💿 2 álbuns                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação Técnica

### 1. Backend - Atualizar sessions.ts

```typescript
// GET /api/sessions/:id - adicionar álbuns agrupados
const session = await prisma.session.findUnique({
  where: { id },
  include: {
    audioEvents: { ... },
    tracks: {
      where: { albumId: { not: null } }, // Apenas tracks vinculados
      orderBy: { recognizedAt: 'asc' },
      include: {
        album: {
          select: { id: true, title: true, artist: true, year: true, coverUrl: true }
        }
      }
    }
  }
});

// Agrupar tracks por albumId, pegar primeiro reconhecimento
const albumsMap = new Map();
for (const track of session.tracks) {
  if (!albumsMap.has(track.albumId)) {
    albumsMap.set(track.albumId, {
      ...track.album,
      recognizedTrack: {
        title: track.title,
        recognizedAt: track.recognizedAt
      }
    });
  }
}
const albums = Array.from(albumsMap.values());
```

### 2. Backend - Novo endpoint albums/:id/sessions

```typescript
// GET /api/albums/:id/sessions
router.get('/:id/sessions', async (req, res) => {
  const { id } = req.params;
  
  // Buscar tracks deste álbum, agrupar por sessão
  const tracks = await prisma.track.findMany({
    where: { albumId: id },
    orderBy: { recognizedAt: 'desc' },
    include: {
      session: {
        select: { id: true, startedAt: true, endedAt: true, durationSeconds: true }
      }
    }
  });
  
  // Agrupar por sessão, pegar primeiro reconhecimento
  const sessionsMap = new Map();
  for (const track of tracks) {
    if (!sessionsMap.has(track.sessionId)) {
      sessionsMap.set(track.sessionId, {
        ...track.session,
        recognizedTrack: {
          title: track.title,
          recognizedAt: track.recognizedAt
        }
      });
    }
  }
  
  return res.json({
    sessions: Array.from(sessionsMap.values()),
    totalSessions: sessionsMap.size
  });
});
```

### 3. Backend - Atualizar GET /api/sessions

```typescript
// GET /api/sessions - adicionar albumCount
select: {
  ...existing,
  _count: { select: { tracks: true } }
},

// Post-process: contar álbuns únicos
// Nota: Para performance, podemos usar raw query ou aceitar aproximação
```

### 4. Frontend - Novo Componente AlbumsPlayed.tsx

```
frontend/src/components/Sessions/
└── AlbumsPlayed.tsx   ← Seção de álbuns tocados na sessão
```

### 5. Frontend - Atualizar CollectionDetail.tsx

Substituir placeholder (linhas 369-382) pelo componente de histórico real.

---

## Decisões de Design

### Tracks Não Vinculados

**Decisão**: Ignorar tracks sem `albumId` na lista de "Álbuns Tocados".

**UX**: Quando usuário reconhece música mas não vincula a álbum:
- Não aparece na seção "Álbuns Tocados"
- Toast existente já sugere "Adicionar à coleção"
- Para aparecer no histórico: adicionar álbum e reconhecer novamente

### Múltiplos Reconhecimentos do Mesmo Álbum

**Decisão**: Agrupar por álbum, mostrar primeiro reconhecimento.

Se usuário reconhece mesmo álbum 2x na sessão:
- Aparece como entrada única
- Mostra horário do primeiro reconhecimento
- Faixa exibida é a do primeiro reconhecimento

### Lado A/B do Disco

**Decisão**: Fora do escopo V2-09.

Possível adição futura:
- Campo opcional "side" no reconhecimento
- Inferência por múltiplos reconhecimentos do mesmo álbum
- Detecção por silêncio longo (virar disco)

---

## i18n Keys

Adicionar aos arquivos de locale:

```json
// pt-BR.json
{
  "sessionDetail": {
    "albumsPlayed": "Álbuns Tocados",
    "noAlbumsPlayed": "Nenhum álbum identificado nesta sessão",
    "identifiedAt": "Identificado às {{time}}",
    "identifiedVia": "Identificado via \"{{track}}\"",
    "viewAlbum": "Ver"
  },
  "sessions": {
    "albumCount_one": "{{count}} álbum",
    "albumCount_other": "{{count}} álbuns"
  },
  "collection": {
    "detail": {
      "play_history": "Histórico de Escuta",
      "no_play_history": "Nenhuma sessão registrada para este álbum",
      "total_sessions_one": "{{count}} sessão",
      "total_sessions_other": "{{count}} sessões",
      "view_session": "Ver"
    }
  }
}
```

```json
// en.json
{
  "sessionDetail": {
    "albumsPlayed": "Albums Played",
    "noAlbumsPlayed": "No albums identified in this session",
    "identifiedAt": "Identified at {{time}}",
    "identifiedVia": "Identified via \"{{track}}\"",
    "viewAlbum": "View"
  },
  "sessions": {
    "albumCount_one": "{{count}} album",
    "albumCount_other": "{{count}} albums"
  },
  "collection": {
    "detail": {
      "play_history": "Play History",
      "no_play_history": "No sessions recorded for this album",
      "total_sessions_one": "{{count}} session",
      "total_sessions_other": "{{count}} sessions",
      "view_session": "View"
    }
  }
}
```

---

## Testes

### Unit Tests
- [ ] `sessions.test.ts`: Verificar álbuns agrupados na resposta
- [ ] `albums.test.ts`: Endpoint de sessões por álbum
- [ ] `AlbumsPlayed.test.tsx`: Renderização, links para álbuns

### Integration Tests
- [ ] Sessão com álbuns → Mostra lista agrupada
- [ ] Sessão sem álbuns → Mostra mensagem vazia
- [ ] Álbum com sessões → Mostra histórico
- [ ] Click nos links → Navegação correta

---

## Pré-requisitos

- [x] V2-01: Schema Dados V2 (model Track com albumId)
- [x] V2-05: Reconhecimento Musical (cria tracks)
- [x] V2-06: Validação Contra Coleção (vincula track → album)
- [x] V2-07: UI de Matching/Confirmação (confirma vinculação)

> **Nota:** Esta story não depende de V2-08 (adiada).

---

## Estimativa

- **Complexidade:** Baixa-Média
- **Pontos:** 3
- **Tempo estimado:** 2-3 horas

---

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.4 (UI Expandida - Histórico de Escuta)
- [Tech Spec V2](../tech-spec-epic-v2.md) - APIs/Tracks
- [Epics](../epics.md) - Epic V2
- [Technical Decisions](../technical-decisions.md) - Eventos de Áudio Adiados

---

## Histórico

| Data | Ação | Motivo |
|------|------|--------|
| 2025-12-06 | Revisão de escopo | Focar em álbuns em vez de tracks individuais |
| 2025-12-06 | Implementação completa | Todos os ACs implementados e testados |
