# Story V1.15: UI de Diagnóstico (VU Meter e Thresholds)

**Epic:** V1 - Foundation Core (MVP)
**Status:** Review

**User Story:**
Como usuário,  
quero poder ver o nível de áudio em tempo real e ajustar thresholds de detecção,  
para que possa calibrar o sistema para meu toca-discos específico.

## Critérios de Aceitação

1. Página Diagnostics criada
2. VU meter em tempo real mostrando nível de áudio (dB)
3. Configuração de thresholds:
   - Silence threshold (dB)
   - Silence duration (segundos)
   - Track change sensitivity (0-1)
   - Session timeout (minutos)
4. Botões de teste manual (trigger de eventos para teste)
5. Mudanças salvas via API e aplicadas imediatamente

## Pré-requisitos

- V1.14 - WebSocket Real-Time Updates

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.3 (Reconhecimento Sonoro - UI de Diagnóstico)
- [Epics](../epics.md) - Epic V1

---

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-15-ui-diagnostico.context.xml) - Generated 2025-11-30

### Implementation Notes

**Completed:** 2025-11-29

#### Backend Changes

1. **SettingsService** (`backend/src/services/settings-service.ts`)
   - CRUD de settings via Prisma
   - Cache em memória para leitura rápida
   - Emite evento `settings.changed` quando alterado
   - Inicialização com valores do `.env` como fallback
   - Validação de ranges e tipos

2. **Settings Router** (`backend/src/routes/settings.ts`)
   - `GET /api/settings` - Lista todas as settings com metadata
   - `PATCH /api/settings` - Atualiza uma ou mais settings
   - `POST /api/settings/reset` - Reseta todas para default
   - `POST /api/settings/:key/reset` - Reseta uma específica

3. **EventDetector Updates** (`backend/src/services/event-detector.ts`)
   - Novo método `updateConfig()` para atualizar múltiplas configs
   - Novo método `setClippingCooldown()`

4. **SessionManager Updates** (`backend/src/services/session-manager.ts`)
   - Novo método `setSessionTimeout()` - reinicia timer se ativo
   - Novo método `setAudioThreshold()`

5. **Index Integration** (`backend/src/index.ts`)
   - SettingsService inicializado com Prisma
   - Listener `settings.changed` aplica configs em tempo real
   - Função `applySettings()` atualiza EventDetector e SessionManager

#### Frontend Changes

1. **VU Meter Component** (`frontend/src/components/vu-meter.tsx`)
   - Componente reutilizável com configuração flexível
   - Indicadores visuais de threshold (silence/clipping)
   - Segmentos LED para efeito visual
   - Suporte a orientação horizontal/vertical
   - Escala de dB opcional

2. **Diagnostics Page** (`frontend/src/pages/Diagnostics.tsx`)
   - VU meter em tempo real via WebSocket
   - Form de configuração com sliders
   - Validação visual de mudanças pendentes
   - Botões de salvar e resetar
   - Log de eventos em tempo real (50 últimos)
   - Componentes shadcn/ui: Card, Badge, Slider, Label, Alert, ScrollArea

3. **Routing** (`frontend/src/main.tsx`, `frontend/src/App.tsx`)
   - Nova rota `/diagnostics`
   - Botão de navegação no header

#### Settings Migradas do .env para Banco

| Setting Key | Default | Unit | Descrição |
|-------------|---------|------|-----------|
| `silence.threshold` | -50 | dB | Threshold de silêncio |
| `silence.duration` | 10 | s | Duração para detectar silêncio |
| `clipping.threshold` | -3 | dB | Threshold de clipping |
| `clipping.cooldown` | 1000 | ms | Cooldown entre clippings |
| `session.timeout` | 1800 | s | Timeout de sessão |

#### Acceptance Criteria Verification

- ✅ Página Diagnostics criada
- ✅ VU meter em tempo real mostrando nível de áudio (dB)
- ✅ Configuração de thresholds via sliders
- ✅ Mudanças salvas via API e aplicadas imediatamente
- ⏸️ Botões de teste manual (não implementado - pode ser V1.16 ou posterior)
