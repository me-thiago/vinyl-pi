# Arquitetura de Decisões - Vinyl-OS

## Resumo Executivo

Vinyl-OS utiliza uma arquitetura monolítica Node.js com backend Express e frontend React SPA, projetada especificamente para execução estável em Raspberry Pi. O sistema implementa streaming de áudio em tempo real via Icecast2, processamento de eventos sonoros, e uma arquitetura dual-path (V3) para gravação paralela sem degradação de performance. A arquitetura prioriza estabilidade, baixa latência (~1-2s), e operação local-first, com decisões técnicas focadas em reduzir complexidade operacional em hardware de baixo consumo.

## Inicialização do Projeto

O projeto será inicializado manualmente devido à natureza especializada (hardware Raspberry Pi + streaming de áudio). Não há starter template padrão adequado para este caso de uso.

### Estrutura Base Inicial

```bash
# Backend - Express.js + Prisma
mkdir -p backend/src/{services,routes,middleware,utils}
cd backend
npm init -y
npm install express@^4.21.2 socket.io@^4.8.2 @prisma/client@^6.16.0 winston@^3.15.0
npm install --save-dev @types/node @types/express typescript ts-node prisma

# Inicializar Prisma
npx prisma init --datasource-provider sqlite

# Frontend - React + Vite + shadcn/ui
cd ../frontend
npm create vite@latest . -- --template react-ts
npm install react-router-dom@^6.20.0 socket.io-client@^4.8.2
npm install tailwindcss@^4.1.2 @tailwindcss/vite@^4.1.2
npm install recharts@^2.15.0 date-fns@^4.1.0
npm install --save-dev @types/node

# Configurar Tailwind v4 no vite.config.ts
# (ver seção de configuração abaixo)

# Inicializar shadcn/ui
npx shadcn@latest init
# Escolher: Style: New York, Base color: Neutral, CSS variables: true

# Adicionar tema tweakcn (Modern Minimal)
npx shadcn@latest add https://tweakcn.com/r/themes/modern-minimal.json
```

**Decisões fornecidas pela inicialização manual:**
- TypeScript habilitado por padrão (backend e frontend)
- Estrutura de diretórios modular
- React Router v6 para roteamento
- TailwindCSS v4 + shadcn/ui para estilização e componentes
- Vite como build tool (desenvolvimento rápido)
- Prisma ORM para type-safe database access

## Tabela de Resumo de Decisões

| Categoria | Decisão | Versão | Afeta Épicos | Rationale |
| --------- | ------- | ------- | ------------ | --------- |
| **Runtime** | Node.js | 20.x LTS | Todos | Suporte estável e performance adequada para Pi |
| **Backend Framework** | Express | ^4.21.2 | Todos | Simples, estável, baixo overhead |
| **Frontend Framework** | React | ^18.3.1 | Todos | Ecossistema maduro, SPA eficiente |
| **Build Tool** | Vite | ^6.0.0 | Frontend | Build rápido, ideal para desenvolvimento |
| **Database** | SQLite3 | 3.x (via Prisma + SQLite) | Todos | Zero config, backup fácil, suficiente para escala |
| **ORM** | Prisma | ^6.16.0 | Todos | Type-safe queries, migrations automáticas, melhor DX |
| **Real-time** | Socket.io | ^4.8.2 | Eventos, Status | WebSocket com fallback, robusto |
| **Streaming** | Icecast2 + FFmpeg | Sistema | Streaming | Padrão de mercado, compatível universalmente |
| **Styling** | TailwindCSS | ^4.1.2 | UI | Utility-first, bundle otimizado, v4 com melhorias |
| **UI Components** | shadcn/ui | Latest (v4-compatible) | UI | Componentes acessíveis, customizáveis, copy-paste |
| **UI Theme** | tweakcn (Modern Minimal) | - | UI | Tema pré-configurado moderno e minimalista |
| **State Management** | Context API (V1) → Zustand (V3+) | React 18 / Zustand ^5.0.0 | UI | Context suficiente V1, Zustand se necessário V3+ |
| **Charts/Visualização** | Recharts | ^2.15.0 | Dashboard, QA | Lightweight, React-native |
| **Logging** | Winston | ^3.15.0 | Todos | Structured logging, rotation, múltiplos transports |
| **Date Handling** | Date-fns | ^4.1.0 | Todos | Lightweight, tree-shakeable, timezone support nativo. Versão mais recente com suporte a TZDate/UTCDate |
| **API Pattern** | REST | - | Todos | Simples, documentável, adequado ao caso |
| **Audio Processing** | FFmpeg (child process) | Sistema | Audio, Recording | Padrão, maduro, suporta todos formatos |
| **Process Manager** | PM2 | ^5.4.3 | Deploy | Auto-restart, clustering opcional, monitoring |
| **Authentication** | Nenhum (V1-V2) | - | - | Sistema local, sem autenticação necessária |
| **File Storage** | Sistema de arquivos local | - | Recording (V3) | Local-first, sem necessidade de cloud |
| **Background Jobs** | Bull Queue (SQLite adapter V2+) | ^5.0.0 | Recognition (V2+) | Redis-free, adequado para Pi |

## Estrutura do Projeto

```
/home/pi/vinyl-os/
├── .env                          # Secrets (API keys V2+)
├── .gitignore
├── package.json                  # Root (scripts de conveniência)
├── README.md
│
├── config/
│   ├── default.yaml              # Configurações base
│   ├── production.yaml           # Override produção
│   └── icecast.xml               # Config Icecast2
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma         # Prisma schema (V1-V3)
│   │   └── migrations/           # Migration files
│   ├── src/
│   │   ├── server.ts             # Entry point Express
│   │   ├── app.ts                # App config Express
│   │   ├── lib/
│   │   │   └── prisma.ts         # Prisma Client singleton
│   │   ├── services/
│   │   │   ├── audio-manager.ts  # Gerenciamento captura FFmpeg
│   │   │   ├── event-detector.ts # Detecção eventos sonoros (V1)
│   │   │   ├── recognition.ts    # Reconhecimento musical (V2)
│   │   │   ├── recording.ts      # Dual-path recording (V3)
│   │   │   └── chromaprint.ts    # Fingerprinting local (V3)
│   │   ├── routes/
│   │   │   ├── index.ts          # Router principal
│   │   │   ├── health.ts         # Health check
│   │   │   ├── status.ts         # Status sistema
│   │   │   ├── events.ts         # Eventos (V1)
│   │   │   ├── sessions.ts       # Sessões
│   │   │   ├── recognition.ts    # Reconhecimento (V2)
│   │   │   ├── albums.ts         # Coleção (V2)
│   │   │   ├── recordings.ts     # Gravações (V3)
│   │   │   └── settings.ts       # Configurações
│   │   ├── middleware/
│   │   │   ├── error-handler.ts  # Error handling global
│   │   │   ├── logger.ts         # Request logging
│   │   │   └── validation.ts     # Request validation
│   │   ├── utils/
│   │   │   ├── event-bus.ts      # EventBus pub/sub (V1)
│   │   │   ├── logger.ts         # Winston config
│   │   │   ├── config.ts         # Config loader
│   │   │   └── date.ts           # Date helpers (date-fns)
│   │   └── workers/
│   │       └── recognition-worker.ts # Background recognition (V2)
│   │
│   └── dist/                     # Build TypeScript
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts            # Config com Tailwind v4 plugin
│   ├── tsconfig.json
│   ├── tsconfig.app.json         # Path aliases (@/*)
│   ├── components.json           # shadcn/ui config
│   ├── index.html
│   └── src/
│       ├── main.tsx              # Entry point
│       ├── App.tsx               # Root component
│       ├── lib/
│       │   └── utils.ts          # shadcn/ui utils (cn function)
│       ├── i18n/                  # Internacionalização (V1.5)
│       │   ├── index.ts          # Configuração i18next
│       │   └── locales/
│       │       ├── pt-BR.json    # Traduções Português BR
│       │       └── en.json       # Traduções Inglês
│       ├── components/
│       │   ├── ui/               # shadcn/ui components
│       │   │   ├── button.tsx
│       │   │   ├── card.tsx
│       │   │   ├── dialog.tsx
│       │   │   ├── table.tsx
│       │   │   └── ...           # Outros componentes adicionados via CLI
│       │   ├── Player/
│       │   │   ├── Player.tsx    # Player principal
│       │   │   └── VolumeControl.tsx
│       │   ├── Dashboard/
│       │   │   ├── Dashboard.tsx
│       │   │   └── StatsCard.tsx
│       │   ├── Diagnostics/
│       │   │   ├── Diagnostics.tsx
│       │   │   ├── VUMeter.tsx   # VU meter (V1)
│       │   │   ├── EventLog.tsx  # Log eventos (V1)
│       │   │   └── ThresholdConfig.tsx
│       │   ├── Sessions/
│       │   │   ├── SessionList.tsx
│       │   │   └── SessionDetail.tsx
│       │   ├── Collection/       # (V2)
│       │   │   ├── AlbumList.tsx
│       │   │   ├── AlbumCard.tsx
│       │   │   └── AlbumForm.tsx
│       │   ├── Recordings/       # (V3)
│       │   │   └── RecordingList.tsx
│       │   └── layout/
│       │       ├── Layout.tsx    # Layout principal
│       │       ├── Navbar.tsx
│       │       └── Sidebar.tsx
│       ├── pages/
│       │   ├── Home.tsx          # Dashboard
│       │   ├── Diagnostics.tsx   # (V1)
│       │   ├── Sessions.tsx
│       │   ├── Collection.tsx    # (V2)
│       │   ├── Recordings.tsx    # (V3)
│       │   └── Settings.tsx
│       ├── hooks/
│       │   ├── useSocket.ts      # Socket.io hook
│       │   ├── useStatus.ts      # Status hook
│       │   ├── useSessions.ts    # Sessions hook
│       │   └── useAudioStream.ts # WAV streaming com Web Audio API (V1.5)
│       ├── contexts/             # Global state management
│       │   └── (V3+ Zustand store quando necessário)
│       └── styles/
│           └── globals.css       # Tailwind v4 + CSS variables (tweakcn theme)
│
├── data/
│   ├── vinyl-os.db               # SQLite database
│   ├── logs/
│   │   ├── app.log               # Winston logs
│   │   └── error.log
│   └── recordings/               # FLAC files (V3)
│
├── scripts/
│   ├── install.sh                # Setup script
│   ├── backup.sh                 # Backup database
│   └── update.sh                 # Update script
│
└── docs/
    ├── prd-v3.md
    ├── architecture.md            # Este documento
    └── stories/                   # Dev stories (V1+)
```

## Mapeamento de Épicos para Arquitetura

| Épico | Componentes Arquiteturais | Localização | Observações |
| ----- | ------------------------- | ----------- | ----------- |
| **V1 - Foundation Core** | | | |
| Captura de Áudio | `audio-manager.ts` | `backend/src/services/` | FFmpeg child process |
| Streaming Engine | `audio-manager.ts` + Icecast2 | Sistema + Backend | Icecast2 externo |
| Reconhecimento Sonoro | `event-detector.ts` | `backend/src/services/` | Análise de nível de áudio |
| EventBus Core | `event-bus.ts` | `backend/src/utils/` | Pub/sub simples |
| Interface Web MVP | React SPA completo | `frontend/src/` | Player + Dashboard + Diagnostics |
| Persistência V1 | Prisma schema + Client | `backend/prisma/schema.prisma`, `backend/src/lib/prisma.ts` | Sessions + Events via Prisma |
| **V2 - Coleção & Reconhecimento** | | | |
| Gestão Coleção | `albums.ts` route + Prisma | `backend/src/routes/`, Prisma Client | CRUD completo |
| Integração Discogs | Service externo | `backend/src/services/` | API client Discogs |
| Reconhecimento Musical | `recognition.ts` + worker | `backend/src/services/`, `workers/` | ACRCloud/AudD |
| Validação Coleção | Fuzzy matching | `backend/src/services/recognition.ts` | Levenshtein algorithm |
| **V3 - Gravação & Análise** | | | |
| Dual-Path Architecture | `recording.ts` + `audio-manager.ts` | `backend/src/services/` | Buffer circular, sincronização |
| Gravação FLAC | `recording.ts` | `backend/src/services/` | FFmpeg paralelo |
| Chromaprint | `chromaprint.ts` | `backend/src/services/` | Fingerprinting local |
| Quality Analysis | `recording.ts` (análise) | `backend/src/services/` | SNR, clicks, wow/flutter |
| **V4 - Polimento** | | | |
| UI Refinamento | Todos componentes React | `frontend/src/` | Mobile-responsive |
| Admin Controls | Settings route + UI | `backend/src/routes/`, `frontend/src/pages/` | Configurações avançadas |
| Integrações | EventBus extensível | `backend/src/utils/event-bus.ts` | Last.fm, MQTT, webhooks |

## Detalhes da Stack Tecnológica

### Tecnologias Core

**Backend:**
- **Node.js 20.x LTS**: Runtime estável, suporte de longo prazo
- **Express ^4.21.2**: Framework web minimalista, baixo overhead
- **TypeScript**: Type safety, melhor DX, detecção de erros
- **Prisma ^6.16.0**: ORM type-safe, migrations automáticas, melhor DX
- **SQLite3**: Database via Prisma (zero config, backup fácil)
- **Socket.io ^4.8.2**: WebSocket com fallback, robusto para rede local

**Frontend:**
- **React ^19.1.1**: Biblioteca UI, hooks modernos (atualizado de 18.x)
- **Vite ^6.0.0**: Build tool rápido, HMR excelente
- **TypeScript**: Type safety no frontend
- **React Router ^6.20.0**: Roteamento SPA
- **TailwindCSS ^4.1.2**: Utility-first CSS v4, melhorias de performance
- **shadcn/ui**: Componentes UI acessíveis, customizáveis, copy-paste
- **react-i18next ^25.7.1**: Internacionalização com suporte a pt-BR e en
- **@sentry/react ^10.29.0**: Error tracking e performance monitoring

**Áudio & Streaming:**
- **FFmpeg**: Processamento de áudio via child process
- **Icecast2**: Servidor de streaming (instalação sistema)
- **ALSA**: Interface de áudio Linux (sistema)

**Infraestrutura:**
- **PM2 ^5.4.3**: Process manager, auto-restart, clustering opcional
- **Winston ^3.15.0**: Logging estruturado com rotação

### Internacionalização (i18n)

O sistema suporta múltiplos idiomas usando react-i18next (V1.5):

**Configuração:**
```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: { ptBR, en },
  lng: 'pt-BR',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});
```

**Idiomas Suportados:**
- `pt-BR` - Português do Brasil (padrão)
- `en` - English

**Estrutura de Arquivos:**
```
frontend/src/i18n/
├── index.ts           # Configuração i18next
└── locales/
    ├── pt-BR.json     # ~200 chaves de tradução
    └── en.json        # ~200 chaves de tradução
```

**Uso nos Componentes:**
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('dashboard.title')}</h1>;
}
```

### Error Tracking (Sentry)

O sistema utiliza Sentry para monitoramento de erros em produção (V1.5):

**Configuração:**
```typescript
// src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration()
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});
```

**Features Ativas:**
- Browser Tracing: Performance monitoring de navegação
- Session Replay: Gravação de sessões com erro para debug
- Error Boundaries: Captura automática de erros React

**Environment Variables:**
```bash
VITE_SENTRY_DSN=https://xxx@sentry.io/yyy  # DSN do projeto Sentry
```

### Hook useAudioStream

Hook avançado para streaming de áudio WAV via Web Audio API (V1.5):

**Responsabilidades:**
- Conexão com endpoint `/stream.wav` do backend
- Decodificação manual de PCM s16le em AudioBuffer
- Gestão de AudioContext lifecycle
- Detecção e recuperação de rebuffering
- Reconnection com exponential backoff

**Arquitetura:**
```
Backend (/stream.wav)
    │ HTTP chunked transfer (PCM s16le, 48kHz, stereo)
    ▼
useAudioStream
    │
    ├── fetch() com ReadableStream
    ├── Chunk accumulation (8KB threshold ~42ms)
    ├── Manual Int16Array → Float32Array conversion
    ├── AudioBuffer construction (48kHz sample rate)
    └── AudioBufferSourceNode scheduling
    │
    ▼
Web Audio API → Hardware Audio
```

**Constantes Chave:**
| Constante | Valor | Descrição |
|-----------|-------|-----------|
| Sample Rate | 48000 Hz | Deve coincidir com backend ALSA |
| Chunk Threshold | 8KB (~42ms) | Mínimo de dados antes de processar |
| Rebuffer Enter | 50ms | Threshold para entrar em rebuffering |
| Rebuffer Exit | 200ms | Threshold para sair de rebuffering |
| Max Reconnections | 5 | Tentativas antes de desistir |
| Max Backoff | 30s | Delay máximo entre reconexões |

**Uso:**
```typescript
const { isPlaying, isBuffering, error, play, stop, volume, setVolume } = useAudioStream();
```

### Pontos de Integração

**Backend ↔ Frontend:**
- REST API (`/api/*`) para operações CRUD e configuração
- WebSocket (Socket.io) para updates em tempo real (status, eventos)

**Backend ↔ Audio:**
- FFmpeg child process com stdin/stdout pipes para captura
- HTTP POST para Icecast2 mount point (streaming)
- Sistema de arquivos para gravações FLAC (V3)

**Backend ↔ External APIs (V2+):**
- ACRCloud API (HTTPS) para reconhecimento musical
- AudD API (HTTPS) como fallback
- Discogs API (HTTPS) para importação de metadados

**Frontend ↔ Audio Stream:**
- HTTP streaming direto do Icecast2 (`http://pi.local:8000/stream`)
- HTML5 Audio element para reprodução

## Padrões de Implementação

Estes padrões garantem consistência entre agentes AI durante implementação:

### Padrões de Nomenclatura

**API Routes:**
- Formato: `/api/{resource}` (plural)
- Exemplos: `/api/sessions`, `/api/events`, `/api/albums`
- Parâmetros: `/api/sessions/:id` (colon notation)
- Query params: snake_case (`?date_from=`, `?limit=`)

**Database Tables (Prisma):**
- Formato: singular no schema Prisma (Prisma converte para plural)
- Exemplos: `model Session`, `model AudioEvent`, `model Album`
- Colunas: camelCase no schema (`startedAt`, `sessionId`)
- Prisma gera: snake_case nas tabelas SQLite (`started_at`, `session_id`)
- Foreign keys: `{model}Id` no schema (`sessionId`, `albumId`)
- Primary keys: `id String @id @default(uuid())` ou `@default(cuid())`

**Components React:**
- Formato: PascalCase
- Exemplos: `Player.tsx`, `VUMeter.tsx`, `AlbumCard.tsx`
- Files: correspondem ao nome do component (`Player.tsx` exporta `Player`)
- Diretórios: kebab-case ou PascalCase para feature components (`Player/`, `Dashboard/`)
- **shadcn/ui components**: Em `components/ui/`, kebab-case (`button.tsx`, `card.tsx`)
- Importação shadcn: `import { Button } from "@/components/ui/button"`

**TypeScript:**
- Interfaces: PascalCase (`Session`, `AudioEvent`, `Album`)
- Types: PascalCase (`EventType`, `SessionStatus`)
- Functions: camelCase (`createSession`, `detectEvent`)
- Constants: UPPER_SNAKE_CASE (`MAX_LISTENERS`, `SILENCE_THRESHOLD`)

**Services Backend:**
- Files: kebab-case (`audio-manager.ts`, `event-detector.ts`)
- Classes: PascalCase (`AudioManager`, `EventDetector`)
- Methods: camelCase (`startStreaming()`, `detectSilence()`)

### Padrões de Estrutura

**Test Organization:**
- Test files: `*.test.ts` co-localizados com source
- Exemplo: `audio-manager.ts` → `audio-manager.test.ts`
- Integration tests: `__tests__/integration/`
- Setup: `__tests__/setup.ts`

**Component Organization:**
- Por feature (Dashboard/, Player/, Diagnostics/)
- Shared components: `components/common/`
- Hooks: `hooks/` (top-level)
- Utils: `lib/` (top-level)

**Backend Organization:**
- Services: lógica de negócio (`services/`)
- Routes: endpoints HTTP (`routes/`)
- Lib: Prisma Client singleton (`lib/prisma.ts`)
- Prisma: Schema e migrations (`prisma/`)
- Utils: helpers genéricos (`utils/`)
- Workers: background jobs (`workers/`)

**Prisma Usage:**
- Importar Prisma Client de `@/lib/prisma`
- Usar Prisma Client diretamente em services/routes
- Não criar camada de "models" separada - Prisma Client é o model
- Exemplo: `const sessions = await prisma.session.findMany()`

### Padrões de Formato

**API Response Format:**
```typescript
// Success
{
  data: T | T[],
  meta?: {
    total?: number,
    limit?: number,
    offset?: number
  }
}

// Error
{
  error: {
    message: string,
    code?: string,
    details?: unknown
  }
}
```

**Error Format:**
- HTTP status codes padrão (200, 400, 404, 500)
- Error response sempre `{ error: { message, code?, details? } }`
- Logging: Winston com nível apropriado (error, warn, info)

**Date Format:**
- JSON: ISO 8601 strings (`"2025-01-27T14:30:00Z"`)
- Database: DATETIME (SQLite armazena como TEXT ISO)
- UI: formatado via `date-fns` v4 (locale-aware, timezone support nativo)
- Timezone: UTC no backend, convertido no frontend via `date-fns` timezone support se necessário
- **date-fns v4**: Usar imports nomeados: `import { format, formatDistance } from 'date-fns'`

### Padrões de Comunicação

**WebSocket Events:**
- Client → Server: `{ type: "subscribe", channels: [...] }`
- Server → Client: `{ type: "status" | "audio_event" | "track_recognized", data: {...} }`
- Event naming: snake_case (`audio_event`, `track_recognized`)

**EventBus Events:**
- Event types: dot notation (`silence.detected`, `session.started`)
- Payload: objeto plano, serializável
- Handlers: async functions, nunca lançam exceções não tratadas

### Padrões de Lifecycle

**Loading States:**
- Backend: não retorna até operação completa (exceto streams)
- Frontend: `useState<boolean>` para loading flags
- UI: componente `Loading.tsx` reutilizável

**Error Recovery:**
- Backend: try-catch em todos async operations, log + resposta HTTP adequada
- Frontend: Error boundaries para React errors, toast notifications para API errors
- Retry logic: 3 tentativas com exponential backoff para operações críticas (V2+)

### Padrões de Localização

**API Route Structure:**
- `/api/health` - Health check
- `/api/status` - Status sistema
- `/api/sessions` - CRUD sessões
- `/api/events` - Eventos (V1)
- `/api/albums` - Coleção (V2)
- `/api/recognize` - Reconhecimento (V2)
- `/api/recordings` - Gravações (V3)

**Static Assets:**
- Frontend build: `frontend/dist/`
- Serve via Express static middleware em produção
- Audio files: `data/recordings/` (V3)

**Config Files:**
- Root: `config/default.yaml`, `config/production.yaml`
- Environment: `.env` (não commitado)
- Icecast: `config/icecast.xml`

### Padrões de Consistência

**UI Date Formatting:**
- `date-fns` v4 `format()` para formatação
- Imports: `import { format, formatDistance, formatRelative } from 'date-fns'`
- Locale: `pt-BR` (Portuguese BR): `import { ptBR } from 'date-fns/locale'`
- Exemplos: "27 de janeiro de 2025", "14:30"
- Timezone support: Usar `TZDate` ou `UTCDate` se necessário para conversões específicas

**Logging Format:**
- Winston structured logging
- Format: JSON em produção, readable em desenvolvimento
- Levels: error, warn, info, debug
- Context: incluir `sessionId`, `userId` (se aplicável) quando disponível

**User-Facing Errors:**
- Mensagens em português BR
- Técnicas mas acessíveis
- Sem stack traces expostos
- Código de erro para troubleshooting (`ERROR_AUDIO_DEVICE_NOT_FOUND`)

## Arquitetura de Dados

### Prisma Schema (Modelos Principais)

**V1 Models:**
```prisma
model Session {
  id              String       @id @default(uuid())
  startedAt       DateTime     @default(now())
  endedAt         DateTime?
  durationSeconds Int          @default(0)
  eventCount      Int          @default(0)
  audioEvents     AudioEvent[]
  tracks          Track[]      // V2
  recordings      Recording[]  // V3
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([startedAt(sort: Desc)])
}

model AudioEvent {
  id          String   @id @default(uuid())
  sessionId   String?
  session     Session? @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  eventType   String
  timestamp   DateTime @default(now())
  metadata    Json?
  
  @@index([sessionId, timestamp])
  @@index([eventType, timestamp])
}

model Setting {
  key       String   @id
  value     String
  type      String   @default("string") // string|number|boolean|json
  updatedAt DateTime @updatedAt
}
```

**V2 Additions:**
```prisma
model Album {
  id            String       @id @default(uuid())
  title         String
  artist        String
  year          Int?
  label         String?
  format        String?      // LP, 7", 12"
  coverUrl      String?
  discogsId     Int?         @unique
  condition     String?      // mint, VG+, VG
  tags          Json?        // Array de strings
  notes         String?
  tracks        Track[]      // V2
  chromaprint   Chromaprint? // V3
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([artist])
  @@index([title])
}

model Track {
  id                String    @id @default(uuid())
  sessionId         String
  session           Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  albumId           String?
  album             Album?    @relation(fields: [albumId], references: [id], onDelete: SetNull)
  title             String
  artist            String
  albumName         String?
  albumArtUrl       String?
  year              Int?
  label             String?
  isrc              String?
  durationSeconds   Int?
  confidence        Float     @default(0)
  recognitionSource String    @default("manual") // acrcloud, audd, manual
  recognizedAt      DateTime  @default(now())
  metadata          Json?

  @@index([albumId])
  @@index([recognizedAt(sort: Desc)])
}

model RecognitionCache {
  hash      String   @id
  trackData Json
  expiresAt DateTime

  @@index([expiresAt])
}
```

**V3 Additions:**
```prisma
model Recording {
  id             String    @id @default(uuid())
  sessionId      String
  session        Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  albumId        String?
  album          Album?    @relation(fields: [albumId], references: [id], onDelete: SetNull)
  filePath       String
  format         String    @default("flac")
  sampleRate     Int?
  bitDepth       Int?
  durationSeconds Int?
  fileSizeBytes  Int?
  qaReport       QaReport? // V3
  createdAt      DateTime  @default(now())

  @@index([sessionId, createdAt(sort: Desc)])
}

model Chromaprint {
  id              String  @id @default(uuid())
  albumId         String  @unique
  album           Album   @relation(fields: [albumId], references: [id], onDelete: Cascade)
  fingerprint     String  // Base64 encoded
  durationSeconds Int?
  createdAt       DateTime @default(now())
}

model QaReport {
  id                  String    @id @default(uuid())
  recordingId         String    @unique
  recording           Recording @relation(fields: [recordingId], references: [id], onDelete: Cascade)
  albumId             String?
  album               Album?    @relation(fields: [albumId], references: [id], onDelete: SetNull)
  snrDb               Float?
  wowFlutterPercent   Float?
  clicksCount         Int?
  popsCount           Int?
  highFreqRolloffDb   Float?
  clippingEvents      Int?
  healthScore         Int?      // 0-100
  metadata            Json?
  createdAt           DateTime  @default(now())

  @@index([recordingId])
}
```

### Relacionamentos

- `Session` 1:N `AudioEvent` (V1)
- `Session` 1:N `Track` (V2)
- `Session` 1:N `Recording` (V3)
- `Album` 1:N `Track` (V2, optional)
- `Album` 1:1 `Chromaprint` (V3)
- `Recording` 1:1 `QaReport` (V3, optional)

**Índices**: Definidos via `@@index` no Prisma schema (exemplos acima).

## Contratos de API

### Endpoints REST Principais

**System:**
- `GET /api/health` - Health check
- `GET /api/status` - Status completo do sistema

**Sessions:**
- `GET /api/sessions?limit=20&offset=0&date_from=&date_to=`
- `GET /api/sessions/:id`
- `POST /api/sessions` (criação manual, raro)

**Events (V1):**
- `GET /api/events?session_id=&limit=100&offset=0`
- `GET /api/events/stats?date_from=&date_to=`

**Albums (V2):**
- `GET /api/albums?limit=50&offset=0&search=&filter=`
- `POST /api/albums`
- `GET /api/albums/:id`
- `PUT /api/albums/:id`
- `DELETE /api/albums/:id`
- `POST /api/albums/import-discogs`

**Recognition (V2):**
- `POST /api/recognize` - Trigger reconhecimento

**Recordings (V3):**
- `GET /api/recordings?session_id=&limit=20`
- `GET /api/recordings/:id`
- `DELETE /api/recordings/:id`

**Settings:**
- `GET /api/settings`
- `PUT /api/settings`

### WebSocket Events

**Client → Server:**
```typescript
{ type: "subscribe", channels: ["status", "events", "recognition"] }
{ type: "recognize", force?: boolean } // V2
```

**Server → Client:**
```typescript
// Status update (5s interval)
{ type: "status", data: { streaming, listeners, session_active, audio_level_db } }

// Audio event (V1)
{ type: "audio_event", data: { event_type, timestamp, metadata } }

// Track recognized (V2)
{ type: "track_recognized", data: { title, artist, album, album_art, confidence, timestamp, album_match? } }

// Session changed
{ type: "session_changed", data: { event: "started" | "ended", session_id, timestamp } }
```

## Arquitetura de Segurança

**Princípios:**
- Local-first: operação sem internet (exceto reconhecimento V2+)
- No authentication: sistema single-user local
- Network isolation: Icecast2 bind apenas em rede local (192.168.x.x)
- Secrets: API keys apenas em `.env` (não commitado)
- File permissions: database e gravações com permissões restritas

**Recomendações:**
- Firewall: `ufw` bloqueando portas desnecessárias
- HTTPS: opcional via reverse proxy (Nginx) se acesso remoto necessário
- Backups: automáticos do database e configurações

## Considerações de Performance

**NFRs do PRD:**
- CPU idle: ≤15% com streaming ativo (Pi 5)
- Memória: ≤200MB backend completo
- Latência: ≤2s end-to-end (click → som)
- Uptime: ≥99% em 7 dias

**Estratégias:**
- **Streaming**: FFmpeg otimizado para baixa latência (buffer 512-2048 samples)
- **Database**: SQLite WAL mode, índices apropriados, queries otimizadas
- **Frontend**: Code splitting, lazy loading de rotas, asset optimization via Vite
- **Caching**: In-memory cache para configurações, recognition cache (V2)
- **Dual-Path (V3)**: Buffer circular, sincronização eficiente, <5% overhead

## Arquitetura de Deploy

**Target:**
- Raspberry Pi 4B/5 com Raspberry Pi OS (64-bit)
- Process manager: PM2
- Reverse proxy: Nginx (opcional, para HTTPS)
- Auto-start: systemd service (PM2)

**Deploy Process:**
1. Clone repositório
2. `npm install` (backend e frontend)
3. `npm run build` (frontend)
4. Configurar `.env` e `config/*.yaml`
5. Instalar Icecast2 (sistema): `sudo apt install icecast2`
6. Configurar Icecast2: `config/icecast.xml`
7. `pm2 start ecosystem.config.js`
8. `pm2 save` + `pm2 startup`

**Monitoring:**
- PM2: `pm2 monit`, `pm2 logs`
- Winston: logs em `data/logs/`
- Health endpoint: `/api/health` para external monitoring

## Ambiente de Desenvolvimento

### Pré-requisitos

- Node.js 20.x LTS
- npm 10.x+
- SQLite3 (sistema)
- FFmpeg (sistema, para desenvolvimento/testes)
- TypeScript 5.x+
- Git

### Comandos de Setup

```bash
# Backend
cd backend
npm install

# Prisma
npx prisma generate          # Gerar Prisma Client
npx prisma migrate dev       # Criar e aplicar migrations
npx prisma studio            # GUI para visualizar dados (opcional)

npm run dev        # Desenvolvimento (ts-node)
npm run build      # Build TypeScript
npm start          # Produção (node dist/server.js)

# Frontend
cd frontend
npm install

# Configurar Tailwind v4 no vite.config.ts
# (ver seção de configuração abaixo)

# shadcn/ui
npx shadcn@latest init
# Escolher: Style: New York, Base color: Neutral, CSS variables: true

# Adicionar tema tweakcn
npx shadcn@latest add https://tweakcn.com/r/themes/modern-minimal.json

# Adicionar componentes conforme necessário
npx shadcn@latest add button card table dialog

npm run dev        # Dev server (Vite)
npm run build      # Build produção
npm run preview    # Preview build produção

# Database
# SQLite criado automaticamente via Prisma migrate
# Migrações: `npx prisma migrate dev` (automático)

# Icecast2 (desenvolvimento local, opcional)
# Pode usar mock ou instalar localmente
sudo apt install icecast2
```

### Configuração Tailwind v4 + Vite

**vite.config.ts:**
```typescript
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

**src/styles/globals.css:**
```css
@import "tailwindcss";

/* CSS Variables do tema tweakcn (Modern Minimal) */
/* Adicionadas automaticamente pelo comando shadcn add */
```

**tsconfig.json e tsconfig.app.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Registros de Decisões Arquiteturais (ADRs)

### ADR-001: SQLite ao invés de PostgreSQL

**Contexto:** Sistema single-user, local-first, baixo volume de dados.

**Decisão:** SQLite3 para simplicidade operacional.

**Consequências:**
- ✅ Zero configuração
- ✅ Backup fácil (arquivo único)
- ✅ Performance suficiente (<10k tracks/ano)
- ⚠️ Limitações: concorrência de escrita, sem replicação

### ADR-001b: Prisma ao invés de better-sqlite3

**Contexto:** Necessidade de migrations entre versões (V1→V2→V3), type safety, melhor DX.

**Decisão:** Prisma ORM desde V1 para type-safe database access e migrations automáticas.

**Consequências:**
- ✅ Type safety automático (tipos gerados)
- ✅ Migrations automáticas (V1→V2→V3 facilitado)
- ✅ Query builder type-safe (menos erros em runtime)
- ✅ Melhor DX (IntelliSense, validação de schema)
- ⚠️ Overhead pequeno (~500KB bundle, aceitável no backend)
- ⚠️ Requer `prisma generate` após mudanças no schema

### ADR-002: Icecast2 + FFmpeg ao invés de WebRTC

**Contexto:** Latência 1-2s aceitável, necessidade de compatibilidade universal.

**Decisão:** Icecast2 para streaming HTTP, FFmpeg para processamento.

**Consequências:**
- ✅ Compatibilidade universal (qualquer player)
- ✅ Menor complexidade vs WebRTC
- ✅ "Just works" sem codecs específicos
- ⚠️ Latência 1-2s (não sub-segundo)

### ADR-003: Monolito ao invés de Microserviços

**Contexto:** Sistema single-user, hardware limitado (Pi), baixa escala.

**Decisão:** Arquitetura monolítica com separação clara de concerns.

**Consequências:**
- ✅ Simplicidade operacional
- ✅ Baixo overhead
- ✅ Debugging mais fácil
- ⚠️ Scaling horizontal não suportado (não necessário)

### ADR-004: Dual-Path Architecture (V3)

**Contexto:** Necessidade de gravação FLAC paralela sem degradar streaming.

**Decisão:** Dois processos FFmpeg separados com buffer circular compartilhado.

**Consequências:**
- ✅ Gravação lossless sem afetar stream
- ✅ Pré-roll via buffer circular
- ✅ Sincronização sample-accurate
- ⚠️ Complexidade aumentada, uso de memória maior

### ADR-005: Reconhecimento Sonoro antes de Musical (V1)

**Contexto:** Reduzir risco técnico, validar eventos básicos primeiro.

**Decisão:** V1 foca em eventos sonoros (silêncio, sessões), V2 adiciona reconhecimento musical.

**Consequências:**
- ✅ Validação progressiva de features
- ✅ Sistema funcional sem APIs externas (V1)
- ✅ Fundação sólida para V2+
- ⚠️ Reconhecimento musical só disponível V2+

### ADR-006: shadcn/ui + Tailwind v4 ao invés de biblioteca de componentes tradicional

**Contexto:** Necessidade de componentes UI acessíveis, customizáveis, sem vendor lock-in.

**Decisão:** shadcn/ui com Tailwind CSS v4 e tema tweakcn (Modern Minimal).

**Consequências:**
- ✅ Componentes copy-paste (sem dependência runtime)
- ✅ Totalmente customizável (código no projeto)
- ✅ Acessibilidade built-in (Radix UI primitives)
- ✅ Tailwind v4: melhorias de performance e bundle
- ✅ Tema tweakcn: base moderna e minimalista
- ⚠️ Requer configuração inicial (shadcn init)
- ⚠️ Componentes adicionados manualmente via CLI (não bundle)

---

_Gerado por BMAD Decision Architecture Workflow v1.3.2_  
_Data: 2025-01-27_  
_Para: Thiago_
