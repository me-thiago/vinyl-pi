#!/bin/bash

###############################################################################
# Vinyl-OS Installation Script
# Automatiza a instalação completa do sistema Vinyl-OS no Raspberry Pi
###############################################################################

set -e

# Cores ANSI
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NODE_VERSION="20"
ICECAST_SOURCE_PASSWORD="hackme"
ICECAST_ADMIN_PASSWORD="admin123"

###############################################################################
# Funções de Utilidade
###############################################################################

print_header() {
    echo -e "${BOLD}${CYAN}"
    echo "═══════════════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════════════"
    echo -e "${RESET}"
}

print_step() {
    echo -e "\n${BOLD}${BLUE}▶ $1${RESET}"
}

print_success() {
    echo -e "${GREEN}✓ $1${RESET}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${RESET}"
}

print_error() {
    echo -e "${RED}✗ $1${RESET}"
}

check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "Este script NÃO deve ser executado como root."
        print_warning "Execute sem sudo: ./scripts/install.sh"
        exit 1
    fi
}

check_raspberry_pi() {
    if [ -f /proc/device-tree/model ]; then
        MODEL=$(cat /proc/device-tree/model)
        if [[ "$MODEL" == *"Raspberry Pi"* ]]; then
            print_success "Raspberry Pi detectado: $MODEL"
            return 0
        fi
    fi
    print_warning "Não parece ser um Raspberry Pi - prosseguindo mesmo assim"
    return 0
}

###############################################################################
# Instalação de Dependências do Sistema
###############################################################################

install_system_dependencies() {
    print_step "Instalando dependências do sistema..."

    sudo apt update

    # Lista de pacotes necessários
    PACKAGES=(
        "git"
        "ffmpeg"
        "icecast2"
        "alsa-utils"
        "sqlite3"
        "curl"
        "jq"
    )

    for pkg in "${PACKAGES[@]}"; do
        if dpkg -l | grep -q "^ii  $pkg "; then
            print_success "$pkg já instalado"
        else
            echo "Instalando $pkg..."
            sudo apt install -y "$pkg"
            print_success "$pkg instalado"
        fi
    done
}

install_nodejs() {
    print_step "Verificando Node.js..."

    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node -v | sed 's/v//' | cut -d'.' -f1)
        if [ "$CURRENT_NODE" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $(node -v) já instalado"
            return 0
        fi
    fi

    echo "Instalando Node.js $NODE_VERSION..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt install -y nodejs
    print_success "Node.js $(node -v) instalado"
}

install_pm2() {
    print_step "Verificando PM2..."

    if command -v pm2 &> /dev/null; then
        print_success "PM2 já instalado: $(pm2 -v)"
    else
        echo "Instalando PM2 globalmente..."
        sudo npm install -g pm2
        print_success "PM2 instalado"
    fi
}

###############################################################################
# Instalação de Dependências do Projeto
###############################################################################

install_project_dependencies() {
    print_step "Instalando dependências do projeto..."

    cd "$PROJECT_ROOT"

    # Root dependencies
    echo "Instalando dependências raiz..."
    npm install
    print_success "Dependências raiz instaladas"

    # Backend dependencies
    echo "Instalando dependências do backend..."
    cd "$PROJECT_ROOT/backend"
    npm install
    print_success "Dependências do backend instaladas"

    # Frontend dependencies
    echo "Instalando dependências do frontend..."
    cd "$PROJECT_ROOT/frontend"
    npm install
    print_success "Dependências do frontend instaladas"

    cd "$PROJECT_ROOT"
}

###############################################################################
# Configuração do Banco de Dados
###############################################################################

setup_database() {
    print_step "Configurando banco de dados Prisma..."

    cd "$PROJECT_ROOT/backend"

    # Verificar se o schema existe
    if [ ! -f "prisma/schema.prisma" ]; then
        print_error "Schema Prisma não encontrado!"
        exit 1
    fi

    # Gerar cliente Prisma
    echo "Gerando cliente Prisma..."
    npx prisma generate
    print_success "Cliente Prisma gerado"

    # Criar/atualizar banco de dados
    echo "Aplicando migrações..."
    npx prisma db push
    print_success "Banco de dados configurado"

    cd "$PROJECT_ROOT"
}

###############################################################################
# Configuração do Icecast2
###############################################################################

setup_icecast() {
    print_step "Configurando Icecast2..."

    # Verificar se já existe configuração customizada
    if [ -f "$PROJECT_ROOT/config/icecast.xml" ]; then
        print_success "Configuração Icecast já existe em config/icecast.xml"
    else
        # Criar diretório config se não existir
        mkdir -p "$PROJECT_ROOT/config"

        # Criar configuração base
        cat > "$PROJECT_ROOT/config/icecast.xml" << EOF
<icecast>
    <location>Home</location>
    <admin>admin@localhost</admin>

    <limits>
        <clients>100</clients>
        <sources>2</sources>
        <queue-size>524288</queue-size>
        <client-timeout>30</client-timeout>
        <header-timeout>15</header-timeout>
        <source-timeout>10</source-timeout>
        <burst-size>65535</burst-size>
    </limits>

    <authentication>
        <source-password>${ICECAST_SOURCE_PASSWORD}</source-password>
        <admin-user>admin</admin-user>
        <admin-password>${ICECAST_ADMIN_PASSWORD}</admin-password>
    </authentication>

    <hostname>localhost</hostname>

    <listen-socket>
        <port>8000</port>
    </listen-socket>

    <mount>
        <mount-name>/stream</mount-name>
        <fallback-mount>/silence.mp3</fallback-mount>
        <fallback-override>1</fallback-override>
    </mount>

    <fileserve>1</fileserve>

    <paths>
        <basedir>/usr/share/icecast2</basedir>
        <logdir>${PROJECT_ROOT}/logs</logdir>
        <webroot>/usr/share/icecast2/web</webroot>
        <adminroot>/usr/share/icecast2/admin</adminroot>
        <alias source="/" destination="/status.xsl"/>
    </paths>

    <logging>
        <accesslog>access.log</accesslog>
        <errorlog>error.log</errorlog>
        <loglevel>3</loglevel>
        <logsize>10000</logsize>
    </logging>

    <security>
        <chroot>0</chroot>
    </security>
</icecast>
EOF
        print_success "Configuração Icecast criada em config/icecast.xml"
    fi

    # Criar diretório de logs
    mkdir -p "$PROJECT_ROOT/logs"
    print_success "Diretório de logs criado"
}

###############################################################################
# Configuração do PM2
###############################################################################

setup_pm2() {
    print_step "Configurando PM2..."

    cd "$PROJECT_ROOT"

    # Verificar se ecosystem.config.js existe
    if [ ! -f "ecosystem.config.js" ]; then
        print_error "ecosystem.config.js não encontrado!"
        exit 1
    fi

    print_success "ecosystem.config.js encontrado"

    # Configurar auto-start (salvar estado atual se já rodando)
    if pm2 list 2>/dev/null | grep -q "vinyl"; then
        print_warning "Processos Vinyl-OS já rodando no PM2"
        pm2 save
    fi

    print_success "PM2 configurado"
}

setup_pm2_startup() {
    print_step "Configurando PM2 para iniciar no boot..."

    # Gerar comando de startup
    STARTUP_CMD=$(pm2 startup systemd -u "$USER" --hp "$HOME" 2>&1 | grep "sudo" | head -1)

    if [ -n "$STARTUP_CMD" ]; then
        echo "Executando: $STARTUP_CMD"
        eval "$STARTUP_CMD"
        print_success "PM2 startup configurado"
    else
        # Verificar se já está configurado
        if systemctl is-enabled "pm2-$USER" &>/dev/null; then
            print_success "PM2 startup já configurado"
        else
            print_warning "Não foi possível configurar PM2 startup automaticamente"
            echo "Execute manualmente: pm2 startup"
        fi
    fi
}

###############################################################################
# Build do Projeto
###############################################################################

build_project() {
    print_step "Compilando projeto..."

    cd "$PROJECT_ROOT"

    # Build backend
    echo "Compilando backend..."
    cd "$PROJECT_ROOT/backend"
    npm run build
    print_success "Backend compilado"

    # Build frontend
    echo "Compilando frontend..."
    cd "$PROJECT_ROOT/frontend"
    npm run build
    print_success "Frontend compilado"

    cd "$PROJECT_ROOT"
}

###############################################################################
# Testes de Validação
###############################################################################

run_validation_tests() {
    print_step "Executando testes de validação..."

    TESTS_PASSED=0
    TESTS_FAILED=0

    # Teste 1: Node.js
    if command -v node &> /dev/null; then
        print_success "Node.js: $(node -v)"
        ((TESTS_PASSED++))
    else
        print_error "Node.js não encontrado"
        ((TESTS_FAILED++))
    fi

    # Teste 2: npm
    if command -v npm &> /dev/null; then
        print_success "npm: $(npm -v)"
        ((TESTS_PASSED++))
    else
        print_error "npm não encontrado"
        ((TESTS_FAILED++))
    fi

    # Teste 3: FFmpeg
    if command -v ffmpeg &> /dev/null; then
        print_success "FFmpeg: $(ffmpeg -version 2>/dev/null | head -1 | cut -d' ' -f3)"
        ((TESTS_PASSED++))
    else
        print_error "FFmpeg não encontrado"
        ((TESTS_FAILED++))
    fi

    # Teste 4: Icecast2
    if command -v icecast2 &> /dev/null; then
        print_success "Icecast2 instalado"
        ((TESTS_PASSED++))
    else
        print_error "Icecast2 não encontrado"
        ((TESTS_FAILED++))
    fi

    # Teste 5: PM2
    if command -v pm2 &> /dev/null; then
        print_success "PM2: $(pm2 -v)"
        ((TESTS_PASSED++))
    else
        print_error "PM2 não encontrado"
        ((TESTS_FAILED++))
    fi

    # Teste 6: SQLite
    if command -v sqlite3 &> /dev/null; then
        print_success "SQLite: $(sqlite3 --version | cut -d' ' -f1)"
        ((TESTS_PASSED++))
    else
        print_error "SQLite não encontrado"
        ((TESTS_FAILED++))
    fi

    # Teste 7: Backend build
    if [ -f "$PROJECT_ROOT/backend/dist/index.js" ]; then
        print_success "Backend compilado"
        ((TESTS_PASSED++))
    else
        print_error "Backend não compilado"
        ((TESTS_FAILED++))
    fi

    # Teste 8: Frontend build
    if [ -d "$PROJECT_ROOT/frontend/dist" ]; then
        print_success "Frontend compilado"
        ((TESTS_PASSED++))
    else
        print_error "Frontend não compilado"
        ((TESTS_FAILED++))
    fi

    # Teste 9: Database
    if [ -f "$PROJECT_ROOT/backend/data/vinyl-os.db" ]; then
        print_success "Database existe"
        ((TESTS_PASSED++))
    else
        print_warning "Database ainda não criado (será criado na primeira execução)"
        ((TESTS_PASSED++))
    fi

    # Teste 10: Dispositivo de áudio
    if arecord -l 2>/dev/null | grep -q "card"; then
        AUDIO_DEVICE=$(arecord -l 2>/dev/null | grep "card" | head -1)
        print_success "Dispositivo de áudio: $AUDIO_DEVICE"
        ((TESTS_PASSED++))
    else
        print_warning "Nenhum dispositivo de áudio detectado"
        ((TESTS_PASSED++))
    fi

    echo ""
    echo -e "${BOLD}Resultado: ${GREEN}$TESTS_PASSED passed${RESET}, ${RED}$TESTS_FAILED failed${RESET}"

    if [ "$TESTS_FAILED" -gt 0 ]; then
        return 1
    fi
    return 0
}

###############################################################################
# Verificar Dispositivo de Áudio
###############################################################################

check_audio_device() {
    print_step "Verificando dispositivos de áudio..."

    echo "Dispositivos de captura disponíveis:"
    arecord -l 2>/dev/null || print_warning "Nenhum dispositivo de captura encontrado"

    echo ""
    echo -e "${YELLOW}IMPORTANTE:${RESET}"
    echo "  1. Anote o número do card e device do seu dispositivo USB"
    echo "  2. Configure AUDIO_DEVICE no .env (ex: plughw:1,0)"
    echo "  3. Teste com: arecord -D plughw:1,0 -f cd -d 5 /tmp/test.wav"
}

###############################################################################
# Mostrar Próximos Passos
###############################################################################

show_next_steps() {
    print_header "🎉 Instalação Concluída!"

    echo -e "${BOLD}Próximos Passos:${RESET}"
    echo ""
    echo "1. Configure o dispositivo de áudio no .env:"
    echo -e "   ${CYAN}nano $PROJECT_ROOT/.env${RESET}"
    echo "   AUDIO_DEVICE=plughw:X,Y  # Substitua X,Y pelo seu dispositivo"
    echo ""
    echo "2. Inicie os serviços:"
    echo -e "   ${CYAN}cd $PROJECT_ROOT${RESET}"
    echo -e "   ${CYAN}npm run pm2:start${RESET}"
    echo ""
    echo "3. Salve e configure auto-start:"
    echo -e "   ${CYAN}pm2 save${RESET}"
    echo ""
    echo "4. Acesse a interface:"
    echo -e "   ${CYAN}http://$(hostname -I | awk '{print $1}'):5173${RESET}"
    echo ""
    echo "5. Monitore o sistema:"
    echo -e "   ${CYAN}./scripts/system-health.sh${RESET}"
    echo -e "   ${CYAN}pm2 logs${RESET}"
    echo ""
    echo -e "${BOLD}Comandos Úteis:${RESET}"
    echo "  npm run pm2:status   - Ver status dos serviços"
    echo "  npm run pm2:logs     - Ver logs em tempo real"
    echo "  npm run pm2:restart  - Reiniciar todos os serviços"
    echo "  npm run pm2:stop     - Parar todos os serviços"
    echo ""
}

###############################################################################
# Menu Principal
###############################################################################

show_menu() {
    print_header "🎵 Vinyl-OS Installation Script"
    echo ""
    echo "Este script irá:"
    echo "  1. Instalar dependências do sistema (Node.js, FFmpeg, Icecast2, etc.)"
    echo "  2. Instalar dependências do projeto (npm packages)"
    echo "  3. Configurar banco de dados Prisma"
    echo "  4. Configurar Icecast2"
    echo "  5. Configurar PM2 para auto-start"
    echo "  6. Compilar backend e frontend"
    echo "  7. Executar testes de validação"
    echo ""
    echo -e "${YELLOW}Tempo estimado: 10-20 minutos${RESET}"
    echo ""
    read -p "Deseja continuar? [S/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Instalação cancelada."
        exit 0
    fi
}

###############################################################################
# Main
###############################################################################

main() {
    check_root
    show_menu
    check_raspberry_pi

    install_system_dependencies
    install_nodejs
    install_pm2
    install_project_dependencies
    setup_database
    setup_icecast
    build_project
    setup_pm2
    setup_pm2_startup

    echo ""
    run_validation_tests
    check_audio_device
    show_next_steps
}

# Executar
main "$@"
