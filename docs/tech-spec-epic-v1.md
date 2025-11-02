# Epic Technical Specification: Foundation Core (MVP)

Date: 2025-11-02
Author: Thiago
Epic ID: v1
Status: Draft

---

## Overview

Epic V1 - Foundation Core estabelece a funcionalidade MVP do Vinyl-OS com streaming estável de áudio, detecção de eventos sonoros básicos (silêncio, sessões, troca de faixa, clipping), e interface web minimalista para monitoramento e controle. Este épico foca em criar uma base sólida e estável antes de adicionar features complexas, implementando captura de áudio via ALSA, streaming via Icecast2/FFmpeg, sistema de eventos pub/sub interno (EventBus), persistência SQLite via Prisma, e UI React com diagnóstico em tempo real.

O Epic V1 é a fundação do sistema, priorizando estabilidade, baixa latência (~1-2s end-to-end), e operação local-first. Todas as funcionalidades são locais, sem dependências de APIs externas, permitindo operação completa sem internet.

## Objectives and Scope

**In Scope:**
- Captura de áudio estável via ALSA (plughw:1,0) com FFmpeg
- Streaming MP3 320kbps CBR via Icecast2 (mount point `/stream`)
- Detecção de eventos sonoros: silêncio, clipping, troca de faixa (calibrável), sessões
- EventBus pub/sub interno para comunicação desacoplada entre componentes
- Persistência SQLite via Prisma: sessions, audio_events, settings
- Interface web SPA React com: Player, Dashboard, Diagnóstico (VU meter, configuração de thresholds), Histórico de Sessões, Configurações
- WebSocket (Socket.io) para updates em tempo real
- PM2 configuration para auto-start e process management
- Install script completo para Raspberry Pi OS
- Documentação básica (README, troubleshooting)

**Out of Scope (V1):**
- Reconhecimento musical (V2)
- Gestão de coleção de discos (V2)
- Gravação FLAC lossless (V3)
- Análise de qualidade (QA) (V3)
- Integrações externas (Last.fm, MQTT, webhooks) (V4)
- Multiroom sincronizado
- Edição ou processamento de áudio

## System Architecture Alignment

O Epic V1 implementa os componentes core da arquitetura monolítica Node.js:

**Backend Components:**
- `audio-manager.ts`: Gerencia captura ALSA via FFmpeg child process e streaming para Icecast2
- `event-detector.ts`: Analisa nível de áudio em tempo real e detecta eventos sonoros (silêncio, clipping, troca de faixa, sessões)
- `event-bus.ts`: Sistema pub/sub interno simples para comunicação entre componentes
- Prisma Client: Type-safe database access (sessions, audio_events, settings)
- Express routes: `/api/health`, `/api/status`, `/api/events`, `/api/sessions`, `/api/settings`
- Socket.io server: WebSocket para updates em tempo real

**Frontend Components:**
- Player: HTML5 Audio element conectando em `http://pi.local:8000/stream`
- Dashboard: Status sistema, sessão ativa, últimos eventos
- Diagnostics: VU meter, configuração de thresholds, log de eventos, calibração manual
- Sessions: Histórico de sessões com eventos
- Settings: Configuração de dispositivo de áudio, thresholds, tema

**External Services:**
- Icecast2 (porta 8000): Servidor de streaming, instalado no sistema

**Performance Constraints (NFRs do PRD):**
- CPU idle: ≤15% com streaming ativo (Pi 5)
- Memória: ≤200MB backend completo
- Latência: ≤2s end-to-end (click no vinil → som no browser)
- Uptime: ≥99% em 7 dias contínuos

## Detailed Design

### Services and Modules

| Service/Module | Responsibilities | Inputs/Outputs | Owner |
|----------------|------------------|----------------|-------|
| `audio-manager.ts` | Captura ALSA via FFmpeg, encode MP3, stream para Icecast2, monitoring de nível de áudio | Input: ALSA device (`plughw:1,0`), Output: HTTP stream para Icecast2, audio level events via EventBus | Backend |
| `event-detector.ts` | Análise de nível de áudio, detecção de silêncio, clipping, troca de faixa, sessões | Input: audio level events (EventBus), Output: eventos detectados (EventBus) | Backend |
| `event-bus.ts` | Pub/sub interno para eventos | Input: publish events, Output: notify subscribers | Backend |
| Prisma Client (`lib/prisma.ts`) | Type-safe database access, migrations | Input: queries, Output: data from SQLite | Backend |
| Express Routes | REST API endpoints | Input: HTTP requests, Output: JSON responses | Backend |
| Socket.io Server | WebSocket real-time updates | Input: eventos via EventBus, Output: WebSocket messages para clients | Backend |
| React SPA | Interface web completa | Input: API data + WebSocket events, Output: UI interativa | Frontend |

### Data Models and Contracts

**Prisma Schema (V1):**

```prisma
// Sessões de escuta
model Session {
  id              String       @id @default(uuid())
  startedAt       DateTime     @default(now())
  endedAt         DateTime?
  durationSeconds Int          @default(0)
  eventCount      Int          @default(0)
  audioEvents     AudioEvent[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([startedAt(sort: Desc)])
}

// Eventos de áudio detectados
model AudioEvent {
  id          String   @id @default(uuid())
  sessionId   String?
  session     Session? @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  eventType   String   // 'silence', 'silence_ended', 'track_change', 'clipping', 'session_start', 'session_end', 'turntable_idle', 'turntable_active'
  timestamp   DateTime @default(now())
  metadata    Json?    // { level_db?, duration?, threshold? }
  
  @@index([sessionId, timestamp])
  @@index([eventType, timestamp])
}

// Configurações
model Setting {
  key       String   @id
  value     String
  type      String   @default("string") // string|number|boolean|json
  updatedAt DateTime @updatedAt
}
```

**Field Types:**
- `id`: UUID string (auto-generated)
- `startedAt`, `endedAt`, `timestamp`: ISO 8601 DateTime (SQLite TEXT)
- `durationSeconds`, `eventCount`: Integer
- `eventType`: String (valores específicos)
- `metadata`: JSON (objeto serializável)

**Relationships:**
- Session 1:N AudioEvent (cascade delete)

### APIs and Interfaces

**REST Endpoints:**

```typescript
// System
GET /api/health
Response: { status: "healthy" | "degraded", streaming: boolean, uptime: number, cpu: number, memory: number, temperature: number }

GET /api/status
Response: {
  session: { id, started_at, duration, event_count } | null,
  streaming: { active, listeners, bitrate, mount_point },
  audio: { level_db, clipping_detected, silence_detected }
}

// Events
GET /api/events?session_id=&limit=100&offset=0
Response: { events: [...], total, has_more }

GET /api/events/stats?date_from=&date_to=
Response: { total_events, by_type: {...}, sessions_count }

// Sessions
GET /api/sessions?limit=20&offset=0&date_from=&date_to=
Response: { sessions: [...], total, has_more }

GET /api/sessions/:id
Response: { id, started_at, ended_at, duration, events: [...] }

// Settings
GET /api/settings
Response: { audio: {...}, streaming: {...}, event_detection: {...} }

PUT /api/settings
Body: { audio: {...}, streaming: {...}, event_detection: {...} }
Response: { success: boolean }
```

**WebSocket Events (Socket.io):**

```typescript
// Client → Server
{ type: "subscribe", channels: ["status", "events", "session"] }
{ type: "trigger_event", event_type: string } // Testing only

// Server → Client
{ type: "status", data: { streaming, listeners, session_active, audio_level_db } } // 5s interval
{ type: "audio_event", data: { event_type, timestamp, metadata } }
{ type: "session_changed", data: { event: "started" | "ended", session_id, timestamp } }
```

**EventBus Interface:**

```typescript
// Eventos V1
- audio.start
- audio.stop
- silence.detected
- silence.ended
- turntable.idle
- turntable.active
- track.change.detected
- session.started
- session.ended
- clipping.detected

// API
eventBus.publish(event: string, payload: object): void
eventBus.subscribe(event: string, handler: (payload) => Promise<void>): void
```

### Workflows and Sequencing

**Workflow 1: Streaming Startup**
1. User inicia backend (`pm2 start`)
2. AudioManager inicializa: spawn FFmpeg process
3. FFmpeg captura ALSA device (`plughw:1,0`)
4. FFmpeg encode PCM → MP3 320kbps CBR
5. FFmpeg stream HTTP POST → Icecast2 (`/stream`)
6. Icecast2 disponibiliza mount point para clients
7. Frontend Player conecta em `http://pi.local:8000/stream`
8. Audio playback via HTML5 Audio element

**Workflow 2: Event Detection**
1. AudioManager monitora nível de áudio (FFmpeg metadata)
2. EventDetector recebe audio level events via EventBus
3. EventDetector analisa thresholds:
   - Silêncio: level < threshold (-50dB) por duration (10s)
   - Clipping: level > threshold (-1dB)
   - Troca de faixa: mudança abrupta + silêncio curto
4. EventDetector emite eventos via EventBus (`silence.detected`, etc.)
5. Backend persiste evento no database (AudioEvent via Prisma)
6. Socket.io emite evento para frontend clients
7. Frontend atualiza UI em tempo real

**Workflow 3: Session Management**
1. EventDetector detecta áudio após período idle → emite `session.started`
2. Backend cria registro Session no database (via Prisma)
3. Backend emite WebSocket event `session_changed`
4. Frontend exibe sessão ativa
5. EventDetector conta eventos durante sessão
6. EventDetector detecta silêncio prolongado (30min) → emite `session.ended`
7. Backend atualiza Session (endedAt, duration, eventCount)
8. Backend emite WebSocket event `session_changed`
9. Frontend remove sessão ativa

**Workflow 4: Diagnostics & Calibration**
1. User acessa página Diagnostics
2. Frontend conecta WebSocket (canal "status")
3. Backend envia audio_level_db a cada 5s
4. Frontend renderiza VU meter em tempo real
5. User ajusta thresholds via UI (silence_threshold, track_change_sensitivity)
6. Frontend envia `PUT /api/settings`
7. Backend atualiza settings no database (via Prisma)
8. Backend aplica novos thresholds em EventDetector
9. EventDetector usa novos valores em detecção
10. Frontend mostra log de eventos detectados (últimos 100)

## Non-Functional Requirements

### Performance

- **Latência end-to-end**: ≤2s (click no vinil → som no browser)
  - ALSA capture latency: ~50ms (buffer configurável 512-2048 samples)
  - FFmpeg processing: ~100ms
  - Network streaming: ~500ms (rede local)
  - Browser playback buffer: ~500ms
  - Total: ~1.15s baseline, aceitar até 2s

- **CPU Usage**: ≤15% em idle com streaming ativo (Pi 5)
  - FFmpeg: ~8-10%
  - Node.js backend: ~3-5%
  - Icecast2: ~1-2%

- **Memory**: ≤200MB backend completo
  - Node.js heap: ~80-100MB
  - FFmpeg buffer: ~20-30MB
  - Prisma Client: ~10MB
  - Icecast2: ~30MB

- **Throughput**: Suportar até 20 clients simultâneos (configurável)
  - Bitrate: 320kbps CBR = ~40KB/s por client
  - Total bandwidth: 20 * 40KB/s = 800KB/s (~6.4 Mbps)

### Security

- **Local-first**: Sistema opera completamente local, sem internet necessária
- **Network isolation**: Icecast2 bind apenas em rede local (192.168.x.x, 10.x.x.x)
- **No authentication**: Single-user local system (V1-V2), autenticação não necessária
- **File permissions**: Database e logs com permissões restritas (owner read/write)
- **Secrets**: Nenhum secret em V1 (Icecast password em config, não exposto)
- **Input validation**: Validação de parâmetros em todas rotas API
- **Error messages**: User-friendly, sem stack traces expostos

### Reliability/Availability

- **Uptime**: ≥99% em 7 dias contínuos
  - Target: 24/7 streaming sem interrupções
  - Acceptable downtime: ~100 min/semana

- **Auto-restart**: PM2 auto-restart em caso de crash
  - Max restarts: 10 por minuto (evitar crash loop)
  - Exponential backoff em falhas consecutivas

- **Error recovery**:
  - FFmpeg crash → restart automático via PM2
  - ALSA device disconnect → retry connection (3 tentativas, 5s delay)
  - Icecast2 unavailable → retry stream connection (exponential backoff)
  - Database lock → retry query (3 tentativas, 100ms delay)

- **Graceful shutdown**: SIGTERM handling para fechar sessões e salvar estado

- **Data integrity**: SQLite WAL mode para evitar corrupção em crash

### Observability

- **Logging**: Winston structured logging
  - Levels: error, warn, info, debug
  - Format: JSON em produção, readable em desenvolvimento
  - Rotation: daily, máx 14 dias
  - Location: `data/logs/app.log`, `data/logs/error.log`

- **Metrics**: Health endpoint `/api/health`
  - Uptime, CPU, memória, temperatura (Pi)
  - Streaming status, listeners count
  - Last error timestamp

- **Events**: Todos eventos detectados persistidos no database
  - Query via `/api/events/stats` para análise temporal
  - WebSocket events para monitoring em tempo real

- **Diagnostics UI**: VU meter + log de eventos + configuração de thresholds

## Dependencies and Integrations

**System Dependencies:**
- Node.js 20.x LTS
- FFmpeg 5.x+ (sistema): `sudo apt install ffmpeg`
- Icecast2 2.4.x+ (sistema): `sudo apt install icecast2`
- ALSA utils (sistema): `sudo apt install alsa-utils`
- SQLite3 (sistema): `sudo apt install sqlite3`
- PM2 ^5.4.3 (global): `npm install -g pm2`

**Backend Dependencies (package.json):**
```json
{
  "dependencies": {
    "express": "^4.21.2",
    "socket.io": "^4.8.2",
    "@prisma/client": "^6.16.0",
    "winston": "^3.15.0",
    "winston-daily-rotate-file": "^5.0.0",
    "dotenv": "^16.4.7",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^5.0.0",
    "typescript": "^5.7.3",
    "ts-node": "^10.9.2",
    "prisma": "^6.16.0"
  }
}
```

**Frontend Dependencies (package.json):**
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.20.0",
    "socket.io-client": "^4.8.2",
    "tailwindcss": "^4.1.2",
    "@tailwindcss/vite": "^4.1.2",
    "recharts": "^2.15.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.0",
    "typescript": "^5.7.3"
  }
}
```

**Integration Points:**
- Backend → FFmpeg: child_process spawn, stdin/stdout pipes
- Backend → Icecast2: HTTP POST (stream source)
- Backend → Prisma → SQLite: Prisma Client queries
- Backend → Frontend: REST API (Express) + WebSocket (Socket.io)
- Frontend → Icecast2: HTML5 Audio element HTTP stream

**Version Constraints:**
- Node.js: 20.x LTS (verificar com `node --version`)
- npm: ≥10.0.0
- FFmpeg: ≥5.0 (verificar com `ffmpeg -version`)
- Icecast2: ≥2.4.0

## Acceptance Criteria (Authoritative)

**AC-01**: Stream funciona por 24h sem interrupção
- Given: Sistema iniciado com `pm2 start`
- When: Streaming ativo por 24h contínuas
- Then: Uptime ≥99%, sem crashes, audio ininterrupto

**AC-02**: Detecção de eventos sonoros funciona com ≥85% precisão
- Given: Sessão de escuta com eventos conhecidos (silêncio, sessões)
- When: Eventos ocorrem (vinil tocando → pausa → retoma)
- Then: Sistema detecta ≥85% dos eventos corretamente

**AC-03**: UI carrega em <2s na rede local
- Given: Frontend build produção servido via Express static
- When: User acessa `http://pi.local:3000` na rede local
- Then: Página inicial carrega em <2s (FCP)

**AC-04**: Sessões são detectadas e salvas corretamente
- Given: Sistema idle (sem áudio)
- When: Vinil começa a tocar
- Then: Sessão criada no database com timestamp correto
- And: Sessão exibida na UI como ativa
- When: Vinil para por 30min (session timeout)
- Then: Sessão finalizada no database (endedAt, duration atualizados)

**AC-05**: Interface de diagnóstico permite ajustar thresholds
- Given: User na página Diagnostics
- When: User ajusta silence_threshold de -50dB para -45dB
- Then: Setting salvo no database via `PUT /api/settings`
- And: EventDetector aplica novo threshold imediatamente
- And: Próximos eventos usam novo threshold

**AC-06**: Install script funciona no Pi OS 64-bit limpo
- Given: Raspberry Pi com Pi OS 64-bit limpo (fresh install)
- When: User executa `./scripts/install.sh`
- Then: Script instala todas dependências sem erros
- And: Sistema inicia com `pm2 start` e streaming funciona
- And: Frontend acessível em `http://pi.local:3000`

**AC-07**: Documentação cobre setup básico
- Given: User com Pi OS 64-bit e hardware correto
- When: User segue README.md passo a passo
- Then: User consegue setup completo em ≤30 min
- And: Streaming funciona sem necessidade de troubleshooting

**AC-08**: VU meter mostra nível de áudio em tempo real
- Given: User na página Diagnostics com streaming ativo
- When: Áudio tocando
- Then: VU meter atualiza a cada 5s via WebSocket
- And: Nível exibido em dB corresponde ao áudio real

**AC-09**: Log de eventos na UI mostra últimos 100 eventos
- Given: User na página Diagnostics
- When: Eventos são detectados
- Then: Log exibe eventos em ordem cronológica reversa
- And: Máximo 100 eventos visíveis (scroll)

**AC-10**: Calibração manual de troca de faixa funcional
- Given: User na página Diagnostics
- When: User ajusta track_change_sensitivity (0-1)
- Then: Detecção de troca de faixa usa nova sensibilidade
- And: User pode testar e ajustar até precisão aceitável

**AC-11**: Histórico de sessões mostra lista completa
- Given: Database com múltiplas sessões
- When: User acessa página Sessions
- Then: Lista mostra todas sessões com data, duração, event_count
- And: Filtros por data funcionam (date_from, date_to)
- And: Paginação funciona (limit, offset)

**AC-12**: Dark mode funcional
- Given: User na página Settings
- When: User seleciona tema escuro
- Then: Interface muda para dark mode imediatamente
- And: Preferência salva no database
- And: Dark mode persiste após reload

**AC-13**: WebSocket reconnect automático funciona
- Given: Cliente conectado via WebSocket
- When: Conexão é perdida (backend restart)
- Then: Cliente reconecta automaticamente em <5s
- And: Events são recebidos novamente

**AC-14**: Error handling robusto
- Given: Sistema em operação
- When: Erro ocorre (ex: device disconnect)
- Then: Backend loga erro com Winston (level: error)
- And: API retorna HTTP 500 com mensagem user-friendly
- And: Frontend exibe toast notification com erro
- And: Sistema continua operando (não crash)

**AC-15**: PM2 auto-restart funciona
- Given: Sistema rodando via PM2
- When: Backend crash (unhandled exception)
- Then: PM2 restart automático em <3s
- And: Logs indicam restart (pm2 logs)

**AC-16**: Detecção de clipping funciona
- Given: Áudio com nível > -1dB (clipping)
- When: Clipping ocorre
- Then: Evento `clipping.detected` emitido via EventBus
- And: Evento salvo no database
- And: Frontend exibe notificação visual

**AC-17**: Configuração de dispositivo de áudio funciona
- Given: User na página Settings
- When: User seleciona dispositivo diferente (dropdown)
- Then: Setting salvo no database
- And: AudioManager reinicia com novo device
- And: Streaming continua com novo device

**AC-18**: Export CSV do histórico funciona
- Given: User na página Sessions
- When: User clica "Export CSV"
- Then: Arquivo CSV gerado com todas sessões
- And: Download automático no browser

## Traceability Mapping

| AC | Spec Section(s) | Component(s)/API(s) | Test Idea |
|----|----------------|---------------------|-----------|
| AC-01 | Streaming Engine | AudioManager, FFmpeg, Icecast2 | Long-running test (24h), monitorar uptime e crashes |
| AC-02 | Event Detection | EventDetector, EventBus | Test set com eventos conhecidos, validar precisão |
| AC-03 | Frontend | React SPA, Vite build | Lighthouse performance test, target FCP <2s |
| AC-04 | Session Management | EventDetector, Prisma (Session) | Simular idle → audio → idle (30min), validar database |
| AC-05 | Diagnostics UI | Diagnostics page, Settings API | UI test, alterar threshold, validar save + aplicação |
| AC-06 | Install Script | scripts/install.sh | Pi OS limpo, executar script, validar sucesso |
| AC-07 | Documentation | README.md | User testing, cronometrar setup, validar <30min |
| AC-08 | Diagnostics UI | VUMeter component, WebSocket | WebSocket test, validar update rate 5s |
| AC-09 | Diagnostics UI | EventLog component | Gerar >100 eventos, validar scroll e limit |
| AC-10 | Diagnostics UI | ThresholdConfig component | UI test, ajustar sensitivity, validar detecção |
| AC-11 | Sessions UI | Sessions page, Sessions API | Database com múltiplas sessões, validar filtros e paginação |
| AC-12 | Settings UI | Settings page, theme toggle | UI test, alternar tema, validar persistência |
| AC-13 | WebSocket | Socket.io client | Restart backend durante conexão, validar reconnect |
| AC-14 | Error Handling | Express error middleware | Simular erros (device disconnect), validar handling |
| AC-15 | PM2 Config | ecosystem.config.js | Crash test, validar PM2 restart automático |
| AC-16 | Event Detection | EventDetector (clipping) | Áudio com clipping, validar detecção e notificação |
| AC-17 | Settings UI | Settings page, AudioManager | Alterar device via UI, validar restart e streaming |
| AC-18 | Sessions UI | Export functionality | Clicar export, validar CSV gerado corretamente |

## Risks, Assumptions, Open Questions

**Risks:**

1. **Risk**: Detecção de troca de faixa imprecisa (<80% inicial)
   - **Probability**: Alta
   - **Impact**: Médio (feature opcional, não crítica)
   - **Mitigation**: UI de calibração manual, threshold ajustável, documentação de como calibrar

2. **Risk**: Latência maior que 2s em redes WiFi
   - **Probability**: Alta (WiFi instável)
   - **Impact**: Médio (experiência degradada)
   - **Mitigation**: Documentar Ethernet como recomendado, aceitar 1-2s como baseline

3. **Risk**: Memory leak em long-running (>7 dias)
   - **Probability**: Média
   - **Impact**: Alto (sistema crash)
   - **Mitigation**: PM2 restart diário agendado (cron), monitoring de memória via `/api/health`

4. **Risk**: SD card corruption após múltiplos writes
   - **Probability**: Baixa
   - **Impact**: Crítico (perda de dados)
   - **Mitigation**: SQLite WAL mode, backup automático diário, documentar uso de SD cards de qualidade (A1/A2)

5. **Risk**: FFmpeg incompatibilidade com ALSA device
   - **Probability**: Média (depende de hardware)
   - **Impact**: Alto (sem captura de áudio)
   - **Mitigation**: Testar com dispositivos comuns (Behringer UCA222), documentar troubleshooting, fallback para device alternativo

**Assumptions:**

1. Raspberry Pi 4B/5 com 4GB+ RAM disponível
2. Interface de áudio USB funcional (LINE input, não PHONO)
3. Rede local estável (Ethernet recomendado, WiFi aceitável)
4. Raspberry Pi OS 64-bit (Bookworm ou mais recente)
5. User tem acesso SSH ou físico ao Pi para setup inicial
6. Toca-discos configurado em modo LINE (se tiver switch PHONO/LINE)

**Open Questions:**

1. **Q**: Threshold padrão de -50dB para silêncio funciona universalmente?
   - **Status**: Assumir -50dB, validar com testes reais, UI permite ajuste

2. **Q**: Session timeout de 30min é apropriado?
   - **Status**: Assumir 30min, validar com usuários, tornar configurável via Settings

3. **Q**: Buffer size FFmpeg ideal para latência vs estabilidade?
   - **Status**: Default 1024 samples, testar range 512-2048, tornar configurável

4. **Q**: VU meter update rate (5s) é suficiente?
   - **Status**: Assumir 5s, validar com testes, considerar 1s se performance permitir

5. **Q**: Máximo 100 eventos no log UI é suficiente?
   - **Status**: Assumir 100, adicionar paginação/infinite scroll se necessário

## Test Strategy Summary

**Unit Tests:**
- `audio-manager.test.ts`: Captura ALSA, FFmpeg spawn, error handling
- `event-detector.test.ts`: Detecção de silêncio, clipping, troca de faixa, sessões
- `event-bus.test.ts`: Publish/subscribe, múltiplos listeners
- `prisma-client.test.ts`: CRUD operations (Session, AudioEvent, Setting)
- API routes tests: health, status, events, sessions, settings

**Integration Tests:**
- End-to-end streaming: ALSA → FFmpeg → Icecast2 → Browser
- Event detection → Database → WebSocket → UI update
- Session lifecycle: start → eventos → end (30min timeout)
- Settings update: UI → API → Database → EventDetector aplicação

**Performance Tests:**
- 24h long-running test: uptime, memory leak detection
- 20 clients simultâneos: streaming stability, bandwidth
- CPU/memory baseline: streaming idle, verificar ≤15% CPU, ≤200MB memory

**Acceptance Tests:**
- User testing: setup em <30min (seguindo README)
- Detecção de eventos: ≥85% precisão com eventos conhecidos
- UI responsiveness: carregamento <2s, WebSocket updates em tempo real
- Dark mode: funcional e persistente

**Test Environment:**
- Raspberry Pi 4B/5 (4GB RAM) com Pi OS 64-bit
- Behringer UCA222 (interface de áudio USB)
- Audio-Technica AT-LPW50PB (toca-discos LINE mode)
- Rede local (Ethernet Cat 6)

**Test Data:**
- Sessions de teste com eventos conhecidos (silêncio, troca de faixa)
- Database seed com múltiplas sessões para UI testing
- Audio samples para testes de detecção (silence, clipping, track changes)

**Test Tools:**
- Jest: Unit tests (backend)
- Supertest: API integration tests
- React Testing Library: Frontend component tests
- Playwright: E2E tests (UI flows)
- Artillery: Load testing (20 clients simultâneos)

**Coverage Target:**
- Unit tests: ≥80% coverage (critical paths: AudioManager, EventDetector)
- Integration tests: All major workflows (streaming, event detection, session management)
- E2E tests: Core user journeys (Player, Dashboard, Diagnostics, Sessions, Settings)

