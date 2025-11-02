# Story V2.2: CRUD de Álbuns (Backend)

**Epic:** V2 - Coleção & Reconhecimento Musical

**User Story:**
Como usuário,  
quero poder adicionar, editar e remover álbuns da minha coleção,  
para que possa gerenciar minha coleção física.

## Critérios de Aceitação

1. API endpoints criados: `GET /api/albums`, `POST /api/albums`, `GET /api/albums/:id`, `PUT /api/albums/:id`, `DELETE /api/albums/:id`
2. Campos suportados: título, artista, ano, label, formato (LP, 7", 12"), coverUrl, discogsId, condition, tags, notes
3. Validação de campos obrigatórios (título, artista)
4. Busca e filtros funcionais (search, filter por artista/ano/label)
5. Paginação implementada

## Pré-requisitos

- V2.1 - Schema de Dados V2

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.1 (Gestão da Coleção de Discos - CRUD Completo)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Collection)
- [Epics](../epics.md) - Epic V2

