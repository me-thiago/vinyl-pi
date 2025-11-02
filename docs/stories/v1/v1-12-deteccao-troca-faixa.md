# Story V1.12: Detecção de Troca de Faixa

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero que o sistema detecte quando uma faixa termina e outra começa,  
para que possa ter eventos marcando trocas de faixa.

## Critérios de Aceitação

1. Detecção baseada em mudança abrupta de nível + silêncio curto
2. Thresholds ajustáveis (nível, duração do silêncio)
3. Evento `track.change.detected` emitido via EventBus
4. Precisão inicial pode ser <80% (aceitável)
5. Metadata inclui timestamp da detecção

## Pré-requisitos

- V1.9 - Detecção de Clipping

## Nota

Calibração manual via UI será adicionada em V1.15

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.3 (Reconhecimento Sonoro - Detecção de Troca de Faixa)
- [Epics](../epics.md) - Epic V1

