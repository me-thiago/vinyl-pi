# Story V1.9: Detecção de Clipping

**Epic:** V1 - Foundation Core (MVP)
**Status:** review

**User Story:**
Como usuário,
quero ser alertado quando o áudio está saturado (clipping),
para que possa ajustar o volume de entrada.

## Critérios de Aceitação

- [x] 1. Detecção de clipping quando nível > threshold (default: -1dB)
- [x] 2. Evento `clipping.detected` emitido via EventBus
- [x] 3. Metadata inclui timestamp e nível de áudio
- [x] 4. Contador de eventos de clipping disponível

## Pré-requisitos

- V1.8 - Detecção de Silêncio ✅

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.1 (Captura de Áudio - Monitoramento)
- [Epics](../epics.md) - Epic V1

## Tasks

- [x] 1. Adicionar ClippingDetectionConfig ao EventDetector
  - [x] 1.1. Interface com threshold
  - [x] 1.2. Payload ClippingDetectedPayload
- [x] 2. Implementar lógica de detecção de clipping
  - [x] 2.1. Verificar se nível > threshold (-1dB)
  - [x] 2.2. Emitir evento clipping.detected via EventBus
  - [x] 2.3. Contador de eventos de clipping (total desde start)
- [x] 3. Adicionar métodos de status e config para clipping
  - [x] 3.1. getClippingCount()
  - [x] 3.2. getClippingConfig() - retorna config de clipping
  - [x] 3.3. setClippingThreshold()
- [x] 4. Atualizar API /api/status
  - [x] 4.1. Remover TODO e implementar clipping_detected real
- [x] 5. Escrever testes unitários para clipping
  - [x] 5.1. Testes de detecção de clipping (7 tests)
  - [x] 5.2. Testes de contagem de eventos
  - [x] 5.3. Testes de edge cases
  - [x] 5.4. Testes de configuração de clipping (3 tests)
  - [x] 5.5. Testes combinados silence + clipping (2 tests)
- [x] 6. Executar todos os testes e validar

## Dev Agent Record

### Context Reference
- V1.8 Story Context usado como base (mesma arquitetura)

### File List
- **Modified:**
  - `backend/src/services/event-detector.ts` - Adicionada detecção de clipping
  - `backend/src/routes/status.ts` - API retorna clipping_detected e clipping_count
  - `backend/src/__tests__/services/event-detector.test.ts` - 16 novos testes de clipping

### Debug Log
- 2025-11-28: Iniciando implementação V1.9
  - Arquitetura: Estender EventDetector existente para detectar clipping
  - Clipping = nível > -1dB (configurável)
  - Evento clipping.detected com payload {timestamp, levelDb, threshold, count}
  - Contador de eventos de clipping desde o start

### Change Log
- 2025-11-28: V1.9 Detecção de Clipping implementada
  - Adicionadas interfaces ClippingDetectionConfig e ClippingDetectedPayload
  - EventDetector agora suporta novo formato de config: { silence: {...}, clipping: {...} }
  - Backward compatibility mantida com formato legado de config
  - Métodos adicionados: getClippingCount(), getClippingConfig(), setClippingThreshold()
  - Evento `clipping.detected` emitido via EventBus quando nível > threshold
  - API /api/status retorna clipping_detected (boolean) e clipping_count (number)
  - getStatus() retorna informações completas incluindo clippingCount e clippingConfig
  - 39 testes unitários (23 silence + 16 clipping), 100% pass

### Completion Notes
**Implementation Summary:**
Estendido o EventDetector para detectar clipping (saturação de áudio):
- **ClippingDetectionConfig**: Interface com threshold configurável (default: -1dB)
- **Detecção**: Quando levelDb > threshold, incrementa contador e emite evento
- **Evento clipping.detected**: Payload com timestamp, levelDb, threshold, count

**Key Features:**
- ✅ Detecção de clipping em tempo real (nível > -1dB)
- ✅ Threshold configurável via setClippingThreshold()
- ✅ Evento `clipping.detected` com payload completo
- ✅ Contador de clipping desde o start (getClippingCount())
- ✅ API /api/status retorna clipping_detected e clipping_count
- ✅ Backward compatibility com formato de config legado
- ✅ Reset do contador no stop()/destroy()

**Technical Decisions:**
- Clipping emite evento para cada ocorrência (não debounced) para monitoramento preciso
- Contador resetado no stop() para permitir análise por sessão
- Config suporta ambos formatos: legado {threshold, duration} e novo {silence, clipping}

**Test Coverage (39 tests, 100% pass):**
- Initialization (6), Start/Stop (5), Silence Detection (6), Config Updates (3)
- Status Reporting (3), Edge Cases (3), Destroyable (1)
- Clipping Detection (7), Clipping Configuration (3), Combined Silence+Clipping (2)

### Code Review Notes
**Teste em cenário real sugerido:**
- Testar clipping com vinil real, simulando movimentos na agulha ao tocar o disco
- Colocar/retirar agulha do disco deve gerar picos que disparam clipping
- Verificar se o contador incrementa corretamente durante operação real
- Validar que a API /api/status reflete os eventos de clipping em tempo real
