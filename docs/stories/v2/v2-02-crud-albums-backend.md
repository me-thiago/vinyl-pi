# Story V2-02: CRUD de Álbuns (Backend)

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** done

**User Story:**
Como usuário,
quero poder adicionar, editar e remover álbuns da minha coleção,
para que possa gerenciar minha coleção física.

## Critérios de Aceitação

### Endpoints CRUD
1. [x] `GET /api/albums` - Listar com paginação (limit, offset), busca (search), filtros (artist, year, format, archived)
2. [x] `POST /api/albums` - Criar álbum com validação Zod
3. [x] `GET /api/albums/:id` - Buscar por ID
4. [x] `PUT /api/albums/:id` - Atualizar (não permite alterar discogsId)
5. [x] `DELETE /api/albums/:id` - Deletar álbum

### Endpoints Adicionais
6. [x] `PATCH /api/albums/:id/archive` - Arquivar/desarquivar álbum
7. [x] `POST /api/albums/:id/sync-discogs` - Stub para V2-04 (retorna 501 Not Implemented)

### Validação
8. [x] Schema Zod: title e artist obrigatórios, format e condition como enums
9. [x] Mensagens de erro em português BR

### Comportamento
10. [x] GET /api/albums por padrão não retorna álbuns com archived=true
11. [x] Paginação retorna meta: { total, limit, offset }
12. [x] Sort por: title, artist, year, createdAt (default: createdAt desc)

### Testes
13. [x] Testes unitários para schemas Zod
14. [x] Testes de integração para rotas (CRUD completo)
15. [x] Cobertura mínima 80%

## Pré-requisitos

- [x] V2-01 - Schema de Dados V2

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção APIs/Albums CRUD, Data Models
- [PRD v3.0](../prd-v3.md) - Seção 5.2.1, 7.1

---

## Tasks/Subtasks

- [x] Criar schema Zod em `backend/src/schemas/albums.schema.ts`
  - [x] albumCreateSchema (title, artist obrigatórios)
  - [x] albumUpdateSchema (partial, bloqueia discogsId)
  - [x] albumQuerySchema (paginação, filtros, sort)
  - [x] albumArchiveSchema
- [x] Criar rota em `backend/src/routes/albums.ts`
  - [x] GET /api/albums (listagem com filtros)
  - [x] POST /api/albums (criar)
  - [x] GET /api/albums/:id (buscar por ID)
  - [x] PUT /api/albums/:id (atualizar)
  - [x] DELETE /api/albums/:id (deletar)
  - [x] PATCH /api/albums/:id/archive (arquivar)
  - [x] POST /api/albums/:id/sync-discogs (stub 501)
- [x] Registrar rota no index.ts
- [x] Adicionar documentação Swagger/OpenAPI
- [x] Criar testes em `backend/src/__tests__/routes/albums.test.ts`
- [x] Criar testes em `backend/src/__tests__/schemas/albums.schema.test.ts`
- [x] Rodar validação completa (npm run validate)

---

## Dev Agent Record

### Debug Log

1. **Zod 4 API diferente**: O projeto usa Zod 4, que tem API diferente do Zod 3:
   - Usar `{ message: '...' }` em vez de `{ errorMap: ... }` ou `{ required_error: '...' }`
   - UUID validation no Zod 4 é mais estrita (RFC 4122 compliant)

2. **Prisma Json type**: Campo `tags` (Json?) não aceita `null` diretamente - usar `undefined` em vez de `null`

3. **Swagger test adjustment**: Teste existente esperava apenas 200, ajustado para aceitar 201 (POST) e 501 (stub)

### Completion Notes

Story implementada com sucesso. Todos os ACs atendidos:
- CRUD completo funcionando
- Validação Zod com mensagens em PT-BR
- Paginação, busca e filtros implementados
- Documentação Swagger adicionada
- 100% cobertura nos schemas, rotas com alta cobertura
- `npm run validate` passando (backend + frontend)

---

## File List

### Created
- `backend/src/schemas/albums.schema.ts` - Schemas Zod para validação
- `backend/src/routes/albums.ts` - Rotas CRUD de álbuns
- `backend/src/__tests__/schemas/albums.schema.test.ts` - Testes de schema
- `backend/src/__tests__/routes/albums.test.ts` - Testes de integração

### Modified
- `backend/src/schemas/index.ts` - Export do novo schema
- `backend/src/index.ts` - Registro da rota de álbuns
- `backend/src/config/swagger.ts` - Tags e schemas OpenAPI para Albums
- `backend/src/__tests__/config/swagger.test.ts` - Ajuste para aceitar 201/501

---

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2025-12-05 | Implementação completa do CRUD de álbuns | Amelia (Dev Agent) |
