# Story V2-10: Estatísticas da Coleção

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** ready-for-dev

**User Story:**
Como usuário,
quero ver estatísticas sobre minha coleção,
para que possa entender melhor minha coleção.

## Critérios de Aceitação

### Backend Endpoint
1. `GET /api/stats/collection` - Retorna estatísticas agregadas
2. `GET /api/stats/listening` - Retorna estatísticas de escuta

### Estatísticas da Coleção (simples, sem gráficos)
3. Total de álbuns (excluindo archived)
4. Total de álbuns arquivados
5. Total de artistas únicos
6. Contagem por formato (LP: X, EP: Y, etc.)
7. Contagem por década (70s: X, 80s: Y, etc.)
8. Álbuns sem discogsId (adicionados manualmente)

### Estatísticas de Escuta
9. Total de tracks reconhecidos
10. Tracks reconhecidos este mês
11. Artistas mais ouvidos (top 5, contagem de tracks)
12. Álbuns mais ouvidos (top 5, contagem de tracks)

### UI
13. Card/seção de estatísticas na página Collection
14. Números simples com labels (sem gráficos visuais - adiado para V3/V4)
15. Atualização ao carregar página (não real-time)

## Resposta da API

```typescript
// GET /api/stats/collection
{
  totalAlbums: number;
  archivedAlbums: number;
  uniqueArtists: number;
  byFormat: { LP: number; EP: number; ... };
  byDecade: { "1970s": number; "1980s": number; ... };
  manuallyAdded: number;  // sem discogsId
}

// GET /api/stats/listening
{
  totalTracks: number;
  tracksThisMonth: number;
  topArtists: { artist: string; count: number }[];
  topAlbums: { albumId: string; title: string; artist: string; count: number }[];
}
```

## Nota

Gráficos visuais (recharts) adiados para V3/V4. V2 foca em contadores simples.

## Pré-requisitos

- V2-09 - Histórico de Escuta Expandido

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md)
- [PRD v3.0](../prd-v3.md) - Seção 5.2.1, 15

