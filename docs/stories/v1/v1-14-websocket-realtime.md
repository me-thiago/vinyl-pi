# Story V1.14: WebSocket Real-Time Updates

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero receber atualizações em tempo real sobre eventos e status,  
para que a interface seja sempre atualizada sem refresh.

## Critérios de Aceitação

1. Socket.io configurado no backend e frontend
2. Cliente pode subscrever canais: `status`, `events`, `session`
3. Status update a cada 5s: streaming, listeners, sessão ativa, nível de áudio
4. Eventos emitidos em tempo real quando detectados
5. Reconexão automática em caso de desconexão

## Pré-requisitos

- V1.13 - Dashboard Básico

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 7.2 (WebSocket Events)
- [Epics](../epics.md) - Epic V1

