# Story V1.21: Install Script Completo

**Epic:** V1 - Foundation Core (MVP)
**Status:** ready-for-dev

**User Story:**
Como usuário,  
quero ter um script de instalação que configure tudo automaticamente,  
para que o setup seja simples e reproduzível.

## Critérios de Aceitação

1. Script `scripts/install.sh` criado
2. Instala dependências do sistema (Node.js, FFmpeg, Icecast2, etc.)
3. Instala dependências do projeto (npm install)
4. Configura Prisma e database
5. Configura Icecast2
6. Setup inicial de PM2
7. Testes básicos de funcionamento
8. Documentação do processo de instalação

## Pré-requisitos

- V1.20 - PM2 Config e Auto-Start

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 10.1 (Quick Start)
- [PRD v3.0](../prd-v3.md) - Seção 10.2 (Validação Pós-Instalação)
- [Epics](../epics.md) - Epic V1

## Dev Agent Record

### Context Reference
- [Story Context](../v1-21-install-script.context.xml)

