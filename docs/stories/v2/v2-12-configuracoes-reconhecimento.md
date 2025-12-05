# Story V2-12: Configurações de Reconhecimento

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** ready-for-dev

**User Story:**
Como usuário,
quero configurar as opções de reconhecimento musical,
para que possa controlar quando e como o reconhecimento acontece.

## Critérios de Aceitação

### Backend
1. Novos campos em Settings para reconhecimento:
   - `recognition.autoEnabled` (boolean, default: false)
   - `recognition.intervalMinutes` (number, default: 3, min: 1, max: 30)
   - `recognition.sampleDuration` (number, default: 10, min: 5, max: 15)

2. Endpoints:
   - `GET /api/recognition/status` - Status do reconhecimento automático
   - `PATCH /api/recognition/auto` - Habilitar/desabilitar e configurar

3. Validação de API keys no startup (log warning se ausentes)

### Timer Inteligente
4. Quando auto habilitado, agenda próximo reconhecimento:
   - Se track anterior tem durationSeconds: agenda para (duration - 30s)
   - Se não tem: usa intervalMinutes configurado
   - Mínimo entre reconhecimentos: 60s
5. Timer pausado se sessão não estiver ativa
6. Timer reiniciado quando sessão inicia

### UI (Extensão de Settings)
7. Seção "Reconhecimento Musical" na página Settings
8. Toggle "Reconhecimento Automático" (default: off)
9. Slider/input para intervalo mínimo (1-30 min)
10. Status: "Próximo reconhecimento em X:XX" (se auto habilitado)
11. Campos para API keys (mascarados, save no .env via backend)
12. Botão "Testar Conexão" para validar API keys

### WebSocket
13. Evento `recognition_status` broadcast quando status muda
14. Frontend atualiza status em tempo real

## Variáveis de Ambiente

```env
# Já definidas em V2-04/V2-05, validadas aqui
ACRCLOUD_HOST=
ACRCLOUD_ACCESS_KEY=
ACRCLOUD_ACCESS_SECRET=
AUDD_API_TOKEN=
DISCOGS_CONSUMER_KEY=
DISCOGS_CONSUMER_SECRET=
```

## Pré-requisitos

- V2-05 - Reconhecimento Musical
- V2-06 - Validação Coleção

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Recognition Service, Workflow 2
- [PRD v3.0](../prd-v3.md) - Seção 5.2.2

---

## Nota Histórica

Esta story substitui a antiga "V2-12: Background Recognition Worker" que foi **adiada para V3**.

**Motivo do adiamento:** Com timing inteligente baseado em `durationSeconds`, não há necessidade de Bull Queue. O reconhecimento síncrono (~15s) é aceitável para V2. Worker só faria sentido para processamento de gravações offline (V3).

