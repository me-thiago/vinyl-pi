# 🎵 Vinyl-OS System Health Monitor

Script de monitoramento completo do sistema Vinyl-OS com dashboard ASCII colorido.

## 📊 O que ele monitora?

### 1. **Sistema**
- ⏱️ Uptime & Load Average
- 🌡️ Temperatura da CPU (Raspberry Pi)
- 💾 Memória RAM (total, usado, disponível, breakdown)
- 💿 Uso de disco (root + /tmp)

### 2. **Vinyl-OS**
- 🎵 Status de todos os serviços PM2
- Backend (ts-node) - memória e CPU
- FFmpeg (2 processos) - captura + streaming
- Icecast - servidor de streaming
- Frontend (Vite) - servidor web

### 3. **Performance**
- 📊 Top 10 processos por uso de memória
- 💻 Impacto do Cursor IDE (se rodando)
- 🛡️ Detecção de memory leaks no EventBus
- 📡 Health check do streaming Icecast

### 4. **Alertas Inteligentes**
- 🔴 Memória baixa (< 500MB disponível)
- 🔴 Temperatura alta (> 75°C)
- 🟡 Uso elevado de swap
- 🟡 Backend com memória suspeita (> 300MB)
- 🟡 Arquivos grandes em /tmp (usa RAM!)
- 🟡 Cursor IDE com memória alta (> 2GB)

## 🚀 Como usar

### Execução simples:
```bash
./scripts/system-health.sh
```

### Adicionar ao PATH (opcional):
```bash
# No ~/.bashrc ou ~/.zshrc:
alias health='cd /home/thiago/projects/vinyl-os && ./scripts/system-health.sh'

# Depois:
health  # de qualquer lugar!
```

### Monitoramento contínuo:
```bash
# Atualizar a cada 30 segundos
watch -n 30 -c ./scripts/system-health.sh

# Ou salvar histórico:
./scripts/system-health.sh >> logs/health-$(date +%Y%m%d).log
```

## 📸 Exemplo de saída

```
═══════════════════════════════════════════════════════════════════════
  🎵 VINYL-OS SYSTEM HEALTH MONITOR
═══════════════════════════════════════════════════════════════════════

Timestamp: 2025-11-28 21:38:11

▶ ⏱️  System Uptime & Load
───────────────────────────────────────────────────────────────────────
Uptime:        3 weeks, 15 hours, 36 minutes
Load Average:  0.30, 0.37, 0.31

▶ 🌡️  Temperature
───────────────────────────────────────────────────────────────────────
CPU Temp:      ✓ 58.2°C

▶ 💾 Memory Usage
───────────────────────────────────────────────────────────────────────
Total:         8063 MB
Used:          3609 MB (44%)
Available:     4453 MB

Usage:         [████████████████░░░░░░░░░░░░░░░░░░░░░░░░]  44%

Breakdown:
  Free:        3961 MB
  Shared:      27 MB
  Buff/Cache:  819 MB

▶ 🎵 Vinyl-OS Processes
───────────────────────────────────────────────────────────────────────
PM2 Processes:
  vinyl-backend: online (mem: 53MB, cpu: 0.2%)
  vinyl-os-icecast: online (mem: 16MB, cpu: 0%)
  vinyl-frontend: online (mem: 56MB, cpu: 0.1%)

Vinyl-OS Services:
  ✓ Backend (ts-node):    180 MB | CPU: 0.9%
  ✓ FFmpeg (2 processes): 187 MB
  ✓ Icecast:               17 MB
  ✓ Frontend (Vite):       83 MB

Total Vinyl-OS Memory:   467 MB

▶ 💡 Recommendations
───────────────────────────────────────────────────────────────────────
✓ System is healthy! No issues detected.
```

## 🎨 Recursos visuais

- **Cores:** Verde (OK), Amarelo (Atenção), Vermelho (Crítico)
- **Barras de progresso:** Uso de memória/disco/swap
- **Símbolos:** ✓ (OK), ◐ (Warning), ✗ (Error), ● (Critical)
- **Formatação:** Bold para valores importantes, Cyan para títulos

## 🔧 Dependências

### Obrigatórias:
- `bash` (já vem no Raspberry Pi OS)
- `ps`, `free`, `df`, `uptime` (coreutils)
- `awk`, `grep`, `sed` (textutils)

### Opcionais (para recursos extras):
- `vcgencmd` - temperatura da CPU (Raspberry Pi)
- `jq` - parsing JSON do PM2 e Icecast
- `curl` - health check do Icecast
- `pm2` - status dos serviços Vinyl-OS

## 🐛 Troubleshooting

### Script não executa:
```bash
# Garantir que é executável
chmod +x scripts/system-health.sh
```

### "vcgencmd not found":
```bash
# Normal se não for Raspberry Pi
# Temperatura será marcada como "not available"
```

### "jq not found":
```bash
# Instalar jq (opcional)
sudo apt install jq
```

### Cores não aparecem:
```bash
# Seu terminal pode não suportar cores ANSI
# Script funcionará, mas sem cores
```

## 📈 Interpretando os resultados

### Memória:
- **< 40% usado:** ✅ Excelente
- **40-60% usado:** ✅ Normal
- **60-80% usado:** ⚠️ Atenção
- **> 80% usado:** 🔴 Crítico

### CPU Load (Pi 4 com 4 cores):
- **< 1.0:** ✅ Excelente
- **1.0-2.0:** ✅ Normal
- **2.0-4.0:** ⚠️ Alto
- **> 4.0:** 🔴 Sobrecarga

### Temperatura:
- **< 60°C:** ✅ Ótimo
- **60-65°C:** ✅ Normal
- **65-75°C:** ⚠️ Elevado
- **> 75°C:** 🔴 Muito alto

### Vinyl-OS Memory:
- **Backend < 200MB:** ✅ Esperado
- **Backend 200-300MB:** ⚠️ Monitorar
- **Backend > 300MB:** 🔴 Possível leak

## 🎯 Casos de uso

### Debug de performance:
```bash
# Sistema está lento?
./scripts/system-health.sh

# Verificar: CPU load, memória disponível, swap usage
```

### Detecção de memory leak:
```bash
# Executar a cada hora e comparar backend memory
./scripts/system-health.sh | tee -a logs/health.log

# Se backend memory crescer constantemente: leak!
```

### Monitoramento do Cursor IDE:
```bash
# Cursor usando muita RAM?
./scripts/system-health.sh

# Veja seção "Cursor IDE Impact"
# Se > 2GB: Reload Window (Ctrl+Shift+P)
```

### Verificar arquivos em /tmp:
```bash
# /tmp usa RAM (tmpfs)!
./scripts/system-health.sh

# Se "Large files in /tmp" aparecer:
du -sh /tmp/* | sort -h
rm /tmp/arquivo-grande.mp3
```

## 📝 Histórico

- **2025-11-28:** Criação inicial
  - Resolveu mistério de 1.9GB de memória crescente
  - Identificou Icecast dump-file (464MB em RAM)
  - Detectou Cursor IDE usando 3GB

## 🤝 Contribuindo

Se encontrar bugs ou tiver sugestões:
1. Edite `scripts/system-health.sh`
2. Teste: `./scripts/system-health.sh`
3. Commit: `git commit -m "fix(monitoring): ..."`

## 📄 Licença

Parte do projeto Vinyl-OS - Uso interno

