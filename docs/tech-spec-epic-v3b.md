# Epic Technical Specification: Reconhecimento Offline (Local-first)

Date: 2025-12-14  
Author: Thiago (+ apoio: Winston/SM)  
Epic ID: v3b  
Status: Draft

---

## Overview

O Epic **V3b — Reconhecimento Offline** evolui o Vinyl-OS para um modelo **local-first** de reconhecimento musical: o sistema tenta identificar a faixa atual usando fingerprints geradas localmente a partir de gravações FLAC (V3a). Quando o match local for **inconclusivo**, o sistema faz **fallback para AudD** (mantendo a experiência atual e reduzindo risco).

Este documento é um **Tech Spec** (nível execução). Ele complementa (não substitui):
- PRD (`docs/prd-v3.md`): visão/roadmap em nível produto (V1–V4)
- Visão do Epic V3 (`docs/epic-v3-vision.md`): decisões e fatiamento V3a/V3b/V3c

---

## Goals

1. **Local-first recognition**: reconhecer faixa (ou pelo menos álbum) usando fingerprints locais quando possível.
2. **Fallback seguro**: quando o match local não for confiável, usar AudD como fallback.
3. **Operação simples**: fluxo de preparação “uma vez por álbum” (ou por gravação fonte), sem depender de jobs complexos.
4. **Resiliência**: reconhecimento continua funcionando mesmo sem fingerprints (cloud-only).

### Success Metrics (iniciais)

- **Latência do match local**: alvo < 2s (em hardware real).
- **Taxa local vs fallback**: medir e acompanhar (sem meta fixa antes da calibração).
- **Custo operacional**: geração de fingerprints por álbum “aceitável” (alvo: < 5 min, com feedback).

---

## Non-goals

- Análise de qualidade (V3c): SNR, wow/flutter, clicks/pops, health score.
- Segmentação automática por silêncio.
- Prometer 100% offline (fallback existe; pode haver modo strict offline, mas não é requisito do MVP).
- Mirror MusicBrainz / matching por metadados externos.

---

## Scope (User Journeys)

### A) Preparar álbum (setup local)

1. Ter uma **gravação FLAC** vinculada ao álbum (V3a).
2. Fazer **trim** e **marcadores** (TrackMarker) para todas as faixas.
3. Selecionar uma **gravação fonte** do álbum (Opção A: 1 fonte por álbum).
4. **Aprovar/Lock** essa gravação como fonte de fingerprints.
5. Gerar fingerprints por faixa.

### B) Reconhecer ao vivo (local-first)

1. Capturar sample do ring buffer.
2. Gerar fingerprint temporário.
3. Tentar match local.
4. Se inconclusivo, chamar AudD.
5. Persistir log técnico (`Track`) e histórico de escuta (`SessionAlbum`).

### C) Manutenção (não diária, mas eventual)

- Se o usuário mexer em trim/markers da gravação fonte após aprovar, os fingerprints ficam **stale** e o sistema exige **regen**.

---

## Architecture (High Level)

### Local-first pipeline

- **Input ao vivo**: ring buffer (já existente, V2) → áudio curto (sampleSeconds).
- **Fingerprint temp**: gerado via Chromaprint/fpcalc.
- **Match**: comparar fingerprint temp contra fingerprints salvos por faixa.
- **Fallback**: AudD (reutilizar estratégia atual de sample curto).

### “Always-on” vs gravação manual

- A arquitetura de áudio do V3a usa FFmpeg #4 **always-on** enquanto o streaming está ativo.
- “Gravação manual” = decisão de persistir write (default discard) — não muda este epic, mas impacta a disponibilidade de gravações fonte.

---

## Data Model (Proposta)

### 1) Tracklist: `AlbumTrack`

Fonte de verdade para faixas do álbum (ordem, nomes, origem). Pode ser populada via Discogs (V3b-02) ou manual.

Campos sugeridos:
- `id`
- `albumId`
- `trackNumber` (1..N)
- `title` (string)
- `side` (opcional: "A" | "B")
- `durationSeconds` (opcional)
- `source` ("discogs" | "manual")
- `discogsTrackPosition` (opcional: ex. "A1", "B2")
- `markerId` (opcional) → referência ao `TrackMarker` da gravação fonte (mapeamento 1:1)

Constraints/Indexes:
- Unique: (`albumId`, `trackNumber`)


### 2) Fingerprint: `AlbumTrackFingerprint`

Fingerprint por faixa (1:1 com `AlbumTrack`).

Campos sugeridos:
- `id`
- `albumTrackId` (unique)
- `sourceRecordingId` (para auditoria/reprodutibilidade)
- `fingerprint` (string)
- `durationSeconds` (number)
- `algorithm` ("chromaprint")
- `algorithmVersion` (ex.: "fpcalc-1.x")
- `paramsJson` (JSON: sampleSeconds, targetSampleRate, etc.)
- `status` ("pending" | "done" | "error" | "stale")
- `errorMessage` (opcional)
- timestamps


### 3) Álbum: gravação fonte

`Album.fingerprintSourceRecordingId` define **qual gravação é a fonte**.

Regras:
- Por álbum, existe **no máximo 1 gravação fonte**.
- Fingerprints gerados devem registrar `sourceRecordingId` (audit trail).


### 4) Gravação: lock/approve

`Recording.isApprovedForFingerprinting` + `approvedAt`.

Regras:
- Só a gravação referenciada por `Album.fingerprintSourceRecordingId` pode estar `isApprovedForFingerprinting=true`.
- Alterações de trim/markers após aprovar:
  - set `isApprovedForFingerprinting=false`
  - marcar fingerprints como `stale`

---

## APIs (Proposta)

> Observação: endpoints exatos podem mudar; o importante é o contrato.

### Tracklist

- `GET /api/albums/:albumId/tracks`
- `POST /api/albums/:albumId/tracks` (criar/editar manual)
- `POST /api/albums/:albumId/tracks/sync-discogs` (V3b-02)

### Fingerprints

- `POST /api/albums/:albumId/fingerprint-source`
  - Body: `{ recordingId: string }`
  - Efeito: define a gravação fonte e invalida fingerprints anteriores (stale)

- `POST /api/albums/:albumId/fingerprints/generate`
  - Pré-condições: fonte definida + aprovada + markers mapeados
  - Resposta: `{ jobId, status }` (mesmo que job seja in-process)

- `GET /api/albums/:albumId/fingerprints/status`
  - Retorna status agregado + status por faixa (opcional)

- `POST /api/albums/:albumId/fingerprints/retry`
  - Reprocessa `stale`/`error`

### Approval

- `POST /api/recordings/:recordingId/approve-fingerprinting`
- `POST /api/recordings/:recordingId/unapprove-fingerprinting`

---

## Fingerprint Generation (Implementation Notes)

### Chromaprint / fpcalc

- Usar `fpcalc` (Chromaprint CLI) para gerar fingerprint de um arquivo/segmento.
- Estratégia: extrair segmento FLAC conforme marker (start/end) e rodar `fpcalc` nesse segmento.
- Armazenar `algorithmVersion` e `paramsJson` para reprodutibilidade.

### Idempotência

- Se `AlbumTrackFingerprint` já existe e não está `stale`, pular.
- Se está `stale` ou `error`, regenerar.

---

## Matching Strategy (Sem thresholds ainda)

Este epic NÃO define thresholds definitivos antes de uma calibração em hardware real.

### Contrato mínimo

- O match local retorna:
  - candidato(s) (top-N)
  - `score` normalizado (escala a definir pelo engine)
  - decisão: `matched | inconclusive`

### Fallback

- Se decisão for `inconclusive`, chamar AudD.

---

## Spike obrigatório: calibração Chromaprint

**Story/Spike proposta (V3b-Spike-01):** validar distribuição de scores em cenários reais:

Matriz mínima:
- (1) Mesma música (ao vivo) vs fingerprint correto
- (2) Música diferente do mesmo álbum
- (3) Música de outro álbum/artista
- (4) Silêncio/ruído

Variar duração do sample:
- 3s, 8s, 15s (ou valores equivalentes)

Output esperado:
- Distribuição de scores
- Threshold(s) recomendados
- Regras de ambiguidade (gap entre top-1 e top-2)

---

## Jobs / Queue (mínimo viável)

Motivação: geração pode levar tempo e não deve travar request HTTP.

Implementação sugerida:
- Job in-process (1 worker) por álbum.
- Status agregado por álbum + status por faixa (opcional, mas útil para retry).
- Persistir status no DB (para UI e retomada/observabilidade).

---

## Invalidation + Lock

Eventos que invalidam fingerprints do álbum:
- Alterar trim da gravação fonte
- Alterar markers da gravação fonte
- Trocar gravação fonte do álbum

Comportamento:
- marcar fingerprints como `stale`
- bloquear uso de `stale` no matching
- exigir nova aprovação + regen

---

## UX / UI (mínimo)

Locais:
- Página do **Álbum**: seção “Fingerprints”
- Página da **Gravação**: ações relacionadas à aprovação/edição

Estados principais:
- Sem gravação
- Sem gravação fonte
- Sem markers mapeados
- Fonte não aprovada
- Pronto para gerar
- Gerando
- Erro (retry)
- Stale (regen)

Ambiguidade:
- MVP: não pedir confirmação → **fallback AudD**

---

## Observability

Logs estruturados (mínimo):
- `albumId`, `recordingId`, `albumTrackId`, `jobId`
- `durationSeconds`, `sampleSeconds`
- `source` (local|audd)
- `score` (quando local)

Métricas (mínimo):
- localMatchRate vs fallbackRate
- averageLocalMatchLatencyMs
- fingerprintGenerationTimePerAlbum
- erros por causa (fpcalc, IO, parsing, etc.)

---

## Test Plan

### Unit
- mapping markers → AlbumTrack
- invalidação (stale) quando trim/marker muda
- seleção de gravação fonte por álbum

### Integration
- fpcalc: execução (spawn) + parsing do output em ambiente compatível
- geração de fingerprint de um fixture curto

### Manual (no Pi)
- 3 álbuns:
  - 1 completo com markers
  - 1 sem markers
  - 1 caso ambíguo (simulado) para validar fallback

---

## Rollout / Migration

- Migração DB:
  - criar `AlbumTrack`
  - criar `AlbumTrackFingerprint`
  - adicionar `Album.fingerprintSourceRecordingId`
  - adicionar `Recording.isApprovedForFingerprinting`

- Feature flag:
  - habilitar local-first por config

- Backward compatibility:
  - sem fingerprints → cloud-only (AudD) continua funcionando

---

## Risks & Mitigations

- Matching impreciso
  - Mitigação: spike de calibração + thresholds conservadores + fallback AudD

- Tracklist Discogs incorreta
  - Mitigação: edição manual/override

- Markers ruins / ausência
  - Mitigação: bloquear geração até markers mínimos ou avisar baixa qualidade

- Performance no Pi
  - Mitigação: concurrency=1 + batch, e medir no spike

---

## Story Breakdown (alinhamento com sprint-status)

Baseado em `docs/sprint-status.yaml`:
- V3b-01: AlbumTrack table (drafted)
- V3b-02: Discogs tracklist sync (drafted)
- V3b-03: Schema chromaprints (backlog)
- V3b-04: Geração chromaprint (backlog)
- V3b-05: Segmentação por markers → AlbumTrack (backlog)
- V3b-06: UI geração fingerprints (backlog)
- V3b-07: Matching engine (backlog)
- V3b-08: Integração local-first (backlog)
- V3b-09: UI Now Playing Offline (backlog)

Sugestão de adição:
- V3b-Spike-01: Chromaprint calibration (thresholds/duração/robustez)

---

## Open Questions

1. ✅ **Score normalizado** em escala **0..1** (engine pode ter score interno diferente; normalizar no adapter).
2. ⏳ **Duração mínima do sample**: decidir via **V3b-Spike-01** (testar 3s/8s/15s ou valores equivalentes).
3. ✅ **Permitir fingerprints parciais** (gerar e usar apenas faixas que existirem), sem exigir álbum completo.
