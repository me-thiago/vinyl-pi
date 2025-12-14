# PRD — Vinyl-OS (Pi)

**Versão 3.0** — Documento revisado com divisão estratégica em 4 versões incrementais

**Última atualização:** 2025-01-27  
**Status:** ✅ Pronto para desenvolvimento

> **Nota (2025-12):** “PRD v3.0” aqui é a **versão do documento de PRD**, e não o mesmo conceito que o “Epic V3”.  
> Este PRD descreve requisitos e roadmap (V1–V4) em nível de produto. A execução do V3 foi fatiada em **V3a/V3b/V3c** para reduzir risco e registrar decisões incrementais, documentadas em:
> - `docs/epic-v3-vision.md` (visão/decisões e fatiamento V3a/V3b/V3c)
> - `docs/tech-spec-epic-v3a.md` (especificação técnica do V3a)
>
> Quando houver divergência entre PRD e execução (ex.: detalhes de gravação, pré-roll, segmentação), tratar como **decisão a ser reconciliada**: manter a cautela do PRD e registrar explicitamente a refutação/ajuste com justificativa em docs de visão/tech spec/decisões técnicas — em vez de “substituir” silenciosamente o PRD.

---

## 1. Resumo Executivo

**Vinyl-OS** é um sistema open-source para Raspberry Pi que transforma qualquer toca-discos em um streamer de áudio inteligente para a casa.

### Visão Geral por Versão

**V1 - Foundation Core (MVP):** Captura estável, streaming local de alta qualidade, **reconhecimento sonoro** (eventos básicos: silêncio, troca de faixa), interface web minimalista e sistema de eventos básico.

**V2 - Coleção & Reconhecimento Musical:** Gestão da coleção física, integração Discogs, reconhecimento musical com validação contra coleção, histórico de escuta.

**V3 - Gravação & Análise:** Dual-Path Architecture finalizada, gravação FLAC lossless, chromaprint local, reconhecimento offline e análise de qualidade (QA).

**V4 - Polimento & Controles Avançados:** Integração final de UI, controles administrativos avançados, integrações opcionais (Last.fm, MQTT).

É construído com Node.js, focado em **estabilidade antes de features**, oferecendo uma experiência "it just works" para usuários não-técnicos após o setup inicial.

**Princípio central:** Entregas incrementais com valor claro em cada versão, reduzindo risco técnico através de validação progressiva.

---

## 2. Objetivos & Métricas de Sucesso

### Objetivos Primários (V1)
1. **Streaming confiável**: Áudio estável 24/7 sem interrupções
2. **Detecção de eventos**: Sistema confiável para identificar eventos básicos (silêncio, sessões, troca de faixa)
3. **UX simples**: Interface que não requer manual
4. **Setup reproduzível**: Instalação consistente em <30 minutos

### Objetivos Secundários (V2-V4)
5. Gestão completa da coleção física (V2)
6. Reconhecimento musical preciso com validação (V2)
7. Gravação e análise de qualidade (V3)
8. Arquitetura extensível por plugins (V3+)

### KPIs de Sucesso por Versão

#### V1 - Foundation Core
- **Uptime de streaming**: ≥99% em 7 dias contínuos
- **Latência end-to-end**: ≤2s (click no vinil → som no browser)
- **Detecção de eventos sonoros**: ≥85% precisão em detecção de silêncio/sessões
- **Setup inicial**: ≤30 min do zero até streaming funcionando
- **CPU em idle** (Pi 5): ≤15% com streaming ativo
- **Memória**: ≤200MB para backend completo
- **Tempo de boot**: ≤45s do power-on até stream disponível

#### V2 - Coleção & Reconhecimento Musical
- **Taxa de reconhecimento musical**: ≥80% em álbuns da coleção
- **Validação contra coleção**: Redução de >50% em falsos positivos
- **Gestão de coleção**: Suporte a 500+ álbuns sem performance issues
- **Integração Discogs**: Importação de metadados com >95% sucesso

#### V3 - Gravação & Análise
- **Dual-path**: Sem degradação de performance no streaming (<5% overhead)
- **Gravação FLAC**: Sincronização precisa com eventos (<100ms drift)
- **Reconhecimento offline**: ≥70% de álbuns da coleção reconhecidos localmente
- **QA Report**: ≤2 min para análise completa de um lado

#### V4 - Polimento & Controles
- **UI mobile-responsive**: Funciona perfeitamente em smartphones
- **Performance**: Tempo de carregamento <2s em redes locais
- **Admin controls**: Configuração avançada sem editar arquivos

### Fora de Escopo (Todas as Versões)

#### V1
- Multiroom sincronizado
- Edição ou processamento de áudio
- Streaming para internet pública
- Integração com assistentes de voz
- Suporte a múltiplos toca-discos simultâneos
- **Reconhecimento musical** (apenas sonoro/eventos)

#### V2-V4
- Restauração de áudio (de-clicking em tempo real)
- Transcodificação para múltiplos formatos simultâneos
- Interface mobile nativa (SPA web é suficiente)
- Comparação automática entre prensagens

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

### Persona Futura (V3+): "Archivist Collector"
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

## 5. Escopo Funcional Detalhado por Versão

### 5.1 V1 - Foundation Core (MVP)

#### 5.1.1 Captura de Áudio
- **Input**: ALSA via plughw (device específico configurável)
- **Formato interno**: 48kHz/16-bit/stereo (padrão) ou 44.1kHz
- **Buffer**: 512-2048 samples (configurável para latência vs estabilidade)
- **Monitoramento**:
  - Detecção de clipping
  - Monitoramento de nível de áudio (VU meter)
  - Detecção de silêncio (threshold e duração configuráveis)

#### 5.1.2 Streaming Engine
- **Servidor**: Icecast2 (robusto, testado, compatível)
- **Encoder**: FFmpeg com libmp3lame
- **Mount point**: `/stream` (MP3 128kbps CBR)
- **Fallback**: Loop de silêncio quando sem input
- **Clients simultâneos**: Até 20 (configurável)
- **Buffer do servidor**: 64KB (balanço latência/estabilidade)

#### 5.1.3 Reconhecimento Sonoro (NÃO Musical)
**Foco em eventos físicos do toca-discos:**

- **Detecção de Silêncio**:
  - Threshold configurável (-50dB padrão)
  - Duração configurável (10s padrão)
  - Evento: `silence.detected`
  
- **Detecção de Toca-discos em Vazio**: ⏸️ *Adiado para V2/V3*
  - Ruído de fundo baixo mas constante
  - Diferenciar de silêncio total
  - Evento: `turntable.idle`
  - **Status**: Não implementado em V1 - nível de áudio oscila muito e não se mantém constante por tempo suficiente para detecção confiável. Requer análise espectral mais sofisticada (possivelmente via Meyda features adicionais).

- **Detecção de Troca de Faixa**: ⏸️ *Adiado indefinidamente*
  - Mudança abrupta de nível de áudio + silêncio curto
  - Thresholds ajustáveis (nível, duração do silêncio)
  - Calibração manual via UI
  - Evento: `track.change.detected`
  - **Status**: Não implementado - ruído de fundo do vinil impede detecção confiável (gaps entre faixas raramente atingem -50dB). Sem padrão consistente de silêncio entre faixas. Possível implementação futura via fingerprinting ou machine learning.
  
- **Detecção de Sessão**:
  - Início: Primeira detecção de áudio após período idle
  - Fim: Silêncio prolongado (30min configurável)
  - Eventos: `session.started`, `session.ended`

- **UI de Diagnóstico**:
  - VU meter em tempo real
  - Indicadores visuais de eventos detectados
  - Log de eventos (scrollable, últimos 100 eventos)
  - Configuração de thresholds:
    - Silence threshold (dB)
    - Silence duration (segundos)
    - Clipping threshold (dB)
    - Session timeout

#### 5.1.4 EventBus Core
- Sistema de eventos interno básico
- Padrão publish/subscribe simples
- Eventos implementados em V1:
  - `audio.start`, `audio.stop`
  - `silence.detected`, `silence.ended`
  - `session.started`, `session.ended`
  - `clipping.detected`
  - `audio.level` (interno, para análise)
- Eventos planejados (não implementados):
  - `turntable.idle`, `turntable.active` - adiado para V2/V3
  - `track.change.detected` - adiado indefinidamente
- **Nota**: Extensível na V3 para plugins, V1 mantém simples

#### 5.1.5 Interface Web (SPA MVP)
- **Player Principal**:
  - Play/Pause do stream
  - Volume local (não afeta source)
  - Indicador visual de streaming ativo
  - Status do sistema (streaming on/off, sessão ativa)
  
- **Dashboard**:
  - Estado atual (sessão, última atividade)
  - Últimos eventos detectados (lista simplificada)
  - Quick stats básicas (sessão atual: duração)
  
- **Diagnóstico** (Nova seção V1):
  - VU meter
  - Configuração de thresholds
  - Log de eventos
  - Calibração manual
  
- **Histórico de Sessões**:
  - Lista de sessões (início/fim, duração)
  - Visualização de eventos por sessão
  - Filtros por data
  
- **Configurações**:
  - Device de áudio (dropdown de dispositivos detectados)
  - Thresholds de detecção de eventos
  - Tema claro/escuro

#### 5.1.6 Persistência de Dados (SQLite Básico)
**Database**: SQLite (arquivo único, backup fácil)

**Tabelas V1**:
```sql
-- Sessões de escuta
CREATE TABLE sessions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    duration_seconds INTEGER DEFAULT 0,
    event_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Eventos de áudio detectados
CREATE TABLE audio_events (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    session_id TEXT,
    event_type TEXT NOT NULL, -- 'silence', 'track_change', 'clipping', 'session_start', 'session_end'
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata_json TEXT, -- JSON com dados adicionais (nível, duração, etc.)
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Configurações
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT DEFAULT 'string', -- string|number|boolean|json
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Índices V1**:
```sql
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX idx_audio_events_session ON audio_events(session_id, timestamp);
CREATE INDEX idx_audio_events_type ON audio_events(event_type, timestamp);
```

### 5.2 V2 - Coleção & Reconhecimento Musical

#### 5.2.1 Gestão da Coleção de Discos
- **CRUD Completo**:
  - Adicionar/editar/remover álbuns
  - Campos: Título, artista, ano, label, formatos (LP, 7", 12")
  - Upload de capa (ou busca automática via Discogs)
  - Tags/categorias customizáveis
  - Estado físico (mint, VG+, VG, etc.)
  - Notas pessoais
  
- **Integração Discogs**:
  - Busca por catálogo/barcode
  - Importação automática de metadados
  - Sincronização de capas (alta resolução)
  - API key opcional (funciona sem, mas com rate limits)
  - Cache local de dados importados
  
- **UI de Gestão**:
  - Lista/grid de coleção (visualização flexível)
  - Busca e filtros avançados (artista, ano, label, tags)
  - Estatísticas da coleção (total discos, artistas, etc.)
  - Importação em batch (CSV/JSON)

#### 5.2.2 Reconhecimento Musical
- **Integração com AudD/ACRCloud**:
  - Mesmo sistema do PRD original
  - Cache de reconhecimentos (30 min TTL)
  - Fallback entre serviços
  
- **Validação contra Coleção**:
  - Ao reconhecer, busca automática na coleção
  - Match por artista + álbum (fuzzy matching, Levenshtein)
  - Confiança de match (threshold configurável)
  - Se múltiplos matches: UI de seleção manual
  - Se nenhum match: opção "Adicionar à coleção"
  - **Objetivo**: Evitar chamar música certa do álbum errado

- **Persistência de Reconhecimentos**:
  - Salvar tracks reconhecidos por sessão
  - Link opcional para álbum na coleção (se encontrado)
  - Histórico de escuta completo

#### 5.2.3 Persistência Expandida (SQLite V2)
**Novas Tabelas**:
```sql
-- Álbuns na coleção
CREATE TABLE albums (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    year INTEGER,
    label TEXT,
    format TEXT, -- 'LP', '7"', '12"', etc.
    cover_url TEXT,
    discogs_id INTEGER,
    condition TEXT, -- 'mint', 'VG+', etc.
    tags TEXT, -- JSON array
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tracks reconhecidos (atualizado de V1)
CREATE TABLE tracks (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    session_id TEXT NOT NULL,
    album_id TEXT, -- Link opcional para álbum na coleção
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    album_art_url TEXT,
    year INTEGER,
    label TEXT,
    isrc TEXT,
    duration_seconds INTEGER,
    confidence REAL DEFAULT 0,
    recognition_source TEXT DEFAULT 'manual', -- 'acrcloud', 'audd', 'manual'
    recognized_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata_json TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
);

-- Cache de reconhecimento
CREATE TABLE recognition_cache (
    hash TEXT PRIMARY KEY, -- MD5 do audio sample
    track_data TEXT NOT NULL, -- JSON
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Novos Índices**:
```sql
CREATE INDEX idx_albums_artist ON albums(artist);
CREATE INDEX idx_albums_title ON albums(title);
CREATE INDEX idx_tracks_album ON tracks(album_id);
CREATE INDEX idx_tracks_recognized ON tracks(recognized_at DESC);
CREATE INDEX idx_cache_expires ON recognition_cache(expires_at);
```

#### 5.2.4 UI Expandida
- **Player Atualizado**:
  - Mostrar capa do álbum quando reconhecido
  - Metadados completos (artista, título, álbum, ano)
  - Link para álbum na coleção (se encontrado)
  - Botão "Adicionar à coleção" se não existir
  
- **Histórico de Escuta**:
  - Lista de sessões com tracks reconhecidos
  - Filtros e busca avançada
  - Export CSV/JSON
  - Estatísticas (mais ouvidos, etc.)
  
- **Nova Seção: Coleção**:
  - Gestão completa de álbuns
  - Integração com reconhecimento
  - Visualizações (grid, lista, timeline)

### 5.3 V3 - Gravação & Análise

#### 5.3.1 Dual-Path Architecture (Finalização)
- **Stream Path** (existente): Continua funcionando normalmente
- **Recording Path** (novo):
  - Captura paralela em FLAC lossless
  - Sincronização por sample counter
  - Buffer circular de 30s para pré-roll
  - **Requisito crítico**: Sem degradação no stream path (<5% overhead)

#### 5.3.2 Gravação FLAC/Lossless
- **Gravação Automática**:
  - Por sessão completa
  - Segmentação automática por silêncio/troca de faixa
  - Metadata embedding (tags Vorbis)
  - Sidecar JSON com offsets e eventos
  
- **Gravação Manual**:
  - Botão de gravação na UI
  - Pré-roll: Capturar 5-10s antes do comando
  
- **Formato**:
  - FLAC padrão (48kHz/16-bit ou 44.1kHz/16-bit)
  - Opção para outros codecs lossless (WAV, ALAC)

#### 5.3.3 Chromaprint & Reconhecimento Offline
- **Chromaprint Local**:
  - Geração de fingerprint para cada álbum na coleção
  - Processamento assíncrono (não bloqueia streaming)
  - Armazenamento na DB vinculado ao álbum
  
- **Reconhecimento Offline**:
  - Match de fingerprint contra banco local
  - Fallback para cloud apenas quando não encontrado
  - **Meta**: 70%+ de álbuns da coleção reconhecidos localmente
  
- **Nota**: MusicBrainz mirror pode ser considerado futuramente, mas não é essencial para V3

#### 5.3.4 Quality Analysis (QA)
- **Métricas de Análise**:
  - **SNR** (Signal-to-Noise Ratio)
  - **Wow/Flutter** detection (variação de pitch)
  - **Clicks/Pops** counting
  - **Desgaste de alta frequência** (>10kHz rolloff)
  - **Clipping** events (já detectado em V1, agora quantificado)
  
- **Health Score**:
  - Score 0-100 baseado nas métricas acima
  - Relatório por álbum/lado
  - Comparação temporal (degradação ao longo do tempo)
  
- **UI de QA**:
  - Visualização de relatórios
  - Gráficos de espectro de frequência
  - Timeline de eventos (clicks, clipping)

#### 5.3.5 Persistência V3
**Novas Tabelas**:
```sql
-- Gravações
CREATE TABLE recordings (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    session_id TEXT NOT NULL,
    album_id TEXT, -- Link opcional
    file_path TEXT NOT NULL,
    format TEXT DEFAULT 'flac',
    sample_rate INTEGER,
    bit_depth INTEGER,
    duration_seconds INTEGER,
    file_size_bytes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
);

-- Chromaprints
CREATE TABLE chromaprints (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    album_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL, -- Base64 encoded
    duration_seconds INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    UNIQUE(album_id)
);

-- QA Reports
CREATE TABLE qa_reports (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    recording_id TEXT NOT NULL,
    album_id TEXT, -- Opcional
    snr_db REAL,
    wow_flutter_percent REAL,
    clicks_count INTEGER,
    pops_count INTEGER,
    high_freq_rolloff_db REAL,
    clipping_events INTEGER,
    health_score INTEGER, -- 0-100
    metadata_json TEXT, -- Detalhes adicionais
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
);
```

#### 5.3.6 EventBus Extensível
- Extensão do EventBus para suportar plugins
- Hook system para eventos customizados
- Exemplos futuros: Last.fm, MQTT, webhooks

### 5.4 V4 - Polimento & Controles Avançados

#### 5.4.1 Integração Final de UI
- **Refinamento UX**:
  - Baseado em feedback de usuários V1-V3
  - Mobile-responsive completo
  - Performance otimizada (lazy loading, code splitting)
  - Acessibilidade básica (WCAG 2.1 AA)
  
- **Melhorias Visuais**:
  - Animações sutis
  - Transições suaves
  - Feedback visual em todas as ações
  - Dark mode refinado

#### 5.4.2 Advanced Admin Controls
- **Configurações Avançadas**:
  - Ajuste fino de codec/bitrate
  - Configuração de múltiplos dispositivos de áudio
  - Backup/restore completo via UI
  - Logs avançados e debugging tools
  
- **Monitoramento**:
  - Dashboard de métricas detalhadas em tempo real
  - Alertas configuráveis (email, webhook, MQTT)
  - Export de relatórios (PDF, CSV, JSON)
  - Histórico de performance (CPU, memória, latência)
  
- **Integrações Opcionais**:
  - **Last.fm Scrobbling**: Envio automático de plays
  - **MQTT**: Publicação de eventos para home automation
  - **Webhooks**: Eventos customizados para integrações
  - **Slack/Discord**: Notificações configuráveis

#### 5.4.3 Otimizações Finais
- Performance: Redução de latência onde possível
- Estabilidade: Correção de edge cases identificados
- Documentação: Guias avançados para power users

---

## 6. Arquitetura Técnica

### 6.1 Stack Tecnológico

#### Backend (Node.js 20 LTS)
- **Framework**: Express 4.x (simples, estável)
- **Streaming**: Child process para FFmpeg
- **Database**: SQLite3 via `better-sqlite3`
- **Áudio**: Interação com ALSA via comandos
- **Cache**: In-memory (node-cache) 
- **Jobs**: Bull queue (Redis-free via SQLite adapter) - V2+
- **Logs**: Winston com rotate
- **EventBus**: Custom simples (V1), extensível (V3+)

#### Frontend (SPA)
- **Framework**: React 18 com Vite
- **Routing**: React Router v6
- **Estado**: Context API (V1), Zustand ou Redux Toolkit (V3+)
- **Estilo**: TailwindCSS
- **Gráficos**: Recharts (histórico, métricas)
- **WebSocket**: Socket.io-client
- **UI Components**: Headless UI ou Radix UI

#### Serviços Sistema
- **Icecast2**: Via systemd/Docker
- **Process Manager**: PM2 (produção) ou Docker Compose
- **Reverse Proxy**: Nginx (opcional, para HTTPS)

### 6.2 Arquitetura de Componentes (Evolução)

**V1:**
```
┌──────────────────────────────────────────────┐
│                   Frontend SPA                │
│                  (React + Vite)                │
└────────────────────┬─────────────────────────┘
                     │ HTTP/WS
┌────────────────────▼─────────────────────────┐
│                Backend Node.js                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  API     │ │ Audio    │ │ EventBus │     │
│  │  REST    │ │ Manager  │ │  Core    │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│  ┌──────────┐ ┌──────────┐                  │
│  │ Session  │ │ Database │                  │
│  │ Manager  │ │  SQLite  │                  │
│  └──────────┘ └──────────┘                  │
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

**V3 (Dual-Path):**
```
┌──────────────────────────────────────────────┐
│                   Frontend SPA                │
└────────────────────┬─────────────────────────┘
                     │ HTTP/WS
┌────────────────────▼─────────────────────────┐
│                Backend Node.js                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  API     │ │ Audio    │ │ EventBus │     │
│  │  REST    │ │ Manager  │ │Extended  │     │
│  └──────────┘ └────┬─────┘ └──────────┘     │
│                    │                         │
│         ┌──────────┴──────────┐             │
│         │                      │             │
│  ┌──────▼──────┐     ┌────────▼────────┐   │
│  │ Stream Path │     │ Recording Path  │   │
│  │  (FFmpeg)   │     │  (FFmpeg)       │   │
│  └──────┬──────┘     └────────┬────────┘   │
└─────────┼──────────────────────┼────────────┘
          │                      │
          │ HTTP                 │ File
┌─────────▼──────────┐  ┌────────▼────────┐
│  Icecast2 Server   │  │  FLAC Files     │
└────────────────────┘  └─────────────────┘
```

### 6.3 Fluxo de Dados Principal (V1)

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

### 6.4 Fluxo de Reconhecimento Sonoro (V1)

```
1. Audio Manager monitora nível de áudio
        ↓
2. Análise de thresholds (silence, clipping)
        ↓
3. Detecção de padrões (troca de faixa, sessão)
        ↓
4. Emit evento via EventBus
        ↓
5. Save to DB (audio_events)
        ↓
6. Emit via WebSocket
        ↓
7. UI atualiza em tempo real
```

### 6.5 Fluxo de Reconhecimento Musical (V2)

```
1. Timer/Manual trigger
        ↓
2. Capture 5-10s do stream (FFmpeg → WAV)
        ↓
3. Check cache (30 min TTL)
        ↓ (miss)
4. Send to ACRCloud/AudD
        ↓
5. Validação contra coleção (fuzzy match)
        ↓
6. Save to DB + cache
        ↓
7. Emit evento via WebSocket
        ↓
8. UI atualiza "Now Playing" + capa
```

---

## 7. API Contracts

### 7.1 REST Endpoints (V1 Base, Expandido V2+)

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
    event_count: number // V1
  } | null,
  streaming: {
    active: boolean,
    listeners: number,
    bitrate: number,
    mount_point: string
  },
  audio: { // V1 - Reconhecimento Sonoro
    level_db: number,
    clipping_detected: boolean,
    silence_detected: boolean
  }
}
```

#### Events (V1)
```typescript
GET /api/events?session_id=&limit=100&offset=0
Response: {
  events: [{
    id: string,
    session_id: string | null,
    event_type: string,
    timestamp: string,
    metadata: object
  }],
  total: number,
  has_more: boolean
}

GET /api/events/stats?date_from=&date_to=
Response: {
  total_events: number,
  by_type: { [eventType: string]: number },
  sessions_count: number
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
    event_count: number, // V1
    track_count: number  // V2+
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
  events: [...], // V1
  tracks: [...]  // V2+
}
```

#### Recognition (V2)
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
    source: string,
    album_match?: { // V2 - Validação coleção
      album_id: string,
      match_confidence: number,
      needs_confirmation: boolean
    }
  },
  error?: string,
  cached: boolean
}
```

#### Collection (V2)
```typescript
GET /api/albums?limit=50&offset=0&search=&filter=
POST /api/albums
GET /api/albums/:id
PUT /api/albums/:id
DELETE /api/albums/:id

POST /api/albums/import-discogs
Body: { catalog_number: string, barcode?: string }
```

#### Settings
```typescript
GET /api/settings
PUT /api/settings
Body: {
  audio: {
    device: string,
    sample_rate: number,
    buffer_size: number,
    silence_threshold: number,    // V1
    silence_duration: number,     // V1
    track_change_sensitivity: number // V1
  },
  recognition: { // V2
    enabled: boolean,
    interval: number,
    service: "acrcloud" | "audd",
    confidence_threshold: number
  },
  streaming: {
    mount_point: string,
    bitrate: number,
    max_listeners: number
  }
}
```

### 7.2 WebSocket Events

#### Client → Server
```typescript
// Subscribe to events
{ type: "subscribe", channels: ["status", "events", "recognition", "session"] }

// Manual recognition trigger (V2)
{ type: "recognize", force: boolean }

// Manual event trigger (V1 - testing)
{ type: "trigger_event", event_type: string }
```

#### Server → Client
```typescript
// Status update (cada 5s)
{
  type: "status",
  data: {
    streaming: boolean,
    listeners: number,
    session_active: boolean,
    audio_level_db: number // V1
  }
}

// Audio event (V1)
{
  type: "audio_event",
  data: {
    event_type: string,
    timestamp: string,
    metadata: object
  }
}

// Track reconhecido (V2)
{
  type: "track_recognized",
  data: {
    title: string,
    artist: string,
    album: string,
    album_art: string,
    confidence: number,
    timestamp: string,
    album_match?: object
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

## 8. Modelo de Dados

### 8.1 Schema SQLite Completo (Evolução por Versão)

**V1 Schema** (já mostrado na seção 5.1.6)

**V2 Schema** (já mostrado na seção 5.2.3)

**V3 Schema** (já mostrado na seção 5.3.5)

### 8.2 Migrações Entre Versões

- **V1 → V2**: Adicionar tabelas `albums`, atualizar `tracks`, adicionar `recognition_cache`
- **V2 → V3**: Adicionar `recordings`, `chromaprints`, `qa_reports`
- **V3 → V4**: Sem mudanças de schema (apenas UI/features)

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
│   │   ├── audio-manager.js
│   │   ├── event-detector.js  # V1
│   │   ├── recognition.js     # V2
│   │   └── recording.js       # V3
│   ├── routes/
│   └── workers/
├── frontend/
│   ├── dist/             # Build de produção
│   └── src/
│       ├── components/
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Diagnostics.jsx  # V1
│       │   ├── Collection.jsx   # V2
│       │   └── Recordings.jsx   # V3
│       └── hooks/
├── data/
│   ├── vinyl-os.db       # SQLite database
│   ├── logs/
│   └── recordings/       # V3: FLAC files
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

# V1 - Reconhecimento Sonoro
event_detection:
  silence_threshold: -50  # dB
  silence_duration: 10    # segundos
  track_change_sensitivity: 0.3  # 0-1
  session_timeout: 1800   # 30 min
  clipping_threshold: -1  # dB

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

recognition:  # V2
  enabled: false  # V1 não usa
  auto_interval: 120
  confidence_threshold: 0.7
  cache_ttl: 1800
  sample_duration: 10
  service: "acrcloud"
  collection_validation: true  # V2

recording:  # V3
  enabled: false
  format: "flac"
  preroll_seconds: 10
  auto_segment: true

database:
  path: "./data/vinyl-os.db"
  wal_mode: true
  busy_timeout: 5000

monitoring:
  health_check_interval: 5000  # ms
  session_timeout: 1800  # 30 min
```

### 9.3 Environment Variables

```bash
# .env (não commitar!)
NODE_ENV=production

# API Keys (V2+)
ACRCLOUD_ACCESS_KEY=your_key_here
ACRCLOUD_SECRET_KEY=your_secret_here
AUDD_API_TOKEN=your_token_here
DISCOGS_TOKEN=your_token_here  # Opcional V2

# Icecast
ICECAST_SOURCE_PASSWORD=strong_password_here
ICECAST_ADMIN_PASSWORD=another_strong_password

# Optional (V4)
LASTFM_API_KEY=
LASTFM_SECRET=
MQTT_BROKER_URL=
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
nano .env  # Adicionar API keys (V2+)

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
| Alto uso de CPU | Reduzir bitrate, desabilitar features opcionais |
| Eventos não detectados (V1) | Ajustar thresholds na UI de diagnóstico |

---

## 11. Segurança & Privacidade

### 11.1 Princípios
- **Local-first**: Tudo funciona sem internet (exceto reconhecimento V2+)
- **Opt-in**: APIs externas requerem ativação explícita
- **No-telemetry**: Sem coleta de dados ou analytics
- **Transparent**: Logs locais, sem tracking

### 11.2 Implementação
- Icecast: Bind apenas em rede local (192.168.x.x / 10.x.x.x)
- API keys: Apenas em `.env`, nunca no código
- SQLite: Arquivo local, sem acesso remoto
- Backups: Locais ou para NAS do usuário
- HTTPS: Opcional via reverse proxy
- Gravações (V3): Armazenamento local, sem upload automático

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

### 12.1 Testes Unitários por Versão

**V1:**
```javascript
// Áudio capture
- ✓ Detecta dispositivos disponíveis
- ✓ Valida formato de áudio
- ✓ Handle device disconnect

// Event Detection
- ✓ Detecção de silêncio com thresholds configuráveis
- ✓ Detecção de clipping
- ✓ Detecção de troca de faixa (com calibração)
- ✓ Session start/end logic

// EventBus
- ✓ Publish/subscribe funciona
- ✓ Eventos são emitidos corretamente
```

**V2:**
```javascript
// Recognition
- ✓ Cache previne duplicatas
- ✓ Fallback ACRCloud → AudD
- ✓ Confidence threshold funciona
- ✓ Validação contra coleção (fuzzy matching)

// Collection
- ✓ CRUD de álbuns funciona
- ✓ Importação Discogs
- ✓ Busca e filtros
```

**V3:**
```javascript
// Dual-path
- ✓ Recording não degrada streaming
- ✓ Sincronização precisa

// Chromaprint
- ✓ Geração de fingerprint
- ✓ Match local funciona

// QA
- ✓ Análise de métricas
- ✓ Health score calculado corretamente
```

### 12.2 Testes de Integração

```javascript
// End-to-end flow V1
- ✓ Áudio → FFmpeg → Icecast → Browser
- ✓ Event detection → Database → WebSocket → UI
- ✓ Session tracking durante 1 hora

// End-to-end flow V2
- ✓ Recognition → Collection validation → UI
- ✓ Discogs import → Database → UI

// Stress tests
- ✓ 10 clients simultâneos por 24h
- ✓ 1000 eventos sem memory leak
- ✓ Database com 10k tracks (V2)
```

### 12.3 Testes de Aceitação

**V1:**
- [ ] Usuário não-técnico consegue setup em <45 min
- [ ] Stream funciona em iPhone, Android, Desktop
- [ ] Detecção de eventos funciona com >85% precisão
- [ ] Interface de diagnóstico permite ajustar thresholds
- [ ] Interface intuitiva sem manual

**V2:**
- [ ] Reconhece 8/10 músicas da coleção
- [ ] Validação reduz falsos positivos significativamente
- [ ] Gestão de coleção suporta 500+ álbuns

**V3:**
- [ ] Gravação FLAC mantém sincronização
- [ ] QA detecta problemas comuns
- [ ] Reconhecimento offline funciona para maioria da coleção

---

## 13. Roadmap Detalhado

### V1 - Foundation Core
**Duração estimada:** 8-10 semanas  
**Objetivo:** MVP funcional com streaming e detecção de eventos básicos

#### Sprint 1-2: Core Streaming (2 semanas)
- [ ] Captura ALSA estável
- [ ] FFmpeg → Icecast pipeline
- [ ] Frontend player básico
- [ ] PM2 config e auto-start

#### Sprint 3-4: Event Detection (2 semanas)
- [ ] Detecção de silêncio
- [ ] Detecção de clipping
- [ ] Detecção de troca de faixa (versão inicial)
- [ ] EventBus core
- [ ] Persistência de eventos (SQLite)

#### Sprint 5-6: UI & Diagnóstico (2 semanas)
- [ ] Dashboard básico
- [ ] **UI de diagnóstico** (VU meter, thresholds, log)
- [ ] Histórico de sessões
- [ ] Configurações básicas
- [ ] WebSocket real-time updates

#### Sprint 7-8: Polish & Docs (2 semanas)
- [ ] Error handling robusto
- [ ] Install script completo
- [ ] Documentação básica
- [ ] Testes de aceitação
- [ ] Preparação para release

### V2 - Coleção & Reconhecimento Musical
**Duração estimada:** 8-10 semanas  
**Dependências:** V1 completo e estável

#### Sprint 1-2: Gestão de Coleção (2 semanas)
- [ ] CRUD de álbuns
- [ ] Integração Discogs (busca, importação)
- [ ] UI de gestão de coleção
- [ ] Busca e filtros

#### Sprint 3-4: Reconhecimento Musical (2 semanas)
- [ ] Integração AudD/ACRCloud
- [ ] Sistema de validação contra coleção
- [ ] Fuzzy matching
- [ ] UI de matching/confirmação

#### Sprint 5-6: Integração & Histórico (2 semanas)
- [ ] Link reconhecimento → coleção
- [ ] Histórico de escuta expandido
- [ ] Estatísticas
- [ ] Export de dados

#### Sprint 7-8: Polish V2 (2 semanas)
- [ ] Otimização de performance
- [ ] Testes de aceitação
- [ ] Documentação
- [ ] Release V2

### V3 - Gravação & Análise
**Duração estimada:** 12-14 semanas  
**Dependências:** V2 completo

#### Sprint 1-3: Dual-Path Architecture (3 semanas)
- [ ] Recording path paralelo
- [ ] Sincronização sample-accurate
- [ ] Buffer circular pré-roll
- [ ] Testes de performance (garantir <5% overhead)

#### Sprint 4-6: Gravação FLAC (3 semanas)
- [ ] Gravação automática por sessão
- [ ] Segmentação automática
- [ ] Metadata embedding
- [ ] Gravação manual com pré-roll
- [ ] UI de gravações

#### Sprint 7-9: Chromaprint & Offline (3 semanas)
- [ ] Geração de fingerprints
- [ ] Reconhecimento offline
- [ ] Cache local de fingerprints
- [ ] UI de gerenciamento

#### Sprint 10-12: Quality Analysis (3 semanas)
- [ ] Análise SNR, wow/flutter
- [ ] Detecção clicks/pops
- [ ] Health score
- [ ] Relatórios e visualizações
- [ ] UI de QA

#### Sprint 13-14: Polish V3 (2 semanas)
- [ ] EventBus extensível para plugins
- [ ] Testes completos
- [ ] Documentação
- [ ] Release V3

### V4 - Polimento & Controles Avançados
**Duração estimada:** 6-8 semanas  
**Dependências:** V3 completo

#### Sprint 1-2: UI Final (2 semanas)
- [ ] Refinamento UX baseado em feedback
- [ ] Mobile-responsive completo
- [ ] Performance otimizada
- [ ] Acessibilidade básica

#### Sprint 3-4: Admin Controls (2 semanas)
- [ ] Configurações avançadas via UI
- [ ] Dashboard de métricas
- [ ] Alertas configuráveis
- [ ] Logs e debugging tools

#### Sprint 5-6: Integrações (2 semanas)
- [ ] Last.fm scrobbling
- [ ] MQTT support
- [ ] Webhooks
- [ ] Notificações (Slack/Discord)

#### Sprint 7-8: Release Final (2 semanas)
- [ ] Otimizações finais
- [ ] Testes de regressão
- [ ] Documentação completa
- [ ] Release V4

---

## 14. Riscos & Mitigação

### Riscos Técnicos por Versão

**V1:**
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Detecção de troca de faixa imprecisa | Alta | Médio | UI de calibração manual, aceitar <80% inicial |
| Latência maior que esperado | Alta | Médio | Aceitar 1-2s como baseline |
| WiFi instável | Média | Alto | Documentar Ethernet como recomendado |
| Memory leak em long-running | Média | Alto | PM2 restart diário, monitoring |
| SD card corruption | Baixa | Crítico | WAL mode, backup automático |

**V2:**
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Fuzzy matching gera falsos positivos | Alta | Médio | Thresholds ajustáveis, confirmação manual |
| Discogs API rate limits | Média | Baixo | Cache agressivo, importação em batch |
| Reconhecimento baixo em vinis antigos | Alta | Médio | UI para correção manual |

**V3:**
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Dual-path degrada performance | Média | Alto | Testes extensivos, buffer otimizado |
| Chromaprint lento | Média | Baixo | Processamento assíncrono, cache |
| QA não detecta problemas reais | Média | Baixo | Validação com usuários, ajustes de algoritmo |

### Riscos de Adoção

| Risco | Mitigação |
|-------|-----------|
| Setup muito complexo | Script de instalação one-click, documentação clara |
| Dependência de API keys (V2) | Modo básico sem reconhecimento funciona |
| Documentação insuficiente | Videos de setup, FAQ extenso |
| Eventos sonoros não funcionam bem | UI de diagnóstico permite ajuste, documentação de troubleshooting |

---

## 15. Métricas de Monitoramento

### Runtime Metrics (Dashboard)

**V1:**
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
    track_change_events: number, // V1
    sample_rate_actual: number
  },
  events: { // V1
    total_detected: number,
    by_type: { [type: string]: number },
    last_hour: number
  }
}
```

**V2+:** Adicionar:
```javascript
  recognition: {
    total_attempts: number,
    success_rate: percent,
    cache_hit_rate: percent,
    collection_match_rate: percent, // V2
    avg_response_time_ms: number,
    api_credits_remaining: number
  },
  collection: { // V2
    total_albums: number,
    recently_added: number
  }
```

### Business Metrics (Weekly Report)

- Total listening hours
- Sessions count
- Events detected (V1)
- Unique albums played (V2+)
- Most played artists (V2+)
- Recognition accuracy (V2+)
- System stability (uptime %)
- Collection growth (V2+)

---

## 16. Decisões de Design

### Por que Reconhecimento Sonoro antes de Musical?
- **Reduz risco técnico**: Valida eventos básicos primeiro
- **Fundação sólida**: Detecção de eventos é base para features futuras
- **Feedback mais rápido**: Usuário vê sistema funcionando sem depender de APIs externas
- **Aprendizado iterativo**: Ajustar thresholds é mais fácil que corrigir reconhecimento musical

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
- Opus/AAC para versões futuras (se necessário)

### Por que EventBus básico V1, extensível V3?
- **V1**: Foco em eventos internos, manter simples
- **V3**: Quando precisa de plugins, refatorar com conhecimento acumulado
- **YAGNI**: Não construir extensibilidade que não será usada ainda

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
- Release cycle mensal (após V4)

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
sqlite3 data/vinyl-os.db "SELECT COUNT(*) FROM audio_events;"  # V1
sqlite3 data/vinyl-os.db "SELECT COUNT(*) FROM tracks;"  # V2

# Network
ss -tuln | grep -E "3000|8000"
curl http://localhost:8000/status-json.xsl

# Logs
journalctl -u icecast2 -f
tail -f data/logs/vinyl-os.log
```

### B. Configuração Exemplo Completa

```javascript
// ecosystem.config.js (PM2)
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
- **Chromaprint**: Algoritmo de fingerprinting de áudio (V3)
- **EventBus**: Sistema de eventos pub/sub interno
- **FFmpeg**: Framework de processamento multimídia  
- **FIFO**: First In First Out (named pipe)
- **LINE level**: ~1V RMS, sinal pré-amplificado
- **Mount point**: Endpoint URL no Icecast
- **PHONO level**: ~5mV, precisa pré-amplificação RIAA
- **Pré-roll**: Captura de áudio antes do comando de gravação (V3)
- **QA**: Quality Analysis, análise de qualidade do vinil (V3)
- **Sample rate**: Amostras por segundo (48000 Hz)
- **TTL**: Time To Live (cache expiration)
- **VU meter**: Medidor de nível de áudio em tempo real
- **WAL**: Write-Ahead Logging (SQLite mode)

---

## 20. Critérios de Aceitação por Versão

### V1 - Foundation Core

#### Must Have (Launch Blockers)
- [ ] Stream funciona por 24h sem interrupção
- [ ] Detecção de eventos sonoros funciona com >85% precisão (silêncio/sessões)
- [ ] UI carrega em <2s na rede local
- [ ] Sessões são detectadas e salvas corretamente
- [ ] Interface de diagnóstico permite ajustar thresholds
- [ ] Install script funciona no Pi OS 64-bit limpo
- [ ] Documentação cobre setup básico

#### Should Have
- [ ] Dark mode
- [ ] Export CSV do histórico de eventos
- [ ] Detecção de troca de faixa (mesmo que <80% precisão)
- [ ] Calibração manual funcional

#### Could Have  
- [ ] Estatísticas detalhadas
- [ ] Visualizações de eventos (timeline, gráficos)

### V2 - Coleção & Reconhecimento Musical

#### Must Have
- [ ] Reconhece música com >80% de acurácia em coleção testada
- [ ] Validação contra coleção reduz falsos positivos em >50%
- [ ] Gestão de coleção suporta 500+ álbuns sem performance issues
- [ ] Integração Discogs importa metadados corretamente
- [ ] UI de coleção intuitiva

#### Should Have
- [ ] Busca e filtros avançados
- [ ] Importação em batch
- [ ] Estatísticas da coleção

### V3 - Gravação & Análise

#### Must Have
- [ ] Dual-path não degrada performance do streaming (<5% overhead)
- [ ] Gravação FLAC mantém sincronização precisa com eventos (<100ms drift)
- [ ] Chromaprint reconhece >70% dos álbuns da coleção offline
- [ ] QA detecta problemas comuns (cracks, wear) com >75% precisão
- [ ] Relatórios de QA são gerados corretamente

### V4 - Polimento & Controles

#### Must Have
- [ ] UI funciona perfeitamente em mobile
- [ ] Admin controls permitem configuração avançada sem editar arquivos
- [ ] Integrações funcionam estáveis por 30+ dias
- [ ] Performance otimizada (carregamento <2s)

---

## 21. Decisões Pendentes & Notas

### Decisões Assumidas para este PRD:
1. **Detecção de troca de faixa V1**: Incluída mesmo que precisão inicial <80%, com UI de calibração
2. **EventBus V1**: Básico, extensível na V3 (YAGNI)
3. **Discogs V2**: Opcional (API key), mas recomendado
4. **Chromaprint V3**: Apenas fingerprints locais da coleção (sem MusicBrainz mirror por enquanto)

### Notas Técnicas:
- **Precisão de detecção V1**: Pode variar muito dependendo do toca-discos. UI de diagnóstico é crítica.
- **Reconhecimento musical V2**: Validação contra coleção é chave para reduzir erros.
- **Dual-path V3**: Maior risco técnico, requer testes extensivos.
- **QA V3**: Algoritmos podem precisar ajuste baseado em feedback real.

---

**Este PRD v3.0 representa uma divisão estratégica em 4 versões incrementais, priorizando estabilidade e validação progressiva de features complexas.**

**Princípio central: "Estabilidade antes de features, validação antes de complexidade"**

---

**Próximos passos:**
1. ✅ Revisar este PRD
2. ⏭️ Validar decisões assumidas
3. ⏭️ Criar issues/tasks detalhadas para V1
4. ⏭️ Iniciar desenvolvimento V1

