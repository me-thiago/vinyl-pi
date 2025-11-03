# Story V1.5: Pipeline FFmpeg → Icecast (Streaming Engine)

**Epic:** V1 - Foundation Core (MVP)  
**Status:** ready-for-dev

**User Story:**
Como usuário,  
quero que o áudio capturado seja codificado e enviado para Icecast2,  
para que possa ouvir o stream em qualquer dispositivo na rede local.

## Critérios de Aceitação

1. FFmpeg processa captura ALSA e codifica para MP3 320kbps CBR
2. Stream enviado para Icecast2 mount point `/stream` via HTTP POST
3. Fallback: loop de silêncio quando sem input
4. Suporte a até 20 clientes simultâneos
5. Buffer do servidor: 64KB (latência vs estabilidade)
6. Status de streaming disponível via API (`GET /api/status`)

## Pré-requisitos

- V1.4 - Captura de Áudio ALSA via FFmpeg

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.2 (Streaming Engine)
- [PRD v3.0](../prd-v3.md) - Seção 6.3 (Fluxo de Dados Principal)
- [Epics](../epics.md) - Epic V1

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-5-pipeline-ffmpeg-icecast.context.xml) - Generated 2025-11-03

