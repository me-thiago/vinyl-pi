# Story V1.20: PM2 Config e Auto-Start

**Epic:** V1 - Foundation Core (MVP)

**User Story:**
Como usuário,  
quero que o sistema inicie automaticamente após reboot,  
para que funcione sem intervenção manual.

## Critérios de Aceitação

1. Arquivo `ecosystem.config.js` criado para PM2
2. Script de start configurado
3. Auto-restart habilitado
4. Logs configurados (app.log, error.log)
5. Comando `pm2 startup` executado e configurado
6. Documentação de como iniciar/parar serviço

## Pré-requisitos

- V1.19 - Error Handling Robusto

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 6.1 (Stack Tecnológico - Process Manager)
- [PRD v3.0](../prd-v3.md) - Seção 18.B (Configuração Exemplo Completa)
- [Epics](../epics.md) - Epic V1

