# Onboarding de Agente - Vinyl-OS

**Última atualização:** 2025-12-04

Este documento descreve a ordem de leitura recomendada para um agente AI entender completamente o projeto Vinyl-OS e continuar o desenvolvimento.

---

## Resumo Compacto (5 arquivos essenciais)

Se o agente tiver contexto limitado, estes 5 arquivos cobrem 90% do necessário:

| Ordem | Arquivo | Propósito |
|-------|---------|-----------|
| 1 | `CLAUDE.md` | Instruções do projeto, EventBus safety, estrutura BMAD |
| 2 | `docs/prd-v3.md` | O QUE construir (requisitos, features, NFRs) |
| 3 | `docs/architecture.md` | COMO construir (stack, padrões, estrutura) |
| 4 | `docs/technical-decisions.md` | POR QUE certas escolhas foram feitas |
| 5 | `docs/sprint-status.yaml` | ONDE estamos (o que foi feito, o que falta) |

**Slash command:** `/project-context` executa este fluxo automaticamente.

---

## Fluxo Completo de Onboarding

### Fase 1: Contexto do Produto (O QUE)

```
1. docs/prd-v3.md              # Requisitos completos, visão do produto
2. docs/epics.md               # Breakdown de 58 histórias em 4 versões
```

**Objetivo:** Entender o produto, usuário-alvo, features planejadas.

### Fase 2: Arquitetura Técnica (COMO)

```
3. docs/architecture.md        # Design técnico, stack, padrões, estrutura
4. docs/technical-decisions.md # Decisões técnicas críticas, constantes
```

**Objetivo:** Entender stack, estrutura de código, padrões de nomenclatura, decisões arquiteturais.

### Fase 3: Estado Atual (ONDE ESTAMOS)

```
5. docs/sprint-status.yaml     # Status de cada história (done/in-progress/todo)
6. docs/bmm-workflow-status.yaml # Fase atual do workflow BMM
```

**Objetivo:** Saber o que foi implementado, o que está em progresso, próximos passos.

### Fase 4: Implementação Específica (SE NECESSÁRIO)

```
7. docs/tech-spec-epic-v1.md   # Detalhes de implementação V1 (referência)
8. docs/tech-spec-epic-v1.5.md # Detalhes de implementação V1.5 (referência)
```

**Objetivo:** Consultar detalhes técnicos de stories já implementadas.

### Fase 5: Código-Fonte (DEEP DIVE)

```
9.  CLAUDE.md                  # Instruções específicas para o agente
10. backend/src/services/      # Lógica core (audio-manager, event-detector)
11. frontend/src/hooks/        # Hooks principais (useAudioStream, useSocket)
```

**Objetivo:** Entender implementação real quando for modificar código.

---

## Validação de Entendimento

Após ler os documentos, o agente deve ser capaz de responder:

1. **O que é o Vinyl-OS?**
   - Sistema de streaming de áudio para toca-discos via Raspberry Pi

2. **Qual a stack tecnológica?**
   - Backend: Node.js + Express + Prisma + SQLite
   - Frontend: React + Vite + TailwindCSS + shadcn/ui
   - Streaming: FFmpeg + Icecast2 + Web Audio API

3. **Estado atual do desenvolvimento?**
   - V1 (Foundation Core): Completo
   - V1.5 (Hardening & Quality): Completo
   - V2 (Coleção & Reconhecimento): Próximo
   - V3/V4: Planejado

4. **Padrões críticos a seguir?**
   - EventBus memory safety (ver CLAUDE.md)
   - Sample rate 48kHz em todo pipeline
   - Dual streaming (RAW PCM + MP3)

---

## Documentos de Referência

| Categoria | Documentos |
|-----------|------------|
| Canônicos | prd-v3.md, architecture.md, epics.md, technical-decisions.md |
| Tech Specs | tech-spec-epic-v1.md, tech-spec-epic-v1.5.md |
| Operacionais | sprint-status.yaml, bmm-workflow-status.yaml |
| Validações | doc-validation-report-2025-12-04.md, audit-report-2025-12-03.md |
| Arquivados | docs/archived/ (histórico, não ativos) |

---

## Notas

- **Idioma:** Comunicação em Português, documentação em Português BR
- **Usuário:** Thiago
- **Output de docs:** `{project-root}/docs`
- **Stories:** `{project-root}/docs/stories`
