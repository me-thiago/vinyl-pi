# Vinyl-OS

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

### 1. Clone o repositório

```bash
git clone <repository-url>
cd vinyl-os
```

### 2. Instale as dependências

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
DATABASE_URL="file:../data/vinyl-os.db"
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

(Em desenvolvimento)

## 📝 Licença

ISC

