# Story V1.18: Página de Configurações de Streaming

**Epic:** V1 - Foundation Core (MVP)
**Status:** Done

**User Story:**
Como usuário,
quero configurar parâmetros de streaming (buffer do player e bitrate MP3),
para que possa ajustar latência vs estabilidade conforme minha rede.

## Contexto Técnico

O Vinyl-OS tem dois streams paralelos:
- **PCM** (:3000/stream.wav) - baixa latência, usado pelo player web local
- **MP3** (:8000/stream) - comprimido, usado por TuneIn e players externos

As configurações são categorizadas por impacto:
- **Hot** - aplicam imediatamente (thresholds - já em Diagnostics)
- **Warm** - causam breve interrupção (~2s) no stream afetado
- **Cold** - requerem restart do sistema (fora do escopo)

Esta story foca em configurações **warm** de streaming.

## Critérios de Aceitação

### 1. Página Settings criada
- [x] Nova rota `/settings` no frontend
- [x] Link "Configurações" na navegação (ao lado de Diagnostics)
- [x] Layout responsivo com 3 cards

### 2. Card PCM / Player Local
- [x] Título: "Player Local (PCM)"
- [x] Slider `player.buffer_ms` (100-300ms, default 150ms)
- [x] Label indica valor atual em ms
- [x] Info read-only: "Latência estimada: ~{value}ms"
- [x] Ao salvar: mensagem orienta reconectar stream

### 3. Card Stream MP3
- [x] Título: "Stream MP3 (Icecast)"
- [x] Dropdown `stream.bitrate` com opções: 128k, 192k, 256k (default 128k)
- [x] Alert warning: "Alterar reinicia o stream (~2s de silêncio)"
- [x] URL read-only: `http://{host}:8000/stream` com botão "Copiar"
- [x] Ao salvar: reinicia FFmpeg #2 (endpoint `/streaming/restart`)

### 4. Card Sistema (read-only)
- [x] Título: "Sistema"
- [x] Device ALSA: valor de `AUDIO_DEVICE` (ex: `plughw:0,0`)
- [x] Sample Rate: `44100 Hz`
- [x] Versão: `Vinyl-OS v1.18`

### 5. Backend: Novas Settings
- [x] Adicionar ao `settings-service.ts`:
  - `player.buffer_ms` (number, 100-300, default 150)
  - `stream.bitrate` (number, enum [128, 192, 256], default 128)
- [x] Endpoint `GET /api/system/info` retorna device, sample rate, versão

### 6. Backend: Restart de Stream
- [x] Novo endpoint `POST /streaming/restart`
- [x] Aplica novo bitrate do settings
- [x] Para FFmpeg #2, reinicia com novo bitrate
- [x] Retorna status de sucesso/erro

### 7. Frontend: Aplicar Buffer
- [x] Player.tsx lê `player.buffer_ms` do settings (não hardcoded)
- [x] Ao mudar setting, orienta usuário a reconectar

## Fora do Escopo

- Thresholds (já em Diagnostics)
- Theme toggle (já em todas as páginas)
- Device ALSA (requer restart completo - V2+)
- Configurações do Icecast2 (requer restart do serviço)

## Pré-requisitos

- V1.17 - Histórico de Sessões

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.5 (Interface Web - Configurações)
- [Dual Streaming Architecture](../dual-streaming-architecture.md)
- [Epics](../epics.md) - Epic V1

---

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-18-configuracoes-basicas.context.xml) - Generated 2025-11-30

### Implementation Notes
- **Completed:** 2025-11-30

### Files Created/Modified

**Frontend:**
- `frontend/src/pages/Settings.tsx` - Nova página com 3 cards
- `frontend/src/main.tsx` - Rota /settings adicionada
- `frontend/src/App.tsx` - Link "Configurações" na navegação
- `frontend/src/components/Player/Player.tsx` - Lê buffer do settings via API
- `frontend/src/components/ui/select.tsx` - Componente shadcn instalado

**Backend:**
- `backend/src/services/settings-service.ts` - Novas settings: player.buffer_ms, stream.bitrate
- `backend/src/routes/settings.ts` - Endpoint GET /api/system/info
- `backend/src/index.ts` - Endpoint POST /streaming/restart, helper getStreamingConfig()

### Change Log
- 2025-11-30: Implementação completa da V1.18
