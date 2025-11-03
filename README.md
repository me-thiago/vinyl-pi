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

