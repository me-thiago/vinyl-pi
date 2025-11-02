# Story V1.7: EventBus Core

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como desenvolvedor,  
quero ter um sistema de eventos pub/sub interno,  
para que componentes possam comunicar eventos de forma desacoplada.

## Critérios de Aceitação

1. Utilitário `event-bus.ts` criado com padrão publish/subscribe
2. Eventos suportados: `audio.start`, `audio.stop`, `silence.detected`, `silence.ended`, `turntable.idle`, `turntable.active`, `track.change.detected`, `session.started`, `session.ended`, `clipping.detected`
3. Múltiplos listeners por evento
4. Payload serializável (objeto plano)
5. Handlers async que não lançam exceções não tratadas

## Pré-requisitos

- V1.4 - Captura de Áudio ALSA via FFmpeg

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.4 (EventBus Core)
- [Epics](../epics.md) - Epic V1

