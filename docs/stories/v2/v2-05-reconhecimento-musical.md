# Story V2.5: Integração AudD/ACRCloud (Reconhecimento Musical)

**Epic:** V2 - Coleção & Reconhecimento Musical

**User Story:**
Como usuário,  
quero que o sistema reconheça qual música está tocando,  
para que possa saber automaticamente o que está escutando.

## Critérios de Aceitação

1. Service `recognition.ts` criado
2. Integração com ACRCloud API
3. Fallback para AudD API se ACRCloud falhar
4. Captura de 5-10s do stream (FFmpeg → WAV)
5. Envio para API de reconhecimento
6. Parse de resposta e extração de metadados
7. Cache de reconhecimentos (30 min TTL)

## Pré-requisitos

- V1.5 - Pipeline FFmpeg → Icecast (streaming funcionando)

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.2 (Reconhecimento Musical)
- [PRD v3.0](../prd-v3.md) - Seção 6.5 (Fluxo de Reconhecimento Musical)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Recognition)
- [Epics](../epics.md) - Epic V2

