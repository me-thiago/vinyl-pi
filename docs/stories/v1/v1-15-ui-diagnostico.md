# Story V1.15: UI de Diagnóstico (VU Meter e Thresholds)

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero poder ver o nível de áudio em tempo real e ajustar thresholds de detecção,  
para que possa calibrar o sistema para meu toca-discos específico.

## Critérios de Aceitação

1. Página Diagnostics criada
2. VU meter em tempo real mostrando nível de áudio (dB)
3. Configuração de thresholds:
   - Silence threshold (dB)
   - Silence duration (segundos)
   - Track change sensitivity (0-1)
   - Session timeout (minutos)
4. Botões de teste manual (trigger de eventos para teste)
5. Mudanças salvas via API e aplicadas imediatamente

## Pré-requisitos

- V1.14 - WebSocket Real-Time Updates

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.3 (Reconhecimento Sonoro - UI de Diagnóstico)
- [Epics](../epics.md) - Epic V1

