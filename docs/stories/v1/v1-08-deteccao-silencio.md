# Story V1.8: Detecção de Silêncio

**Epic:** V1 - Foundation Core (MVP)  
**Status:** review

**User Story:**
Como usuário,  
quero que o sistema detecte quando não há áudio (silêncio),  
para que possa identificar quando o toca-discos está parado.

## Critérios de Aceitação

- [x] 1. Serviço `event-detector.ts` analisa nível de áudio em tempo real
- [x] 2. Threshold configurável (default: -50dB)
- [x] 3. Duração configurável (default: 10s)
- [x] 4. Evento `silence.detected` emitido via EventBus quando detectado
- [x] 5. Evento `silence.ended` emitido quando áudio retorna
- [x] 6. Status disponível via API

## Pré-requisitos

- V1.7 - EventBus Core ✅

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.3 (Reconhecimento Sonoro - Detecção de Silêncio)
- [Epics](../epics.md) - Epic V1

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-8-deteccao-silencio.context.xml) - Generated 2025-11-03

### File List
- **Created:**
  - `backend/src/services/audio-analyzer.ts` - Serviço de análise de áudio usando Meyda
  - `backend/src/services/event-detector.ts` - Serviço de detecção de eventos (silêncio)
  - `backend/src/__tests__/services/audio-analyzer.test.ts` - Testes do AudioAnalyzer (15 tests)
  - `backend/src/__tests__/services/event-detector.test.ts` - Testes do EventDetector (23 tests)

- **Modified:**
  - `backend/src/index.ts` - Integração do AudioAnalyzer e EventDetector
  - `backend/src/routes/status.ts` - Adicionado audio.silence_detected na API
  - `backend/package.json` - Adicionada dependência Meyda

### Change Log
- 2025-11-28: V1.8 Detecção de Silêncio implementada
  - Biblioteca Meyda instalada para análise de áudio
  - AudioAnalyzer: Recebe chunks PCM, extrai RMS/dB, publica `audio.level` no EventBus
  - EventDetector: Escuta `audio.level`, detecta silêncio baseado em threshold (-50dB) e duração (10s)
  - Eventos `silence.detected` e `silence.ended` emitidos via EventBus
  - API GET /api/status atualizada com `audio.silence_detected`
  - API GET /api/status/audio adicionada com detalhes de análise
  - 38 testes unitários (15 AudioAnalyzer + 23 EventDetector), 100% pass

### Completion Notes

**Implementation Summary:**
Implementada arquitetura modular para análise de áudio:
- **AudioAnalyzer**: Processa chunks PCM do broadcaster, usa Meyda para extrair RMS, converte para dB, publica `audio.level` no EventBus a cada 100ms
- **EventDetector**: Escuta `audio.level`, implementa state machine para detecção de silêncio com threshold e duração configuráveis

**Key Features:**
- ✅ Análise de nível de áudio em tempo real usando Meyda
- ✅ Threshold configurável via env `SILENCE_THRESHOLD` (default: -50dB)
- ✅ Duração configurável via env `SILENCE_DURATION` (default: 10s)
- ✅ Eventos `silence.detected` com payload {timestamp, levelDb, duration, threshold}
- ✅ Eventos `silence.ended` com payload {timestamp, levelDb, silenceDuration}
- ✅ API /api/status retorna `audio.silence_detected: boolean`
- ✅ API /api/status/audio retorna status detalhado do analyzer e detector
- ✅ Graceful shutdown integrado
- ✅ Memory leak prevention usando SubscriptionManager

**Technical Decisions:**
- Meyda escolhida por ser leve (~50KB), sem WebAssembly, API simples
- Análise feita no broadcaster (index.ts) mesmo sem clientes conectados
- AudioAnalyzer separado do AudioManager para Single Responsibility
- EventDetector usa state machine para evitar eventos duplicados

**Test Coverage (38 tests, 100% pass):**
- AudioAnalyzer: Initialization (4), Start/Stop (4), PCM Analysis (4), EventBus Integration (2), RMS Calculation (1)
- EventDetector: Initialization (4), Start/Stop (4), Silence Detection (6), Config Updates (3), Status Reporting (2), Edge Cases (3), Destroyable (1)

