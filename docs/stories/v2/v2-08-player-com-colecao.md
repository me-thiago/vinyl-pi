# Story V2.8: Link Reconhecimento → Coleção no Player

**Epic:** V2 - Coleção & Reconhecimento Musical

**User Story:**
Como usuário,  
quero ver a capa do álbum e metadados completos quando uma música é reconhecida,  
para que tenha uma experiência visual rica.

## Critérios de Aceitação

1. Player atualizado para mostrar capa do álbum quando reconhecido
2. Metadados completos: artista, título, álbum, ano
3. Link para álbum na coleção (se encontrado)
4. Botão "Adicionar à coleção" se não encontrado
5. WebSocket event `track_recognized` atualiza player em tempo real

## Pré-requisitos

- V2.7 - UI de Matching/Confirmação
- V1.6 - Frontend Player Básico

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.4 (UI Expandida - Player Atualizado)
- [PRD v3.0](../prd-v3.md) - Seção 7.2 (WebSocket Events - Track Reconhecido)
- [Epics](../epics.md) - Epic V2

