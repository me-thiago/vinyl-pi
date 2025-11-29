# Story V1.7: EventBus Core

**Epic:** V1 - Foundation Core (MVP)
**Status:** done

**User Story:**
Como desenvolvedor,
quero ter um sistema de eventos pub/sub interno,
para que componentes possam comunicar eventos de forma desacoplada.

## Critérios de Aceitação

- [x] 1. Utilitário `event-bus.ts` criado com padrão publish/subscribe
- [x] 2. Eventos suportados: `audio.start`, `audio.stop`, `silence.detected`, `silence.ended`, `turntable.idle`, `turntable.active`, `track.change.detected`, `session.started`, `session.ended`, `clipping.detected`
- [x] 3. Múltiplos listeners por evento
- [x] 4. Payload serializável (objeto plano)
- [x] 5. Handlers async que não lançam exceções não tratadas

## Tasks/Subtasks

- [x] Criar `backend/src/utils/event-bus.ts` com classe EventBus
- [x] Implementar métodos `publish`, `subscribe`, `unsubscribe`
- [x] Adicionar types para EventType e EventHandler
- [x] Implementar tratamento de exceções async (não propagar)
- [x] Adicionar logging com Winston
- [x] Criar testes abrangentes em `backend/src/__tests__/utils/event-bus.test.ts`
- [x] Validar todos os 5 critérios de aceitação via testes

## Pré-requisitos

- V1.4 - Captura de Áudio ALSA via FFmpeg

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.4 (EventBus Core)
- [Epics](../epics.md) - Epic V1

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-7-eventbus-core.context.xml) - Generated 2025-11-03

### File List
- **Created:**
  - `backend/src/utils/event-bus.ts` - EventBus implementation (singleton)
  - `backend/src/__tests__/utils/event-bus.test.ts` - Comprehensive test suite (26 tests)

### Change Log
- 2025-11-07: EventBus Core implemented and tested (100% pass rate)
- 2025-11-08: Memory leak prevention enhancements added:
  - JSDoc expandido com avisos de memory leak e padrões corretos
  - Guards de segurança (warning ≥10 listeners, error ≥50 listeners, detecção de duplicatas)
  - Método `getDebugReport()` para diagnóstico
  - Utilitário `lifecycle.ts` com `createSubscriptionManager()` e `DestroyableComponent`
  - Documentação abrangente em CLAUDE.md e .cursor/rules/eventbus-safety.mdc
  - Comentários de exemplo em audio-manager.ts
  - Testes de lifecycle (17 tests, 100% pass)
  - Total: 44 testes (27 EventBus + 17 Lifecycle)

### Completion Notes

**Implementation Summary:**
Implementado EventBus completo com padrão pub/sub usando TypeScript nativo (sem dependências externas). Sistema robusto com tratamento de exceções, logging detalhado, e suporte para execução paralela de handlers.

**Key Features:**
- ✅ Classe EventBus com Map<string, Set<EventHandler>> para gerenciar listeners
- ✅ Métodos `publish`, `subscribe`, `unsubscribe`
- ✅ 10 tipos de eventos suportados (EventType union type)
- ✅ Handlers async com try/catch (exceções não propagam)
- ✅ Execução paralela de handlers via Promise.all
- ✅ Singleton export para uso global
- ✅ Logging com Winston (info, error, warn)
- ✅ Métodos auxiliares: `getListenerCount`, `clearAllListeners`

**Test Coverage (26 tests, 100% pass):**
- AC1: Criação do utilitário + singleton (4 tests)
- AC2: 10 eventos suportados (3 tests)
- AC3: Múltiplos listeners + execução paralela (3 tests)
- AC4: Payloads serializáveis (3 tests)
- AC5: Handlers async + exception handling (4 tests)
- Unsubscribe functionality (4 tests)
- Performance/memory tests (3 tests)
- Integration scenarios (2 tests)

**Technical Decisions:**
- Usado Map + Set para O(1) subscribe/unsubscribe
- Promise.all para execução paralela (não sequential)
- Winston logger com file output (logs/event-bus.log)
- No external dependencies (apenas TypeScript + Winston)

