# Story V2.12: Background Recognition Worker (Opcional)

**Epic:** V2 - Coleção & Reconhecimento Musical

**User Story:**
Como usuário,  
quero que reconhecimentos sejam processados em background,  
para que a UI não trave durante reconhecimento.

## Critérios de Aceitação

1. Worker `recognition-worker.ts` usando Bull Queue (SQLite adapter)
2. Jobs de reconhecimento processados assincronamente
3. Status de job disponível via API
4. UI mostra status "Reconhecendo..." durante processamento

## Pré-requisitos

- V2.5 - Integração AudD/ACRCloud

## Nota

Opcional para V2, pode ser adiado se performance for aceitável

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 6.1 (Stack Tecnológico - Jobs)
- [Epics](../epics.md) - Epic V2

