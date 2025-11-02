# Story V2.6: Validação Contra Coleção (Fuzzy Matching)

**Epic:** V2 - Coleção & Reconhecimento Musical

**User Story:**
Como usuário,  
quero que reconhecimentos sejam validados contra minha coleção,  
para que erros sejam reduzidos e reconhecimentos sejam vinculados aos meus álbuns.

## Critérios de Aceitação

1. Após reconhecimento, busca automática na coleção
2. Fuzzy matching por artista + álbum (algoritmo Levenshtein)
3. Threshold de confiança configurável
4. Se múltiplos matches: retorno com flag `needs_confirmation`
5. Se nenhum match: opção para adicionar à coleção
6. Match de album vinculado ao track reconhecido

## Pré-requisitos

- V2.5 - Integração AudD/ACRCloud
- V2.2 - CRUD de Álbuns (Backend)

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.2 (Reconhecimento Musical - Validação contra Coleção)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Recognition - album_match)
- [Epics](../epics.md) - Epic V2

