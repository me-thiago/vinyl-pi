# Story V1.17: Histórico de Sessões

**Epic:** V1 - Foundation Core (MVP)
**Status:** Done

**User Story:**
Como usuário,
quero ver uma lista de todas as sessões de escuta anteriores,
para que possa revisar meu histórico de uso.

## Critérios de Aceitação

1. [x] Página Sessions criada
2. [x] Lista de sessões com: início, fim, duração, contador de eventos
3. [x] Filtros por data (date_from, date_to)
4. [x] Paginação (limit/offset)
5. [x] Link para detalhes de sessão (mostrar eventos da sessão)

## Pré-requisitos

- V1.14 - WebSocket Real-Time Updates

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.5 (Interface Web - Histórico de Sessões)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Sessions)
- [Epics](../epics.md) - Epic V1

---

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-17-historico-sessoes.context.xml) - Generated 2025-11-30

### Implementation Notes
- **Completed:** 2025-11-29
- **Commit:** 63b094d

### Files Created/Modified
- `frontend/src/pages/Sessions.tsx` - Lista de sessões com filtros e paginação
- `frontend/src/pages/SessionDetail.tsx` - Detalhes da sessão com timeline de eventos
- `frontend/src/components/ui/input.tsx` - Componente Input do shadcn
- `frontend/src/main.tsx` - Rotas /sessions e /sessions/:id
- `frontend/src/App.tsx` - Link "Sessões" na navegação
- `frontend/src/index.css` - Variáveis --success e --success-foreground
- `backend/src/services/session-manager.ts` - Fix: endedAt agora reflete início do silêncio
