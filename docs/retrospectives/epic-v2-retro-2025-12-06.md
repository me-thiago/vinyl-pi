# Retrospectiva Epic V2 - Coleção & Reconhecimento Musical

**Data:** 2025-12-06  
**Facilitador:** Bob (Scrum Master)  
**Participante:** Thiago

---

## Resumo do Epic

| Métrica | Resultado |
|---------|-----------|
| **Stories Completadas** | 11/12 (91.7%) |
| **Stories Adiadas** | 1 (V2-08: Player com Coleção) |
| **Período** | ~2 semanas (2025-12-05 a 2025-12-06) |
| **Decisões Técnicas Documentadas** | 4 |

### Stories Completadas

- ✅ V2-01: Schema de Dados V2
- ✅ V2-02: CRUD Albums Backend
- ✅ V2-03: UI Gestão Coleção
- ✅ V2-04: Integração Discogs
- ✅ V2-05: Reconhecimento Musical
- ✅ V2-06: Validação Contra Coleção
- ✅ V2-07: UI Matching/Confirmação
- ⏸️ V2-08: Player com Coleção (adiado)
- ✅ V2-09: Histórico Escuta Expandido
- ✅ V2-10: Estatísticas Coleção
- ✅ V2-11: Export Dados
- ✅ V2-12: Configurações Reconhecimento

### Decisões Técnicas Importantes

1. **Migração ACRCloud → AudD** - Por problemas de autenticação HMAC-SHA1
2. **Ring Buffer 30s** - Captura instantânea para reconhecimento
3. **axios vs fetch** - Resolveu problemas de FormData no Node.js
4. **Discogs Merge Strategy** - Aditiva (só adicionar, nunca deletar)

---

## O que Funcionou Bem

### Práticas de Sucesso

| Prática | Impacto |
|---------|---------|
| **Tech-spec detalhado** | IA alucionou menos, menos retrabalho |
| **Comando project-context** | Contexto consistente entre sessões |
| **Esforço cognitivo pré-story** | Épico em tempo recorde |
| **V2-06 + V2-07** | Validação perfeita, funcionou de primeira |
| **Referência de projeto antigo** | Desbloqueou integração AudD rapidamente |

### Destaques

- A maioria das stories fluiu bem graças ao bom planejamento
- Integração Discogs ficou fluida e sem erros
- AudD funcionando muito bem na prática
- Stories V2-06 e V2-07 validaram perfeitamente com um prompt

---

## Desafios Enfrentados

| Desafio | Causa Raiz | Aprendizado |
|---------|------------|-------------|
| **UX de reconhecimento difícil** | Falta de visualização prévia | Design sprint antes de implementar |
| **Tracking sessões/tracks complexo** | Arquitetura não clara | Mapear fluxos de dados antes |
| **ACRCloud falhou** | Sem referência anterior | Buscar projetos antigos como base |
| **Pressão para decidir UI/UX** | Decisões durante implementação | Separar design de coding |

### V2-08 Adiado

**Motivo:** Sem reconhecimento automático contínuo, a UI de "Now Playing" fica desatualizada. Dependência não prevista de:
- Detecção de troca de faixa (V1-12 adiada)
- Ou Chromaprint para reconhecimento local (V3)

**Decisão:** Aguardar V3 com Chromaprint antes de retomar.

---

## Insights e Aprendizados

### Insight Chave

> *"Vinil não é Spotify. Você não monta uma playlist, você escuta um álbum. E um álbum é uma história inteira contada."*

Esta realização guiou a decisão de focar em **álbuns** (não músicas individuais) para estatísticas e tracking.

### Lições para V3

1. **Bom planejamento foi crucial** - Permitiu épico em tempo recorde
2. **Mas poderia ter sido melhor** - Mais tempo na visão do produto poderia ter expandido o épico
3. **Referências são ouro** - Projeto antigo salvou integração AudD
4. **UI/UX precisa visualização prévia** - Falta de clareza causou pressão

---

## Action Items

### Process Improvements

| # | Action Item | Owner | Timeline |
|---|-------------|-------|----------|
| 1 | Design Sprint antes de cada épico | Thiago + UX | Antes de V3 |
| 2 | Extrair referências de projetos antigos (Chromaprint) | Thiago | Antes de V3 |
| 3 | Tech-spec com seção de UI/UX obrigatória | SM | Template |

### Technical Debt

| # | Item | Owner | Priority |
|---|------|-------|----------|
| 1 | Documentar arquitetura FFmpeg atual (3 processos) | Dev | Alta |
| 2 | Avaliar consumo de memória dos FFmpeg processes | Dev | Média |
| 3 | V2-08 continua adiado até Chromaprint | - | Baixa |

### Team Agreements

- ✅ **Focar em álbuns, não músicas** - Vinil é experiência de álbum completo
- ✅ **Planejamento > Velocidade** - Esforço cognitivo pré-story vale a pena
- ✅ **Dividir épicos grandes** - V3a/V3b pattern para reduzir risco
- ✅ **Referências antes de "coisas novas"** - Buscar projetos anteriores/exemplos

---

## Preparação para V3

### Divisão Proposta

#### V3a - Gravação & Fundação (Menor risco)

| Story | Descrição | Risco |
|-------|-----------|-------|
| V3-01 | Schema Dados V3 | 🟢 Baixo |
| V3-02 | Dual-Path Architecture (finalizar) | 🟢 Baixo |
| V3-03 | Gravação FLAC Automática | 🟡 Médio |
| V3-04 | Segmentação Automática por Silêncio | 🟡 Médio |
| V3-05 | Gravação Manual + Pré-roll | 🟢 Baixo |
| V3-06 | UI Gravações (básica) | 🟢 Baixo |
| **NEW** | Detecção "Vinil Rodando em Vazio" | 🟡 Médio |

#### V3b - Análise & Reconhecimento Offline (Maior risco)

| Story | Descrição | Risco |
|-------|-----------|-------|
| V3-07 | Geração Chromaprint | 🔴 Alto |
| V3-08 | Reconhecimento Offline | 🔴 Alto |
| V3-09 | Análise SNR/Wow/Flutter (Meyda) | 🔴 Alto |
| V3-10 | Detecção Clicks/Pops | 🔴 Alto |
| V3-11 | Health Score/Relatórios | 🟡 Médio |
| V3-12 | UI QA/Visualizações | 🟡 Médio |
| **NEW** | UI Waveform/Audio Engineering | 🔴 Alto |

### Arquitetura FFmpeg Proposta (V3)

```
ALSA → FFmpeg #1 (Main) → stdout (PCM → Express /stream.wav)
                        → FIFO1 (PCM → FFmpeg #2 → MP3 → Icecast)
                        → FIFO2 (PCM → FFmpeg #3 → Ring Buffer 30s → Recognition)
                        → FIFO3 (PCM → FFmpeg #4 → FLAC → Arquivo)  ← NOVO
```

### Novas Features Identificadas

1. **Detecção "Vinil Rodando em Vazio"** - Avisar quando disco acabar
2. **UI Waveform/Audio Engineering** - Visualizar áudio, marcar faixas, segmentar por música
3. **FFmpeg #4** - Processo dedicado para gravação FLAC

### Preparation Sprint Tasks

| Task | Owner | Est. | Priority |
|------|-------|------|----------|
| Design Sprint: UI Gravação | Thiago | 2-4h | 🔴 Crítico |
| Design Sprint: UI Waveform | Thiago | 2-4h | 🟡 Alto |
| Spike: Chromaprint/fpcalc | Dev | 4h | 🔴 Crítico |
| Spike: Meyda features (spectral) | Dev | 2h | 🟡 Alto |
| Documentar arquitetura FFmpeg atual | Dev | 1h | 🔴 Crítico |
| Extrair referências projeto antigo | Thiago | 2h | 🔴 Crítico |
| Definir FFmpeg #4 strategy | Architect | 1h | 🔴 Crítico |
| Pesquisar wavesurfer.js / peaks.js | Dev | 2h | 🟡 Alto |

**Total Estimado:** ~16-20 horas de preparação

### Critical Path

| # | Item | Owner | Deadline |
|---|------|-------|----------|
| 1 | Spike Chromaprint | Dev | Antes de V3b |
| 2 | Design UI Gravação | Thiago | Antes de V3a |
| 3 | Arquitetura FFmpeg #4 | Architect | Antes de V3-03 |

---

## Conclusão

O Epic V2 foi um sucesso com 91.7% das stories completadas em tempo recorde. O bom planejamento (tech-spec detalhado, project-context command) foi fundamental. 

A principal lição é que **visualizar o produto (UI/UX) antes de implementar** evita pressão e decisões apressadas durante o desenvolvimento.

Para V3, a divisão em V3a (Gravação) e V3b (Análise/Chromaprint) reduz risco e permite progresso incremental em áreas de maior incerteza técnica.

---

*Retrospectiva facilitada por Bob (Scrum Master)*  
*Documento gerado em 2025-12-06*

