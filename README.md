# Vinyl-OS

[![CI](https://github.com/me-thiago/vinyl-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/me-thiago/vinyl-pi/actions/workflows/ci.yml)

Sistema de monitoramento e gerenciamento de reprodução de vinis com streaming ao vivo.

## 📖 Visão Geral

Vinyl-OS é uma plataforma completa que permite capturar áudio de toca-discos via ALSA, processar com FFmpeg, transmitir via Icecast2, e oferecer uma interface web moderna para monitoramento em tempo real com detecção de eventos (silêncio, clipping, troca de faixa, sessões).

## 🛠️ Stack Tecnológico

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Express 4.x
- **ORM:** Prisma com SQLite3
- **WebSockets:** Socket.io
- **Logging:** Winston
- **Linguagem:** TypeScript

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **UI Library:** shadcn/ui (theme: tweakcn Modern Minimal)
- **Styling:** TailwindCSS v4
- **Charts:** Recharts
- **Routing:** React Router
- **Linguagem:** TypeScript

### Áudio
- **Captura:** ALSA
- **Processamento:** FFmpeg
- **Streaming:** Icecast2

## 📋 Requisitos de Sistema

### Hardware Recomendado
- **Raspberry Pi 4B ou 5** (4GB+ RAM recomendado)
- **Dispositivo de áudio USB** (placa de som ou pré-amplificador com saída USB)
- **Cartão microSD** 32GB+ (Class 10 ou superior)
- **Conexão Ethernet** (recomendado para streaming estável)

### Hardware Testado
- Raspberry Pi 4B 4GB
- Raspberry Pi 5 8GB
- Behringer U-Phono UFO202 (USB Audio Interface)
- Art DJ Pre II (USB Phono Preamp)

### Software
- Raspberry Pi OS (64-bit) - Bookworm ou superior
- Node.js 20 LTS ou superior
- npm 9+ ou yarn 1.22+
- FFmpeg instalado no sistema
- Icecast2 instalado no sistema
- ALSA configurado (para captura de áudio)

## 🔧 Instalação de Dependências do Sistema

Antes de instalar as dependências Node.js, você precisa instalar as ferramentas de sistema necessárias.

### Raspberry Pi OS / Debian / Ubuntu

```bash
# Atualizar índice de pacotes
sudo apt update

# Instalar Icecast2 (servidor de streaming)
sudo apt install -y icecast2

# Durante a instalação, o Icecast2 perguntará sobre configuração inicial
# Você pode aceitar os valores padrão, pois vamos usar um arquivo de configuração customizado

# Instalar FFmpeg (processamento de áudio)
sudo apt install -y ffmpeg

# Verificar instalações
which icecast2  # deve retornar /usr/bin/icecast2
which ffmpeg    # deve retornar /usr/bin/ffmpeg

# Verificar versões
icecast2 --version
ffmpeg -version
```

### ALSA (já vem instalado no Raspberry Pi OS)

```bash
# Verificar se ALSA está disponível
aplay -l  # Lista dispositivos de reprodução
arecord -l  # Lista dispositivos de captura
```

**Nota:** O Vinyl-OS usa um arquivo de configuração customizado (`config/icecast.xml`) ao invés do padrão do sistema (`/etc/icecast2/icecast.xml`), permitindo versionamento e configuração sem necessidade de sudo.

## 🚀 Instalação

### Instalação Automatizada (Recomendado)

O script de instalação automatiza todo o processo de setup:

```bash
# Clone o repositório
git clone <repository-url>
cd vinyl-os

# Execute o script de instalação
./scripts/install.sh
```

O script irá:
1. Instalar dependências do sistema (Node.js, FFmpeg, Icecast2, etc.)
2. Instalar dependências do projeto (npm packages)
3. Configurar banco de dados Prisma
4. Configurar Icecast2
5. Configurar PM2 para auto-start
6. Compilar backend e frontend
7. Executar testes de validação

**Tempo estimado:** 10-20 minutos

### Instalação Manual

Se preferir instalar manualmente:

#### 1. Clone o repositório

```bash
git clone <repository-url>
cd vinyl-os
```

#### 2. Instale as dependências

```bash
# Instalar dependências de todos os workspaces
npm run install:all

# Ou instalar manualmente em cada pasta
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na pasta `backend/`:

```bash
DATABASE_URL="file:./data/vinyl-os.db"
PORT=3001
```

### 4. Inicialize o banco de dados

```bash
cd backend
npx prisma generate
npx prisma db push
```

### 5. Backup e Restore do Banco de Dados

O Vinyl-OS utiliza SQLite em arquivo único (`data/vinyl-os.db`), facilitando backup e restore.

#### Criar Backup

```bash
# Backup manual com timestamp
cp data/vinyl-os.db data/backups/vinyl-os-$(date +%Y%m%d-%H%M%S).db

# Ou backup simples
cp data/vinyl-os.db data/backups/vinyl-os-backup.db
```

**Importante:** Crie a pasta `data/backups/` antes do primeiro backup:
```bash
mkdir -p data/backups
```

#### Restaurar Backup

```bash
# Restaurar de um backup específico
cp data/backups/vinyl-os-20241102-194600.db data/vinyl-os.db

# Ou restaurar do backup mais recente
cp data/backups/$(ls -t data/backups/ | head -1) data/vinyl-os.db
```

**Dica:** Recomenda-se fazer backups regulares antes de atualizações ou migrations do banco de dados.

## 🏃 Executando o Projeto

### Desenvolvimento (Backend + Frontend simultaneamente)

```bash
npm run dev
```

Isso iniciará:
- Backend em `http://localhost:3001`
- Frontend em `http://localhost:5173`

### Executando separadamente

```bash
# Backend apenas
npm run dev:backend

# Frontend apenas
npm run dev:frontend
```

## 🏗️ Build para Produção

```bash
# Build completo
npm run build

# Build individual
npm run build:backend
npm run build:frontend
```

## 🔧 Gerenciamento via PM2

O Vinyl-OS usa **PM2** para gerenciar os processos (Icecast2, backend, frontend) em produção ou para desenvolvimento com auto-restart.

### Instalar PM2 (se ainda não instalado)

```bash
npm install -g pm2
```

### Gerenciar todos os serviços

```bash
# Iniciar todos os serviços (Icecast2 + Backend + Frontend)
npm run pm2:start

# Ver status de todos os processos
npm run pm2:status

# Parar todos os serviços
npm run pm2:stop

# Reiniciar todos os serviços
npm run pm2:restart

# Ver logs de todos os serviços
npm run pm2:logs

# Remover todos os processos do PM2
npm run pm2:delete
```

### Gerenciar serviços individuais

```bash
# Apenas Icecast2
npm run pm2:icecast

# Apenas Backend
npm run pm2:backend

# Apenas Frontend
npm run pm2:frontend

# Parar serviço individual
pm2 stop icecast2    # ou vinyl-backend, ou vinyl-frontend

# Ver logs de um serviço específico
pm2 logs icecast2
```

### Logs e Monitoramento

Os logs dos serviços são salvos em `./logs/`:
- `icecast2-*.log` - Logs do servidor de streaming
- `backend-*.log` - Logs do backend Node.js
- `frontend-*.log` - Logs do frontend React

```bash
# Ver logs em tempo real
pm2 logs

# Ver logs apenas do Icecast2
pm2 logs icecast2 --lines 50

# Monitoramento visual
pm2 monit
```

### Auto-start no boot (Produção)

```bash
# Salvar configuração atual do PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup

# Seguir instruções exibidas pelo comando acima
```

### Fluxo de Desenvolvimento (após alterar código)

**IMPORTANTE:** Após modificar código TypeScript, é necessário recompilar antes de reiniciar o PM2.

```bash
# Apenas Backend
npm run build:backend && pm2 restart vinyl-backend

# Apenas Frontend
npm run build:frontend && pm2 restart vinyl-frontend

# Ambos (Backend + Frontend)
npm run build && pm2 restart vinyl-backend vinyl-frontend

# Rebuild completo (limpa dist/ antes)
npm run rebuild && pm2 restart vinyl-backend vinyl-frontend
```

**Dica:** Durante desenvolvimento ativo, considere usar `npm run dev` (backend) ou `npm run dev:frontend` que fazem hot-reload automático, sem necessidade de rebuild manual.

## 🎵 Como Usar

### Interface Web

Após iniciar os serviços, acesse a interface web:
- **URL local:** `http://localhost:5173`
- **Na rede:** `http://<ip-do-raspberry>:5173`

### Páginas Disponíveis

#### Dashboard (Página Inicial)
- Visualização do status do streaming em tempo real
- Indicadores de nível de áudio (VU meters)
- Status da conexão Icecast
- Últimos eventos detectados

#### Player
- Player de áudio integrado com stream Icecast
- Controles de play/pause
- Indicador de buffer e latência

#### Diagnóstico
- Configurações de thresholds para detecção de eventos
- Silêncio: ajuste o limite de dB para detecção
- Clipping: ajuste a sensibilidade
- Visualização em tempo real dos níveis

#### Sessões
- Histórico de sessões de escuta
- Filtros por data e duração
- Estatísticas de uso

#### Configurações
- Configurações do dispositivo de áudio
- Parâmetros do streaming
- Opções de logging

### Monitoramento via Terminal

```bash
# Ver status de todos os serviços
npm run pm2:status

# Logs em tempo real
npm run pm2:logs

# Logs apenas do backend
pm2 logs vinyl-backend --lines 100

# Health check do sistema
./scripts/system-health.sh
```

### Acessar o Stream de Áudio

O stream Icecast está disponível em:
- **URL:** `http://<ip-do-raspberry>:8000/stream`
- **Formato:** MP3 192kbps

Você pode ouvir em qualquer player que suporte streams HTTP:
```bash
# VLC
vlc http://localhost:8000/stream

# mpv
mpv http://localhost:8000/stream

# ffplay
ffplay http://localhost:8000/stream
```

## 🔍 Troubleshooting

### Problemas Comuns

| Problema | Causa Provável | Solução |
|----------|----------------|---------|
| "Device not found" | Dispositivo de áudio não detectado | Execute `arecord -l` para listar dispositivos e ajuste `AUDIO_DEVICE` no `.env` |
| "Permission denied" ao capturar áudio | Usuário não está no grupo audio | Execute `sudo usermod -a -G audio $USER` e faça logout/login |
| Stream cortando/falhando | Buffer insuficiente ou WiFi instável | Use conexão Ethernet; aumente `buffer_size` nas configurações |
| "Connection refused" no Icecast | Senha incorreta ou serviço parado | Verifique senhas em `config/icecast.xml`; execute `pm2 restart vinyl-os-icecast` |
| Alto uso de CPU | Bitrate muito alto ou muitos processos | Reduza bitrate para 128k; feche aplicações não essenciais |
| Eventos não detectados | Thresholds mal configurados | Ajuste na página de Diagnóstico; verifique se há sinal de áudio |
| Frontend não carrega | Build não executado ou porta em uso | Execute `npm run build:frontend`; verifique se porta 5173 está livre |
| Backend não responde | Erro no startup ou porta em uso | Verifique logs com `pm2 logs vinyl-backend`; porta 3001 deve estar livre |

### Verificar Dispositivos de Áudio

```bash
# Listar dispositivos de captura
arecord -l

# Testar captura (grava 5 segundos)
arecord -D plughw:0,0 -f cd -d 5 /tmp/test.wav

# Reproduzir gravação de teste
aplay /tmp/test.wav
```

### Verificar Serviços

```bash
# Status do PM2
pm2 status

# Status do Icecast
curl -s http://localhost:8000/status-json.xsl | jq .

# Health check da API
curl http://localhost:3001/health

# Status do streaming
curl http://localhost:3001/api/status
```

### Logs Úteis

```bash
# Logs do PM2 (todos os serviços)
pm2 logs

# Logs apenas de erros
pm2 logs --err

# Logs do Icecast
cat logs/error.log

# Logs do sistema (journald)
sudo journalctl -u pm2-$USER -f
```

### Reiniciar Serviços

```bash
# Reiniciar tudo
npm run pm2:restart

# Reiniciar apenas o backend
pm2 restart vinyl-backend

# Parar tudo e iniciar novamente
npm run pm2:stop && npm run pm2:start
```

## 📁 Estrutura do Projeto

```
vinyl-os/
├── backend/              # API Node.js + Express
│   ├── src/
│   │   ├── services/     # Lógica de negócio
│   │   ├── routes/       # Rotas da API
│   │   ├── middleware/   # Middlewares Express
│   │   ├── utils/        # Utilitários
│   │   └── prisma/       # Schema Prisma
│   └── package.json
├── frontend/             # Interface React
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── pages/        # Páginas da aplicação
│   │   ├── hooks/        # React hooks customizados
│   │   └── lib/          # Utilitários
│   └── package.json
├── config/               # Arquivos de configuração
├── data/                 # Banco de dados SQLite
├── scripts/              # Scripts de automação
├── docs/                 # Documentação do projeto
└── package.json          # Root workspace
```

## 📚 Documentação

Para mais informações, consulte a pasta `docs/`:
- [PRD v3.0](docs/prd-v3.md)
- [Arquitetura](docs/architecture.md)
- [Epics e Stories](docs/epics.md)

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja [CONTRIBUTING.md](CONTRIBUTING.md) para detalhes sobre como começar.

## 📋 Changelog

Veja [CHANGELOG.md](CHANGELOG.md) para histórico de versões e mudanças.

## 📝 Licença

ISC

