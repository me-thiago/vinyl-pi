# Troubleshooting Session: Streaming Regression

**Data:** 2025-11-03
**Duração:** ~2h
**Status:** UNRESOLVED - Requer V1.5.1

---

## Contexto

Durante análise de latência do sistema, identificamos que o delay end-to-end estava em ~5 segundos. A investigação revelou:

### Latência Original (Funcionando)

| Componente | Latência | Observação |
|------------|----------|------------|
| ALSA buffer (1024 samples @ 48kHz) | 21ms | ✅ Otimizado |
| FFmpeg MP3 encoding (libmp3lame) | 50-70ms | ⚠️ Limitado (natureza algorítmica) |
| **Icecast burst-size (64KB @ 320kbps)** | **~1.6s** | 🔴 ALTO |
| Network (localhost) | <1ms | ✅ Mínimo |
| Browser HTML5 Audio buffer | 2-5s | 🔴 ALTO (sem controle) |
| Audio output | 10-50ms | ✅ Baixo |
| **TOTAL** | **~4-7s** | 🔴 Inaceitável |

### Plano de Otimização

1. ✅ **Reduzir Icecast `burst-size`**: 64KB → 8KB (~1.4s economia)
2. ✅ **Atualizar V1.6**: HTML5 Audio → Web Audio API (<500ms target)

**Resultado Esperado:** ~300-500ms end-to-end

---

## Cronologia do Problema

### ✅ Estado Inicial (2025-11-02)
```
Stream funcionando:
- config/icecast.xml: burst-size=65536, logdir=/home/thiago/.../logs
- FFmpeg → Icecast: ✅ Conectado
- Latência: ~5s (aceitável para teste, não otimizado)
```

### ⚠️ Tentativa 1: Reduzir burst-size (2025-11-03 05:13)
```diff
- <burst-size>65535</burst-size>
+ <burst-size>8192</burst-size>
```
```bash
sudo systemctl restart icecast2
curl -X POST http://localhost:3001/streaming/start
```
**Resultado:** FFmpeg exit code 1 (falha imediata)

### ⚠️ Tentativa 2: Aumentar para 16KB
```diff
- <burst-size>8192</burst-size>
+ <burst-size>16384</burst-size>
```
**Resultado:** FFmpeg exit code 1 (falha imediata)

### 🔍 Descoberta: Problema de Permissões
```
Erro Icecast:
FATAL: could not open error logging (/home/thiago/.../logs/error.log): Permission denied
```

**Fix Aplicado:**
```diff
- <logdir>/home/thiago/projects/vinyl-os/logs</logdir>
+ <logdir>/var/log/icecast2</logdir>

+ <security>
+   <changeowner>
+     <user>icecast2</user>
+     <group>icecast</group>
+   </changeowner>
+ </security>
```

**Resultado:** Icecast iniciou corretamente, mas FFmpeg ainda falha

### ⚠️ Tentativa 3: Reverter burst-size
```diff
- <burst-size>16384</burst-size>
+ <burst-size>65535</burst-size>  # Voltar ao original
```
**Resultado:** FFmpeg exit code 1 (AINDA FALHA!)

---

## Diagnóstico

### ✅ Icecast: Funcionando
```bash
curl http://localhost:8000
# ✅ Responde (página Icecast)

ps aux | grep icecast
# ✅ Processo rodando (PID 1263100)

sudo tail /var/log/icecast2/error.log
# ✅ Iniciou sem erros
```

### ❌ FFmpeg → Icecast: Falhando
```bash
# Via Backend (FALHA):
curl -X POST http://localhost:3001/streaming/start
# Backend: "Streaming started successfully"
# AudioManager log: [ERROR] FFmpeg exited with code 1

# Via Shell Manual (SUCESSO!):
timeout 120 ffmpeg -f alsa -i plughw:1,0 -ar 48000 -ac 2 \
  -acodec libmp3lame -ab 320k -b:a 320k -f mp3 \
  -content_type audio/mpeg \
  icecast://source:hackme@localhost:8000/stream
# ✅ Rodou por 2+ minutos sem erro (timeout)
```

### 🤔 Anomalia Crítica

**MESMO COMANDO** funciona manualmente mas falha via PM2/Node.js spawn!

Possíveis causas:
1. **Variáveis de ambiente**: Shell vs PM2 context
2. **Permissões**: Usuário `thiago` (shell) vs `thiago` (PM2) - mesmos, mas algo diferente?
3. **State race condition**: AudioManager reporta success mas processo morre
4. **Stdio pipes**: `stdio: ['ignore', 'ignore', 'pipe']` pode estar causando problema
5. **Timeout**: Spawn pode ter timeout muito curto
6. **ALSA device lock**: Manual executou enquanto backend tentava?

---

## Evidências Coletadas

### Logs do AudioManager
```
2025-11-03T10:35:27.009Z [INFO] Starting FFmpeg streaming with args:
  -f alsa -i plughw:1,0 -ar 48000 -ac 2 -acodec libmp3lame -ab 320k
  -b:a 320k -f mp3 -content_type audio/mpeg
  icecast://source:hackme@localhost:8000/stream
2025-11-03T10:35:27.013Z [INFO] Streaming started successfully to localhost:8000/stream
2025-11-03T10:35:27.286Z [ERROR] FFmpeg exited with code 1
```
**Tempo até falha:** ~270ms

### Logs do Icecast
```
[2025-11-03  05:38:28] EROR connection/_handle_connection Wrong request type from client
```
**Interpretação:** Icecast recebeu algo, mas não reconheceu como valid source

### Estado do Backend
```bash
curl http://localhost:3001/api/status
{
  "streaming": {
    "active": true,  # ❌ FALSO! Processo morreu
    "bitrate": 320,
    "mount_point": "/stream"
  }
}
```
**Estado inconsistente:** Backend acha que está streaming, mas não está

---

## Tentativas de Fix (Sem Sucesso)

1. ✅ Corrigir permissões de logs: `/var/log/icecast2`
2. ✅ Adicionar `<changeowner>` no security
3. ✅ Reverter `burst-size` para original
4. ✅ Reiniciar Icecast2 múltiplas vezes
5. ✅ Adicionar `ENABLE=true` em `/etc/default/icecast2`
6. ❌ Reiniciar PM2 backend (processo não existia no PM2)
7. ✅ Verificar device ALSA (plughw:1,0 disponível)

---

## Próximos Passos (V1.5.1)

### Investigação
- [ ] Capturar **stderr completo** do FFmpeg (atualmente apenas parseando erros)
- [ ] Adicionar **FFmpeg -loglevel debug** para verbose output
- [ ] Comparar **variáveis de ambiente**: `env` no shell vs PM2
- [ ] Verificar **file descriptors**: limite do processo PM2
- [ ] Testar **spawn com shell: true** (pode revelar diferenças)
- [ ] Adicionar **delay antes do spawn** (race condition?)

### Fix Temporário
- [ ] Criar script wrapper que executa FFmpeg via shell
- [ ] Adicionar retry logic no AudioManager (3 tentativas)
- [ ] Implementar health check do processo FFmpeg

### Fix Definitivo
- [ ] Identificar root cause da diferença shell vs spawn
- [ ] Corrigir estado inconsistente no AudioManager
- [ ] Adicionar monitoring de processo real vs flag `isStreaming`

---

## Arquivos Modificados

### Config (Atual)
```
/home/thiago/projects/vinyl-os/config/icecast.xml
- burst-size: 65535 (revertido)
- logdir: /var/log/icecast2 (corrigido)
- changeowner: icecast2:icecast (adicionado)
```

### Stories
```
docs/stories/v1/v1-05-pipeline-ffmpeg-icecast.md
- Status: blocked ⚠️
- Seção "Known Issues" adicionada

docs/stories/v1/v1-06-frontend-player-basico.md
- Título: "Frontend Player Básico (Baixa Latência)"
- AC: Web Audio API (não HTML5 Audio)
- Target: <500ms end-to-end
```

---

## Lições Aprendidas

1. **Sempre testar mudanças incrementalmente**: Alterar múltiplos valores ao mesmo tempo dificulta debug
2. **Manter backups de configs funcionais**: Reverter é mais difícil sem saber estado exato
3. **Spawn vs Shell tem diferenças sutis**: Variáveis de ambiente, permissões, stdio
4. **Estado inconsistente é perigoso**: Backend reporta success mas processo morreu
5. **Logs verbosos são essenciais**: FFmpeg stderr truncado não ajuda

---

## Referências

- **V1.5 Story:** `docs/stories/v1/v1-05-pipeline-ffmpeg-icecast.md`
- **V1.6 Story:** `docs/stories/v1/v1-06-frontend-player-basico.md`
- **AudioManager:** `backend/src/services/audio-manager.ts:226-270`
- **Icecast Config:** `config/icecast.xml`
- **Logs:** `/var/log/icecast2/error.log`, `backend/logs/audio-manager.log`

---

**Status Final:** BLOCKED - Requer investigação dedicada em V1.5.1
