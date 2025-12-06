# Story V2-12: Configurações de Reconhecimento

**Epic:** V2 - Coleção & Reconhecimento Musical  
**Status:** done

---

## User Story

Como usuário,  
quero configurar as APIs de reconhecimento e ter reconhecimento automático no início de cada sessão,  
para que não precise clicar manualmente toda vez que coloco um disco.

---

## Contexto

### Escopo V2-12 (Revisão 2025-12-06)

Esta story inclui:
- ✅ Configuração de API keys via UI
- ✅ Validação de conexão com as APIs
- ✅ **Reconhecimento automático no início da sessão** (novo!)
- ✅ Configuração de sample duration

### O que foi adiado para V3:
- ⏸️ Reconhecimento automático contínuo (timer inteligente baseado em duração)
- ⏸️ Auto-reconhecimento por troca de faixa

### Reconhecimento no Início da Sessão

**Premissa**: Início de sessão ≈ novo disco colocado no toca-discos.

Quando uma sessão inicia (áudio detectado após silêncio prolongado), o sistema aguarda ~20 segundos e dispara um reconhecimento automático. Isso captura o álbum que está começando a tocar.

**Por que 20 segundos?**
- Passa o lead-in silencioso do vinil (~5-10s)
- Entra na música propriamente dita
- Dá tempo para nível de áudio estabilizar

**Custo**: 1 chamada de API por sessão (vs. múltiplas chamadas do reconhecimento contínuo).

---

## Critérios de Aceitação

### AC-1: Backend - Settings de Reconhecimento
- [x] Novos campos em Settings:
  - `recognition.sampleDuration` (number, default: 10, min: 5, max: 15)
  - `recognition.preferredService` (enum: 'acrcloud' | 'audd' | 'auto', default: 'auto')
  - `recognition.autoOnSessionStart` (boolean, default: false)
  - `recognition.autoDelay` (number, default: 20, min: 10, max: 60)
- [x] Campos salvos via API existente `PUT /api/settings`

### AC-2: Backend - Validação de API Keys
- [x] `GET /api/recognition/status` retorna status das APIs configuradas
- [x] `POST /api/recognition/test` testa conexão com APIs (sem reconhecer áudio)
- [x] Status inclui: apiConfigured, lastTestResult, lastTestAt, autoEnabled
- [x] Validação no startup (log warning se keys ausentes)

### AC-3: Backend - Auto-Reconhecimento no Início da Sessão
- [x] Quando `session.started` é emitido E `autoOnSessionStart` está habilitado:
  - Aguarda `autoDelay` segundos
  - Dispara reconhecimento automático
  - Salva track vinculado à sessão
  - Emite WebSocket event `track_recognized`
- [x] Se sessão terminar antes do delay, cancela o reconhecimento
- [x] Se reconhecimento falhar, loga erro mas não afeta sessão
- [x] Apenas 1 auto-reconhecimento por sessão (não repete se manual acontecer antes)

### AC-4: UI - Seção em Settings
- [x] Nova seção "Reconhecimento Musical" na página Settings
- [x] Toggle "Reconhecimento automático ao iniciar sessão" (default: off)
- [x] Slider para delay (10-60 segundos, default: 20)
- [x] Campos para API keys (mascarados com ••••••)
- [x] Dropdown para serviço preferido
- [x] Slider para duração da amostra (5-15 segundos)
- [x] Botão "Testar Conexão" com feedback visual
- [x] Status: "✅ Configurado" ou "⚠️ Não configurado"

### AC-5: WebSocket - Notificação de Auto-Reconhecimento
- [x] Evento `recognition_started` quando auto-reconhecimento inicia
- [x] Evento `track_recognized` quando completa (já existe)
- [x] Frontend mostra toast/notificação: "Identificando música..."

---

## Fluxo do Auto-Reconhecimento

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Sessão Iniciada (session.started)                                  │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────┐                                                │
│  │ autoOnSession   │── false ──▶ [Nada acontece]                    │
│  │ Start enabled?  │                                                │
│  └────────┬────────┘                                                │
│           │ true                                                    │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │ Aguarda 20s     │◀── (cancelável se sessão terminar)             │
│  │ (autoDelay)     │                                                │
│  └────────┬────────┘                                                │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │ Reconhecimento  │── Já houve reconhecimento? ──▶ [Skip]          │
│  │ ainda necessário│    (manual ou auto)                            │
│  └────────┬────────┘                                                │
│           │ Sim                                                     │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │ WebSocket:      │                                                │
│  │ recognition_    │                                                │
│  │ started         │                                                │
│  └────────┬────────┘                                                │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │ Captura áudio   │                                                │
│  │ + API request   │                                                │
│  └────────┬────────┘                                                │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐     ┌─────────────────┐                        │
│  │ Sucesso?        │─no─▶│ Log erro,       │                        │
│  └────────┬────────┘     │ continua sessão │                        │
│           │ yes          └─────────────────┘                        │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │ Salva Track     │                                                │
│  │ WebSocket:      │                                                │
│  │ track_recognized│                                                │
│  └─────────────────┘                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Resposta da API

```typescript
// GET /api/recognition/status
interface RecognitionStatus {
  services: {
    acrcloud: {
      configured: boolean;
      lastTestAt: string | null;
      lastTestResult: 'success' | 'error' | null;
      lastTestError: string | null;
    };
    audd: {
      configured: boolean;
      lastTestAt: string | null;
      lastTestResult: 'success' | 'error' | null;
      lastTestError: string | null;
    };
  };
  settings: {
    preferredService: 'acrcloud' | 'audd' | 'auto';
    sampleDuration: number;
    autoOnSessionStart: boolean;
    autoDelay: number;
  };
}

// POST /api/recognition/test
// Request: { service: 'acrcloud' | 'audd' }
// Response: { success: boolean; message: string; responseTime: number }

// PUT /api/recognition/config
interface RecognitionConfigUpdate {
  preferredService?: 'acrcloud' | 'audd' | 'auto';
  sampleDuration?: number;
  autoOnSessionStart?: boolean;
  autoDelay?: number;
}
```

---

## Design da UI

```
┌─────────────────────────────────────────────────────────────────┐
│  🎵 Reconhecimento Musical                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Reconhecimento Automático                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [●] Identificar automaticamente ao iniciar sessão       │    │
│  └─────────────────────────────────────────────────────────┘    │
│  Quando você começar a tocar um disco, o sistema identificará   │
│  automaticamente após alguns segundos.                          │
│                                                                 │
│  Delay antes de identificar                                     │
│  ◀──────────●──────────▶  20 segundos                           │
│  10s                  60s                                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Configurações Gerais                                           │
│                                                                 │
│  Serviço Preferido                                              │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ Automático (tenta ACRCloud, fallback AudD)      ▼   │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
│  Duração da Amostra                                             │
│  ◀──────────●──────────▶  10 segundos                           │
│  5s                  15s                                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  API Keys                                                       │
│                                                                 │
│  ACRCloud                                    ✅ Configurado     │
│  Host: identify-*.acrcloud.com                                  │
│  Access Key: ••••••••••••••••                                   │
│  Access Secret: ••••••••••••••••                                │
│                                     [Testar Conexão]            │
│                                                                 │
│  AudD                                        ⚠️ Não configurado │
│  API Token: (não configurado)                                   │
│                                     [Testar Conexão]            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                [Salvar]         │
└─────────────────────────────────────────────────────────────────┘
```

### Toast de Auto-Reconhecimento

```
┌────────────────────────────────────────┐
│  🎵 Identificando música...            │
│  Aguarde alguns segundos               │
└────────────────────────────────────────┘

       ↓ (após sucesso)

┌────────────────────────────────────────┐
│  ✅ Música identificada                │
│  "Money" - Pink Floyd                  │
│  Dark Side of the Moon (1973)          │
│                        [Ver álbum]     │
└────────────────────────────────────────┘
```

---

## Implementação Técnica

### Backend - Auto-Recognition Handler

```typescript
// src/services/auto-recognition.ts
import { eventBus } from './event-bus';
import { recognize } from './recognition';
import { getSettings } from './settings-service';
import { socketManager } from './socket-manager';

let pendingRecognition: NodeJS.Timeout | null = null;
let sessionHasRecognition = new Map<string, boolean>();

export function setupAutoRecognition() {
  eventBus.on('session.started', async (data) => {
    const settings = await getSettings();
    
    if (!settings['recognition.autoOnSessionStart']) {
      return;
    }
    
    const sessionId = data.sessionId;
    const delay = settings['recognition.autoDelay'] || 20;
    
    // Cancelar qualquer pending
    if (pendingRecognition) {
      clearTimeout(pendingRecognition);
    }
    
    // Marcar sessão como sem reconhecimento ainda
    sessionHasRecognition.set(sessionId, false);
    
    // Agendar auto-reconhecimento
    pendingRecognition = setTimeout(async () => {
      // Verificar se já houve reconhecimento manual
      if (sessionHasRecognition.get(sessionId)) {
        return;
      }
      
      try {
        // Notificar início
        socketManager.broadcast('recognition_started', { sessionId, auto: true });
        
        // Executar reconhecimento
        const result = await recognize({ sessionId });
        
        if (result.success) {
          sessionHasRecognition.set(sessionId, true);
          // track_recognized já é emitido pelo recognize()
        }
      } catch (error) {
        console.error('Auto-recognition failed:', error);
        // Não afeta a sessão
      }
    }, delay * 1000);
  });
  
  eventBus.on('session.ended', (data) => {
    // Cancelar pending se sessão terminou
    if (pendingRecognition) {
      clearTimeout(pendingRecognition);
      pendingRecognition = null;
    }
    sessionHasRecognition.delete(data.sessionId);
  });
  
  // Marcar quando reconhecimento manual acontece
  eventBus.on('track.recognized', (data) => {
    if (data.sessionId) {
      sessionHasRecognition.set(data.sessionId, true);
    }
  });
}
```

### Frontend - WebSocket Handler

```typescript
// Adicionar ao useWebSocket ou componente apropriado
socket.on('recognition_started', (data) => {
  if (data.auto) {
    toast.info(t('recognition.autoStarted'));
  }
});
```

---

## i18n Keys

```json
{
  "recognition": {
    "settings": {
      "title": "Reconhecimento Musical",
      "autoSection": "Reconhecimento Automático",
      "autoOnSessionStart": "Identificar automaticamente ao iniciar sessão",
      "autoOnSessionStartDesc": "Quando você começar a tocar um disco, o sistema identificará automaticamente após alguns segundos.",
      "autoDelay": "Delay antes de identificar",
      "seconds": "segundos",
      "generalSection": "Configurações Gerais",
      "preferredService": "Serviço Preferido",
      "serviceAuto": "Automático (tenta ACRCloud, fallback AudD)",
      "serviceAcrcloud": "ACRCloud",
      "serviceAudd": "AudD",
      "sampleDuration": "Duração da Amostra",
      "apiKeysSection": "API Keys",
      "configured": "Configurado",
      "notConfigured": "Não configurado",
      "testConnection": "Testar Conexão",
      "testing": "Testando...",
      "testSuccess": "Conexão OK ({{time}}ms)",
      "testError": "Erro: {{message}}",
      "save": "Salvar"
    },
    "autoStarted": "Identificando música...",
    "autoStartedDesc": "Aguarde alguns segundos"
  }
}
```

---

## Pré-requisitos

- [x] V2-05 - Reconhecimento Musical (serviço funcionando)
- [x] V1-11 - Detecção de Sessão (session.started event)

---

## Estimativa

- **Complexidade:** Média
- **Pontos:** 5
- **Tempo estimado:** 3-4 horas

---

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Recognition Service
- [PRD v3.0](../prd-v3.md) - Seção 5.2.2

---

## Funcionalidades Adiadas para V3

### Reconhecimento Automático Contínuo
- Timer inteligente baseado em `durationSeconds` do track
- Agendamento de próximo reconhecimento
- Detecção de troca de faixa para trigger

**Motivo do adiamento**: 
- Custo de múltiplas chamadas de API
- Sem detecção de troca de faixa confiável
- Em V3, com chromaprint local, será gratuito e preciso

---

## Histórico

| Data | Ação | Motivo |
|------|------|--------|
| 2025-12-06 | Simplificação inicial | Adiar reconhecimento contínuo para V3 |
| 2025-12-06 | Adição auto-on-session | Reconhecimento único no início da sessão (baixo custo) |
