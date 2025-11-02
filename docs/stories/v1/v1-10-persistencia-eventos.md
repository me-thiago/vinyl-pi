# Story V1.10: Persistência de Eventos

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero que todos os eventos detectados sejam salvos no banco de dados,  
para que possa consultar histórico posteriormente.

## Critérios de Aceitação

1. Eventos salvos na tabela `audio_events` via Prisma
2. Relacionamento com sessões (session_id quando aplicável)
3. Metadata armazenada como JSON
4. Índices criados para queries eficientes
5. API endpoint `GET /api/events` funcional

## Pré-requisitos

- V1.9 - Detecção de Clipping
- V1.2 - Configuração Prisma e Database

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.6 (Persistência de Dados)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Events)
- [Epics](../epics.md) - Epic V1

