# Story V2.4: Integração Discogs (Busca e Importação)

**Epic:** V2 - Coleção & Reconhecimento Musical

**User Story:**
Como usuário,  
quero poder buscar álbuns no Discogs e importar metadados automaticamente,  
para que não precise digitar todas as informações manualmente.

## Critérios de Aceitação

1. Service `discogs.ts` criado com cliente da API Discogs
2. Endpoint `POST /api/albums/import-discogs` funcional
3. Busca por catálogo/barcode
4. Importação de metadados: título, artista, ano, label, formato, capa
5. Tratamento de rate limits da API
6. Cache local de dados importados

## Pré-requisitos

- V2.3 - UI de Gestão de Coleção

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.1 (Gestão da Coleção de Discos - Integração Discogs)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Collection)
- [Epics](../epics.md) - Epic V2

