# Plano: Migração para Always-On Streaming

**Data:** 2025-11-07  
**Status:** 📋 PLANEJADO (não implementado)  
**Prioridade:** ALTA

---

## 🎯 Objetivo

Migrar de streaming baseado em "sessões" (start/stop manual) para streaming **always-on** (sempre ativo), alinhando o comportamento do sistema com o conceito de um toca-discos real.

---

## 🤔 Contexto e Motivação

### Problema Atual
- Frontend tem botões "Iniciar/Parar Streaming"
- Cliente precisa esperar 2-3s para FFmpeg iniciar
- Múltiplos clientes podem causar conflitos (quem controla?)
- Experiência não é "instantânea"
- Erro `ERR_CONNECTION_REFUSED` quando frontend tenta conectar em `localhost:3001` de outro dispositivo

### ⚠️ IMPORTANTE: Sessões vs Streaming

**Conceitos diferentes que não devem ser confundidos:**

- **Sessão** = Período de escuta de vinis (conceito de negócio)
  - Detectada por eventos sonoros (início de áudio após silêncio)
  - Termina após silêncio prolongado (30min padrão)
  - Rastreada na tabela `sessions` do banco
  - Essencial para V2 (reconhecimento musical) e V3 (gravações)

- **Streaming** = Estado técnico do backend (sempre ativo ou não)
  - FFmpeg rodando continuamente
  - Icecast2 disponível 24/7
  - Frontend conecta instantaneamente

**Este plano trata apenas de tornar o STREAMING always-on. O conceito e tabela de SESSÕES permanecem intactos no PRD V1!**

### Por Que Always-On?

**1. Conceito de Toca-Discos Real**
- Toca-discos não tem "start/stop"
- Está sempre pronto para tocar
- Você só coloca o disco e abaixa a agulha

**2. Experiência de Usuário**
- ✅ Conexão instantânea (sem espera)
- ✅ Múltiplos clientes sem conflitos
- ✅ Comportamento previsível
- ✅ Igual a uma rádio/stream real

**3. Recursos Não São Problema**
```
FFmpeg PCM:  ~10MB RAM, ~2% CPU
FFmpeg MP3:  ~10MB RAM, ~3% CPU
Total:       ~20MB RAM, ~5% CPU

Pi disponível: 8GB RAM, load < 0.3
Impacto: MÍNIMO
```

**4. Mais Robusto**
- FFmpeg supervisionado pelo PM2
- Auto-restart se crashar (já implementado)
- Sem race conditions de start/stop
- Health monitor garante uptime

---

## ⏱️ Timing e Pré-requisitos

**IMPORTANTE: Este plano deve ser implementado APÓS:**

- ✅ V1-06: Frontend Player Básico (DONE)
- ⏳ V1-07: EventBus Core (IN PROGRESS)
- ⏳ V1-08: Detecção de Silêncio (REQUIRED)

**Razão:** Detecção de silêncio é prerequisito para auto-detect de sessões em modo always-on. Sem isso, sistema não consegue determinar início/fim de sessões automaticamente.

**Status:** 📋 PLANEJADO (aguardando V1-08)

---

## 📋 Plano de Implementação

### Fase 1: Backend Auto-Start ✅ PRIORITÁRIO

#### 1.1. Corrigir API_BASE_URL no Frontend

**Problema:** Frontend usa `localhost:3001` hardcoded, falha quando acessado de outro dispositivo.

**Arquivo:** `frontend/src/hooks/useStreamingControl.ts`

**Mudança:**
```typescript
// ANTES:
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// DEPOIS:
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  `http://${window.location.hostname}:3001`;
```

**Resultado:** Frontend conecta corretamente em `pi.local:3001` ou qualquer hostname.

---

#### 1.2. Auto-Start Streaming no Boot

**Arquivo:** `backend/src/index.ts`

**Adicionar após `app.listen()`:**
```typescript
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Auto-start streaming on boot
  try {
    const streamingConfig = {
      icecastHost: process.env.ICECAST_HOST || 'localhost',
      icecastPort: parseInt(process.env.ICECAST_PORT || '8000'),
      icecastPassword: process.env.ICECAST_SOURCE_PASSWORD || 'hackme',
      mountPoint: process.env.ICECAST_MOUNT_POINT || '/stream',
      bitrate: 128,
      fallbackSilence: true
    };
    
    await audioManager.startStreaming(streamingConfig);
    console.log('✅ Always-On Streaming started automatically');
    console.log(`   PCM: http://localhost:${PORT}/stream.wav`);
    console.log(`   MP3: http://localhost:${streamingConfig.icecastPort}${streamingConfig.mountPoint}`);
  } catch (err) {
    console.error('⚠️  Failed to auto-start streaming:', err);
    console.error('   Will retry via Health Monitor...');
  }
});
```

**Resultado:** Streaming inicia automaticamente quando backend sobe.

---

#### 1.3. Health Monitor Garante Uptime

**Arquivo:** `backend/src/services/health-monitor.ts`

**Adicionar novo check:**
```typescript
/**
 * Verifica se streaming está ativo e tenta restart se necessário
 * @private
 */
private async checkStreamingHealth(): Promise<void> {
  const status = this.audioManager.getStreamingStatus();
  
  if (!status.active) {
    logger.warn('Streaming is down, attempting auto-restart...');
    
    try {
      await this.audioManager.startStreaming({
        icecastHost: 'localhost',
        icecastPort: 8000,
        icecastPassword: 'hackme',
        mountPoint: '/stream',
        bitrate: 128,
        fallbackSilence: true
      });
      
      logger.info('✅ Streaming auto-restarted successfully');
      this.emit('streaming_recovered');
    } catch (err) {
      logger.error(`Failed to auto-restart streaming: ${err}`);
      this.emit('streaming_failed', { error: err });
    }
  }
}

// Adicionar no performHealthCheck():
private async performHealthCheck(): Promise<void> {
  const timestamp = Date.now();
  
  // Check 1: Uso de memória
  const memoryMb = this.checkMemoryUsage();
  
  // Check 2: Memory leak detection
  this.checkMemoryLeak(timestamp, memoryMb);
  
  // Check 3: Processos FFmpeg órfãos
  await this.checkOrphanProcesses();
  
  // Check 4: Streaming health (NOVO)
  await this.checkStreamingHealth();
  
  // ... resto do código
}
```

**Resultado:** Se streaming cair, Health Monitor tenta restart automático.

---

### Fase 2: Frontend Simplificado 🎨

#### ⚠️ IMPORTANTE: Manter Conceito de Sessões

**O que REMOVER:**
- Botões "Iniciar/Parar Streaming" (controle técnico)
- Hook `useStreamingControl` (se for apenas para start/stop)

**O que MANTER:**
- Tabela e conceito de `sessions` (PRD requirement)
- Dashboard mostrando sessões (histórico de escuta)
- Detecção automática de sessões via eventos sonoros
- UI que mostra "Sessão Ativa" quando tocando discos

**Sessões são parte do core V1 e essenciais para V2/V3!**

---

#### 2.1. Opção A: Remover Controles de Streaming (Recomendado)

**Arquivo:** `frontend/src/components/Player/Player.tsx`

**Remover:**
- Hook `useStreamingControl` (se usado apenas para start/stop)
- Seção "Backend Streaming" com botões start/stop
- Lógica de disable do Play baseado em `backendStreaming`

**Manter/Adicionar:**
- Indicador de status read-only: "Streaming: Always On 🟢"
- Dashboard de sessões (histórico, duração, eventos)
- Player sempre habilitado (streaming sempre ativo)

**Simplificar para:**
```typescript
// Remover controles de streaming manual
// Deixar apenas:
// - Vinyl Visualizer
// - Play/Pause (sempre habilitado)
// - Volume
// - Latency badge
// - Status indicator (streaming always on)
// - Dashboard de Sessões (manter!)
```

**Resultado:** UI mais limpa, foco no playback, mas mantém rastreamento de sessões.

---

#### 2.2. Opção B: Manter Controles para Debug (Alternativa)

Se quiser manter controles para debug/admin:

**Mudanças:**
1. Adicionar toggle "Advanced Controls" (colapsável)
2. Mostrar status read-only: "Streaming: Always On 🟢"
3. Botões start/stop apenas em modo debug
4. Adicionar badge "Always-On Mode" no header

**Resultado:** Funcionalidade preservada para troubleshooting.

---

### Fase 3: Configuração de Produção 🚀

#### 3.1. Variáveis de Ambiente

**Arquivo:** `backend/.env`

Adicionar:
```bash
# Always-On Streaming
AUTO_START_STREAMING=true
STREAMING_AUTO_RESTART=true

# Audio Device
AUDIO_DEVICE=plughw:0,0
AUDIO_SAMPLE_RATE=48000
AUDIO_CHANNELS=2
AUDIO_BUFFER_SIZE=1024

# Icecast
ICECAST_HOST=localhost
ICECAST_PORT=8000
ICECAST_SOURCE_PASSWORD=hackme
ICECAST_MOUNT_POINT=/stream
ICECAST_BITRATE=128
```

---

#### 3.2. PM2 Ecosystem (Opcional)

**Arquivo:** `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'vinyl-os-icecast',
      script: '/usr/bin/icecast2',
      args: '-c /home/thiago/projects/vinyl-os/config/icecast.xml',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'vinyl-backend',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/thiago/projects/vinyl-os/backend',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
        AUTO_START_STREAMING: 'true'
      }
    }
  ]
};
```

**Deploy:**
```bash
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

---

### Fase 4: Documentação e Testes 📝

#### 4.1. Atualizar README

**Arquivo:** `README.md`

Adicionar seção:
```markdown
## Always-On Streaming

O Vinyl-OS opera em modo **always-on**, simulando um toca-discos real:

- ✅ Streaming inicia automaticamente no boot
- ✅ Sempre pronto para conexões
- ✅ Auto-restart se FFmpeg crashar
- ✅ Supervisionado pelo Health Monitor

### Endpoints Disponíveis

- **PCM (baixa latência):** `http://pi.local:3001/stream.wav`
- **MP3 (Icecast):** `http://pi.local:8000/stream`

### Troubleshooting

**Streaming não inicia:**
```bash
# Verificar logs
pm2 logs vinyl-backend

# Verificar device de áudio
arecord -l

# Restart manual
curl -X POST http://localhost:3001/streaming/start
```
```

---

#### 4.2. Testes de Validação

**Checklist:**

- [ ] Backend inicia e auto-start funciona
- [ ] FFmpeg processes aparecem: `ps aux | grep ffmpeg`
- [ ] PCM stream acessível: `curl -I http://localhost:3001/stream.wav`
- [ ] MP3 stream acessível: `curl -I http://localhost:8000/stream`
- [ ] Frontend conecta sem erros de CORS
- [ ] Múltiplos clientes podem conectar simultaneamente
- [ ] Memória estável após 1h: `pm2 monit`
- [ ] Crash recovery funciona: `pm2 restart vinyl-backend`
- [ ] Health monitor detecta e recupera: verificar logs

---

## 📊 Comparação Antes/Depois

| Aspecto | Sessão (Atual) | Always-On (Planejado) |
|---------|----------------|----------------------|
| **Tempo de conexão** | 2-3s (espera FFmpeg) | Instantâneo ✅ |
| **Múltiplos clientes** | Conflitos possíveis | Sem conflitos ✅ |
| **Experiência** | "Servidor" | "Toca-discos real" ✅ |
| **Complexidade UI** | Botões start/stop | Simples ✅ |
| **Robustez** | Depende de cliente | Supervisionado ✅ |
| **Recursos** | 0MB parado, 20MB ativo | 20MB sempre (~0.25% RAM) |
| **Uptime** | Intermitente | 24/7 ✅ |

---

## ⚠️ Considerações Importantes

### 1. Device de Áudio Sempre Ocupado
- FFmpeg mantém device ALSA aberto 24/7
- Outros apps não podem usar simultaneamente
- **Solução:** No Vinyl-OS, isso é desejado (uso dedicado)

### 2. Erro se Device Não Conectado
- Se toca-discos desconectado, FFmpeg falha
- **Solução:** Health monitor tenta reconectar automaticamente
- **Fallback:** Logs claros para troubleshooting

### 3. Consumo de Recursos
- ~20MB RAM, ~5% CPU constante
- **Impacto:** Mínimo em Pi com 8GB RAM
- **Benefício:** Experiência instantânea vale a pena

### 4. Rede (Icecast MP3)
- MP3 128kbps = ~1MB/min = ~60MB/hora
- **Solução:** Só transmite se há clientes conectados
- **Impacto:** Praticamente zero se não houver ouvintes

---

## 🎯 Priorização de Tarefas

### Sprint 1: Backend Always-On (CRÍTICO)
1. ✅ Corrigir `API_BASE_URL` no frontend (5 min)
2. ✅ Adicionar auto-start no `index.ts` (10 min)
3. ✅ Adicionar streaming health check (20 min)
4. ✅ Testar boot-to-streaming (15 min)

**Tempo estimado:** ~1 hora  
**Impacto:** ALTO (resolve problema principal)

---

### Sprint 2: Frontend Simplificado (MÉDIO)
1. ⏳ Remover controles de streaming (15 min)
2. ⏳ Atualizar testes (10 min)
3. ⏳ Validar UX (10 min)

**Tempo estimado:** ~35 min  
**Impacto:** MÉDIO (melhora UX)

---

### Sprint 3: Produção (BAIXO)
1. ⏳ Configurar `.env` (5 min)
2. ⏳ Criar `ecosystem.config.js` (10 min)
3. ⏳ Atualizar documentação (20 min)
4. ⏳ Testes de longa duração (24h)

**Tempo estimado:** ~35 min + 24h validação  
**Impacto:** BAIXO (polish)

---

## 🚀 Quick Start para Implementação

**Para iniciar a implementação, execute:**

```bash
# 1. Corrigir frontend
cd /home/thiago/projects/vinyl-os/frontend
# Editar src/hooks/useStreamingControl.ts (linha 21)

# 2. Adicionar auto-start no backend
cd /home/thiago/projects/vinyl-os/backend
# Editar src/index.ts (após app.listen)

# 3. Atualizar health monitor
# Editar src/services/health-monitor.ts

# 4. Testar
pm2 restart vinyl-backend
pm2 logs vinyl-backend --lines 50

# 5. Validar
curl -I http://localhost:3001/stream.wav
curl -I http://localhost:8000/stream
```

---

## 📚 Referências

- **Documentação Atual:**
  - `docs/stability-improvements.md` - Melhorias de estabilidade
  - `docs/memory-leak-fix.md` - Correção de memory leak
  - `docs/technical-decisions.md` - Decisões técnicas

- **Código Relevante:**
  - `backend/src/services/audio-manager.ts` - Gerenciamento de streaming
  - `backend/src/services/health-monitor.ts` - Monitoramento de saúde
  - `backend/src/index.ts` - Entry point do backend
  - `frontend/src/hooks/useStreamingControl.ts` - Controle de streaming

- **Issues Relacionadas:**
  - Memory leak no broadcaster (RESOLVIDO)
  - FFmpeg cleanup melhorado (RESOLVIDO)
  - Health monitoring implementado (RESOLVIDO)

---

## ✅ Critérios de Sucesso

**A migração será considerada bem-sucedida quando:**

1. ✅ Backend inicia streaming automaticamente no boot
2. ✅ Frontend conecta sem `ERR_CONNECTION_REFUSED`
3. ✅ Múltiplos clientes podem conectar simultaneamente
4. ✅ Streaming permanece ativo 24/7 sem intervenção
5. ✅ Health monitor recupera automaticamente de crashes
6. ✅ Memória permanece estável < 200MB por 24h
7. ✅ Latência mantém < 500ms
8. ✅ Experiência é "instantânea" (sem espera)

---

## 🎵 Conclusão

A migração para **always-on streaming** alinha o Vinyl-OS com o conceito de um toca-discos real, oferecendo:

- **Melhor UX:** Conexão instantânea
- **Mais Simples:** Menos código, menos bugs
- **Mais Robusto:** Supervisionado 24/7
- **Mais Realista:** Comportamento de toca-discos real

**Custo:** ~20MB RAM (~0.25% do total)  
**Benefício:** Experiência profissional e confiável

**Recomendação:** IMPLEMENTAR ✅

