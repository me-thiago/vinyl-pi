#!/bin/bash

###############################################################################
# Vinyl-OS Audio Pipeline Monitor
# Mostra diagrama ASCII do fluxo de áudio com status em tempo real
###############################################################################

# Cores ANSI
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# Box drawing characters
H_LINE="─"
V_LINE="│"
TL_CORNER="┌"
TR_CORNER="┐"
BL_CORNER="└"
BR_CORNER="┘"
T_DOWN="┬"
T_UP="┴"
T_RIGHT="├"
T_LEFT="┤"
CROSS="┼"
ARROW_R="→"
ARROW_D="↓"

###############################################################################
# FUNÇÕES AUXILIARES
###############################################################################

# Verificar se serviço está rodando
check_service() {
    local name="$1"
    local pattern="$2"
    if pgrep -f "$pattern" > /dev/null 2>&1; then
        echo -e "${GREEN}●${RESET}"
    else
        echo -e "${RED}○${RESET}"
    fi
}

# Verificar se FIFO existe
check_fifo() {
    local path="$1"
    if [ -p "$path" ]; then
        echo -e "${GREEN}●${RESET}"
    else
        echo -e "${DIM}○${RESET}"
    fi
}

# Formatar bytes para humano
format_bytes() {
    local bytes=$1
    bytes=${bytes:-0}
    if [ "$bytes" -gt 1073741824 ]; then
        echo "$((bytes / 1073741824))GB"
    elif [ "$bytes" -gt 1048576 ]; then
        echo "$((bytes / 1048576))MB"
    elif [ "$bytes" -gt 1024 ]; then
        echo "$((bytes / 1024))KB"
    else
        echo "${bytes}B"
    fi
}

# Barra de progresso mini
mini_bar() {
    local percent_raw=$1
    # Remove decimal part for arithmetic
    local percent=${percent_raw%.*}
    percent=${percent:-0}
    
    local width=10
    local filled=$((percent * width / 100))
    local empty=$((width - filled))
    
    if [ "$percent" -ge 80 ]; then
        echo -n -e "${GREEN}"
    elif [ "$percent" -ge 50 ]; then
        echo -n -e "${YELLOW}"
    else
        echo -n -e "${RED}"
    fi
    
    printf '%*s' "$filled" '' | tr ' ' '█'
    echo -n -e "${DIM}"
    printf '%*s' "$empty" '' | tr ' ' '░'
    echo -n -e "${RESET}"
}

###############################################################################
# COLETA DE DADOS
###############################################################################

clear
echo -e "${BOLD}${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║           🎵 VINYL-OS AUDIO PIPELINE MONITOR                              ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "${DIM}$(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo ""

###############################################################################
# 1. PM2 SERVICES
###############################################################################

echo -e "${BOLD}${WHITE}═══ PM2 SERVICES ═══${RESET}"
echo ""

# Backend
BACKEND_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="vinyl-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")
BACKEND_MEM=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="vinyl-backend") | .monit.memory / 1024 / 1024 | floor' 2>/dev/null || echo "0")
BACKEND_CPU=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="vinyl-backend") | .monit.cpu' 2>/dev/null || echo "0")
if [ "$BACKEND_STATUS" = "online" ]; then
    echo -e "  ${GREEN}●${RESET} Backend     ${GREEN}ONLINE${RESET}  │ ${BACKEND_MEM}MB │ CPU: ${BACKEND_CPU}%"
else
    echo -e "  ${RED}○${RESET} Backend     ${RED}OFFLINE${RESET}"
fi

# Icecast
ICECAST_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="vinyl-os-icecast") | .pm2_env.status' 2>/dev/null || echo "unknown")
if [ "$ICECAST_STATUS" = "online" ]; then
    echo -e "  ${GREEN}●${RESET} Icecast     ${GREEN}ONLINE${RESET}"
else
    echo -e "  ${RED}○${RESET} Icecast     ${RED}OFFLINE${RESET}"
fi

# Frontend
FRONTEND_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="vinyl-frontend") | .pm2_env.status' 2>/dev/null || echo "unknown")
if [ "$FRONTEND_STATUS" = "online" ]; then
    echo -e "  ${GREEN}●${RESET} Frontend    ${GREEN}ONLINE${RESET}"
else
    echo -e "  ${YELLOW}○${RESET} Frontend    ${YELLOW}NOT RUNNING${RESET} (optional in prod)"
fi

echo ""

###############################################################################
# 2. API STATUS
###############################################################################

# Buscar dados das APIs
API_STATUS=$(curl -s --max-time 2 http://localhost:3001/api/status 2>/dev/null || echo "{}")
RECORDING_STATUS=$(curl -s --max-time 2 http://localhost:3001/api/recordings/status 2>/dev/null || echo "{}")
BUFFER_STATUS=$(curl -s --max-time 2 http://localhost:3001/api/recognize/buffer-status 2>/dev/null || echo "{}")
ICECAST_JSON=$(curl -s --max-time 2 http://localhost:8000/status-json.xsl 2>/dev/null || echo "{}")

# Extrair valores
STREAMING_ACTIVE=$(echo "$API_STATUS" | jq -r '.streaming.active // false' 2>/dev/null)
AUDIO_LEVEL=$(echo "$API_STATUS" | jq -r '.audio.level_db // -60' 2>/dev/null | cut -d'.' -f1)
SILENCE=$(echo "$API_STATUS" | jq -r '.audio.silence_detected // false' 2>/dev/null)
CLIPPING=$(echo "$API_STATUS" | jq -r '.audio.clipping_detected // false' 2>/dev/null)
BITRATE=$(echo "$API_STATUS" | jq -r '.streaming.bitrate // 0' 2>/dev/null)
LISTENERS=$(echo "$API_STATUS" | jq -r '.streaming.listeners // 0' 2>/dev/null)

IS_RECORDING=$(echo "$RECORDING_STATUS" | jq -r '.data.isRecording // false' 2>/dev/null)
FLAC_ACTIVE=$(echo "$RECORDING_STATUS" | jq -r '.data.flacProcessActive // false' 2>/dev/null)

BUFFER_PERCENT=$(echo "$BUFFER_STATUS" | jq -r '.buffer.fillPercent // "0%"' 2>/dev/null | tr -d '%')
BUFFER_SECS=$(echo "$BUFFER_STATUS" | jq -r '.buffer.availableSeconds // "0"' 2>/dev/null)

ICECAST_LISTENERS=$(echo "$ICECAST_JSON" | jq -r '.icestats.source.listeners // 0' 2>/dev/null)
ICECAST_BITRATE=$(echo "$ICECAST_JSON" | jq -r '.icestats.source.bitrate // 0' 2>/dev/null)

###############################################################################
# 3. PIPELINE DIAGRAM
###############################################################################

echo -e "${BOLD}${WHITE}═══ AUDIO PIPELINE (Quad-Path Architecture) ═══${RESET}"
echo ""

# FFmpeg counts
FFMPEG_PIDS=$(pgrep ffmpeg 2>/dev/null || true)
FFMPEG_COUNT=$(echo "$FFMPEG_PIDS" | grep -c . 2>/dev/null || echo "0")

# Status indicators
if [ "$STREAMING_ACTIVE" = "true" ]; then
    STREAM_ICON="${GREEN}●${RESET}"
    STREAM_TEXT="${GREEN}STREAMING${RESET}"
else
    STREAM_ICON="${RED}○${RESET}"
    STREAM_TEXT="${RED}STOPPED${RESET}"
fi

if [ "$IS_RECORDING" = "true" ]; then
    REC_ICON="${RED}⏺${RESET}"
    REC_TEXT="${RED}RECORDING${RESET}"
    FLAC_DEST="${MAGENTA}→ FILE${RESET}"
else
    REC_ICON="${DIM}○${RESET}"
    REC_TEXT="${DIM}not recording${RESET}"
    FLAC_DEST="${DIM}→ discard${RESET}"
fi

# Level bar
if [ "$AUDIO_LEVEL" -gt -10 ]; then
    LEVEL_COLOR="${RED}"
elif [ "$AUDIO_LEVEL" -gt -30 ]; then
    LEVEL_COLOR="${GREEN}"
else
    LEVEL_COLOR="${YELLOW}"
fi

# FIFO status
FIFO1_STATUS=$(check_fifo "/tmp/vinyl-audio.fifo")
FIFO2_STATUS=$(check_fifo "/tmp/vinyl-recognition.fifo")
FIFO3_STATUS=$(check_fifo "/tmp/vinyl-flac.fifo")

echo -e "  ${BOLD}Status:${RESET} $STREAM_ICON $STREAM_TEXT │ FFmpegs: ${FFMPEG_COUNT}/4 │ Level: ${LEVEL_COLOR}${AUDIO_LEVEL}dB${RESET}"
echo ""

# Diagrama principal
cat << 'EOF'
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                              AUDIO SOURCE                               │
  │                                                                         │
EOF
echo -e "  │     ${CYAN}┌──────────┐${RESET}                                                      │"
echo -e "  │     ${CYAN}│   ALSA   │${RESET}  plughw:1,0 (48kHz/16bit/stereo)                     │"
echo -e "  │     ${CYAN}└────┬─────┘${RESET}                                                      │"
echo -e "  │          ${CYAN}│${RESET}                                                           │"
echo -e "  │          ${CYAN}▼${RESET}                                                           │"
echo -e "  │     ┌──────────┐                                                      │"
echo -e "  │     │${YELLOW}FFmpeg #1 ${RESET}│  Main capture (ALSA → 4 outputs)                   │"
echo -e "  │     └──┬─┬─┬─┬─┘                                                      │"
echo -e "  │        │ │ │ │                                                        │"
echo -e "  └────────┼─┼─┼─┼────────────────────────────────────────────────────────┘"
echo -e "           │ │ │ │"
echo -e "           │ │ │ └─────────────────────────────────────────┐"
echo -e "           │ │ └───────────────────────┐                   │"
echo -e "           │ └───────────┐             │                   │"
echo -e "           │             │             │                   │"
echo -e "           ▼             ▼             ▼                   ▼"
echo ""

# Linha dos 4 caminhos
echo -e "  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐"
echo -e "  │${WHITE}   stdout    ${RESET}│  │${WHITE}   FIFO1    ${RESET}│  │${WHITE}   FIFO2    ${RESET}│  │${WHITE}   FIFO3    ${RESET}│"
echo -e "  │   (PCM)     │  │ $FIFO1_STATUS vinyl-    │  │ $FIFO2_STATUS vinyl-    │  │ $FIFO3_STATUS vinyl-    │"
echo -e "  │             │  │   audio     │  │   recog     │  │   flac      │"
echo -e "  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘"
echo -e "         │                │                │                │"
echo -e "         ▼                ▼                ▼                ▼"
echo ""

# Linha dos processadores
echo -e "  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐"
echo -e "  │${CYAN}   Express   ${RESET}│  │${YELLOW} FFmpeg #2  ${RESET}│  │${YELLOW} FFmpeg #3  ${RESET}│  │${YELLOW} FFmpeg #4  ${RESET}│"
echo -e "  │ /stream.wav │  │ PCM → MP3   │  │ PCM → Ring  │  │ PCM → FLAC  │"
echo -e "  │             │  │ ${BITRATE}kbps      │  │   Buffer    │  │ ${FLAC_DEST}    │"
echo -e "  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘"
echo -e "         │                │                │                │"
echo -e "         ▼                ▼                ▼                ▼"
echo ""

# Linha dos destinos
echo -e "  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐"
echo -e "  │${GREEN}  Frontend   ${RESET}│  │${MAGENTA}  Icecast2  ${RESET}│  │${BLUE} Ring Buffer${RESET}│  │${MAGENTA}  Node.js   ${RESET}│"
echo -e "  │  ~150ms     │  │  /stream    │  │  20 seconds │  │  Recording  │"
if [ "$ICECAST_LISTENERS" != "null" ] && [ "$ICECAST_LISTENERS" != "0" ]; then
    echo -e "  │             │  │ 🎧 ${ICECAST_LISTENERS} listen  │  │ $(mini_bar ${BUFFER_PERCENT:-0}) │  │ $REC_ICON $REC_TEXT │"
else
    echo -e "  │             │  │ 🎧 0 listen  │  │ $(mini_bar ${BUFFER_PERCENT:-0}) │  │ $REC_ICON $REC_TEXT │"
fi
echo -e "  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘"

echo ""
echo ""

###############################################################################
# 4. DETAILS
###############################################################################

echo -e "${BOLD}${WHITE}═══ COMPONENT DETAILS ═══${RESET}"
echo ""

# Ring Buffer details
echo -e "  ${BOLD}Ring Buffer (FFmpeg #3):${RESET}"
if [ -n "$BUFFER_PERCENT" ] && [ "$BUFFER_PERCENT" != "null" ]; then
    echo -e "    Fill: $(mini_bar ${BUFFER_PERCENT}) ${BUFFER_PERCENT}% (${BUFFER_SECS}s available)"
    TOTAL_WRITTEN=$(echo "$BUFFER_STATUS" | jq -r '.buffer.totalWrittenMB // "0"' 2>/dev/null)
    TOTAL_READ=$(echo "$BUFFER_STATUS" | jq -r '.buffer.totalReadMB // "0"' 2>/dev/null)
    echo -e "    Total written: ${TOTAL_WRITTEN}MB │ Total read: ${TOTAL_READ}MB"
else
    echo -e "    ${DIM}Not available (streaming not active?)${RESET}"
fi
echo ""

# Recording details
echo -e "  ${BOLD}Recording (FFmpeg #4):${RESET}"
if [ "$FLAC_ACTIVE" = "true" ]; then
    echo -e "    FLAC Process: ${GREEN}●${RESET} Active (always-on when streaming)"
else
    echo -e "    FLAC Process: ${RED}○${RESET} Inactive"
fi
if [ "$IS_RECORDING" = "true" ]; then
    CURRENT_REC=$(echo "$RECORDING_STATUS" | jq -r '.data.currentRecording // {}' 2>/dev/null)
    REC_DURATION=$(echo "$CURRENT_REC" | jq -r '.durationSeconds // 0' 2>/dev/null)
    REC_SIZE=$(echo "$CURRENT_REC" | jq -r '.fileSizeBytes // 0' 2>/dev/null)
    REC_PATH=$(echo "$CURRENT_REC" | jq -r '.filePath // "unknown"' 2>/dev/null)
    echo -e "    Status: ${RED}⏺ RECORDING${RESET}"
    echo -e "    Duration: ${REC_DURATION}s │ Size: $(format_bytes $REC_SIZE)"
    echo -e "    File: ${REC_PATH}"
else
    echo -e "    Status: ${DIM}Not recording (data being discarded)${RESET}"
fi
echo ""

# Icecast details
echo -e "  ${BOLD}Icecast Stream (FFmpeg #2):${RESET}"
if [ "$ICECAST_JSON" != "{}" ]; then
    STREAM_START=$(echo "$ICECAST_JSON" | jq -r '.icestats.source.stream_start // "Unknown"' 2>/dev/null)
    LISTEN_URL=$(echo "$ICECAST_JSON" | jq -r '.icestats.source.listenurl // "Unknown"' 2>/dev/null)
    echo -e "    URL: ${CYAN}${LISTEN_URL}${RESET}"
    echo -e "    Bitrate: ${ICECAST_BITRATE}kbps │ Listeners: ${ICECAST_LISTENERS}"
    echo -e "    Started: ${STREAM_START}"
else
    echo -e "    ${DIM}Icecast not responding${RESET}"
fi
echo ""

# Session info
SESSION_ID=$(echo "$API_STATUS" | jq -r '.session.id // "none"' 2>/dev/null)
SESSION_DURATION=$(echo "$API_STATUS" | jq -r '.session.duration // 0' 2>/dev/null)
if [ "$SESSION_ID" != "none" ] && [ "$SESSION_ID" != "null" ]; then
    SESSION_MINS=$((SESSION_DURATION / 60))
    echo -e "  ${BOLD}Active Session:${RESET}"
    echo -e "    ID: ${SESSION_ID:0:8}..."
    echo -e "    Duration: ${SESSION_DURATION}s (${SESSION_MINS}min)"
fi

echo ""
echo -e "${DIM}─────────────────────────────────────────────────────────────────────────────${RESET}"
echo -e "${DIM}Run: ./scripts/audio-pipeline.sh    │    For system health: ./scripts/system-health.sh${RESET}"
echo ""
