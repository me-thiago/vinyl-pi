# Story V1.4: Captura de Áudio ALSA via FFmpeg

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero que o sistema capture áudio do dispositivo ALSA configurado,  
para que possa processar e fazer streaming do áudio do toca-discos.

## Critérios de Aceitação

1. Serviço `audio-manager.ts` criado com captura ALSA via FFmpeg
2. Device de áudio configurável (default: `plughw:1,0`)
3. Formato: 48kHz/16-bit/stereo (configurável)
4. Buffer size configurável (512-2048 samples)
5. Detecção de dispositivo desconectado com tratamento de erro
6. Logging adequado de status de captura

## Pré-requisitos

- V1.2 - Configuração Prisma e Database
- V1.3 - Configuração Icecast2

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.1 (Captura de Áudio)
- [Epics](../epics.md) - Epic V1

