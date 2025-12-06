# Story V2-12: Configurações de Reconhecimento

**Epic:** V2 - Coleção & Reconhecimento Musical  
**Status:** ready-for-dev

---

## User Story

Como usuário,  
quero configurar e validar as APIs de reconhecimento musical,  
para que possa garantir que o serviço está funcionando corretamente.

---

## Contexto

### Mudança de Escopo (Revisão 2025-12-06)

**Decisão**: Simplificar esta story para focar em **configuração e validação das APIs**. O reconhecimento automático (timer inteligente) foi **adiado para V3**.

**Justificativa**:
1. **Custo**: Cada chamada de API (ACRCloud/AudD) consome créditos - reconhecimento automático seria caro
2. **Precisão**: Sem detecção de troca de faixa confiável, não sabemos quando reconhecer automaticamente
3. **Modelo mental**: O uso atual é "coloco um disco e clico [🎵] para registrar o que estou ouvindo"
4. **V3 resolve**: Com gravação FLAC + chromaprint local, reconhecimento automático será gratuito e preciso

### O que esta story inclui:
- ✅ Configuração de API keys via UI
- ✅ Validação de conexão com as APIs
- ✅ Status do serviço de reconhecimento
- ✅ Configuração de sample duration

### O que foi adiado para V3:
- ⏸️ Reconhecimento automático (timer inteligente)
- ⏸️ Agendamento baseado em durationSeconds
- ⏸️ Auto-reconhecimento por sessão

---

## Critérios de Aceitação

### AC-1: Backend - Settings de Reconhecimento
- [ ] Novos campos em Settings:
  - `recognition.sampleDuration` (number, default: 10, min: 5, max: 15)
  - `recognition.preferredService` (enum: 'acrcloud' | 'audd' | 'auto', default: 'auto')
- [ ] Campos salvos via API existente `PUT /api/settings`

### AC-2: Backend - Validação de API Keys
- [ ] `GET /api/recognition/status` retorna status das APIs configuradas
- [ ] `POST /api/recognition/test` testa conexão com APIs (sem reconhecer áudio)
- [ ] Status inclui: apiConfigured, lastTestResult, lastTestAt
- [ ] Validação no startup (log warning se keys ausentes)

### AC-3: UI - Seção em Settings
- [ ] Nova seção "Reconhecimento Musical" na página Settings
- [ ] Campos para API keys (mascarados com ••••••)
- [ ] Dropdown para serviço preferido (ACRCloud / AudD / Automático)
- [ ] Slider para duração da amostra (5-15 segundos)
- [ ] Botão "Testar Conexão" com feedback visual
- [ ] Status: "✅ Configurado" ou "⚠️ Não configurado"

### AC-4: Segurança de API Keys
- [ ] API keys não são retornadas em GET (apenas status "configured" ou "not_configured")
- [ ] Keys são salvas em arquivo `.env.local` (não no banco)
- [ ] Backend recarrega keys quando atualizadas
- [ ] Keys nunca aparecem em logs

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
  preferredService: 'acrcloud' | 'audd' | 'auto';
  sampleDuration: number;
}

// POST /api/recognition/test
// Request: { service: 'acrcloud' | 'audd' }
// Response: { success: boolean; message: string; responseTime: number }

// PUT /api/recognition/config
// Request: { preferredService?: string; sampleDuration?: number }
// Response: { success: true }

// PUT /api/recognition/keys
// Request: { acrcloud?: { host, accessKey, accessSecret }; audd?: { token } }
// Response: { success: true }
// Nota: Keys são salvas em .env.local, não no banco
```

---

## Design da UI

```
┌─────────────────────────────────────────────────────────────────┐
│  🎵 Reconhecimento Musical                                      │
├─────────────────────────────────────────────────────────────────┤
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
│  ACRCloud                                    ✅ Configurado     │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ Host: identify-*.acrcloud.com                       │        │
│  └─────────────────────────────────────────────────────┘        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ Access Key: ••••••••••••••••                        │        │
│  └─────────────────────────────────────────────────────┘        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ Access Secret: ••••••••••••••••                     │        │
│  └─────────────────────────────────────────────────────┘        │
│                                     [Testar Conexão]            │
│                                                                 │
│  AudD                                        ⚠️ Não configurado │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ API Token: (não configurado)                        │        │
│  └─────────────────────────────────────────────────────┘        │
│                                     [Testar Conexão]            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                [Salvar]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação Técnica

### Arquivo .env.local

As API keys são salvas em `.env.local` para segurança:

```env
# Recognition API Keys (managed via UI)
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com
ACRCLOUD_ACCESS_KEY=abc123...
ACRCLOUD_ACCESS_SECRET=xyz789...
AUDD_API_TOKEN=token123...
```

### Backend - Atualização de Keys

```typescript
// PUT /api/recognition/keys
router.put('/keys', async (req, res) => {
  const { acrcloud, audd } = req.body;
  
  // Ler .env.local atual
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  
  // Atualizar valores
  if (acrcloud) {
    envContent = updateEnvVar(envContent, 'ACRCLOUD_HOST', acrcloud.host);
    envContent = updateEnvVar(envContent, 'ACRCLOUD_ACCESS_KEY', acrcloud.accessKey);
    envContent = updateEnvVar(envContent, 'ACRCLOUD_ACCESS_SECRET', acrcloud.accessSecret);
  }
  if (audd) {
    envContent = updateEnvVar(envContent, 'AUDD_API_TOKEN', audd.token);
  }
  
  // Salvar arquivo
  fs.writeFileSync(envPath, envContent);
  
  // Recarregar variáveis (dotenv não faz isso automaticamente)
  dotenv.config({ path: envPath, override: true });
  
  return res.json({ success: true });
});
```

---

## i18n Keys

```json
{
  "recognition": {
    "settings": {
      "title": "Reconhecimento Musical",
      "preferredService": "Serviço Preferido",
      "serviceAuto": "Automático (tenta ACRCloud, fallback AudD)",
      "serviceAcrcloud": "ACRCloud",
      "serviceAudd": "AudD",
      "sampleDuration": "Duração da Amostra",
      "seconds": "segundos",
      "configured": "Configurado",
      "notConfigured": "Não configurado",
      "testConnection": "Testar Conexão",
      "testing": "Testando...",
      "testSuccess": "Conexão OK ({{time}}ms)",
      "testError": "Erro: {{message}}",
      "host": "Host",
      "accessKey": "Access Key",
      "accessSecret": "Access Secret",
      "apiToken": "API Token",
      "save": "Salvar"
    }
  }
}
```

---

## Variáveis de Ambiente

```env
# Já definidas em V2-05, gerenciadas aqui via UI
ACRCLOUD_HOST=
ACRCLOUD_ACCESS_KEY=
ACRCLOUD_ACCESS_SECRET=
AUDD_API_TOKEN=
```

---

## Pré-requisitos

- [x] V2-05 - Reconhecimento Musical (serviço funcionando)

---

## Estimativa

- **Complexidade:** Média
- **Pontos:** 3
- **Tempo estimado:** 2-3 horas

---

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Recognition Service
- [PRD v3.0](../prd-v3.md) - Seção 5.2.2

---

## Funcionalidades Adiadas para V3

As seguintes funcionalidades foram adiadas para o Epic V3, quando teremos reconhecimento offline:

### Reconhecimento Automático (Timer Inteligente)
- Toggle "Reconhecimento Automático" 
- Agendamento baseado em `durationSeconds` do track anterior
- Intervalo mínimo configurável entre reconhecimentos
- Timer pausado/reiniciado com sessões

**Motivo do adiamento**: 
- Custo de API por chamada
- Sem detecção de troca de faixa confiável
- Em V3, com chromaprint local, será gratuito e preciso

---

## Histórico

| Data | Ação | Motivo |
|------|------|--------|
| 2025-12-06 | Simplificação | Adiar reconhecimento automático para V3; focar em configuração de APIs |
