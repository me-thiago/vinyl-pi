# Documentação Vinyl-OS

**Última atualização:** 2025-12-04

Este diretório contém toda a documentação do projeto Vinyl-OS, organizada por categoria.

---

## Documentos Canônicos (Fonte da Verdade)

Documentos que definem O QUE e COMO construir o sistema:

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [prd-v3.md](prd-v3.md) | Product Requirements Document - Requisitos completos do produto | ✅ Completo |
| [architecture.md](architecture.md) | Arquitetura do Sistema - Design técnico e decisões arquiteturais | ✅ Completo |
| [epics.md](epics.md) | Breakdown de Épicos - 58 histórias organizadas em 4 versões (V1-V4) | ✅ Ativo |
| [technical-decisions.md](technical-decisions.md) | Log de Decisões Técnicas - Registro de escolhas técnicas importantes | ✅ Ativo |

---

## Tech Specs por Épico

Especificações técnicas detalhadas para implementação:

| Documento | Épico | Status |
|-----------|-------|--------|
| [tech-spec-epic-v1.md](tech-spec-epic-v1.md) | V1 - Foundation Core (MVP) | ✅ Implementado |
| [tech-spec-epic-v1.5.md](tech-spec-epic-v1.5.md) | V1.5 - Hardening & Quality | ✅ Implementado |

---

## Documentos Operacionais

Tracking ativo do desenvolvimento:

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [sprint-status.yaml](sprint-status.yaml) | Status atual do sprint - Tracking de histórias | ✅ Ativo |
| [bmm-workflow-status.yaml](bmm-workflow-status.yaml) | Status das fases BMM (Analysis → Implementation) | ✅ Ativo |

---

## Validações e Auditorias

Relatórios de validação e qualidade:

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [audit-report-2025-12-03.md](audit-report-2025-12-03.md) | Relatório de Auditoria - Score 77/100, base para V1.5 | ✅ Referência |
| [architecture-validation.md](architecture-validation.md) | Validação da Arquitetura - Checklist de completude | ✅ Aprovado |
| [implementation-readiness-report-2025-11-02-validated.md](implementation-readiness-report-2025-11-02-validated.md) | Gate-check Phase 4 - Aprovação para implementação | ✅ Aprovado |

---

## Documentos Técnicos Implementados

Decisões e fixes em produção:

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [memory-leak-fix.md](memory-leak-fix.md) | Fix crítico de memory leak no WAV broadcaster | ✅ Implementado |
| [stability-improvements.md](stability-improvements.md) | 7 melhorias de estabilidade do sistema | ✅ Implementado |

---

## Subpastas

| Pasta | Conteúdo |
|-------|----------|
| [stories/](stories/) | Histórias de usuário organizadas por versão (v1/, v1.5/, v2/, v3/, v4/) |
| [retrospectives/](retrospectives/) | Retrospectivas de épicos completados |
| [troubleshooting/](troubleshooting/) | Logs de resolução de problemas |
| [archived/](archived/) | Documentos históricos (não mais ativos) |

---

## Estrutura de Stories

```
stories/
├── README.md           # Visão geral das histórias
├── v1/                 # Foundation Core (22 histórias) - ✅ Completo
├── v1.5/               # Hardening & Quality (15 histórias) - ✅ Completo
├── v2/                 # Coleção & Reconhecimento (12 histórias) - Drafted
├── v3/                 # Gravação & Análise (12 histórias) - Drafted
└── v4/                 # Polimento & Controles (12 histórias) - Drafted
```

---

## Fluxo de Leitura Recomendado

Para entender o projeto do zero:

1. **PRD** (`prd-v3.md`) - Entender O QUE o sistema faz
2. **Architecture** (`architecture.md`) - Entender COMO foi projetado
3. **Epics** (`epics.md`) - Ver a divisão em histórias implementáveis
4. **Tech Spec** do épico atual - Detalhes técnicos de implementação
5. **Technical Decisions** (`technical-decisions.md`) - Escolhas técnicas importantes

---

## Convenções

- **Idioma:** Documentação em Português BR
- **Formato:** Markdown (GitHub Flavored)
- **Versionamento:** Documentos canônicos não são versionados por arquivo (usar git history)
- **Arquivamento:** Documentos obsoletos vão para `archived/` com razão documentada
