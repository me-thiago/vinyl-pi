# Story V1.2: Configuração Prisma e Database

**Epic:** V1 - Foundation Core (MVP)
**Status:** done

**User Story:**
Como desenvolvedor,
quero ter o banco de dados SQLite configurado com Prisma e schema V1 inicial,
para que possa persistir dados de sessões e eventos.

## Critérios de Aceitação

- [x] Prisma schema criado com modelos Session, AudioEvent, Setting
- [x] Migration inicial criada e aplicada
- [x] Prisma Client gerado e configurado
- [x] Database SQLite criado em `data/vinyl-os.db`
- [x] Scripts de backup documentados

## Pré-requisitos

- V1.1 - Setup Inicial do Projeto

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.6 (Persistência de Dados)
- [Epics](../epics.md) - Epic V1

## Tasks/Subtasks

- [x] Expandir schema.prisma com modelos V1 (Session, AudioEvent, Setting)
  - [x] Adicionar model Session com campos id, startedAt, endedAt, durationSeconds, eventCount, timestamps
  - [x] Adicionar model AudioEvent com FK para Session e cascade delete
  - [x] Adicionar model Setting com key-value pairs
  - [x] Criar índices: Session por startedAt DESC, AudioEvent por sessionId+timestamp e eventType+timestamp
- [x] Validar schema Prisma (npx prisma validate)
- [x] Criar Prisma Client singleton em backend/src/prisma/client.ts
- [x] Gerar Prisma Client (npx prisma generate)
- [x] Aplicar schema ao database (npx prisma db push)
- [x] Verificar criação do database em data/vinyl-os.db
- [x] Criar pasta data/backups/ para armazenamento de backups
- [x] Documentar scripts de backup e restore no README.md
- [x] Executar testes de validação de conectividade e queries básicas

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-2-configuracao-prisma.context.xml) - Generated 2025-11-03

### Debug Log

**Plano de Implementação (2025-11-02):**
1. Expandir schema Prisma existente com os 3 modelos V1 seguindo exatamente a especificação do Tech Spec
2. Criar Prisma Client singleton para reutilização em services
3. Aplicar db push para criar database e tabelas
4. Documentar procedimentos de backup/restore
5. Validar conectividade e schema

**Resolução de Problemas:**
- Database inicialmente criado em `backend/data/` em vez de `data/` no root
- Resolvido removendo diretório incorreto e re-executando db push
- DATABASE_URL no .env correto: `file:../data/vinyl-os.db` (relativo ao backend/)

**Validações Executadas:**
- ✅ `npx prisma validate` - Schema válido
- ✅ `npx prisma generate` - Client gerado com sucesso
- ✅ `npx prisma db push` - Database criado e sincronizado
- ✅ Teste de conectividade - Prisma Client conecta e acessa todos os modelos
- ✅ Schema verificado via sqlite3 - Todas as tabelas, FKs e índices corretos

### Completion Notes

Implementação concluída com sucesso. Database SQLite configurado em `data/vinyl-os.db` (40KB) com os três modelos V1:

**Modelos Criados:**
- **Session**: Rastreamento de sessões de uso com timestamps, duração e contagem de eventos
- **AudioEvent**: Registro de eventos de áudio com FK para Session (cascade delete), suporte a metadata JSON
- **Setting**: Configurações do sistema em formato key-value com tipagem

**Relacionamentos:**
- Session 1:N AudioEvent (cascade delete)

**Índices:**
- Session ordenado por startedAt DESC (queries de sessões recentes)
- AudioEvent composto por sessionId+timestamp (queries por sessão)
- AudioEvent composto por eventType+timestamp (queries por tipo de evento)

**Prisma Client:**
- Singleton criado em `backend/src/prisma/client.ts` para reutilização
- Gerado com sucesso e validado com queries de teste

**Documentação:**
- Scripts de backup/restore adicionados ao README.md seção 5
- Pasta `data/backups/` criada para armazenamento de backups
- Comandos incluem backup com timestamp e restore do mais recente

## File List

- `backend/prisma/schema.prisma` - Adicionados modelos Session, AudioEvent, Setting com índices
- `backend/src/prisma/client.ts` - Criado Prisma Client singleton
- `data/vinyl-os.db` - Database SQLite criado (40KB) com schema V1
- `data/backups/` - Diretório criado para backups
- `README.md` - Adicionada seção 5 "Backup e Restore do Banco de Dados"

## Change Log

- **2025-11-02**: Implementação inicial completa
  - Schema Prisma V1 criado com 3 modelos e relacionamentos
  - Database SQLite criado e validado em data/vinyl-os.db
  - Prisma Client singleton configurado
  - Documentação de backup/restore adicionada ao README

