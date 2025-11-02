# Story V3.2: Dual-Path Architecture - Recording Path

**Epic:** V3 - Gravação & Análise

**User Story:**
Como desenvolvedor,  
quero ter um segundo processo FFmpeg para gravação paralela,  
para que possa gravar sem degradar o streaming.

## Critérios de Aceitação

1. Recording path paralelo implementado em `recording.ts`
2. Dois processos FFmpeg separados (stream path + recording path)
3. Buffer circular compartilhado para sincronização
4. Sincronização sample-accurate entre paths
5. Pré-roll de 30s via buffer circular
6. Overhead <5% no stream path (validado com testes)

## Pré-requisitos

- V3.1 - Schema de Dados V3
- V1.5 - Pipeline FFmpeg → Icecast

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.3.1 (Dual-Path Architecture)
- [PRD v3.0](../prd-v3.md) - Seção 6.2 (Arquitetura de Componentes - V3)
- [Epics](../epics.md) - Epic V3

