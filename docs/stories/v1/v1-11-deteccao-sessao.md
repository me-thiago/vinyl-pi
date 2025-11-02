# Story V1.11: Detecção de Sessão (Start/End)

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero que o sistema detecte quando começo e termino uma sessão de escuta,  
para que possa ter histórico organizado por sessões.

## Critérios de Aceitação

1. Sessão inicia: primeira detecção de áudio após período idle
2. Sessão termina: silêncio prolongado (30min configurável)
3. Eventos `session.started` e `session.ended` emitidos via EventBus
4. Sessão salva na tabela `sessions` via Prisma
5. Contador de eventos por sessão atualizado
6. API endpoint `GET /api/sessions` funcional

## Pré-requisitos

- V1.10 - Persistência de Eventos

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.3 (Reconhecimento Sonoro - Detecção de Sessão)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Sessions)
- [Epics](../epics.md) - Epic V1

