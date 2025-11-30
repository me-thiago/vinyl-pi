# Story V1.11: Detecção de Sessão (Start/End)

**Epic:** V1 - Foundation Core (MVP)
**Status:** ✅ Concluída (2025-01-29)

**User Story:**
Como usuário,
quero que o sistema detecte quando começo e termino uma sessão de escuta,
para que possa ter histórico organizado por sessões.

## Critérios de Aceitação

1. ✅ Sessão inicia: primeira detecção de áudio após período idle
2. ✅ Sessão termina: silêncio prolongado (30min configurável via SESSION_TIMEOUT)
3. ✅ Eventos `session.started` e `session.ended` emitidos via EventBus
4. ✅ Sessão salva na tabela `sessions` via Prisma
5. ✅ Contador de eventos por sessão atualizado
6. ✅ API endpoint `GET /api/sessions` funcional

## Pré-requisitos

- V1.10 - Persistência de Eventos

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.3 (Reconhecimento Sonoro - Detecção de Sessão)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Sessions)
- [Epics](../epics.md) - Epic V1

---

## Implementação

### Arquivos Criados/Modificados

1. **`backend/src/services/session-manager.ts`** (novo)
   - State machine com estados `idle` e `active`
   - Escuta eventos `audio.level`, `silence.detected`, `silence.ended`
   - Inicia sessão quando detecta áudio acima do threshold
   - Encerra sessão após timeout configurável de silêncio
   - Emite eventos `session.started` e `session.ended`
   - Persiste sessões via Prisma

2. **`backend/src/routes/sessions.ts`** (novo)
   - `GET /api/sessions` - Lista com paginação e filtros por data
   - `GET /api/sessions/active` - Sessão ativa atual
   - `GET /api/sessions/:id` - Detalhes da sessão com eventos

3. **`backend/src/services/event-persistence.ts`** (modificado)
   - Adicionado `setSessionManager()` para integração
   - Eventos são automaticamente vinculados à sessão ativa
   - Contador de eventos da sessão incrementado automaticamente

4. **`backend/src/routes/status.ts`** (modificado)
   - Endpoint `/api/status` agora inclui informações da sessão ativa

5. **`backend/src/index.ts`** (modificado)
   - SessionManager inicializado e integrado
   - Graceful shutdown para SessionManager

6. **`backend/.env` e `.env.example`** (modificado)
   - Adicionada variável `SESSION_TIMEOUT` (padrão: 1800 segundos = 30 minutos)

### Testes

- `backend/src/__tests__/services/session-manager.test.ts` - 30 testes
- `backend/src/__tests__/routes/sessions.test.ts` - 29 testes
- Total: 59 testes passando para V1.11

### Configuração

```env
# Session Configuration
# Tempo em segundos para considerar fim de sessão após silêncio
SESSION_TIMEOUT=1800
```

### API Endpoints

```
GET /api/sessions
  Query params: limit, offset, date_from, date_to
  Response: { sessions: [], total: number, hasMore: boolean }

GET /api/sessions/active
  Response: { active: boolean, session: SessionInfo | null }

GET /api/sessions/:id
  Response: SessionInfo com eventos relacionados
```

### Notas Técnicas

- Implementa padrão Destroyable e usa SubscriptionManager para evitar memory leaks
- Timer de timeout cancelado quando silêncio é interrompido
- Graceful shutdown encerra sessão ativa antes de finalizar
- Integração com EventPersistence para contagem automática de eventos

