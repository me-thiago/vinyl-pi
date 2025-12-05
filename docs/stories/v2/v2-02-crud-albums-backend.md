# Story V2-02: CRUD de Álbuns (Backend)

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** drafted

**User Story:**
Como usuário,
quero poder adicionar, editar e remover álbuns da minha coleção,
para que possa gerenciar minha coleção física.

## Critérios de Aceitação

### Endpoints CRUD
1. `GET /api/albums` - Listar com paginação (limit, offset), busca (search), filtros (artist, year, format, archived)
2. `POST /api/albums` - Criar álbum com validação Zod
3. `GET /api/albums/:id` - Buscar por ID
4. `PUT /api/albums/:id` - Atualizar (não permite alterar discogsId)
5. `DELETE /api/albums/:id` - Deletar (considerar archived=true como alternativa)

### Endpoints Adicionais
6. `PATCH /api/albums/:id/archive` - Arquivar/desarquivar álbum
7. `POST /api/albums/:id/sync-discogs` - Re-sincronizar com Discogs (preparação para V2-04)

### Validação
8. Schema Zod: title e artist obrigatórios, format e condition como enums
9. Mensagens de erro em português BR

### Comportamento
10. GET /api/albums por padrão não retorna álbuns com archived=true
11. Paginação retorna meta: { total, limit, offset }
12. Sort por: title, artist, year, createdAt (default: createdAt desc)

## Detalhes Técnicos

```typescript
// Zod Schema
const albumCreateSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  year: z.number().int().min(1900).max(2100).optional(),
  format: z.enum(['LP', 'EP', 'SINGLE_7', 'SINGLE_12', 'DOUBLE_LP', 'BOX_SET']).optional(),
  condition: z.enum(['mint', 'near_mint', 'vg_plus', 'vg', 'good', 'fair', 'poor']).optional(),
  // ... outros campos
});
```

## Pré-requisitos

- V2-01 - Schema de Dados V2

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção APIs/Albums CRUD
- [PRD v3.0](../prd-v3.md) - Seção 5.2.1, 7.1

