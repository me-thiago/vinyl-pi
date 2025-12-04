# Story V1.21: Install Script Completo

**Epic:** V1 - Foundation Core (MVP)
**Status:** done

**User Story:**
Como usuário,
quero ter um script de instalação que configure tudo automaticamente,
para que o setup seja simples e reproduzível.

## Critérios de Aceitação

1. [x] Script `scripts/install.sh` criado
2. [x] Instala dependências do sistema (Node.js, FFmpeg, Icecast2, etc.)
3. [x] Instala dependências do projeto (npm install)
4. [x] Configura Prisma e database
5. [x] Configura Icecast2
6. [x] Setup inicial de PM2
7. [x] Testes básicos de funcionamento
8. [x] Documentação do processo de instalação

## Pré-requisitos

- V1.20 - PM2 Config e Auto-Start

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 10.1 (Quick Start)
- [PRD v3.0](../prd-v3.md) - Seção 10.2 (Validação Pós-Instalação)
- [Epics](../epics.md) - Epic V1

---

## Tasks/Subtasks

- [x] Task 1: Criar script install.sh
  - [x] Estrutura base com funções de utilidade e cores
  - [x] Verificação de ambiente (não root, Raspberry Pi)
- [x] Task 2: Instalação de dependências do sistema
  - [x] Node.js 20 via NodeSource
  - [x] FFmpeg, Icecast2, ALSA utils, SQLite, jq, curl
  - [x] PM2 global
- [x] Task 3: Instalação de dependências Node.js
  - [x] Root workspace
  - [x] Backend
  - [x] Frontend
- [x] Task 4: Configuração do banco de dados
  - [x] Prisma generate
  - [x] Prisma db push
- [x] Task 5: Configuração Icecast2
  - [x] Criar config/icecast.xml se não existir
  - [x] Criar diretório de logs
- [x] Task 6: Configuração PM2
  - [x] Verificar ecosystem.config.js
  - [x] Setup pm2 startup systemd
- [x] Task 7: Build do projeto
  - [x] Backend (npm run build)
  - [x] Frontend (npm run build)
- [x] Task 8: Testes de validação
  - [x] Verificar Node.js, npm, FFmpeg, Icecast2, PM2, SQLite
  - [x] Verificar builds
  - [x] Verificar dispositivo de áudio
- [x] Task 9: Documentação
  - [x] Atualizar README.md com seção de instalação automatizada

---

## Dev Agent Record

### Context Reference
- [Story Context](../v1-21-install-script.context.xml)

### Debug Log
- 2025-12-03: Implementação completa do script de instalação

### Completion Notes
Script de instalação completo criado em `scripts/install.sh`:

**Funcionalidades:**
- Instalação automatizada de todas as dependências
- Detecção de Raspberry Pi
- Verificação de dependências já instaladas (não reinstala)
- Configuração automática de Icecast2, Prisma, PM2
- Build automático de backend e frontend
- 10 testes de validação pós-instalação
- Detecção de dispositivos de áudio
- Instruções claras de próximos passos

**Tempo de execução:** ~10-20 minutos em Raspberry Pi

---

## File List

### Arquivos Criados
- scripts/install.sh

### Arquivos Modificados
- README.md (seção de instalação automatizada)

---

## Change Log

- 2025-12-03: Implementação completa - AC1 a AC8 concluídos

