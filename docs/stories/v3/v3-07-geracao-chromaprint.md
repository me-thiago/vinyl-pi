# Story V3.7: Geração de Chromaprint

**Epic:** V3 - Gravação & Análise

**User Story:**
Como desenvolvedor,  
quero gerar fingerprints de áudio usando chromaprint,  
para que possa reconhecer álbuns localmente.

## Critérios de Aceitação

1. Service `chromaprint.ts` criado
2. Integração com chromaprint (fpcalc)
3. Geração de fingerprint para arquivos FLAC
4. Armazenamento na tabela `chromaprints` vinculado ao álbum
5. Processamento assíncrono (não bloqueia streaming)

## Pré-requisitos

- V3.6 - UI de Gravações

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.3.3 (Chromaprint & Reconhecimento Offline - Chromaprint Local)
- [Epics](../epics.md) - Epic V3

