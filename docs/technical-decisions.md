# Vinyl-OS - Decisões Técnicas

**Autor:** Amelia (Developer Agent)  
**Última Atualização:** 2025-12-04

---

## Índice

1. [MP3 Bitrate e Codec](#mp3-bitrate-e-codec)
2. [Dual Streaming Architecture](#dual-streaming-architecture)
3. [RAW PCM vs MP3 no Frontend](#raw-pcm-vs-mp3-no-frontend)
4. [Constantes e Thresholds](#constantes-e-thresholds)

---

## MP3 Bitrate e Codec

### Decisão: 128kbps default, configurável pelo usuário (128/192/256)

**Data:** 2025-11-07 (implementação inicial), 2025-12-04 (configurável via UI)
**Contexto:** Story V1-05 e V1-06 (Pipeline FFmpeg → Icecast + Frontend Player)
**Status:** ✅ Implementado e Validado

### Atualização V1.5: Bitrate Configurável

O bitrate do stream MP3 é **configurável pelo usuário** através da página `/settings`:
- **128 kbps** (default) - Menor uso de banda
- **192 kbps** - Balanceado
- **256 kbps** - Maior qualidade

**Fluxo de alteração:**
1. Usuário seleciona novo bitrate na UI
2. Frontend envia `PATCH /api/settings` com `stream.bitrate`
3. Frontend envia `POST /streaming/restart` para reiniciar FFmpeg
4. FFmpeg reinicia com novo bitrate

**Nota:** Alterar bitrate interrompe momentaneamente o stream (necessário reiniciar FFmpeg).

### Problema Original

Durante implementação do streaming MP3 para Icecast2, testamos diferentes configurações de bitrate e codecs:

1. **320kbps com libmp3lame:** Qualidade máxima, mas causou problemas no Raspberry Pi
   - Sintomas: Áudio distorcido/choppy
   - Causa provável: CPU do Pi não conseguia manter encoding em tempo real
   - Resultado: ❌ Rejeitado

2. **320kbps com libshine:** Encoder otimizado para ARM (fixed-point)
   - CPU reduzido ~30% vs libmp3lame
   - Qualidade inferior ao libmp3lame
   - Resultado: ⚠️ Parcialmente testado, mas não escolhido

3. **128kbps com libmp3lame:** Balanceamento entre qualidade e performance
   - CPU dentro dos limites do Raspberry Pi
   - Qualidade adequada para streaming doméstico
   - Áudio limpo sem distorção
   - Resultado: ✅ **ESCOLHIDO**

### Justificativa

**Por que 128kbps?**
- Qualidade mais que suficiente para streaming doméstico (vinyl já tem limitações analógicas)
- CPU do Raspberry Pi consegue manter encoding em tempo real sem problemas
- Bitrate compatível com a maioria dos players e integrações (TuneIn, etc.)
- Reduz uso de largura de banda (importante para acesso remoto)

**Por que libmp3lame em vez de libshine?**
- Melhor qualidade de encoding
- Mais maduro e estável
- Amplamente suportado
- Performance aceitável no Pi com 128kbps

### Configuração FFmpeg

```bash
ffmpeg -f s16le -ar 48000 -ac 2 -i /tmp/vinyl-audio.fifo \
  -c:a libmp3lame \
  -b:a 128k \
  -f mp3 \
  -content_type audio/mpeg \
  icecast://source:PASSWORD@localhost:8000/stream
```

### Testes de Validação

| Teste | Resultado |
|-------|-----------|
| Streaming contínuo 24h | ✅ Estável |
| CPU usage | ✅ ~35% de 1 core |
| Qualidade de áudio | ✅ Sem distorção |
| Latência end-to-end | ✅ ~150ms (PCM) + ~2-5s (MP3) |
| Múltiplos clientes | ✅ Até 20 simultâneos (configurado) |

### Alternativas Consideradas

**Se no futuro precisar de mais qualidade:**
- **Opção 1:** Usar 192kbps com libmp3lame (se Pi aguentar)
- **Opção 2:** Migrar para Raspberry Pi 4/5 (mais CPU) e voltar para 320kbps
- **Opção 3:** Usar libshine 256kbps (ARM-optimized, qualidade intermediária)

**Se precisar reduzir CPU:**
- **Opção 1:** Usar libshine 128kbps (economia ~30% CPU, perda de qualidade)
- **Opção 2:** Reduzir para 96kbps (ainda aceitável para vinyl)

### Referências

- Story: `docs/stories/v1/v1-05-pipeline-ffmpeg-icecast.md`
- Story: `docs/stories/v1/v1-06-frontend-player-basico.md`
- Arquitetura detalhada: `docs/archived/dual-streaming-architecture.md`
- Commits: `40b9475` (redução para 128k), `9cb7862` (otimização 24/7)

---

## Meyda para Análise de Áudio

### Decisão: Meyda como biblioteca de análise de áudio

**Data:** 2025-11-28
**Contexto:** Story V1-08 (Detecção de Silêncio)
**Status:** ✅ Implementado

### Problema

Necessidade de analisar nível de áudio em tempo real para:
1. **V1**: Detecção de silêncio e clipping
2. **V3 (futuro)**: Análise de qualidade (SNR, wow/flutter, clicks/pops)

### Solução

Escolhemos **Meyda** como biblioteca de análise de áudio.

### Justificativa

**Por que Meyda?**
- **Leve**: ~50KB, sem dependências pesadas
- **Sem WebAssembly**: Funciona nativamente em Node.js sem compilação
- **API simples**: `Meyda.extract(['rms', 'energy'], samples)`
- **Features extensíveis**: Suporta 26+ features de áudio (RMS, spectralCentroid, MFCC, etc.)

**Visão estratégica para V3:**
Meyda foi escolhida não apenas para V1, mas pensando em V3 (Quality Analysis):
- **SNR**: Pode ser calculado via RMS em diferentes segmentos
- **Spectral analysis**: `spectralCentroid`, `spectralRolloff` para detectar high-freq rolloff
- **MFCC**: Útil para fingerprinting e detecção de padrões
- **Energy**: Base para detecção de clicks/pops (picos de energia)

### Uso Atual (V1)

```typescript
// backend/src/services/audio-analyzer.ts
import Meyda from 'meyda';

const features = Meyda.extract(['rms', 'energy'], floatSamples);
const levelDb = 20 * Math.log10(features.rms);
```

**Features extraídas:**
- `rms`: Root Mean Square (0-1)
- `energy`: Energia do sinal

**Publicação:**
- Evento `audio.level` no EventBus a cada 100ms
- Payload: `{ rms, levelDb, energy, timestamp }`

### Uso Futuro (V3)

```typescript
// Exemplo de análise de qualidade (V3)
const features = Meyda.extract([
  'rms',
  'energy',
  'spectralCentroid',    // Centro de massa espectral
  'spectralRolloff',     // Frequência de rolloff
  'zcr'                  // Zero crossing rate (ruído)
], samples);
```

### Alternativas Consideradas

| Biblioteca | Prós | Contras | Decisão |
|------------|------|---------|---------|
| **Meyda** | Leve, API simples, features extensíveis | Menos features que Web Audio API | ✅ Escolhida |
| **essentia.js** | Mais features, usado em produção | WebAssembly, complexo, ~2MB | ❌ Rejeitada |
| **Web Audio API** | Nativo em browsers | Só funciona em browsers, não Node.js | ❌ Rejeitada |
| **Manual (FFT)** | Controle total | Muito trabalho, reimplementar a roda | ❌ Rejeitada |

### Referências

- Arquivo: `backend/src/services/audio-analyzer.ts`
- Story: `docs/stories/v1/v1-08-deteccao-silencio.md`
- Documentação Meyda: https://meyda.js.org/

---

## Dual Streaming Architecture

### Decisão: RAW PCM (frontend) + MP3 (Icecast2)

**Data:** 2025-11-04  
**Contexto:** Story V1-06 (Frontend Player) + adiantamento parcial de V3-02  
**Status:** ✅ Implementado e Validado

### Problema

Requisitos conflitantes:
1. **Frontend player:** Latência mínima (<500ms, ideal ~150ms)
2. **TuneIn/Compatibilidade:** Stream MP3 via Icecast2

### Solução

Implementamos **dual streaming** com Named Pipe (FIFO):

```
                    ┌──────────────┐
                    │  ALSA Input  │
                    │  plughw:1,0  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  FFmpeg #1   │
                    │ Dual Output  │
                    └──┬────────┬──┘
                       │        │
            stdout     │        │ FIFO
            (RAW PCM)  │        │ (RAW PCM)
                       │        │
             ┌─────────▼─┐   ┌─▼────────┐
             │  Express  │   │FFmpeg #2 │
             │Broadcaster│   │MP3 Encode│
             └─────┬─────┘   └────┬─────┘
                   │              │
            ┌──────▼──────┐  ┌────▼─────┐
            │   Frontend  │  │ Icecast2 │
            │  ~150ms     │  │  ~2-5s   │
            └─────────────┘  └──────────┘
```

### Características

**FFmpeg #1 (Producer):**
- Input: ALSA plughw:1,0 (48kHz stereo s16le)
- Output 1: stdout → Express (RAW PCM)
- Output 2: `/tmp/vinyl-audio.fifo` → FFmpeg #2 (RAW PCM)

**FFmpeg #2 (Consumer MP3):**
- Input: FIFO (RAW PCM)
- Encoding: libmp3lame 128kbps
- Output: Icecast2 via protocolo `icecast://`

**Named Pipe (FIFO):**
- Tipo: Unix FIFO
- Localização: `/tmp/vinyl-audio.fifo`
- Função: Comunicação inter-processo sem blocking
- Vantagem: Desconexão de consumidores não quebra o producer

### Benefícios

1. ✅ **Latência frontend:** ~150ms (target <500ms superado)
2. ✅ **Compatibilidade:** MP3 via Icecast2 para TuneIn/VLC/etc
3. ✅ **Múltiplos clientes:** PassThrough broadcaster suporta N conexões
4. ✅ **Isolamento:** Problemas no MP3 não afetam frontend
5. ✅ **Preparação V3:** Arquitetura pronta para adicionar recording path (FLAC)

### Impacto no Roadmap

Esta implementação **adianta ~80% do Story V3.2** (Dual-Path Architecture):
- ✅ Dual FFmpeg separados
- ✅ Named Pipe para comunicação
- ✅ Sincronização sample-accurate (mesmo ALSA input)
- ⏳ Falta: Buffer circular para pré-roll (30s)
- ⏳ Falta: Recording path (FLAC output)

**Quando implementar V3.2:**
- Adicionar terceiro output no FFmpeg #1: FLAC via FIFO
- Implementar buffer circular em memória
- FFmpeg #3 para consumir FIFO de recording

### Referências

- Arquitetura detalhada (completa): `docs/archived/dual-streaming-architecture.md` (1380 linhas)
- Troubleshooting (histórico): `docs/archived/prob-dual-streaming.md`
- Story implementada: `docs/stories/v1/v1-06-frontend-player-basico.md`
- Story futuro: `docs/stories/v3/v3-02-dual-path-architecture.md`

---

## RAW PCM vs MP3 no Frontend

### Decisão: RAW PCM (s16le) processado manualmente

**Data:** 2025-11-04  
**Contexto:** Story V1-06 (Frontend Player)  
**Status:** ✅ Implementado

### Problema

**Tentativa inicial:** Streaming MP3 chunked com Web Audio API

**Sintomas:**
- Buffer underruns frequentes
- Áudio choppy (picotado)
- Erro: `EncodingError: Unable to decode audio data`

**Causa Raiz:**
```javascript
// ❌ PROBLEMA: decodeAudioData() espera arquivo MP3 completo
audioContext.decodeAudioData(arrayBuffer)
```

A Web Audio API `decodeAudioData()` não consegue processar **chunks fragmentados de MP3** porque:
1. MP3 usa frames com headers que podem estar incompletos nos chunks
2. A API espera um arquivo MP3 válido e completo
3. Clientes conectando mid-stream não recebem o header inicial

### Solução

**RAW PCM (s16le) com construção manual de AudioBuffer:**

```typescript
// Processar chunk RAW PCM
const int16Data = new Int16Array(chunk.buffer);
const numSamples = Math.floor(int16Data.length / 2); // 2 channels

// Criar AudioBuffer
const audioBuffer = context.createBuffer(2, numSamples, 48000);

// Converter Int16 → Float32 e separar canais
const leftChannel = audioBuffer.getChannelData(0);
const rightChannel = audioBuffer.getChannelData(1);

for (let i = 0; i < numSamples; i++) {
  // Int16 range: -32768 to 32767 → Float32 range: -1.0 to 1.0
  leftChannel[i] = int16Data[i * 2] / 32768.0;
  rightChannel[i] = int16Data[i * 2 + 1] / 32768.0;
}
```

### Vantagens

1. ✅ **Sem buffer underruns:** Processamento determinístico
2. ✅ **Latência previsível:** ~150ms consistente
3. ✅ **Mid-stream connection:** Clientes podem conectar a qualquer momento
4. ✅ **Controle fino:** Buffer queue gerenciado manualmente
5. ✅ **Performance:** Conversão Int16→Float32 é rápida

### Desvantagens

1. ⚠️ **Largura de banda:** RAW PCM usa mais banda que MP3 (192KB/s vs 16KB/s)
2. ⚠️ **Complexidade:** Código mais complexo que HTML5 Audio

**Mitigação:** Aplicação é doméstica (rede local), largura de banda não é problema.

### Alternativas Consideradas

**Opção 1: WAV streaming**
- Resultado: Header no início, mesmo problema mid-stream

**Opção 2: MP3 parser (mp3-parser, codec-parser)**
- Resultado: Bibliotecas não suportam streaming ou muito complexas

**Opção 3: HTML5 Audio**
- Resultado: Buffer adaptativo 2-5s (não atende requisito <500ms)

### Formato RAW PCM

```
Format:        s16le (signed 16-bit little endian)
Sample Rate:   48000 Hz
Channels:      2 (stereo)
Bit Depth:     16 bits
Byte Rate:     192 KB/s (48000 * 2 * 16 / 8 / 1024)
Frame Size:    4 bytes (2 channels * 2 bytes/sample)
```

### Referências

- Hook: `frontend/src/hooks/useAudioStream.ts`
- Arquitetura detalhada: `docs/archived/dual-streaming-architecture.md` (seção "Processamento de Áudio no Frontend")
- Story: `docs/stories/v1/v1-06-frontend-player-basico.md`

---

## Eventos de Áudio Adiados

### Decisão: Adiar `turntable.idle` e `track.change.detected`

**Data:** 2025-01-29
**Contexto:** Story V1-12 (Detecção de Troca de Faixa) e análise de viabilidade
**Status:** ⏸️ Adiado

### Problema

Durante testes com discos reais, identificamos limitações fundamentais na detecção baseada em threshold de nível de áudio:

**1. Detecção de Troca de Faixa (`track.change.detected`)**

Abordagem planejada: Detectar queda de nível + silêncio curto entre faixas.

**Por que não funciona:**
- Ruído de fundo do vinil (chiado, pops, crackles) raramente permite que o nível caia abaixo de -50dB nos gaps
- Variabilidade alta: gaps variam de 0.5s a 3s+, alguns álbuns têm faixas que emendam (crossfade, medley)
- Alta taxa de falsos positivos poluiria o banco de dados
- Não há caso de uso imediato definido para esses dados

**Alternativas consideradas:**
- Threshold dinâmico: Complexo, ainda gera falsos positivos
- Detecção por queda de energia: Confunde com passagens quietas
- Threshold configurável: Não resolve discos ruidosos

**Possível solução futura:** Fingerprinting via ACRCloud/AudD (V2) ou machine learning local.

**2. Detecção de Toca-discos em Vazio (`turntable.idle`)**

Abordagem planejada: Identificar ruído de fundo baixo mas constante (disco girando sem música).

**Por que não funciona:**
- Nível de áudio oscila muito e não se mantém constante
- Atinge pontos de -50dB, mas não sustenta por 10s (requisito de silêncio)
- Difícil diferenciar de passagens muito quietas em músicas

**Possível solução futura:** Análise espectral via Meyda (spectralCentroid, spectralFlatness) para identificar padrão característico de ruído de vinil vs silêncio vs música.

### Decisão

| Evento | Status | Motivo | Quando revisitar |
|--------|--------|--------|------------------|
| `track.change.detected` | Adiado indefinidamente | Impossível com threshold simples | Quando tiver fingerprinting (V2+) |
| `turntable.idle` | Adiado para V2/V3 | Requer análise espectral | Quando expandir uso de Meyda |

### Impacto

- EventBus define esses tipos mas nenhum serviço os emite
- PRD v3.0 atualizado para refletir status de adiamento
- Funcionalidade core (silêncio, clipping, sessões) não é afetada

### Referências

- Story: `docs/stories/v1/v1-12-deteccao-troca-faixa.md` (decisão de adiamento documentada)
- PRD: `docs/prd-v3.md` seção 5.1.3

---

## Constantes e Thresholds

### Decisão: Valores Hardcoded para Simplificação

**Data:** 2025-12-04
**Contexto:** Documentação de valores técnicos críticos
**Status:** ✅ Documentado

### Objetivo

Documentar constantes e thresholds críticos que afetam o comportamento do sistema. Estes valores foram ajustados empiricamente durante implementação V1/V1.5 e devem ser considerados para futuros ajustes ou troubleshooting.

### Frontend - useAudioStream.ts

| Constante | Valor | Linha | Descrição |
|-----------|-------|-------|-----------|
| `sampleRate` | 48000 Hz | ~70 | Sample rate do AudioContext (deve coincidir com backend) |
| `CHUNK_THRESHOLD` | 8192 bytes (~42ms) | ~114 | Mínimo de dados acumulados antes de processar chunk |
| `REBUFFER_ENTER_THRESHOLD` | 50ms | ~170 | Buffer abaixo deste valor dispara rebuffering |
| `REBUFFER_EXIT_THRESHOLD` | 200ms | ~170 | Buffer acima deste valor sai de rebuffering |
| `MAX_RECONNECT_ATTEMPTS` | 5 | ~368 | Tentativas de reconexão antes de desistir |
| `MAX_BACKOFF_DELAY` | 30000ms | ~368 | Delay máximo entre reconexões |

### Backend - audio-manager.ts

| Constante | Valor | Linha | Descrição |
|-----------|-------|-------|-----------|
| `RATE_LIMITED_LOG_INTERVAL` | 5000ms | ~118 | Intervalo mínimo entre logs repetitivos |
| `SIGTERM_TIMEOUT` | 2000ms | ~234 | Tempo para esperar FFmpeg terminar graciosamente |
| `HEALTH_CHECK_INTERVAL` | 5000ms | ~45 | Intervalo de verificação de saúde do streaming |

### Backend - audio-analyzer.ts

| Constante | Valor | Linha | Descrição |
|-----------|-------|-------|-----------|
| `ANALYSIS_WINDOW` | 100ms | ~25 | Janela de análise para cálculo RMS/dB |
| `NOISE_FLOOR_DB` | -60dB | ~30 | Nível considerado como silêncio |

### Backend - health-monitor.ts

| Constante | Valor | Linha | Descrição |
|-----------|-------|-------|-----------|
| `INITIAL_BACKOFF` | 1000ms | ~18 | Delay inicial para restart após falha |
| `MAX_BACKOFF` | 30000ms | ~19 | Delay máximo entre tentativas de restart |
| `BACKOFF_MULTIPLIER` | 2 | ~20 | Fator de multiplicação para exponential backoff |

### Backend - settings.schema.ts

| Constante | Valor | Linha | Descrição |
|-----------|-------|-------|-----------|
| `MAX_BITRATE` | 256kbps | ~67 | Bitrate máximo permitido (não 320kbps) |
| `MIN_BITRATE` | 64kbps | ~67 | Bitrate mínimo permitido |
| `DEFAULT_BITRATE` | 128kbps | ~67 | Bitrate padrão para streaming |

### FFmpeg Pipeline

| Constante | Valor | Descrição |
|-----------|-------|-----------|
| `AUDIO_SAMPLE_RATE` | 48000 Hz | Taxa de amostragem ALSA |
| `AUDIO_CHANNELS` | 2 (stereo) | Canais de áudio |
| `AUDIO_FORMAT` | s16le | Formato PCM (signed 16-bit little endian) |
| `MP3_BITRATE` | 128kbps | Bitrate do stream Icecast |
| `FIFO_PATH` | `/tmp/vinyl-audio.fifo` | Caminho do named pipe |

### Icecast2

| Constante | Valor | Descrição |
|-----------|-------|-----------|
| `MAX_LISTENERS` | 20 | Máximo de clientes simultâneos |
| `SOURCE_TIMEOUT` | 10s | Timeout para fonte desconectada |
| `CLIENT_TIMEOUT` | 30s | Timeout para cliente inativo |
| `BURST_SIZE` | 65535 bytes | Buffer inicial para novos clientes |

### Notas de Manutenção

**Quando ajustar estes valores:**
- `CHUNK_THRESHOLD`: Se áudio estiver choppy, aumentar (tradeoff: mais latência)
- `REBUFFER_*`: Ajustar se rebuffering ocorrer muito frequentemente ou raramente
- `MAX_BITRATE`: Se precisar de qualidade superior e Pi suportar
- `NOISE_FLOOR_DB`: Se detecção de silêncio estiver muito sensível ou insensível

**Valores que NÃO devem ser alterados:**
- `sampleRate`: Deve coincidir entre ALSA → backend → frontend
- `AUDIO_FORMAT`: Hardcoded em múltiplos lugares, mudança quebra sistema

---

## V1.5 - Hardening & Quality

### Visão Geral

O Epic V1.5 foi criado após auditoria de código para endereçar gaps de segurança, qualidade e manutenibilidade identificados no V1. Todas as stories foram implementadas entre Nov-Dez 2025.

**Data:** 2025-12-04
**Status:** ✅ Completo (14/15 stories, 1 adiada para V3)

### Decisões por Categoria

#### Segurança

**CORS Restriction (V1.5-01)**
- **Problema:** CORS aberto (`*`) permitia requisições de qualquer origem
- **Solução:** Restringir a origens específicas via `CORS_ORIGINS` no `.env`
- **Configuração:** `CORS_ORIGINS=http://localhost:5173,http://192.168.x.x:5173`
- **Arquivo:** `backend/src/index.ts`

**Input Validation com Zod (V1.5-02)**
- **Problema:** Inputs de API não validados, risco de injection
- **Solução:** Schemas Zod para todas as rotas com input
- **Por que Zod?** TypeScript-first, inferência de tipos, mensagens de erro claras, ~50KB
- **Alternativas rejeitadas:** Joi (sem inferência TS), Yup (menos popular), class-validator (decorators)
- **Arquivos:** `backend/src/schemas/*.ts`, middleware em `backend/src/middleware/validate.ts`

**Rate Limiting (V1.5-05)**
- **Problema:** Sem proteção contra abuse/DoS
- **Solução:** express-rate-limit com limites por endpoint
- **Configuração:**
  - API geral: 100 req/min por IP
  - Settings POST: 10 req/min (mais restritivo)
  - Stream endpoints: sem limite (streaming contínuo)
- **Arquivo:** `backend/src/middleware/rate-limit.ts`

#### Observabilidade

**Logger Centralizado - Winston (V1.5-04)**
- **Problema:** `console.log` espalhado, sem estrutura, sem rotação
- **Solução:** Winston com transports configuráveis
- **Features:**
  - Níveis: error, warn, info, debug
  - Formato: JSON em prod, colorido em dev
  - Rotação: diária, max 14 dias
  - Contexto: cada módulo tem seu logger (`createLogger('ModuleName')`)
- **Por que Winston?** Maduro, flexível, ecosystem rico
- **Arquivo:** `backend/src/utils/logger.ts`

**Error Tracking - Sentry (V1.5-12)**
- **Problema:** Erros em produção não rastreados
- **Solução:** Sentry SDK para backend e frontend
- **Configuração:**
  - DSN via `SENTRY_DSN` no `.env`
  - Sample rate: 1.0 em dev, 0.1 em prod
  - Source maps: enviados no build
- **Arquivos:** `backend/src/utils/sentry.ts`, `frontend/src/lib/sentry.ts`

#### Qualidade de Código

**GitHub Actions CI (V1.5-06)**
- **Pipeline:** lint → typecheck → test → build
- **Triggers:** push to main, PRs
- **Matrix:** Node 20.x
- **Arquivo:** `.github/workflows/ci.yml`

**Swagger/OpenAPI (V1.5-09)**
- **Problema:** API não documentada
- **Solução:** swagger-jsdoc + swagger-ui-express
- **Acesso:** `http://localhost:3001/api-docs`
- **Arquivos:** `backend/src/config/swagger.ts`, JSDoc em cada rota

**TypeScript Strict + Enum EventType (V1.5-11)**
- **Problema:** Strings mágicas para tipos de evento
- **Solução:** Enum `EventType` para type-safety
- **Arquivo:** `backend/src/types/events.ts`

#### UX & Performance

**Internacionalização - react-i18next (V1.5-13)**
- **Problema:** Textos hardcoded em português
- **Solução:** react-i18next com namespaces
- **Idiomas:** pt-BR (default), en (futuro)
- **Por que i18next?** Ecosystem maduro, lazy loading, interpolação
- **Arquivos:** `frontend/src/i18n/`, `frontend/src/i18n/locales/`

**Code Splitting (V1.5-10)**
- **Problema:** Bundle único grande (~500KB)
- **Solução:** React.lazy + Suspense para rotas
- **Resultado:** Chunk inicial ~150KB, rotas carregam sob demanda
- **Arquivo:** `frontend/src/App.tsx`

**Testes Frontend - Vitest (V1.5-08)**
- **Framework:** Vitest (compatível com Vite)
- **Coverage:** Hooks principais (useAudioStream, useSocket)
- **Arquivos:** `frontend/src/**/*.test.ts`

#### Manutenção

**Cleanup Archived (V1.5-03)**
- Movidos 15+ arquivos obsoletos para `docs/archived/`
- Estrutura de docs simplificada

**CONTRIBUTING.md + CHANGELOG.md (V1.5-15)**
- Guia de contribuição padronizado
- Changelog seguindo Keep a Changelog

#### Adiado

**Testes E2E - Playwright (V1.5-14)**
- **Status:** Adiado para V3
- **Motivo:** Complexidade de setup com streaming de áudio real
- **Decisão:** Priorizar testes unitários e integração primeiro

### Referências

- Tech Spec: `docs/tech-spec-epic-v1.5.md`
- Stories: `docs/stories/v1.5/`
- Sprint Status: `docs/sprint-status.yaml` (seção epic-v1.5)

---

## Índice de Decisões por Story

| Story | Decisões Técnicas |
|-------|-------------------|
| V1-05 | MP3 Bitrate e Codec |
| V1-06 | Dual Streaming Architecture, RAW PCM vs MP3 |
| V1-08 | Meyda para Análise de Áudio |
| V1-12 | Eventos de Áudio Adiados (track.change, turntable.idle) |
| V1.5-01 | CORS Restriction |
| V1.5-02 | Zod Input Validation |
| V1.5-04 | Winston Logger |
| V1.5-05 | Rate Limiting |
| V1.5-06 | GitHub Actions CI |
| V1.5-08 | Vitest Frontend Tests |
| V1.5-09 | Swagger/OpenAPI |
| V1.5-10 | Code Splitting |
| V1.5-11 | Enum EventType |
| V1.5-12 | Sentry Error Tracking |
| V1.5-13 | react-i18next i18n |
| V3-02 | (Parcialmente adiantado em V1-06) |

---

**Última revisão:** 2025-12-04
**Próxima revisão:** Quando implementar V2 ou V3

