# Story V2-04: Integração Discogs (Busca e Importação)

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** drafted

**User Story:**
Como usuário,
quero poder buscar álbuns no Discogs e importar metadados automaticamente,
para que não precise digitar todas as informações manualmente.

## Critérios de Aceitação

### Backend Service
1. Service `discogs.ts` criado usando fetch nativo (sem lib externa)
2. Autenticação via Consumer Key/Secret (env vars)
3. Throttling respeitando rate limit (60 req/min)
4. Timeout de 10s por request

### Endpoints
5. `POST /api/albums/import-discogs` - Busca e importa álbum
   - Body: { catalogNumber?, barcode?, releaseId? }
   - Se múltiplos resultados: retorna lista para seleção
   - Se único: importa automaticamente
6. `POST /api/albums/:id/sync-discogs` - Re-sincroniza álbum existente

### Importação
7. Campos importados: title, artist, year, label, format (mapeado para enum), coverUrl
8. coverUrl usa maior resolução disponível
9. discogsId salvo para referência futura
10. discogsAvailable = true ao importar

### Re-sincronização
11. Atualiza APENAS campos vazios localmente (preserva edições do usuário)
12. Atualiza coverUrl se maior resolução disponível
13. Se álbum não encontrado no Discogs (404):
    - discogsAvailable = false
    - Dados locais NÃO são apagados
    - Retorna warning: "Álbum não encontrado no Discogs"

### UI (Extensão de V2-03)
14. Modal "Importar do Discogs" na página Collection
15. Campo de busca (catálogo ou barcode)
16. Lista de resultados com preview (capa, título, artista)
17. Botão "Importar" por resultado
18. Botão "Sincronizar" em álbuns com discogsId

## Variáveis de Ambiente

```env
DISCOGS_CONSUMER_KEY=xxx
DISCOGS_CONSUMER_SECRET=xxx
```

## Pré-requisitos

- V2-03 - UI de Gestão de Coleção

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Discogs Service Interface, Workflow 3-4
- [Discogs API Docs](https://www.discogs.com/developers/)
- [PRD v3.0](../prd-v3.md) - Seção 5.2.1

