# Story V1.16: Log de Eventos na UI

**Epic:** V1 - Foundation Core (MVP)
**Status:** Review

**User Story:**
Como usuário,  
quero ver um log scrollable dos últimos eventos detectados,  
para que possa acompanhar o que o sistema está detectando.

## Critérios de Aceitação

1. Seção de log de eventos na página Diagnostics
2. Lista scrollable mostrando últimos 100 eventos
3. Cada evento mostra: tipo, timestamp, metadata (quando aplicável)
4. Cores diferentes por tipo de evento
5. Auto-scroll para eventos mais recentes (opcional)

## Pré-requisitos

- V1.15 - UI de Diagnóstico

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.3 (Reconhecimento Sonoro - UI de Diagnóstico)
- [Epics](../epics.md) - Epic V1

---

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-16-log-eventos-ui.context.xml) - Generated 2025-11-30

### Implementation Notes

**Completed:** 2025-11-29

Esta story foi implementada junto com a V1.15, pois o log de eventos faz parte da página Diagnostics.

#### Funcionalidades

1. **ScrollArea** com altura fixa (h-96) para 100 eventos
2. **Cores por tipo** de evento via Badge variants:
   - `destructive` - clipping
   - `secondary` - silence
   - `default` - session
   - `outline` - outros
3. **Metadata** exibida quando disponível (levelDb, duration, count)
4. **Toggle Ao vivo/Pausado** - permite pausar a lista para examinar eventos
5. **Timestamp** formatado em horário local

#### Acceptance Criteria Verification

- ✅ Seção de log de eventos na página Diagnostics
- ✅ Lista scrollable mostrando últimos 100 eventos
- ✅ Cada evento mostra: tipo, timestamp, metadata
- ✅ Cores diferentes por tipo de evento
- ✅ Auto-scroll (toggle "Ao vivo" permite pausar)
