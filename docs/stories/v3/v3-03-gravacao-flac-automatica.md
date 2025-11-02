# Story V3.3: Gravação FLAC Automática por Sessão

**Epic:** V3 - Gravação & Análise

**User Story:**
Como usuário,  
quero que sessões sejam gravadas automaticamente em FLAC,  
para que tenha backup lossless de tudo que escuto.

## Critérios de Aceitação

1. Gravação automática inicia com sessão
2. Formato FLAC 48kHz/16-bit ou 44.1kHz/16-bit
3. Arquivo salvo em `data/recordings/` com nome único
4. Metadata embedding (tags Vorbis) com informações da sessão
5. Gravação para quando sessão termina
6. Sidecar JSON com offsets e eventos

## Pré-requisitos

- V3.2 - Dual-Path Architecture

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.3.2 (Gravação FLAC/Lossless - Gravação Automática)
- [Epics](../epics.md) - Epic V3

