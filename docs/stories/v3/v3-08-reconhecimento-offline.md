# Story V3.8: Reconhecimento Offline

**Epic:** V3 - Gravação & Análise

**User Story:**
Como usuário,  
quero que reconhecimentos sejam feitos localmente quando possível,  
para que não dependa de internet e tenha resultados instantâneos.

## Critérios de Aceitação

1. Ao reconhecer, primeiro tenta match local (chromaprint)
2. Compara fingerprint capturado com fingerprints da coleção
3. Se match local encontrado: retorna imediatamente (sem API externa)
4. Se não encontrado: fallback para cloud (ACRCloud/AudD)
5. Meta: 70%+ de álbuns da coleção reconhecidos localmente

## Pré-requisitos

- V3.7 - Geração de Chromaprint
- V2.5 - Integração AudD/ACRCloud

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.3.3 (Chromaprint & Reconhecimento Offline - Reconhecimento Offline)
- [Epics](../epics.md) - Epic V3

