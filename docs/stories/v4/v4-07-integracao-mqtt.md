# Story V4.7: Integração MQTT

**Epic:** V4 - Polimento & Controles Avançados

**User Story:**
Como usuário com home automation,  
quero que eventos sejam publicados via MQTT,  
para que possa integrar com outros sistemas.

## Critérios de Aceitação

1. Service `mqtt.ts` criado
2. Configuração de broker MQTT
3. Publicação de eventos: session.started, session.ended, track_recognized
4. Tópicos configuráveis
5. Opção de enable/disable

## Pré-requisitos

- V1.7 - EventBus Core

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.4.2 (Advanced Admin Controls - Integrações Opcionais)
- [Epics](../epics.md) - Epic V4

