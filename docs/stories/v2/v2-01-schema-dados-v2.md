# Story V2.1: Schema de Dados V2 (Albums e Tracks)

**Epic:** V2 - Coleção & Reconhecimento Musical

**User Story:**
Como desenvolvedor,  
quero ter as tabelas de álbuns e tracks no banco de dados,  
para que possa persistir dados da coleção e reconhecimentos.

## Critérios de Aceitação

1. Migration V1→V2 criada adicionando tabelas: `albums`, `tracks`, `recognition_cache`
2. Relacionamentos definidos: Album 1:N Track, Session 1:N Track, Track N:1 Album (opcional)
3. Índices criados para queries eficientes
4. Migration aplicada e testada
5. Schema Prisma atualizado

## Pré-requisitos

- V1 completo

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.3 (Persistência Expandida - SQLite V2)
- [Epics](../epics.md) - Epic V2

