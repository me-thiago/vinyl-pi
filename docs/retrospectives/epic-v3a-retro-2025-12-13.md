# Retrospectiva Epic V3a - Gravação & Fundação

**Data:** 2025-12-13  
**Facilitador:** Bob (Scrum Master)  
**Participante:** Thiago

---

## Resumo do Epic

| Métrica | Resultado |
|---------|-----------|
| **Stories Completadas** | 9/9 (100%) |
| **Período** | ~1 semana (2025-12-06 a 2025-12-13) |
| **Retrospectiva** | ✅ Executada e marcada no sprint-status |
| **Tracking de story points** | Parcial (apenas V3a-08 e V3a-09 declararam pontos) |

### Stories Completadas

- ✅ V3-01: Schema Dados V3
- ✅ V3-02: Quad-Path Architecture
- ✅ V3-03: Gravação FLAC Manual
- ✅ V3-04: UI Gravações
- ✅ V3-05: UI Detalhe Álbum
- ✅ V3-06: Editor de Áudio
- ✅ V3a-07: Refactor AudioManager (Tech Debt)
- ✅ V3a-08: UX Polish & Safety Guards
- ✅ V3a-09: Edit Session Albums (SessionAlbum)

### Decisões Técnicas Importantes (V3a)

1. **Quad-Path Architecture (4 outputs)** sem degradar os caminhos existentes
2. **FFmpeg #4 always-on + stdout → Node decide write/discard** (elimina race conditions de FIFO3)
3. **Gravação manual only** (sem gravação automática por sessão)
4. **FLAC único por álbum + trim + marcadores** (sem split em múltiplos arquivos)
5. **Guardrails**: auto-stop por limite (default 1h) e alertas (storage)
6. **SessionAlbum**: separação correta entre log técnico (`Track`) e histórico de álbuns ouvidos

---

## O que Funcionou Bem

### Práticas de Sucesso

| Prática | Impacto |
|---------|---------|
| **Dividir V3 em V3a/V3b/V3c** | Reduziu risco e manteve foco no “fundacional” |
| **Tech Spec (V3a) como guia** | Critérios de aceitação e arquitetura ficaram rastreáveis |
| **Refactor de AudioManager ainda dentro do épico** | Reduziu dívida antes de entrar no V3b (maior risco) |
| **Polish orientado a uso real (V3a-08)** | Melhorou segurança/UX de gravação (risco de gravação infinita) |

### Destaques

- Foundation sólida para V3b (gravação + marcadores + infra de arquivos)
- Melhor separação conceitual de domínio (SessionAlbum)

---

## Desafios Enfrentados

| Desafio | Causa raiz | Aprendizado |
|---------|------------|-------------|
| **Drift de documentação** (visão/tech spec vs implementação) | Mudanças durante execução (ex.: FFmpeg #4 always-on) não “propagaram” para todos os docs | Criar rotina explícita de “update docs essenciais” no *story-done |
| **Mudanças finais fora de story (aba de stats)** | Ajuste legítimo, mas sem rastreabilidade em `sprint-status.yaml` | Registrar “late changes” como micro-story ou addendum na story mais próxima |
| **Inconsistência de status em stories** | `sprint-status.yaml` e header da story divergiram (ex.: V3-04) | Checklist simples de consistência pós-merge |

---

## Insights e Aprendizados

1. **V3a confirmou a estratégia**: entregar infraestrutura de gravação antes do matching offline evita travar no risco alto.
2. **Documentação precisa de “fonte de verdade” clara**: hoje `docs/epic-v3-vision.md`, `docs/tech-spec-epic-v3a.md` e `docs/prd-v3.md` não estão 100% coerentes (principalmente por defasagem do PRD e mudanças de implementação).
3. **Scope tracking**: ajustes de UI (ex.: stats) aparecem inevitavelmente no final — o risco não é fazer, é “sumir” sem registro.

---

## Action Items

### Process Improvements

| # | Action Item | Owner | Timeline |
|---|-------------|-------|----------|
| 1 | Checklist “Docs essenciais atualizados” em todo *story-done (Tech decisions + epic vision/tech spec quando afetar) | Thiago | Antes de V3b |
| 2 | Registrar mudanças finais (ex.: stats) como micro-story ou adendo no fim do épico | Thiago | Imediato |
| 3 | Padronizar statuses: `sprint-status.yaml` deve bater com header das stories (done/review/etc) | SM | Imediato |

### Documentação

| # | Item | Owner | Timeline |
|---|------|-------|----------|
| 1 | Atualizar `docs/epic-v3-vision.md` e `docs/tech-spec-epic-v3a.md` para refletir FFmpeg #4 always-on (e remover ambiguidades) | Thiago | Imediato |
| 2 | Criar “nota de alinhamento” no `docs/prd-v3.md`: PRD histórico (2025-01-27) + ponte para visão/tech specs atuais | Thiago | Imediato |
| 3 | Consolidar story duplicada `v3-07-refactor-audio-manager.md` (manter apenas `v3a-07-...`) | Thiago | Antes de V3b |

### Technical Debt

| # | Item | Owner | Priority |
|---|------|-------|----------|
| 1 | Revisar pontos onde docs dizem “FFmpeg #4 sob demanda” vs “always-on” e unificar | Thiago | Alta |
| 2 | Manter `docs/technical-decisions.md` como ADR vivo por épico (com links para stories) | Thiago | Média |

---

## Preparação para V3b (Reconhecimento Offline)

### Contexto

- Próximo épico em `docs/sprint-status.yaml`: **epic-v3b** (backlog)
- Já existem drafts: **V3b-01** e **V3b-02**

### Preparation Sprint (Proposto)

| Task | Owner | Est. | Prioridade |
|------|-------|------|------------|
| Rodar `*epic-tech-context` para V3b (tech spec) | Thiago | 1-2h | 🔴 Crítico |
| Spike `fpcalc`/Chromaprint no Pi (instalação + performance) | Dev/Thiago | 2-3h | 🔴 Crítico |
| Definir schema de tracklist (AlbumTrack) + chromaprint por faixa | Architect | 1-2h | 🔴 Crítico |
| Especificar estratégia de matching (thresholds + fallback AudD) | Architect + TEA | 2-4h | 🔴 Crítico |
| Planejar UX do “Now Playing Offline” (badge Local vs AudD) | Thiago + UX | 2-4h | 🟡 Alto |

### Critical Path

1. **Tech spec V3b completo** (sem isso, stories de V3b tendem a virar exploração contínua)
2. **Validação de Chromaprint no hardware real**
3. **Decisão do matching engine** (o maior risco do V3b)

---

## Conclusão

O Epic V3a foi concluído com 100% das stories planejadas, entregando a base de gravação/edição necessária para o V3b. O principal gap identificado foi **coerência de documentação** (especialmente PRD antigo e decisões que mudaram durante execução), e o principal reforço de processo recomendado é tornar “doc sync” parte do encerramento de cada story.

---

*Retrospectiva facilitada por Bob (Scrum Master)*  
*Documento gerado em 2025-12-13*
