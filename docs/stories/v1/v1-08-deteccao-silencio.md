# Story V1.8: Detecção de Silêncio

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero que o sistema detecte quando não há áudio (silêncio),  
para que possa identificar quando o toca-discos está parado.

## Critérios de Aceitação

1. Serviço `event-detector.ts` analisa nível de áudio em tempo real
2. Threshold configurável (default: -50dB)
3. Duração configurável (default: 10s)
4. Evento `silence.detected` emitido via EventBus quando detectado
5. Evento `silence.ended` emitido quando áudio retorna
6. Status disponível via API

## Pré-requisitos

- V1.7 - EventBus Core

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.3 (Reconhecimento Sonoro - Detecção de Silêncio)
- [Epics](../epics.md) - Epic V1

