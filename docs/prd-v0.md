# PRD — Vinyl-OS (Pi)

**Versão 2.0** — Documento revisado com foco em desenvolvimento incremental e core sólido

---

## 1. Resumo Executivo

**Vinyl-OS** é um sistema open-source para Raspberry Pi que transforma qualquer toca-discos em um streamer de áudio inteligente para a casa. 

**Core (v1)**: Captura estável do toca-discos, streaming local de alta qualidade via HTTP, reconhecimento básico de músicas, interface web moderna e histórico de sessões.

**Futuro (v2)**: Gravação FLAC com pré-roll, análise de qualidade do vinil (QA Score), reconhecimento offline avançado, e arquitetura de plugins.

É construído com Node.js, focado em estabilidade e baixa latência possível com HTTP streaming (~1-2s), oferecendo uma experiência "it just works" para usuários não-técnicos após o setup inicial.

---

## 2. Objetivos & Métricas de Sucesso

### Objetivos Primários (v1)
1. **Streaming confiável**: Áudio estável 24/7 sem interrupções
2. **Reconhecimento funcional**: Identificar >90% das músicas populares
3. **UX simples**: Interface que não requer manual
4. **Setup reproduzível**: Instalação consistente em <30 minutos

### Objetivos Secundários (v2)
5. Arquitetura extensível por plugins
6. Gravação de sessões completas
7. Análise técnica do vinil
8. Modo offline-first

### KPIs de Sucesso

#### v1 - Core
- **Uptime de streaming**: ≥99% em 7 dias contínuos
- **Latência end-to-end**: ≤2s (click no vinil → som no browser)
- **Taxa de reconhecimento**: ≥90% em álbuns mainstream (via ACRCloud/AudD)
- **Setup inicial**: ≤30 min do zero até streaming funcionando
- **CPU em idle** (Pi 5): ≤15% com streaming ativo
- **Memória**: ≤200MB para backend completo
- **Tempo de boot**: ≤45s do power-on até stream disponível

#### v2 - Avançado
- **Latência otimizada**: ≤1s com codec Opus e buffering mínimo
- **Reconhecimento misto**: 60% offline + 95% com cloud fallback
- **Gravação com pré-roll**: Capturar 5-10s antes do comando
- **QA Report**: ≤2 min para análise completa de um lado

### Fora de Escopo

#### v1
- Multiroom sincronizado
- Edição ou processamento de áudio
- Streaming para internet pública
- Integração com assistentes de voz
- Suporte a múltiplos toca-discos simultâneos

#### v2 
- Restauração de áudio (de-clicking em tempo real)
- Transcodificação para múltiplos formatos simultâneos
- Interface mobile nativa

---

## 3. Personas & Necessidades

### Persona Primária: "Vinyl Enthusiast"
**Perfil**: 30-50 anos, possui 50-500 LPs, setup mid-range (€500-2000)
**Necessidades**:
- Ouvir vinil pela casa sem fios adicionais
- Saber qual música está tocando
- Compartilhar o que está ouvindo (opcional)
- Não quer configuração complexa

**Jobs to be Done**:
- "Quando coloco um LP, quero que o som chegue na minha TV/soundbar automaticamente"
- "Quando uma música toca, quero saber artista/título/álbum sem Shazam"
- "Quando termino de ouvir, quero ver o que escutei hoje"

### Persona Secundária: "Household Member"
**Perfil**: Família/amigos do enthusiast
**Necessidades**:
- Interface simples (um botão play)
- Funcionar sempre que o toca-discos estiver ligado
- Ver a capa do álbum na TV

### Persona Futura (v2): "Archivist Collector"
**Perfil**: Colecionador sério, múltiplas prensagens, preocupado com preservação
**Necessidades**:
- Gravar sessões em qualidade máxima
- Comparar qualidade entre prensagens
- Catalogar e organizar digitalmente

---

## 4. Requisitos de Hardware

### Mínimo Requerido
- **Raspberry Pi**: Model 4B (4GB RAM) ou 5 (4GB)
- **Storage**: MicroSD 32GB Class 10 (A1 rating recomendado)
- **Interface de Áudio USB**: 
  - Testado: Behringer UCA222/202HD, U-Phoria UM2
  - Requisito: Input LINE level (não mic)
- **Toca-discos**: Com saída RCA LINE ou PHONO + pré-amplificador
- **Fonte**: Official Raspberry Pi PSU (15W para Pi 4, 27W para Pi 5)
- **Rede**: Ethernet (recomendado) ou WiFi 5GHz

### Configuração de Referência (Testada)
- Raspberry Pi 5 (8GB)
- Samsung EVO+ 64GB A2 microSD  
- Behringer UCA222
- Audio-Technica AT-LPW50PB (switch em LINE)
- Cabo Ethernet Cat 6
- Case com ventilação passiva

### Notas de Compatibilidade
- **IMPORTANTE**: Toca-discos deve estar em modo LINE (não PHONO)
- Se só tiver saída PHONO, necessário pré-amplificador externo
- Interfaces de áudio "gaming" (USB) geralmente não funcionam bem
- Evitar hubs USB entre interface e Pi

---

## 5. Escopo Funcional Detalhado

### 5.1 Core v1 - Streaming Foundation

#### 5.1.1 Captura de Áudio
- **Input**: ALSA via plughw (device específico configurável)
- **Formato interno**: 48kHz/16-bit/stereo (padrão) ou 44.1kHz
- **Buffer**: 512-2048 samples (configurável para latência vs estabilidade)
- **Monitoramento**: Detecção de clipping e silence (>10s = auto-stop)

#### 5.1.2 Streaming Engine
- **Servidor**: Icecast2 (robusto, testado, compatível)
- **Encoder**: FFmpeg com libmp3lame
- **Mount point**: `/stream` (MP3 320kbps CBR)
- **Fallback**: Loop de silêncio quando sem input
- **Clients simultâneos**: Até 20 (configurável)
- **Buffer do servidor**: 64KB (balanço latência/estabilidade)

#### 5.1.3 Reconhecimento Musical (Básico)
- **Trigger**: Manual via botão na UI ou automático a cada 2 min
- **Método**: 
  1. Captura 5-10s do stream
  2. Envio para ACRCloud (primário) ou AudD (fallback)
  3. Cache de 30 minutos para evitar re-reconhecimento
- **Metadados retornados**: Título, artista, álbum, ano, label, ISRC
- **Confiança mínima**: 70% para exibir resultado
- **Fallback**: Busca manual via UI se não reconhecer

#### 5.1.4 Gerenciamento de Sessões
- **Sessão**: Inicia ao detectar áudio, termina após 30min de silêncio
- **Estados**: 
  - `idle`: Sem áudio
  - `active`: Reproduzindo
  - `paused`: Silêncio < 30min  
- **Dados salvos**: Timestamp início/fim, tracks reconhecidos, duração total

#### 5.1.5 Interface Web (SPA)
- **Player Principal**:
  - Visualização do disco girando (33⅓ ou 45 RPM)
  - Play/Pause do stream
  - Volume local (não afeta source)
  - "Now Playing" com capa e metadados
  - Indicador de qualidade de conexão

- **Dashboard**:
  - Estado do sistema (streaming on/off, sessão ativa)
  - Últimas 5 músicas reconhecidas
  - Quick stats (hoje: X músicas, Y minutos)

- **Histórico**:
  - Lista de sessões com expand para ver tracks
  - Filtros por data
  - Busca por artista/álbum/título
  - Export CSV básico

- **Configurações**:
  - Device de áudio (dropdown de dispositivos detectados)
  - Credenciais APIs (ACRCloud/AudD)
  - Reconhecimento automático on/off
  - Tema claro/escuro

#### 5.1.6 Persistência de Dados
- **Database**: SQLite (arquivo único, backup fácil)
- **Tabelas principais**:
  ```sql
  sessions (id, started_at, ended_at, duration_seconds)
  tracks (id, session_id, title, artist, album, year, confidence, recognized_at)
  settings (key, value, updated_at)
  ```
- **Retenção**: Últimos 365 dias (configurável)
- **Backup**: Export manual via UI

### 5.2 Advanced v2 - Pro Features

#### 5.2.1 Dual-Path Architecture
- Stream path (atual) + Recording path (novo)
- Sincronização por sample counter
- Buffer circular de 30s para pré-roll

#### 5.2.2 Gravação FLAC
- Segmentação automática por silêncio
- Metadata embedding (tags Vorbis)
- Sidecar JSON com offsets e eventos

#### 5.2.3 Reconhecimento Offline
- Chromaprint local + cache de fingerprints
- MusicBrainz local mirror (subset)
- Fallback para cloud apenas quando necessário

#### 5.2.4 Quality Analysis (QA)
- SNR, wow/flutter, clicks/pops
- Desgaste de alta frequência
- Health Score 0-100

#### 5.2.5 Plugin System
- Event bus com hooks
- Exemplos: Last.fm, Discogs, MQTT

---

## 6. Arquitetura Técnica

### 6.1 Stack Tecnológico

#### Backend (Node.js 20 LTS)
- **Framework**: Express 4.x (simples, estável)
- **Streaming**: Child process para FFmpeg
- **Database**: SQLite3 via `better-sqlite3`
- **Áudio**: Interação com ALSA via comandos
- **Cache**: In-memory (node-cache) 
- **Jobs**: Bull queue (Redis-free via SQLite adapter)
- **Logs**: Winston com rotate

#### Frontend (SPA)
- **Framework**: React 18 com Vite
- **Routing**: React Router v6
- **Estado**: Context API (simples para v1)
- **Estilo**: TailwindCSS
- **Gráficos**: Recharts (histórico)
- **WebSocket**: Socket.io-client

#### Serviços Sistema
- **Icecast2**: Via systemd/Docker
- **Process Manager**: PM2 (produção) ou Docker Compose
- **Reverse Proxy**: Nginx (opcional, para HTTPS)

### 6.2 Arquitetura de Componentes

```
┌──────────────────────────────────────────────┐
│                   Frontend SPA                │
│                  (React + Vite)                │
└────────────────────┬─────────────────────────┘
                     │ HTTP/WS
┌────────────────────▼─────────────────────────┐
│                Backend Node.js                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  API     │ │ Workers  │ │ EventBus │     │
│  │  REST    │ │Recognition│ │          │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Audio    │ │ Session  │ │ Database │     │
│  │ Manager  │ │ Manager  │ │  SQLite  │     │
│  └─────┬────┘ └──────────┘ └──────────┘     │
└────────┼──────────────────────────────────────┘
         │ Pipe
┌────────▼──────────────────────────────────────┐
│               FFmpeg Process                   │
│          (Capture → Encode → Stream)          │
└────────┬──────────────────────────────────────┘
         │ HTTP
┌────────▼──────────────────────────────────────┐
│              Icecast2 Server                   │
│                 (Port 8000)                    │
└────────────────────────────────────────────────┘
```

### 6.3 Fluxo de Dados Principal

```
1. Toca-discos → Behringer UCA222 → ALSA
                    ↓
2. Node Audio Manager (spawn FFmpeg)
                    ↓
3. FFmpeg: captura PCM → encode MP3 → stream HTTP
                    ↓
4. Icecast2: recebe source → distribui para clients
                    ↓
5. Browser/App: conecta no mountpoint → reproduz
```

### 6.4 Fluxo de Reconhecimento

```
1. Timer/Manual trigger
        ↓
2. Capture 5-10s do stream (FFmpeg → WAV)
        ↓
3. Check cache (30 min TTL)
        ↓ (miss)
4. Send to ACRCloud
        ↓ (fail)
5. Fallback to AudD
        ↓
6. Save to DB + cache
        ↓
7. Emit evento via WebSocket
        ↓
8. UI atualiza "Now Playing"
```

---

## 7. API Contracts (v1)

### 7.1 REST Endpoints

#### System
```typescript
GET /api/health
Response: {
  status: "healthy" | "degraded",
  streaming: boolean,
  uptime: number, // seconds
  cpu: number,    // percentage
  memory: number, // MB used
  temperature: number // Celsius (Pi only)
}

GET /api/status
Response: {
  session: {
    id: string,
    started_at: string, // ISO
    duration: number,   // seconds
    track_count: number
  } | null,
  streaming: {
    active: boolean,
    listeners: number,
    bitrate: number,
    mount_point: string
  },
  recognition: {
    enabled: boolean,
    last_check: string, // ISO
    api_credits: number // remaining this month
  }
}
```

#### Sessions
```typescript
GET /api/sessions?limit=20&offset=0&date_from=&date_to=
Response: {
  sessions: [{
    id: string,
    started_at: string,
    ended_at: string | null,
    duration: number,
    track_count: number,
    tracks: [] // Collapsed, fetch separately
  }],
  total: number,
  has_more: boolean
}

GET /api/sessions/:id
Response: {
  id: string,
  started_at: string,
  ended_at: string | null,
  duration: number,
  tracks: [{
    id: string,
    title: string,
    artist: string,
    album: string,
    recognized_at: string,
    confidence: number,
    source: "acrcloud" | "audd" | "manual"
  }]
}
```

#### Recognition
```typescript
POST /api/recognize
Body: { 
  trigger: "manual" | "automatic",
  force: boolean // Skip cache
}
Response: {
  success: boolean,
  track?: {
    title: string,
    artist: string,
    album: string,
    album_art: string, // URL
    year: number,
    confidence: number,
    source: string
  },
  error?: string,
  cached: boolean
}

POST /api/tracks/:id
Body: {
  title?: string,
  artist?: string,  
  album?: string,
  year?: number
}
Response: { success: boolean }
```

#### Settings
```typescript
GET /api/settings
Response: {
  audio: {
    device: string,
    sample_rate: number,
    buffer_size: number
  },
  recognition: {
    enabled: boolean,
    interval: number, // seconds
    service: "acrcloud" | "audd",
    confidence_threshold: number
  },
  streaming: {
    mount_point: string,
    bitrate: number,
    max_listeners: number
  }
}

PUT /api/settings
Body: Partial<Settings>
Response: { success: boolean, requires_restart: boolean }
```

### 7.2 WebSocket Events

#### Client → Server
```typescript
// Subscribe to events
{ type: "subscribe", channels: ["status", "recognition", "session"] }

// Manual recognition trigger
{ type: "recognize", force: boolean }
```

#### Server → Client
```typescript
// Status update (cada 5s)
{
  type: "status",
  data: {
    streaming: boolean,
    listeners: number,
    session_active: boolean
  }
}

// Track reconhecido
{
  type: "track_recognized",
  data: {
    title: string,
    artist: string,
    album: string,
    album_art: string,
    confidence: number,
    timestamp: string
  }
}

// Sessão iniciada/terminada
{
  type: "session_changed",
  data: {
    event: "started" | "ended",
    session_id: string,
    timestamp: string
  }
}
```

---

## 8. Modelo de Dados (v1)

### Schema SQLite

```sql
-- Sessões de escuta
CREATE TABLE sessions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    duration_seconds INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tracks reconhecidos
CREATE TABLE tracks (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    session_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    album_art_url TEXT,
    year INTEGER,
    label TEXT,
    isrc TEXT,
    duration_seconds INTEGER,
    confidence REAL DEFAULT 0,
    recognition_source TEXT DEFAULT 'manual',
    recognized_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata_json TEXT, -- JSON com dados completos da API
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Configurações
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT DEFAULT 'string', -- string|number|boolean|json
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache de reconhecimento
CREATE TABLE recognition_cache (
    hash TEXT PRIMARY KEY, -- MD5 do audio sample
    track_data TEXT NOT NULL, -- JSON
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX idx_tracks_session ON tracks(session_id, recognized_at);
CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_recognized ON tracks(recognized_at DESC);
CREATE INDEX idx_cache_expires ON recognition_cache(expires_at);

-- Triggers para updated_at
CREATE TRIGGER update_sessions_timestamp 
AFTER UPDATE ON sessions
BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Views úteis
CREATE VIEW recent_tracks AS
SELECT t.*, s.started_at as session_started
FROM tracks t
JOIN sessions s ON t.session_id = s.id
ORDER BY t.recognized_at DESC
LIMIT 100;

CREATE VIEW daily_stats AS
SELECT 
    DATE(started_at) as date,
    COUNT(DISTINCT id) as session_count,
    SUM(duration_seconds) as total_seconds,
    SUM(track_count) as total_tracks
FROM sessions
GROUP BY DATE(started_at);
```

---

## 9. Configuração

### 9.1 Estrutura de Arquivos

```
/home/pi/vinyl-os/
├── .env                    # Secrets (API keys)
├── config/
│   ├── default.yaml       # Configurações base
│   ├── production.yaml    # Override para produção
│   └── icecast.xml        # Config do Icecast
├── backend/
│   ├── server.js
│   ├── services/
│   ├── routes/
│   └── workers/
├── frontend/
│   ├── dist/             # Build de produção
│   └── src/
├── data/
│   ├── vinyl-os.db       # SQLite database
│   ├── logs/
│   └── recordings/       # Futuro: FLAC files
└── scripts/
    ├── install.sh
    ├── backup.sh
    └── update.sh
```

### 9.2 Configuração YAML

```yaml
# config/default.yaml
app:
  name: "Vinyl-OS"
  version: "1.0.0"
  port: 3001
  log_level: "info"

audio:
  device: "plughw:1,0"  # Behringer UCA222
  sample_rate: 48000
  channels: 2
  bit_depth: 16
  buffer_size: 1024

streaming:
  enabled: true
  encoder: "mp3"
  bitrate: 320
  mount_point: "/stream"
  icecast:
    host: "localhost"
    port: 8000
    password: "hackme"  # Mudar em produção!
    name: "Vinyl Stream"
    description: "Live from turntable"
    genre: "Various"

recognition:
  enabled: true
  auto_interval: 120  # segundos
  confidence_threshold: 0.7
  cache_ttl: 1800  # 30 minutos
  sample_duration: 10  # segundos
  service: "acrcloud"  # ou "audd"

database:
  path: "./data/vinyl-os.db"
  wal_mode: true
  busy_timeout: 5000

monitoring:
  health_check_interval: 5000  # ms
  session_timeout: 1800  # 30 min
  silence_threshold: -50  # dB
  silence_duration: 10  # segundos

# APIs (keys no .env)
external_apis:
  acrcloud:
    host: "identify-eu-west-1.acrcloud.com"
    timeout: 10
  audd:
    url: "https://api.audd.io/"
    timeout: 10
```

### 9.3 Environment Variables

```bash
# .env (não commitar!)
NODE_ENV=production

# API Keys
ACRCLOUD_ACCESS_KEY=your_key_here
ACRCLOUD_SECRET_KEY=your_secret_here
AUDD_API_TOKEN=your_token_here

# Icecast
ICECAST_SOURCE_PASSWORD=strong_password_here
ICECAST_ADMIN_PASSWORD=another_strong_password

# Optional
DISCOGS_TOKEN=
LASTFM_API_KEY=
```

---

## 10. Instalação & Setup

### 10.1 Quick Start (30 minutos)

```bash
# 1. Preparar Raspberry Pi OS (64-bit)
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependências
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git ffmpeg icecast2 alsa-utils sqlite3

# 3. Clonar e configurar
git clone https://github.com/user/vinyl-os.git
cd vinyl-os
cp .env.example .env
nano .env  # Adicionar API keys

# 4. Instalar e construir
npm install
npm run build

# 5. Configurar Icecast
sudo nano /etc/icecast2/icecast.xml
# Ajustar passwords e paths
sudo systemctl restart icecast2

# 6. Testar dispositivo de áudio
arecord -l  # Listar dispositivos
# Anotar o device (ex: card 1, device 0)

# 7. Iniciar com PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Seguir instruções

# 8. Acessar interface
# http://raspberry.local:3000
```

### 10.2 Validação Pós-Instalação

```bash
# Checar serviços
pm2 status
sudo systemctl status icecast2

# Testar captura de áudio
arecord -D plughw:1,0 -f cd -d 5 test.wav
aplay test.wav  # Deve tocar o que foi gravado

# Testar streaming
ffmpeg -f alsa -i plughw:1,0 -acodec mp3 -ab 320k \
  -content_type audio/mpeg \
  icecast://source:password@localhost:8000/test.mp3

# Logs
pm2 logs vinyl-backend
tail -f /var/log/icecast2/error.log
```

### 10.3 Troubleshooting Comum

| Problema | Solução |
|----------|---------|
| "Device not found" | Verificar `arecord -l`, ajustar device em config |
| "Permission denied" | `sudo usermod -a -G audio $USER` |
| Stream cortando | Aumentar buffer_size, usar Ethernet |
| Icecast connection refused | Checar password, firewall |
| Alto uso de CPU | Reduzir bitrate, desabilitar auto-recognition |

---

## 11. Segurança & Privacidade

### 11.1 Princípios
- **Local-first**: Tudo funciona sem internet (exceto reconhecimento)
- **Opt-in**: APIs externas requerem ativação explícita
- **No-telemetry**: Sem coleta de dados ou analytics
- **Transparent**: Logs locais, sem tracking

### 11.2 Implementação
- Icecast: Bind apenas em rede local (192.168.x.x / 10.x.x.x)
- API keys: Apenas em `.env`, nunca no código
- SQLite: Arquivo local, sem acesso remoto
- Backups: Locais ou para NAS do usuário
- HTTPS: Opcional via reverse proxy

### 11.3 Recomendações
```bash
# Firewall básico
sudo ufw allow from 192.168.0.0/16 to any port 3000
sudo ufw allow from 192.168.0.0/16 to any port 8000
sudo ufw enable

# Backup automático
crontab -e
# 0 2 * * * /home/pi/vinyl-os/scripts/backup.sh
```

---

## 12. Testes & Validação

### 12.1 Testes Unitários
```javascript
// Áudio capture
- ✓ Detecta dispositivos disponíveis
- ✓ Valida formato de áudio
- ✓ Handle device disconnect

// Recognition
- ✓ Cache previne duplicatas
- ✓ Fallback ACRCloud → AudD
- ✓ Confidence threshold funciona

// Sessions  
- ✓ Auto-start com áudio
- ✓ Auto-end após silêncio
- ✓ Persist tracks corretamente
```

### 12.2 Testes de Integração
```javascript
// End-to-end flow
- ✓ Áudio → FFmpeg → Icecast → Browser
- ✓ Recognition → Database → WebSocket → UI
- ✓ Session tracking durante 1 hora

// Stress tests
- ✓ 10 clients simultâneos por 24h
- ✓ 1000 reconhecimentos sem memory leak
- ✓ Database com 10k tracks
```

### 12.3 Testes de Aceitação
- [ ] Usuário não-técnico consegue setup em <45 min
- [ ] Stream funciona em iPhone, Android, Desktop
- [ ] Reconhece 9/10 músicas do "Top 100 Vinyl"
- [ ] Interface intuitiva sem manual

---

## 13. Roadmap Detalhado

### Phase 1: Foundation (v1.0)
**Duração**: 8 semanas

#### Sprint 1-2: Core Streaming
- [x] Captura ALSA estável
- [x] FFmpeg → Icecast pipeline
- [x] Frontend player básico
- [ ] PM2 config e auto-start

#### Sprint 3-4: Recognition
- [x] ACRCloud integration
- [x] AudD fallback
- [x] Cache system
- [ ] Manual search UI

#### Sprint 5-6: Sessions & Data
- [x] Session detection
- [x] SQLite schema
- [ ] History page
- [ ] Basic stats

#### Sprint 7-8: Polish
- [ ] Settings UI
- [ ] Error handling
- [ ] Install script
- [ ] Documentation

### Phase 2: Enhancement (v1.1)
**Duração**: 4 semanas

- [ ] WebSocket real-time updates
- [ ] Export history (CSV/JSON)
- [ ] Dark mode
- [ ] Mobile-responsive
- [ ] Backup/restore UI

### Phase 3: Advanced (v2.0)
**Duração**: 12 semanas

- [ ] Dual-path architecture
- [ ] FLAC recording
- [ ] Pre-roll buffer
- [ ] Offline recognition
- [ ] Quality analysis
- [ ] Plugin system

---

## 14. Riscos & Mitigação

### Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Latência maior que esperado | Alta | Médio | Aceitar 1-2s como baseline, otimizar depois |
| WiFi instável | Média | Alto | Documentar Ethernet como recomendado |
| Reconhecimento baixo em vinis antigos | Alta | Médio | UI para correção manual |
| Memory leak em long-running | Média | Alto | PM2 restart diário, monitoring |
| SD card corruption | Baixa | Crítico | WAL mode, backup automático |

### Riscos de Adoção

| Risco | Mitigação |
|-------|-----------|
| Setup muito complexo | Script de instalação one-click |
| Dependência de API keys | Modo básico sem reconhecimento |
| Documentação insuficiente | Videos de setup, FAQ extenso |

---

## 15. Métricas de Monitoramento

### Runtime Metrics (Dashboard)
```javascript
{
  system: {
    uptime: seconds,
    cpu_percent: number,
    memory_mb: number,
    temperature_c: number,
    disk_free_gb: number
  },
  streaming: {
    active: boolean,
    listeners: number,
    bytes_sent: number,
    stream_uptime: seconds,
    buffer_underruns: number
  },
  audio: {
    input_level_db: number,
    clipping_events: number,
    silence_periods: number,
    sample_rate_actual: number
  },
  recognition: {
    total_attempts: number,
    success_rate: percent,
    cache_hit_rate: percent,
    avg_response_time_ms: number,
    api_credits_remaining: number
  }
}
```

### Business Metrics (Weekly Report)
- Total listening hours
- Unique albums played
- Most played artists
- Recognition accuracy
- System stability (uptime %)

---

## 16. Decisões de Design

### Por que não WebRTC?
- Complexidade desproporcional para ganho de latência
- Icecast "just works" com tudo
- 1-2s aceitável para use case

### Por que SQLite?
- Zero configuração
- Arquivo único (backup fácil)
- Performance suficiente (<10k tracks/ano)
- Migração futura possível

### Por que Node.js?
- Mesmo stack front/back
- Ecosystem rico (npm)
- FFmpeg bindings maduros
- WebSocket nativo

### Por que MP3 320?
- Compatibilidade universal
- Qualidade suficiente para vinyl
- Bandwidth razoável (2.5 Mbps)
- Opus/AAC para v2

---

## 17. Suporte & Comunidade

### Canais
- GitHub Issues (bugs, features)
- Discord (community support)
- Docs site (vinyl-os.github.io)

### Contribuição
- MIT License
- CLA simples
- CI/CD via GitHub Actions
- Semantic versioning

### Governança (Futuro)
- Core team (3-5 maintainers)
- RFC process para mudanças grandes
- Release cycle mensal

---

## 18. Anexos

### A. Comandos Úteis

```bash
# Audio debugging
arecord -l
cat /proc/asound/cards
alsamixer -c 1

# Process management  
pm2 status/logs/restart vinyl-backend
pm2 monit

# Database
sqlite3 data/vinyl-os.db ".tables"
sqlite3 data/vinyl-os.db "SELECT COUNT(*) FROM tracks;"

# Network
ss -tuln | grep -E "3000|8000"
curl http://localhost:8000/status-json.xsl

# Logs
journalctl -u icecast2 -f
tail -f data/logs/vinyl-os.log
```

### B. Configuração Exemplo Completa

```yaml
# ecosystem.config.js (PM2)
module.exports = {
  apps: [{
    name: 'vinyl-backend',
    script: './backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './data/logs/pm2-error.log',
    out_file: './data/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}
```

### C. Hardware Alternativo Testado

| Dispositivo | Funciona? | Notas |
|-------------|-----------|-------|
| Behringer UCA202 | ✅ Sim | Idêntico ao UCA222 |
| Focusrite Scarlett Solo | ✅ Sim | Overkill mas funciona |
| Creative Sound Blaster | ⚠️ Parcial | Drivers problemáticos |
| Generic USB Soundcard | ❌ Não | Qualidade insuficiente |

---

## 19. Glossário

- **ALSA**: Advanced Linux Sound Architecture
- **CBR**: Constant Bit Rate
- **FFmpeg**: Framework de processamento multimídia  
- **FIFO**: First In First Out (named pipe)
- **LINE level**: ~1V RMS, sinal pré-amplificado
- **Mount point**: Endpoint URL no Icecast
- **PHONO level**: ~5mV, precisa pré-amplificação RIAA
- **Sample rate**: Amostras por segundo (48000 Hz)
- **TTL**: Time To Live (cache expiration)
- **WAL**: Write-Ahead Logging (SQLite mode)

---

## 20. Critérios de Aceitação (v1.0)

### Must Have (Launch Blockers)
- [ ] Stream funciona por 24h sem interrupção
- [ ] Reconhece música com >70% confidence
- [ ] UI carrega em <2s na rede local
- [ ] Sessões salvam e recuperam corretamente
- [ ] Install script funciona no Pi OS 64-bit limpo
- [ ] Documentação cobre setup básico

### Should Have
- [ ] Dark mode
- [ ] Export CSV do histórico
- [ ] Auto-reconhecimento configurável
- [ ] Backup manual via UI

### Could Have  
- [ ] Estatísticas detalhadas
- [ ] Integração Discogs
- [ ] Multi-idioma

### Won't Have (v1)
- [ ] Gravação
- [ ] Análise de qualidade
- [ ] Plugins
- [ ] App mobile

---

**Este PRD v2 representa um produto mais focado e realizável, com caminho claro de evolução para features avançadas.**

**Princípio central: "Estabilidade antes de features"**