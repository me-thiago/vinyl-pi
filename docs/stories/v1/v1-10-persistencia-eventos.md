# Story V1.10: Persistência de Eventos

**Epic:** V1 - Foundation Core (MVP)
**Status:** done

**User Story:**
Como usuário,
quero que todos os eventos detectados sejam salvos no banco de dados,
para que possa consultar histórico posteriormente.

## Critérios de Aceitação

- [x] 1. Eventos salvos na tabela `audio_events` via Prisma
- [x] 2. Relacionamento com sessões (session_id quando aplicável)
- [x] 3. Metadata armazenada como JSON
- [x] 4. Índices criados para queries eficientes
- [x] 5. API endpoint `GET /api/events` funcional

## Pré-requisitos

- V1.9 - Detecção de Clipping ✅
- V1.2 - Configuração Prisma e Database ✅

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.6 (Persistência de Dados)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Events)
- [Epics](../epics.md) - Epic V1

## Tasks

- [x] 1. Criar service event-persistence.ts para persistir eventos via Prisma
- [x] 2. Integrar event-persistence ao EventBus (subscriber)
- [x] 3. Criar rota GET /api/events com filtros e paginação
- [x] 4. Atualizar index.ts para inicializar e cleanup do EventPersistence
- [x] 5. Escrever testes unitários para event-persistence
- [x] 6. Escrever testes para rota /api/events

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-10-persistencia-eventos.context.xml) - Generated 2025-11-28

### File List
- **Created:**
  - `backend/src/services/event-persistence.ts` - Serviço de persistência de eventos
  - `backend/src/routes/events.ts` - Router para API de eventos
  - `backend/src/__tests__/services/event-persistence.test.ts` - Testes do EventPersistence (24 tests)
  - `backend/src/__tests__/routes/events.test.ts` - Testes da rota /api/events (24 tests)

- **Modified:**
  - `backend/src/index.ts` - Integração do EventPersistence com inicialização e graceful shutdown

### Change Log
- 2025-11-29: V1.10 Persistência de Eventos implementada
  - EventPersistence: Subscreve a 6 eventos (silence.detected, silence.ended, clipping.detected, session.started, session.ended, track.change.detected)
  - Persistência fire-and-forget: erros são logados mas não bloqueiam EventBus
  - API GET /api/events com filtros: session_id, event_type, date_from, date_to, limit, offset
  - Resposta inclui: events[], total, hasMore
  - API GET /api/events/stats retorna estatísticas do serviço
  - Graceful shutdown integrado no index.ts
  - 48 testes unitários (24 EventPersistence + 24 Events Router), 100% pass

### Completion Notes

**Implementation Summary:**
Implementado sistema completo de persistência de eventos:
- **EventPersistence**: Serviço que implementa Destroyable, usa SubscriptionManager para cleanup seguro
- **Fire-and-forget**: Persistência não bloqueia EventBus, erros são logados silenciosamente
- **Session tracking**: Suporte para session_id quando sessões estiverem implementadas (V1.11)

**Key Features:**
- ✅ Eventos salvos na tabela audio_events via Prisma
- ✅ sessionId incluído quando sessão está ativa
- ✅ Metadata armazenada como JSON (levelDb, duration, threshold, etc.)
- ✅ Índices já existentes no schema (eventType+timestamp, sessionId+timestamp)
- ✅ API GET /api/events com filtros (session_id, event_type, date_from, date_to)
- ✅ Paginação com limit, offset e hasMore
- ✅ API GET /api/events/stats para monitoramento
- ✅ Graceful shutdown com destroy()
- ✅ Memory leak prevention com SubscriptionManager

**Technical Decisions:**
- Fire-and-forget para não impactar latência do EventBus
- Session management preparado para V1.11 (setCurrentSessionId/getCurrentSessionId)
- Limite máximo de 1000 resultados por página
- Ordenação por timestamp DESC (mais recentes primeiro)
- Erros de persistência incrementam errorCount mas não propagam exceções

**Test Coverage (48 tests, 100% pass):**
- EventPersistence: Initialization (3), Start/Stop (5), Event Persistence (4), Session Management (5), Error Handling (3), Track Change (1), Stats (2)
- Events Router: Basic (3), Pagination (6), Filtering (9), Ordering (1), Error Handling (1), Stats (3)

