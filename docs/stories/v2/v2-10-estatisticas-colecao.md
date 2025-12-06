# Story V2-10: Estatísticas da Coleção

**Epic:** V2 - Coleção & Reconhecimento Musical  
**Status:** done

---

## User Story

Como usuário,  
quero ver estatísticas sobre minha coleção e hábitos de escuta,  
para que possa entender melhor minha coleção e como a utilizo.

---

## Contexto

Esta story adiciona uma **página dedicada `/stats`** com estatísticas da coleção e histórico de escuta. Gráficos visuais (recharts) estão adiados para V3/V4 - V2 foca em contadores simples.

**Decisão de UI**: Página separada em vez de seção na Collection, porque:
1. Espaço para stats de coleção + escuta + rankings
2. Preparado para gráficos futuros (V3/V4)
3. Cada página com propósito claro

**Nota sobre V2-09**: Com a mudança de foco para "álbuns por sessão" (em vez de tracks individuais), as estatísticas de escuta contam **sessões em que cada álbum apareceu**.

---

## Critérios de Aceitação

### AC-1: Backend - Estatísticas da Coleção
- [x] `GET /api/stats/collection` retorna estatísticas agregadas
- [x] Total de álbuns (excluindo archived)
- [x] Total de álbuns arquivados
- [x] Total de artistas únicos
- [x] Contagem por formato (LP: X, EP: Y, etc.)
- [x] Contagem por década (70s: X, 80s: Y, etc.)
- [x] Álbuns adicionados manualmente (sem discogsId)

### AC-2: Backend - Estatísticas de Escuta
- [x] `GET /api/stats/listening` retorna estatísticas de escuta
- [x] Total de sessões de escuta
- [x] Sessões este mês
- [x] Álbuns únicos tocados (all time)
- [x] Álbuns mais tocados (top 5, contagem de sessões)
- [x] Artistas mais ouvidos (top 5, contagem de sessões com álbuns do artista)

### AC-3: Frontend - Página /stats
- [x] Nova página `/stats` criada
- [x] Link "Estatísticas" adicionado ao menu/navbar
- [x] Duas seções: "Coleção" e "Escuta"
- [x] Cards com números e ícones
- [x] Lista de "Mais Tocados" com mini capas
- [x] Atualização ao carregar página (não real-time)
- [x] Layout responsivo (2 colunas em desktop, stack em mobile)

### AC-4: Rota e Navegação
- [x] Rota `/stats` configurada no React Router
- [x] Menu principal atualizado com link para Stats
- [x] Ícone apropriado (📊 ou similar)

---

## Resposta da API

```typescript
// GET /api/stats/collection
interface CollectionStats {
  totalAlbums: number;        // Excluindo archived
  archivedAlbums: number;
  uniqueArtists: number;
  byFormat: Record<string, number>;  // { LP: 45, EP: 12, SINGLE_7: 8, ... }
  byDecade: Record<string, number>;  // { "1970s": 15, "1980s": 22, ... }
  manuallyAdded: number;      // Álbuns sem discogsId
}

// GET /api/stats/listening
interface ListeningStats {
  totalSessions: number;              // Total de sessões de escuta
  sessionsThisMonth: number;          // Sessões no mês atual
  uniqueAlbumsPlayed: number;         // Álbuns únicos tocados (all time)
  topAlbums: {                        // Top 5 mais tocados
    albumId: string;
    title: string;
    artist: string;
    coverUrl: string | null;
    sessionCount: number;             // Em quantas sessões apareceu
  }[];
  topArtists: {                       // Top 5 artistas
    artist: string;
    sessionCount: number;             // Sessões com álbuns deste artista
  }[];
}
```

---

## Design da UI

### Página /stats - Layout Desktop

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📊 Estatísticas                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┤
│  │  💿 COLEÇÃO                     │  │  🎧 ESCUTA                       │
│  │                                 │  │                                 │
│  │  ┌─────┐ ┌─────┐ ┌─────┐        │  │  ┌─────┐ ┌─────┐ ┌─────┐        │
│  │  │ 127 │ │  45 │ │  12 │        │  │  │  52 │ │   8 │ │  34 │        │
│  │  │Álbu.│ │Art. │ │Arq. │        │  │  │Sess.│ │ Mês │ │Álbu.│        │
│  │  └─────┘ └─────┘ └─────┘        │  │  └─────┘ └─────┘ └─────┘        │
│  │                                 │  │                                 │
│  │  Por Formato                    │  │  🏆 Mais Tocados                │
│  │  LP: 89 • EP: 23 • 7": 15       │  │                                 │
│  │                                 │  │  ┌──┐ Dark Side of the Moon     │
│  │  Por Década                     │  │  │🖼│ Pink Floyd                │
│  │  70s: 18 • 80s: 45 • 90s: 32    │  │  └──┘ 12 sessões                │
│  │  00s: 22 • 10s: 8 • 20s: 2      │  │                                 │
│  │                                 │  │  ┌──┐ Abbey Road                │
│  │  ┌─────┐                        │  │  │🖼│ The Beatles               │
│  │  │  23 │ Adicionados            │  │  └──┘ 9 sessões                 │
│  │  │     │ manualmente            │  │                                 │
│  │  └─────┘                        │  │  ┌──┐ Rumours                   │
│  │                                 │  │  │🖼│ Fleetwood Mac             │
│  │                                 │  │  └──┘ 7 sessões                 │
│  │                                 │  │                                 │
│  │                                 │  │  🎨 Top Artistas                │
│  │                                 │  │  1. Pink Floyd (15 sessões)     │
│  │                                 │  │  2. The Beatles (12 sessões)    │
│  │                                 │  │  3. Fleetwood Mac (9 sessões)   │
│  │                                 │  │                                 │
│  └─────────────────────────────────┘  └─────────────────────────────────┘
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Página /stats - Layout Mobile (Stack)

```
┌───────────────────────────┐
│  📊 Estatísticas          │
├───────────────────────────┤
│                           │
│  💿 COLEÇÃO               │
│  ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ 127 │ │  45 │ │  12 │  │
│  └─────┘ └─────┘ └─────┘  │
│  Por Formato: LP: 89...   │
│  Por Década: 70s: 18...   │
│                           │
├───────────────────────────┤
│                           │
│  🎧 ESCUTA                │
│  ┌─────┐ ┌─────┐ ┌─────┐  │
│  │  52 │ │   8 │ │  34 │  │
│  └─────┘ └─────┘ └─────┘  │
│                           │
│  🏆 Mais Tocados          │
│  1. Dark Side... (12)     │
│  2. Abbey Road (9)        │
│  ...                      │
│                           │
└───────────────────────────┘
```

### Navbar Atualizada

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🎵 Vinyl-OS    Dashboard │ Collection │ Sessions │ Stats │ Settings   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementação Técnica

### Backend - stats.ts (novo router)

```typescript
// src/routes/stats.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/stats/collection
router.get('/collection', async (req, res) => {
  const [
    totalAlbums,
    archivedAlbums,
    artistsRaw,
    byFormatRaw,
    manuallyAdded
  ] = await Promise.all([
    prisma.album.count({ where: { archived: false } }),
    prisma.album.count({ where: { archived: true } }),
    prisma.album.groupBy({ by: ['artist'], where: { archived: false } }),
    prisma.album.groupBy({ 
      by: ['format'], 
      where: { archived: false },
      _count: { _all: true }
    }),
    prisma.album.count({ where: { discogsId: null, archived: false } })
  ]);
  
  // Processar por década
  const albums = await prisma.album.findMany({
    where: { archived: false, year: { not: null } },
    select: { year: true }
  });
  const byDecade = albums.reduce((acc, { year }) => {
    const decade = `${Math.floor(year! / 10) * 10}s`;
    acc[decade] = (acc[decade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return res.json({
    totalAlbums,
    archivedAlbums,
    uniqueArtists: artistsRaw.length,
    byFormat: Object.fromEntries(byFormatRaw.map(f => [f.format || 'Unknown', f._count._all])),
    byDecade,
    manuallyAdded
  });
});

// GET /api/stats/listening
router.get('/listening', async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const [totalSessions, sessionsThisMonth] = await Promise.all([
    prisma.session.count(),
    prisma.session.count({ where: { startedAt: { gte: startOfMonth } } })
  ]);
  
  // Top álbuns (por contagem de sessões distintas)
  const topAlbums = await prisma.$queryRaw`
    SELECT 
      a.id as "albumId",
      a.title,
      a.artist,
      a."coverUrl",
      COUNT(DISTINCT t."sessionId") as "sessionCount"
    FROM "Album" a
    JOIN "Track" t ON t."albumId" = a.id
    GROUP BY a.id
    ORDER BY "sessionCount" DESC
    LIMIT 5
  `;
  
  // Top artistas
  const topArtists = await prisma.$queryRaw`
    SELECT 
      a.artist,
      COUNT(DISTINCT t."sessionId") as "sessionCount"
    FROM "Album" a
    JOIN "Track" t ON t."albumId" = a.id
    GROUP BY a.artist
    ORDER BY "sessionCount" DESC
    LIMIT 5
  `;
  
  // Álbuns únicos tocados
  const uniqueAlbumsPlayed = await prisma.track.groupBy({
    by: ['albumId'],
    where: { albumId: { not: null } }
  });
  
  return res.json({
    totalSessions,
    sessionsThisMonth,
    uniqueAlbumsPlayed: uniqueAlbumsPlayed.length,
    topAlbums,
    topArtists
  });
});

export default router;
```

### Frontend - Stats.tsx (nova página)

```
frontend/src/pages/Stats.tsx
frontend/src/components/Stats/
├── CollectionStats.tsx
├── ListeningStats.tsx
├── TopAlbumsList.tsx
└── StatCard.tsx
```

### Rota no App.tsx

```typescript
// App.tsx
<Route path="/stats" element={<Stats />} />
```

---

## i18n Keys

```json
{
  "stats": {
    "pageTitle": "Estatísticas",
    "collectionTitle": "Coleção",
    "listeningTitle": "Escuta",
    "totalAlbums": "Álbuns",
    "uniqueArtists": "Artistas",
    "archivedAlbums": "Arquivados",
    "manuallyAdded": "Manuais",
    "byFormat": "Por Formato",
    "byDecade": "Por Década",
    "totalSessions": "Sessões",
    "sessionsThisMonth": "Este mês",
    "uniqueAlbumsPlayed": "Álbuns tocados",
    "topPlayed": "Mais Tocados",
    "topArtists": "Top Artistas",
    "sessions_one": "{{count}} sessão",
    "sessions_other": "{{count}} sessões",
    "noData": "Sem dados ainda",
    "noListeningData": "Nenhum álbum identificado ainda. Use o botão 🎵 no player para registrar o que você está ouvindo."
  },
  "nav": {
    "stats": "Estatísticas"
  }
}
```

---

## Pré-requisitos

- [x] V2-09 - Histórico de Escuta Expandido (dados de álbuns por sessão)

---

## Estimativa

- **Complexidade:** Baixa-Média
- **Pontos:** 3
- **Tempo estimado:** 2-3 horas

---

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md)
- [PRD v3.0](../prd-v3.md) - Seção 5.2.1, 15

---

## Histórico

| Data | Ação | Motivo |
|------|------|--------|
| 2025-12-06 | Revisão | Ajustar para contar sessões/álbuns em vez de tracks |
| 2025-12-06 | Decisão UI | Página dedicada `/stats` em vez de seção na Collection |
