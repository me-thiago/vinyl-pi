# Epic V3 - Visão e Decisões

**Data:** 2025-12-06
**Participantes:** Thiago, Winston (Architect)
**Status:** Planejamento

---

## Resumo Executivo

O Epic V3 transforma o Vinyl-OS de um sistema de streaming e reconhecimento online para uma **plataforma completa de arquivamento digital e reconhecimento offline**.

Dividido estrategicamente em três fases para reduzir risco:

| Fase | Foco | Risco Geral |
|------|------|-------------|
| **V3a** | Gravação & Fundação | 🟢 Baixo-Médio |
| **V3b** | Reconhecimento Offline | 🟡 Médio-Alto |
| **V3c** | Análise & Insights | 🔴 Alto |

---

## Decisões Arquiteturais

### 1. Evolução da Arquitetura FFmpeg

**De Triple-Path (V2) para Quad-Path (V3):**

```
V2 (atual):
ALSA → FFmpeg #1 → stdout (PCM → Express /stream.wav)
                 → FIFO1 (PCM → FFmpeg #2 → MP3 → Icecast)
                 → FIFO2 (PCM → FFmpeg #3 → Ring Buffer 30s)

V3 (novo):
ALSA → FFmpeg #1 → stdout (PCM → Express /stream.wav)
                 → FIFO1 (PCM → FFmpeg #2 → MP3 → Icecast)
                 → FIFO2 (PCM → FFmpeg #3 → Ring Buffer 30s)
                 → FIFO3 (PCM → FFmpeg #4 → FLAC → Arquivo)  ← NOVO
```

**Decisão (atualizada):** FFmpeg #4 é **always-on enquanto o streaming estiver ativo** (lê FIFO3 continuamente) e entrega FLAC via stdout para o Node.js decidir o destino:
- **Gravando:** escreve em arquivo
- **Não gravando:** descarta os dados

Motivo: elimina race conditions de “janela sem leitor” no FIFO3 e mantém consistência com os processos #2 e #3.

**Importante (semântica de “manual”):**
- “Always-on” se refere ao **processo** FFmpeg #4 (sempre lendo/encodando enquanto streaming está ativo).
- “Gravação manual” se refere à **decisão de persistir** (write) — só acontece quando o usuário clica em **Record** (default é discard).
- Guard-rail: **auto-stop** do modo write ao atingir `recording.maxDurationMinutes` (default 60) para evitar gravações “esquecidas”.

### 2. Formato de Gravação: FLAC

**Por que FLAC?**
- Lossless (qualidade idêntica ao original)
- ~50-60% menor que WAV (um álbum de 45min ≈ 200-250MB)
- Chromaprint/fpcalc funciona perfeitamente com FLAC
- Suportado nativamente pelo FFmpeg

**Decisão:** Um arquivo FLAC por álbum, com marcações de faixa como metadados (não múltiplos arquivos).

### 3. Armazenamento

**Estrutura:**
```
data/recordings/
├── 2025-12/
│   ├── rec-abc123.flac
│   └── rec-def456.flac
└── 2026-01/
    └── rec-ghi789.flac
```

**Decisão:**
- Arquivos organizados por mês (YYYY-MM)
- Metadados e path no banco de dados (tabela `recordings`)
- Alerta quando disco atingir 50% de capacidade

### 4. Gravação: Manual Only

**Decisões:**
- ❌ **Sem gravação automática** - Problema: escutar mesmo álbum 3x ou esquecer vinil ligado geraria arquivos duplicados/enormes
- ❌ **Sem pré-roll** - Overkill, usuário pode fazer trim depois
- ✅ **Gravação manual apenas** - Usuário controla início/fim

### 5. Edição: Trim + Marcadores

**Decisão:** Opção C - Trim + marcação de faixas (sem split)

- **Trim:** Cortar início/fim da gravação
- **Marcadores:** Definir início/fim de cada faixa como metadados
- **Sem split:** Não gera múltiplos arquivos, mantém um FLAC por álbum

**Benefício:** Quando gerar chromaprint (V3b), extraímos o segmento da faixa usando os offsets.

### 6. Vinculação Gravação ↔ Álbum

**Decisão:** Vinculação opcional

- Gravação pode ser vinculada a um álbum da coleção
- Gravação "órfã" permitida (sem álbum associado)
- Cenário: usuário grava disco que ainda não cadastrou, vincula depois

### 7. Chromaprint: Por Faixa

**Decisão:** Fingerprint é por **faixa**, não por álbum inteiro.

**Motivo:**
- Match mais preciso (30s de áudio vs faixa específica de ~3-5min)
- Permite identificar qual faixa está tocando
- Ring buffer captura ~30s, ideal para comparar com faixa individual

**Schema:**
```sql
CREATE TABLE chromaprints (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    recording_id TEXT,          -- Gravação de origem
    track_number INTEGER,       -- Número da faixa
    track_title TEXT,
    fingerprint TEXT NOT NULL,  -- Base64
    duration_seconds INTEGER,
    offset_seconds INTEGER,     -- Offset no FLAC (para extração)
    ...
);
```

### 8. Reconhecimento: Local-First

**Fluxo V3b:**
1. Capturar sample do ring buffer (30s)
2. Gerar fingerprint temporário
3. Tentar match local (banco de chromaprints)
4. Se match ≥80%: usar resultado local
5. Se match <80%: fallback para AudD

**UI:** Badge indicando "🏠 Local" vs "☁️ AudD"

### 9. Segmentação de Faixas: Manual

**Decisão:** Segmentação manual (usuário marca no editor)

**Motivo:** Detecção automática por silêncio não funciona bem com vinil (ruído de fundo impede detecção confiável de gaps entre faixas - já validado em V1-12).

### 10. Análise de Qualidade (V3c)

**Métricas planejadas:**

| Métrica | O que mede | Importância |
|---------|-----------|-------------|
| **SNR** | Relação sinal/ruído (chiado) | Indica desgaste geral |
| **Wow/Flutter** | Variação de pitch | Problemas mecânicos ou disco empenado |
| **Clicks/Pops** | Transientes súbitos | Riscos, sujeira no disco |
| **High-Freq Rolloff** | Perda de agudos >10kHz | Desgaste da agulha ou disco |

**Health Score (0-100):**
```
Health Score =
  (SNR_score × 0.30) +
  (WowFlutter_score × 0.15) +
  (Clicks_score × 0.25) +
  (HighFreq_score × 0.20) +
  (Clipping_score × 0.10)
```

**Processamento:** Offline sobre arquivo FLAC (não ao vivo).

---

## V3a - Gravação & Fundação

**Status:** Tech-spec completo (`docs/tech-spec-epic-v3a.md`)

### Stories

| # | Story | Descrição | Risco |
|---|-------|-----------|-------|
| V3-01 | Schema Dados V3 | Tabelas Recording e TrackMarker | 🟢 |
| V3-02 | Quad-Path Architecture | FIFO3 + FFmpeg #4 | 🟡 |
| V3-03 | Gravação FLAC Manual | API start/stop + RecordingManager | 🟡 |
| V3-04 | UI Gravações | Listagem + botão Record no footer | 🟢 |
| V3-05 | UI Detalhe Álbum | Página expandida com gravações | 🟢 |
| V3-06 | Editor de Áudio | Waveform (wavesurfer.js) + trim + marcadores | 🟡 |

### Dependências

```
V3-01 (Schema) → V3-02 (Architecture) → V3-03 (Gravação)
                                              ↓
                                    ┌─────────┴─────────┐
                                    ↓                   ↓
                              V3-04 (UI List)     V3-06 (Editor)
                                    ↓
                              V3-05 (Album Detail)
```

---

## V3b - Reconhecimento Offline

**Status:** Planejamento (tech-spec pendente)

### Stories

| # | Story | Descrição | Risco |
|---|-------|-----------|-------|
| V3-07 | Schema Chromaprints | Tabela chromaprints com suporte a faixas | 🟢 |
| V3-08 | Geração Chromaprint | Serviço que processa FLAC via fpcalc | 🟡 |
| V3-09 | Segmentação de Faixas | Usar marcadores do editor para definir faixas | 🟢 |
| V3-10 | UI Geração Fingerprints | Botão na página do álbum + progress | 🟢 |
| V3-11 | Matching Engine | Comparar fingerprint do ring buffer com banco local | 🔴 |
| V3-12 | Integração Local-First | Modificar RecognitionService: local primeiro, fallback AudD | 🟡 |
| V3-13 | UI Now Playing (Offline) | Badge "Local" vs "AudD" + confidence | 🟢 |

### Fluxo Completo

```
PREPARAÇÃO (uma vez por álbum):
Gravação FLAC → Marcar faixas no editor → Gerar Chromaprint por faixa → Salvar no banco

RECONHECIMENTO (ao vivo):
Ring Buffer (30s) → Gerar fingerprint temp → Match contra banco local → Identificar faixa

RESULTADO:
UI mostra "Now Playing: Faixa 3 - Album X" (🏠 Local)
```

### Dependências

```
V3a completo (gravação + marcadores)
        ↓
V3-07 (Schema) → V3-08 (Geração) → V3-09 (Segmentação usa marcadores V3-06)
                      ↓
               V3-10 (UI Geração) → V3-11 (Matching) → V3-12 (Integration)
                                                              ↓
                                                       V3-13 (UI Now Playing)
```

---

## V3c - Análise & Insights

**Status:** Planejamento (tech-spec pendente)

### Stories

| # | Story | Descrição | Risco |
|---|-------|-----------|-------|
| V3-14 | Análise Meyda | Processar FLAC para extrair SNR, spectral features | 🔴 |
| V3-15 | Detecção Clicks/Pops | Identificar transientes súbitos no áudio | 🔴 |
| V3-16 | Detecção Wow/Flutter | Medir variação de pitch | 🔴 |
| V3-17 | Health Score | Calcular score 0-100 baseado nas métricas | 🟡 |
| V3-18 | Relatório de Qualidade | Gerar relatório por gravação/álbum | 🟡 |
| V3-19 | UI Waveform/Visualizações | Visualizar métricas, timeline de eventos | 🟡 |

### Detecções Possíveis

| Detecção | Método | Prioridade |
|----------|--------|------------|
| Clicks/Pops | Picos de energia súbitos (Meyda energy) | Alta |
| SNR | RMS em diferentes segmentos | Alta |
| High-Freq Rolloff | spectralRolloff (Meyda) | Média |
| Wow/Flutter | Análise de variação de pitch ao longo do tempo | Alta |
| Vinil rodando em vazio | spectralFlatness + baixa energia | Baixa |
| Troca de faixa | Combinar com chromaprint (V3b) | Baixa |

### Dependências

```
V3a completo (gravação FLAC)
        ↓
V3-14 (Meyda) → V3-15 (Clicks) + V3-16 (Wow/Flutter)
                        ↓
                 V3-17 (Health Score) → V3-18 (Relatório)
                                              ↓
                                       V3-19 (UI Visualizações)
```

---

## Preparation Sprint

### Crítico (antes de V3a)

| Task | Por quê | Estimativa | Status |
|------|---------|------------|--------|
| Documentar arquitetura FFmpeg atual | Base para FFmpeg #4 | 1h | ⏳ Pendente |
| Spike: FFmpeg #4 FLAC via FIFO | Validar antes de implementar | 2h | ⏳ Pendente |
| Design: UI Recording (botão + listagem) | Evitar pressão durante dev | 2h | ⏳ Pendente |

### Importante (antes de V3b)

| Task | Por quê | Estimativa | Status |
|------|---------|------------|--------|
| Spike: Chromaprint/fpcalc no Pi | Validar instalação e performance | 2h | ⏳ Pendente |
| Spike: Algoritmo de matching Chromaprint | Entender como comparar fingerprints | 3h | ⏳ Pendente |
| Extrair referências projeto antigo (vinyl-player) | Reaproveitar código | 1h | ⏳ Pendente |
| Design: UI página álbum com fingerprints | Evitar pressão durante dev | 2h | ⏳ Pendente |

### Desejável (antes de V3c)

| Task | Por quê | Estimativa | Status |
|------|---------|------------|--------|
| Spike: Meyda spectral features | Validar cálculo SNR/Wow/Flutter | 2h | ⏳ Pendente |
| Pesquisar algoritmos de click detection | Entender abordagens | 2h | ⏳ Pendente |
| Design: UI Waveform/Visualizações | UI complexa | 3h | ⏳ Pendente |

---

## Riscos e Mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Chromaprint não funciona bem no Pi | Média | Alto | Spike antes de V3b |
| Matching engine impreciso | Alta | Alto | Threshold conservador, fallback AudD |
| Meyda não detecta wow/flutter bem | Alta | Médio | Pesquisar libs especializadas |
| SD Card enche rápido | Alta | Alto | Alerta 50%, UI clara |
| Editor de waveform lento | Média | Médio | Cache, renderização progressiva |

---

## KPIs de Sucesso

### V3a
- Overhead de gravação no streaming: < 5% CPU
- Trim de 45min FLAC: < 30s

### V3b
- Reconhecimento offline: ≥ 70% dos álbuns da coleção
- Latência de matching local: < 2s

### V3c
- Análise de qualidade: < 2min para álbum de 45min
- Health Score correlacionado com percepção subjetiva

---

## Histórico de Decisões

| Data | Decisão | Contexto |
|------|---------|----------|
| 2025-12-06 | Dividir V3 em V3a/V3b/V3c | Reduzir risco, validação incremental |
| 2025-12-06 | FLAC em vez de WAV | Lossless + menor tamanho |
| 2025-12-06 | 1 arquivo por álbum com marcadores | Evitar fragmentação |
| 2025-12-06 | Gravação manual only | Evitar duplicatas/arquivos enormes |
| 2025-12-06 | Sem pré-roll | Overkill, trim resolve |
| 2025-12-06 | Chromaprint por faixa | Match mais preciso |
| 2025-12-06 | Segmentação manual | Detecção automática não funciona com vinil |
| 2025-12-06 | Local-first recognition | Tentar local, fallback AudD |
| 2025-12-06 | wavesurfer.js para waveform | Popular, bem documentado |
| 2025-12-06 | Alerta storage 50% | Prevenção antes de disco cheio |
| 2025-12-06 | Gravação órfã permitida | Flexibilidade para vincular depois |

---

## Próximos Passos

1. ✅ Tech-spec V3a completo
2. ⏳ Executar preparation tasks críticos (FFmpeg #4 spike)
3. ⏳ Desenvolver V3a
4. ⏳ Spike Chromaprint (durante ou após V3a)
5. ⏳ Tech-spec V3b
6. ⏳ Desenvolver V3b
7. ⏳ Tech-spec V3c
8. ⏳ Desenvolver V3c

---

**Documento criado em:** 2025-12-06
**Última atualização:** 2025-12-06
