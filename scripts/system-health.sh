#!/bin/bash

###############################################################################
# Vinyl-OS System Health Monitor
# Monitora saúde do sistema, memória, processos e potenciais memory leaks
###############################################################################

# Cores ANSI
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
RESET='\033[0m'

# Função para cabeçalho
print_header() {
    echo -e "${BOLD}${CYAN}"
    echo "═══════════════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════════════"
    echo -e "${RESET}"
}

# Função para seção
print_section() {
    echo -e "\n${BOLD}${BLUE}▶ $1${RESET}"
    echo "───────────────────────────────────────────────────────────────────────"
}

# Função para barra de progresso
print_bar() {
    local percent=$1
    local width=40
    local filled=$((percent * width / 100))
    local empty=$((width - filled))
    
    echo -n "["
    
    # Cor baseada no percentual
    if [ "$percent" -ge 80 ]; then
        echo -n -e "${RED}"
    elif [ "$percent" -ge 60 ]; then
        echo -n -e "${YELLOW}"
    else
        echo -n -e "${GREEN}"
    fi
    
    # Barra preenchida
    printf '%*s' "$filled" '' | tr ' ' '█'
    echo -n -e "${RESET}"
    
    # Barra vazia
    printf '%*s' "$empty" '' | tr ' ' '░'
    
    echo -n "] "
    printf "%3d%%" "$percent"
}

###############################################################################
# INÍCIO DO RELATÓRIO
###############################################################################

clear

print_header "🎵 VINYL-OS SYSTEM HEALTH MONITOR"
echo -e "${CYAN}Timestamp: $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo ""

###############################################################################
# 1. UPTIME & LOAD
###############################################################################
print_section "⏱️  System Uptime & Load"

UPTIME_INFO=$(uptime -p | sed 's/up //')
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | xargs)
LOAD_1MIN=$(echo "$LOAD_AVG" | awk -F',' '{print $1}' | xargs | cut -d'.' -f1)

echo "Uptime:        ${GREEN}${UPTIME_INFO}${RESET}"
echo "Load Average:  ${CYAN}${LOAD_AVG}${RESET}"

# Alerta se load > 2.0 (Pi tem 4 cores)
if [ "$LOAD_1MIN" -gt 2 ] 2>/dev/null; then
    echo -e "${YELLOW}⚠️  High load detected!${RESET}"
fi

###############################################################################
# 2. TEMPERATURA
###############################################################################
print_section "🌡️  Temperature"

if command -v vcgencmd &> /dev/null; then
    TEMP=$(vcgencmd measure_temp 2>/dev/null | grep -oP '\d+\.\d+' || echo "0")
    TEMP_INT=$(echo "$TEMP" | cut -d'.' -f1)
    
    echo -n "CPU Temp:      "
    if [ "$TEMP_INT" -gt 75 ]; then
        echo -e "${RED}● ${TEMP}°C${RESET}"
        echo -e "${RED}⚠️  Temperature too high! Consider cooling.${RESET}"
    elif [ "$TEMP_INT" -gt 65 ]; then
        echo -e "${YELLOW}◐ ${TEMP}°C${RESET}"
    else
        echo -e "${GREEN}✓ ${TEMP}°C${RESET}"
    fi
else
    echo -e "${YELLOW}vcgencmd not available${RESET}"
fi

###############################################################################
# 3. MEMÓRIA
###############################################################################
print_section "💾 Memory Usage"

# Ler free em MB
read -r MEM_TOTAL MEM_USED MEM_FREE MEM_SHARED MEM_BUFFERS MEM_AVAILABLE < <(
    free -m | awk '/^Mem:/ {print $2, $3, $4, $5, $6, $7}'
)

MEM_USED_PERCENT=$((MEM_USED * 100 / MEM_TOTAL))

echo "Total:         ${BOLD}${MEM_TOTAL} MB${RESET}"
echo "Used:          ${MEM_USED} MB (${MEM_USED_PERCENT}%)"
echo "Available:     ${GREEN}${MEM_AVAILABLE} MB${RESET}"
echo ""
echo -n "Usage:         "
print_bar "$MEM_USED_PERCENT"
echo ""
echo ""
echo "Breakdown:"
echo "  Free:        ${MEM_FREE} MB"
echo "  Shared:      ${MEM_SHARED} MB"
echo "  Buff/Cache:  ${MEM_BUFFERS} MB"

# Alerta se memória disponível < 500MB
if [ "$MEM_AVAILABLE" -lt 500 ]; then
    echo -e "\n${RED}⚠️  Low memory! Consider closing applications.${RESET}"
fi

# Swap
read -r SWAP_TOTAL SWAP_USED < <(
    free -m | awk '/^Swap:/ {print $2, $3}'
)

if [ "$SWAP_TOTAL" -gt 0 ]; then
    SWAP_USED_PERCENT=$((SWAP_USED * 100 / SWAP_TOTAL))
    echo ""
    echo "Swap Used:     ${SWAP_USED} MB (${SWAP_USED_PERCENT}%)"
    
    if [ "$SWAP_USED_PERCENT" -gt 50 ]; then
        echo -e "${YELLOW}⚠️  High swap usage - system may be slow${RESET}"
    fi
fi

###############################################################################
# 4. DISCO
###############################################################################
print_section "💿 Disk Usage"

# Root filesystem
DISK_INFO=$(df -h / | tail -1)
DISK_USED=$(echo "$DISK_INFO" | awk '{print $3}')
DISK_AVAIL=$(echo "$DISK_INFO" | awk '{print $4}')
DISK_PERCENT=$(echo "$DISK_INFO" | awk '{print $5}' | tr -d '%')

echo "Root (/):"
echo "  Used:        ${DISK_USED}"
echo "  Available:   ${DISK_AVAIL}"
echo -n "  Usage:       "
print_bar "$DISK_PERCENT"
echo ""

# /tmp (tmpfs - RAM!)
TMP_INFO=$(df -h /tmp | tail -1)
TMP_USED=$(echo "$TMP_INFO" | awk '{print $3}')
TMP_AVAIL=$(echo "$TMP_INFO" | awk '{print $4}')
TMP_PERCENT=$(echo "$TMP_INFO" | awk '{print $5}' | tr -d '%')

echo ""
echo "/tmp (tmpfs - uses RAM!):"
echo "  Used:        ${TMP_USED}"
echo "  Available:   ${TMP_AVAIL}"
echo -n "  Usage:       "
print_bar "$TMP_PERCENT"
echo ""

if [ "$TMP_PERCENT" -gt 20 ]; then
    echo -e "\n${YELLOW}⚠️  /tmp has large files (uses RAM!)${RESET}"
    echo "Large files in /tmp:"
    du -sh /tmp/* 2>/dev/null | sort -h | tail -5 | sed 's/^/  /' || true
fi

###############################################################################
# 5. VINYL-OS PROCESSOS
###############################################################################
print_section "🎵 Vinyl-OS Processes"

# PM2 Status
if command -v pm2 &> /dev/null; then
    echo "PM2 Processes:"
    pm2 jlist 2>/dev/null | jq -r '.[] | "  \(.name): \(.pm2_env.status) (mem: \(.monit.memory / 1024 / 1024 | floor)MB, cpu: \(.monit.cpu)%)"' 2>/dev/null || echo "  PM2 data not available"
    echo ""
fi

# Processos específicos
echo "Vinyl-OS Services:"

VINYL_TOTAL=0

# Backend (pode ser ts-node ou node dist/index.js)
BACKEND_PID=$(pgrep -f "node.*dist/index.js" | head -1 || pgrep -f "ts-node.*index.ts" | head -1 || true)
if [ -n "$BACKEND_PID" ]; then
    BACKEND_MEM=$(ps -o rss= -p "$BACKEND_PID" 2>/dev/null | awk '{print int($1/1024)}' || echo "0")
    BACKEND_CPU=$(ps -o %cpu= -p "$BACKEND_PID" 2>/dev/null | xargs || echo "0")
    BACKEND_UPTIME=$(ps -o etime= -p "$BACKEND_PID" 2>/dev/null | xargs || echo "?")
    echo -e "  ${GREEN}✓${RESET} Backend:               ${BACKEND_MEM} MB | CPU: ${BACKEND_CPU}% | Uptime: ${BACKEND_UPTIME}"
    VINYL_TOTAL=$((VINYL_TOTAL + BACKEND_MEM))
else
    echo -e "  ${RED}✗${RESET} Backend:               ${RED}NOT RUNNING${RESET}"
fi

# FFmpeg processes
FFMPEG_COUNT=$(pgrep ffmpeg | wc -l || echo "0")
if [ "$FFMPEG_COUNT" -gt 0 ]; then
    FFMPEG_MEM=$(pgrep ffmpeg | xargs ps -o rss= -p 2>/dev/null | awk '{sum+=$1} END {print int(sum/1024)}' || echo "0")
    FFMPEG_UPTIME=$(pgrep ffmpeg | head -1 | xargs ps -o etime= -p 2>/dev/null | xargs || echo "?")
    echo -e "  ${GREEN}✓${RESET} FFmpeg (${FFMPEG_COUNT} procs):     ${FFMPEG_MEM} MB | Uptime: ${FFMPEG_UPTIME}"
    VINYL_TOTAL=$((VINYL_TOTAL + FFMPEG_MEM))
else
    echo -e "  ${RED}✗${RESET} FFmpeg:                ${RED}NOT RUNNING${RESET}"
fi

# Icecast
ICECAST_PID=$(pgrep -f icecast2 | head -1 || true)
if [ -n "$ICECAST_PID" ]; then
    ICECAST_MEM=$(ps -o rss= -p "$ICECAST_PID" 2>/dev/null | awk '{print int($1/1024)}' || echo "0")
    ICECAST_UPTIME=$(ps -o etime= -p "$ICECAST_PID" 2>/dev/null | xargs || echo "?")
    echo -e "  ${GREEN}✓${RESET} Icecast:               ${ICECAST_MEM} MB | Uptime: ${ICECAST_UPTIME}"
    VINYL_TOTAL=$((VINYL_TOTAL + ICECAST_MEM))
else
    echo -e "  ${RED}✗${RESET} Icecast:               ${RED}NOT RUNNING${RESET}"
fi

# Frontend (Vite)
VITE_PID=$(pgrep -f "vite preview" | head -1 || true)
if [ -n "$VITE_PID" ]; then
    VITE_MEM=$(ps -o rss= -p "$VITE_PID" 2>/dev/null | awk '{print int($1/1024)}' || echo "0")
    echo -e "  ${GREEN}✓${RESET} Frontend (Vite):       ${VITE_MEM} MB"
    VINYL_TOTAL=$((VINYL_TOTAL + VITE_MEM))
else
    echo -e "  ${YELLOW}◐${RESET} Frontend:              ${YELLOW}NOT RUNNING${RESET}"
fi

echo ""
echo -e "${BOLD}Total Vinyl-OS Memory:   ${CYAN}${VINYL_TOTAL} MB${RESET}"

# FIFO status
echo ""
echo "Audio Pipeline:"
if [ -p /tmp/vinyl-audio.fifo ]; then
    FIFO_SIZE=$(ls -la /tmp/vinyl-audio.fifo 2>/dev/null | awk '{print $5}' || echo "0")
    echo -e "  ${GREEN}✓${RESET} FIFO exists:           /tmp/vinyl-audio.fifo"
else
    echo -e "  ${YELLOW}◐${RESET} FIFO:                  Not created (streaming not started?)"
fi

# API Health check
echo ""
echo "API Health:"
if [ -n "$BACKEND_PID" ]; then
    HEALTH_RESP=$(curl -s --max-time 2 http://localhost:3001/health 2>/dev/null || echo "")
    if [ -n "$HEALTH_RESP" ]; then
        echo -e "  ${GREEN}✓${RESET} /health:               OK"
    else
        echo -e "  ${RED}✗${RESET} /health:               ${RED}NOT RESPONDING${RESET}"
    fi

    STREAM_STATUS=$(curl -s --max-time 2 http://localhost:3001/streaming/status 2>/dev/null || echo "")
    if [ -n "$STREAM_STATUS" ]; then
        IS_ACTIVE=$(echo "$STREAM_STATUS" | jq -r '.active // false' 2>/dev/null || echo "false")
        if [ "$IS_ACTIVE" = "true" ]; then
            echo -e "  ${GREEN}✓${RESET} /streaming/status:     ACTIVE"
        else
            echo -e "  ${YELLOW}◐${RESET} /streaming/status:     Inactive"
        fi
    fi
else
    echo -e "  ${YELLOW}◐${RESET} Cannot check - backend not running"
fi

###############################################################################
# 6. TOP MEMORY CONSUMERS
###############################################################################
print_section "📊 Top Memory Consumers"

echo "Top 10 processes by memory:"
ps aux --sort=-rss | head -11 | tail -10 | awk '{
    mem = int($6/1024)
    printf "  %-20s %6d MB  %5s%%  %s\n", $1, mem, $3, $11
}' || true

###############################################################################
# 7. CURSOR IDE IMPACT
###############################################################################
print_section "💻 Cursor IDE Impact"

CURSOR_TOTAL=$(ps aux | grep -E "cursor|tsserver|claude" | grep -v grep | awk '{sum+=$6} END {print int(sum/1024)}' || echo "0")
CURSOR_COUNT=$(ps aux | grep -E "cursor|tsserver|claude" | grep -v grep | wc -l || echo "0")

if [ "$CURSOR_COUNT" -gt 0 ]; then
    echo "Cursor IDE is RUNNING:"
    echo "  Processes:     ${CURSOR_COUNT}"
    echo "  Total Memory:  ${CYAN}${CURSOR_TOTAL} MB${RESET}"
    
    if [ "$CURSOR_TOTAL" -gt 1500 ]; then
        echo -e "  ${YELLOW}⚠️  High memory usage - consider reloading window${RESET}"
    fi
else
    echo -e "${GREEN}Cursor IDE is not running${RESET}"
fi

###############################################################################
# 8. EVENTBUS SAFETY CHECK
###############################################################################
print_section "🛡️  EventBus Memory Leak Check"

# Verificar se backend está rodando
if [ -n "$BACKEND_PID" ]; then
    echo "Backend Memory:    ${BACKEND_MEM} MB"
    
    # Regras de thumb para detectar leak
    if [ "$BACKEND_MEM" -gt 500 ]; then
        echo -e "${RED}⚠️  Backend memory unusually high (>500MB)${RESET}"
        echo "   Consider checking for EventBus memory leaks"
    elif [ "$BACKEND_MEM" -gt 300 ]; then
        echo -e "${YELLOW}⚠️  Backend memory elevated (>300MB)${RESET}"
        echo "   Monitor for continued growth"
    else
        echo -e "${GREEN}✓ Backend memory looks healthy${RESET}"
    fi
else
    echo -e "${YELLOW}Backend not running - cannot check${RESET}"
fi

###############################################################################
# 9. RECENT ERRORS (PM2 Logs)
###############################################################################
print_section "📋 Recent Errors (last 5)"

if command -v pm2 &> /dev/null; then
    RECENT_ERRORS=$(pm2 logs vinyl-backend --lines 50 --nostream --err 2>/dev/null | grep -i "error\|fail\|crash" | tail -5 || true)
    if [ -n "$RECENT_ERRORS" ]; then
        echo -e "${YELLOW}Recent backend errors:${RESET}"
        echo "$RECENT_ERRORS" | sed 's/^/  /'
    else
        echo -e "${GREEN}✓ No recent errors in backend logs${RESET}"
    fi
else
    echo "PM2 not available"
fi

###############################################################################
# 10. STREAMING HEALTH
###############################################################################
print_section "📡 Streaming Health"

# Verificar stream Icecast
if command -v curl &> /dev/null && [ -n "$ICECAST_PID" ]; then
    STREAM_STATUS=$(curl -s http://localhost:8000/status-json.xsl 2>/dev/null || true)

    if [ -n "$STREAM_STATUS" ]; then
        STREAM_START=$(echo "$STREAM_STATUS" | jq -r '.icestats.server_start // "Unknown"' 2>/dev/null || echo "Unknown")
        echo -e "${GREEN}✓ Icecast is responding${RESET}"
        echo "  Server start:  $STREAM_START"

        # Verificar se há source ativa
        HAS_SOURCE=$(echo "$STREAM_STATUS" | jq '.icestats.source // empty' 2>/dev/null || true)
        if [ -n "$HAS_SOURCE" ]; then
            LISTENERS=$(echo "$STREAM_STATUS" | jq -r '.icestats.source.listeners // 0' 2>/dev/null || echo "0")
            BITRATE=$(echo "$STREAM_STATUS" | jq -r '.icestats.source.bitrate // "Unknown"' 2>/dev/null || echo "Unknown")
            echo -e "  ${GREEN}✓ Stream is ACTIVE${RESET}"
            echo "  Listeners:     $LISTENERS"
            echo "  Bitrate:       $BITRATE kbps"
        else
            echo -e "  ${YELLOW}◐ No active source${RESET}"
        fi
    else
        echo -e "${RED}✗ Cannot connect to Icecast${RESET}"
    fi
else
    echo -e "${YELLOW}Cannot check stream status${RESET}"
fi

# Network connections
echo ""
echo "Network Connections:"
ICECAST_CONNS=$(ss -tn 2>/dev/null | grep ":8000" | wc -l || echo "0")
BACKEND_CONNS=$(ss -tn 2>/dev/null | grep ":3001" | wc -l || echo "0")
FRONTEND_CONNS=$(ss -tn 2>/dev/null | grep ":5173" | wc -l || echo "0")
echo "  Icecast (:8000):     ${ICECAST_CONNS} connections"
echo "  Backend (:3001):     ${BACKEND_CONNS} connections"
echo "  Frontend (:5173):    ${FRONTEND_CONNS} connections"

###############################################################################
# 11. RECOMENDAÇÕES
###############################################################################
print_section "💡 Recommendations"

RECOMMENDATIONS=()

# Memória
if [ "$MEM_AVAILABLE" -lt 500 ]; then
    RECOMMENDATIONS+=("${RED}⚠️  Low memory! Close unused applications${RESET}")
elif [ "$MEM_AVAILABLE" -lt 1000 ]; then
    RECOMMENDATIONS+=("${YELLOW}⚠️  Memory getting low - monitor closely${RESET}")
fi

# Temperatura
if command -v vcgencmd &> /dev/null; then
    TEMP_INT=$(vcgencmd measure_temp 2>/dev/null | grep -oP '\d+\.\d+' | cut -d'.' -f1 || echo "0")
    if [ "$TEMP_INT" -gt 75 ]; then
        RECOMMENDATIONS+=("${RED}⚠️  High temperature! Add cooling${RESET}")
    elif [ "$TEMP_INT" -gt 65 ]; then
        RECOMMENDATIONS+=("${YELLOW}⚠️  Temperature elevated - ensure good ventilation${RESET}")
    fi
fi

# Cursor
if [ "$CURSOR_TOTAL" -gt 2000 ]; then
    RECOMMENDATIONS+=("${YELLOW}💡 Cursor using ${CURSOR_TOTAL}MB - consider reloading window (Ctrl+Shift+P → Reload Window)${RESET}")
fi

# Swap
if [ "$SWAP_USED_PERCENT" -gt 50 ] 2>/dev/null; then
    RECOMMENDATIONS+=("${YELLOW}⚠️  High swap usage - system may be slow${RESET}")
fi

# Backend memory
if [ -n "$BACKEND_PID" ] && [ "$BACKEND_MEM" -gt 500 ]; then
    RECOMMENDATIONS+=("${RED}⚠️  Backend memory very high - check for memory leaks${RESET}")
fi

# /tmp usage
if [ "$TMP_PERCENT" -gt 20 ]; then
    RECOMMENDATIONS+=("${YELLOW}⚠️  /tmp has large files using RAM - run: du -sh /tmp/* | sort -h${RESET}")
fi

# Mostrar recomendações
if [ ${#RECOMMENDATIONS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ System is healthy! No issues detected.${RESET}"
else
    for rec in "${RECOMMENDATIONS[@]}"; do
        echo -e "$rec"
    done
fi

###############################################################################
# RODAPÉ
###############################################################################
echo ""
print_header "End of Report"
echo -e "${CYAN}Run this script anytime: ./scripts/system-health.sh${RESET}"
echo ""
