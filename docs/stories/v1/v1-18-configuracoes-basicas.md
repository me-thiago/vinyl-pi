# Story V1.18: Configurações Básicas

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero poder configurar o dispositivo de áudio e outras opções básicas,  
para que o sistema funcione com meu hardware específico.

## Critérios de Aceitação

1. Página Settings criada
2. Dropdown de dispositivos de áudio detectados
3. Configuração de thresholds (já disponível em Diagnostics, mas também aqui)
4. Tema claro/escuro (toggle)
5. Mudanças salvas via API `PUT /api/settings`
6. Configurações persistidas na tabela `settings`

## Pré-requisitos

- V1.17 - Histórico de Sessões

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.5 (Interface Web - Configurações)
- [PRD v3.0](../prd-v3.md) - Seção 7.1 (API Contracts - Settings)
- [Epics](../epics.md) - Epic V1

