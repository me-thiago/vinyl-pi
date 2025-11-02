# Story V1.9: Detecção de Clipping

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero ser alertado quando o áudio está saturado (clipping),  
para que possa ajustar o volume de entrada.

## Critérios de Aceitação

1. Detecção de clipping quando nível > threshold (default: -1dB)
2. Evento `clipping.detected` emitido via EventBus
3. Metadata inclui timestamp e nível de áudio
4. Contador de eventos de clipping disponível

## Pré-requisitos

- V1.8 - Detecção de Silêncio

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.1 (Captura de Áudio - Monitoramento)
- [Epics](../epics.md) - Epic V1

