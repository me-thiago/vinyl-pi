# Epic Technical Specification: Coleção & Reconhecimento Musical

Date: 2025-12-04
Author: Thiago
Epic ID: v2
Status: Draft

---

## Overview

O Epic V2 - Coleção & Reconhecimento Musical representa a evolução do Vinyl-OS de um sistema de streaming básico para uma plataforma completa de gerenciamento de coleção de vinis com identificação automática de músicas. Este épico adiciona três pilares fundamentais:

1. **Gestão de Coleção**: CRUD completo de álbuns com integração Discogs para importação automática de metadados e capas de alta resolução.

2. **Reconhecimento Musical**: Integração com serviços de fingerprinting de áudio (ACRCloud/AudD) para identificar automaticamente qual música está tocando, com cache inteligente para reduzir chamadas de API.

3. **Validação Inteligente**: Sistema de fuzzy matching que cruza reconhecimentos com a coleção do usuário, reduzindo falsos positivos e vinculando automaticamente as músicas aos álbuns físicos correspondentes.

O V2 transforma a experiência de "streaming genérico" para "minha coleção, minha música, minhas informações", mantendo a filosofia local-first do projeto enquanto utiliza APIs externas apenas quando necessário.

## Objectives and Scope

### In Scope (V2)

**Gestão de Coleção:**
- CRUD completo de álbuns (criar, ler, atualizar, deletar)
- Campos: título, artista, ano, label, formato (LP, 7", 12"), capa, condição física, tags, notas
- Integração Discogs para busca e importação automática
- UI de gestão com grid/lista, busca e filtros
- Suporte a 500+ álbuns sem degradação de performance

**Reconhecimento Musical:**
- Integração ACRCloud como serviço primário
- Fallback para AudD se ACRCloud falhar
- Captura de sample de áudio (5-10s) via FFmpeg
- Cache de reconhecimentos (30 min TTL)
- Endpoint manual (`POST /api/recognize`) e automático (timer configurável)

**Validação e Linking:**
- Fuzzy matching (Levenshtein) de artista + álbum
- Threshold de confiança configurável
- Vinculação de tracks reconhecidos a álbuns da coleção
- UI de confirmação para matches ambíguos

**Histórico e Estatísticas:**
- Histórico de escuta expandido com tracks reconhecidos
- Estatísticas da coleção (álbuns por artista, mais tocados, etc.)
- Export de dados (CSV/JSON)

### Out of Scope (V2)

- Reconhecimento offline/local (chromaprint) → V3
- Gravação FLAC → V3
- Quality Analysis (SNR, clicks/pops) → V3
- Autenticação/multi-user (sistema permanece single-user local)
- Integrações externas (Last.fm, MQTT) → V4
- Edição de metadados em batch
- Comparação entre prensagens de um mesmo álbum

## System Architecture Alignment

O Epic V2 estende a arquitetura existente definida em `docs/architecture.md` sem alterações fundamentais:

### Componentes Existentes Utilizados

| Componente | Uso no V2 |
|------------|-----------|
| Express Backend | Novas rotas `/api/albums`, `/api/recognize` |
| Prisma ORM | Novos models Album, Track, RecognitionCache |
| Socket.io | Eventos `track_recognized`, atualizações de coleção |
| EventBus | Novo evento `track.recognized` para pipeline |
| Frontend React | Novas páginas Collection, histórico expandido |
| FFmpeg | Captura de sample para reconhecimento |

### Novos Componentes V2

```
backend/src/
├── services/
│   ├── recognition.ts     # Service de reconhecimento (ACRCloud + AudD)
│   ├── discogs.ts         # Cliente API Discogs
│   └── collection-matcher.ts # Fuzzy matching coleção
├── routes/
│   ├── albums.ts          # CRUD de álbuns
│   └── recognition.ts     # Endpoint de reconhecimento
├── schemas/
│   ├── albums.schema.ts   # Validação Zod para álbuns
│   └── recognition.schema.ts
└── workers/
    └── recognition-worker.ts # (Opcional) Background processing

frontend/src/
├── pages/
│   ├── Collection.tsx     # Gestão de coleção
│   └── History.tsx        # Histórico expandido
├── components/
│   ├── Collection/
│   │   ├── AlbumCard.tsx
│   │   ├── AlbumForm.tsx
│   │   ├── AlbumGrid.tsx
│   │   └── DiscogsImport.tsx
│   └── Recognition/
│       ├── NowPlaying.tsx
│       └── MatchConfirmation.tsx
└── hooks/
    ├── useAlbums.ts
    └── useRecognition.ts
```

### Fluxo de Dados V2

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │Collection│  │NowPlaying│  │ History  │  │MatchConfirm│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
└───────┼─────────────┼─────────────┼──────────────┼──────────┘
        │ REST        │ WS          │ REST         │ REST
┌───────▼─────────────▼─────────────▼──────────────▼──────────┐
│                         Backend                              │
│  ┌────────┐  ┌───────────┐  ┌─────────┐  ┌───────────────┐  │
│  │ Albums │  │Recognition│  │ Discogs │  │CollectionMatch│  │
│  │ Route  │  │  Service  │  │ Service │  │   Service     │  │
│  └───┬────┘  └─────┬─────┘  └────┬────┘  └───────┬───────┘  │
│      │             │             │               │           │
│      └──────┬──────┴──────┬──────┴───────────────┘           │
│             │             │                                  │
│      ┌──────▼──────┐   ┌──▼───────────┐                     │
│      │   Prisma    │   │  EventBus    │                     │
│      │  (SQLite)   │   │track.recognized                    │
│      └─────────────┘   └──────────────┘                     │
└──────────────────────────────────────────────────────────────┘
        │                       │
        ▼                       ▼
┌───────────────┐    ┌─────────────────────┐
│  SQLite DB    │    │   External APIs     │
│ albums,tracks │    │ ACRCloud, AudD,     │
│ recognition_  │    │ Discogs             │
│ cache         │    └─────────────────────┘
└───────────────┘
```

### Alinhamento com Padrões Existentes

- **Validação**: Zod schemas para todos endpoints (padrão V1.5)
- **Logging**: Winston via `createLogger('ServiceName')`
- **Erros**: Formato `{ error: { message, code, details? } }` em português
- **EventBus**: Padrão pub/sub com handlers armazenados (memory safety)
- **Testes**: Jest backend, Vitest frontend
- **i18n**: Novas chaves em `locales/pt-BR.json` e `en.json`

## Detailed Design

### Services and Modules

| Service/Module | Responsabilidades | Inputs/Outputs | Localização |
|----------------|-------------------|----------------|-------------|
| `recognition.ts` | Orquestrar reconhecimento musical | Input: sample audio, Output: track metadata | `backend/src/services/` |
| `discogs.ts` | Cliente API Discogs com rate limiting | Input: catalog/barcode, Output: album metadata | `backend/src/services/` |
| `collection-matcher.ts` | Fuzzy matching de reconhecimentos | Input: track + albums[], Output: matches[] | `backend/src/services/` |
| `albums.ts` (route) | CRUD de álbuns REST | HTTP requests/responses | `backend/src/routes/` |
| `recognition.ts` (route) | Endpoint de reconhecimento | POST trigger, GET status | `backend/src/routes/` |
| `tracks.ts` (route) | Histórico de tracks reconhecidos | GET com filtros | `backend/src/routes/` |
| `albums.schema.ts` | Validação Zod para álbuns | Schema validation | `backend/src/schemas/` |
| `recognition.schema.ts` | Validação Zod para reconhecimento | Schema validation | `backend/src/schemas/` |
| `Collection.tsx` | Página de gestão de coleção | React component | `frontend/src/pages/` |
| `AlbumCard.tsx` | Card de álbum (grid view) | Props: album | `frontend/src/components/Collection/` |
| `AlbumForm.tsx` | Formulário criar/editar álbum | Props: album?, onSave | `frontend/src/components/Collection/` |
| `DiscogsImport.tsx` | Modal de importação Discogs | Props: onImport | `frontend/src/components/Collection/` |
| `NowPlaying.tsx` | Display de música atual | Props: track | `frontend/src/components/Recognition/` |
| `MatchConfirmation.tsx` | Modal de confirmação de match | Props: matches[], onSelect | `frontend/src/components/Recognition/` |
| `useAlbums.ts` | Hook para CRUD de álbuns | CRUD operations | `frontend/src/hooks/` |
| `useRecognition.ts` | Hook para reconhecimento | trigger, status, result | `frontend/src/hooks/` |

### Data Models and Contracts

**Prisma Schema V2 (adições ao schema existente):**

```prisma
// ============================================
// V2 Enums
// ============================================

/// Formato físico do disco
enum AlbumFormat {
  LP          // 12" 33rpm
  EP          // Extended Play
  SINGLE_7    // 7" 45rpm
  SINGLE_12   // 12" 45rpm
  DOUBLE_LP   // 2xLP
  BOX_SET     // Box com múltiplos discos
}

/// Condição física do disco (Goldmine Standard)
enum AlbumCondition {
  mint        // Perfeito, nunca tocado
  near_mint   // Quase perfeito, mínimo uso
  vg_plus     // Very Good Plus - leve desgaste
  vg          // Very Good - desgaste audível mas não excessivo
  good        // Desgaste significativo
  fair        // Muito desgaste, ainda tocável
  poor        // Danos severos
}

/// Fonte do reconhecimento musical
enum RecognitionSource {
  acrcloud
  audd
  manual
}

// ============================================
// V2 Models - Coleção & Reconhecimento
// ============================================

model Album {
  id               String          @id @default(uuid())
  title            String
  artist           String
  year             Int?
  label            String?
  format           AlbumFormat?
  coverUrl         String?
  discogsId        Int?            @unique
  discogsAvailable Boolean         @default(true)  // false se removido do Discogs
  condition        AlbumCondition?
  tags             Json?           // Array de strings: ["rock", "80s", "favorite"]
  notes            String?
  archived         Boolean         @default(false) // true = usuário não possui mais
  tracks           Track[]
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@index([artist])
  @@index([title])
  @@index([year])
  @@index([archived])
  @@index([createdAt(sort: Desc)])
}

model Track {
  id                String            @id @default(uuid())
  sessionId         String
  session           Session           @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  albumId           String?
  album             Album?            @relation(fields: [albumId], references: [id], onDelete: SetNull)
  title             String
  artist            String
  albumName         String?           // Nome do álbum retornado pelo serviço (pode diferir do Album vinculado)
  albumArtUrl       String?
  year              Int?
  label             String?
  isrc              String?
  durationSeconds   Int?              // Duração da faixa - usado para timing de próximo reconhecimento
  confidence        Float             @default(0)
  recognitionSource RecognitionSource @default(manual)
  recognizedAt      DateTime          @default(now())
  metadata          Json?             // Dados extras do serviço de reconhecimento

  @@index([sessionId])
  @@index([albumId])
  @@index([recognizedAt(sort: Desc)])
  @@index([artist, title])
}

// Atualização do Session model para incluir tracks
model Session {
  // ... campos existentes ...
  tracks          Track[]   // NOVO: relacionamento com tracks
}
```

**Nota sobre Cache:** O V2 **não implementa cache de reconhecimento**. Cada chamada a `/api/recognize` faz request direto ao ACRCloud/AudD. O campo `durationSeconds` do Track será usado para calcular timing inteligente do próximo reconhecimento automático (evitando chamadas redundantes durante a mesma faixa).

**Relacionamentos:**
- `Album` 1:N `Track` (um álbum pode ter múltiplos tracks reconhecidos)
- `Session` 1:N `Track` (uma sessão pode ter múltiplos tracks)
- `Track` N:1 `Album` (opcional - track pode existir sem álbum vinculado)

**Campos especiais:**
- `Album.archived`: Marca álbuns que o usuário vendeu/doou mas quer manter no histórico
- `Album.discogsAvailable`: `false` quando álbum foi removido do Discogs (dados locais preservados)
- `Track.durationSeconds`: Usado pelo reconhecimento automático para agendar próxima captura

### APIs and Interfaces

**Albums CRUD:**

```typescript
// GET /api/albums - Listar álbuns
Query: {
  limit?: number;        // default: 20, max: 100
  offset?: number;       // default: 0
  search?: string;       // busca em title e artist
  artist?: string;       // filtro exato
  year?: number;         // filtro exato
  format?: AlbumFormat;  // enum: LP, EP, SINGLE_7, SINGLE_12, DOUBLE_LP, BOX_SET
  archived?: boolean;    // default: false (não mostrar arquivados)
  sort?: 'title' | 'artist' | 'year' | 'createdAt'; // default: 'createdAt'
  order?: 'asc' | 'desc'; // default: 'desc'
}
Response: {
  data: Album[];
  meta: { total: number; limit: number; offset: number; }
}

// POST /api/albums - Criar álbum
Body: {
  title: string;           // obrigatório
  artist: string;          // obrigatório
  year?: number;
  label?: string;
  format?: AlbumFormat;    // enum
  coverUrl?: string;
  discogsId?: number;
  condition?: AlbumCondition; // enum
  tags?: string[];
  notes?: string;
}
Response: { data: Album }

// GET /api/albums/:id - Buscar álbum por ID
Response: { data: Album }

// PUT /api/albums/:id - Atualizar álbum
Body: Partial<Album> (campos a atualizar)
Response: { data: Album }
// NOTA: discogsId não pode ser alterado via PUT (apenas via import)

// DELETE /api/albums/:id - Deletar álbum
Response: { success: true }
// NOTA: Considerar usar archived=true em vez de deletar para preservar histórico

// PATCH /api/albums/:id/archive - Arquivar/desarquivar álbum
Body: { archived: boolean }
Response: { data: Album }

// POST /api/albums/import-discogs - Importar do Discogs
Body: {
  catalogNumber?: string;
  barcode?: string;
  releaseId?: number;  // ID direto do Discogs
}
Response: {
  data: Album;         // Álbum criado/atualizado
  source: 'discogs';
  discogsUrl: string;
}

// POST /api/albums/:id/sync-discogs - Re-sincronizar com Discogs
Response: {
  data: Album;
  synced: boolean;
  warning?: string;    // "Álbum não encontrado no Discogs" se discogsAvailable=false
}
```

**Recognition:**

```typescript
// POST /api/recognize - Trigger reconhecimento
Body: {
  trigger: 'manual' | 'automatic';
  sampleDuration?: number; // 5-15s, default: 10
}
Response: {
  success: boolean;
  track?: {
    id: string;          // ID do Track criado
    title: string;
    artist: string;
    album: string;
    albumArt: string;
    year?: number;
    durationSeconds?: number; // Duração da faixa (para timing de próximo reconhecimento)
    confidence: number;
    source: 'acrcloud' | 'audd';
    albumMatch?: {
      albumId: string;
      albumTitle: string;
      matchConfidence: number;
      needsConfirmation: boolean;
    };
  };
  nextRecognitionIn?: number; // Segundos até próximo reconhecimento sugerido (baseado em durationSeconds)
  error?: string;
}

// POST /api/recognize/confirm - Confirmar match de álbum
Body: {
  trackId: string;
  albumId: string | null;  // null = "nenhum álbum da coleção"
}
Response: { data: Track }

// GET /api/tracks - Histórico de tracks
Query: {
  limit?: number;
  offset?: number;
  sessionId?: string;
  albumId?: string;
  dateFrom?: string;   // ISO date
  dateTo?: string;
}
Response: {
  data: Track[];
  meta: { total: number; limit: number; offset: number; }
}

// GET /api/recognition/status - Status do reconhecimento automático
Response: {
  enabled: boolean;
  lastRecognizedAt?: string;    // ISO timestamp
  nextRecognitionAt?: string;   // ISO timestamp (se automático habilitado)
  currentTrack?: Track;
}

// PATCH /api/recognition/auto - Habilitar/desabilitar reconhecimento automático
Body: {
  enabled: boolean;
  intervalMinutes?: number;  // Intervalo mínimo entre reconhecimentos (default: 3)
}
Response: { enabled: boolean; intervalMinutes: number; }
```

**Discogs Service Interface:**

```typescript
// backend/src/services/discogs.ts
interface DiscogsService {
  search(query: { catalogNumber?: string; barcode?: string }): Promise<DiscogsRelease[]>;
  getRelease(releaseId: number): Promise<DiscogsRelease>;
  importToAlbum(releaseId: number): Promise<Album>;
}

interface DiscogsRelease {
  id: number;
  title: string;
  artists: { name: string }[];
  year: number;
  labels: { name: string; catno: string }[];
  formats: { name: string; qty: string }[];
  images: { uri: string; type: string }[];
  tracklist: { position: string; title: string; duration: string }[];
}
```

**Recognition Service Interface:**

```typescript
// backend/src/services/recognition.ts
interface RecognitionService {
  recognize(options: RecognizeOptions): Promise<RecognitionResult>;
  getAutoStatus(): AutoRecognitionStatus;
  setAutoEnabled(enabled: boolean, intervalMinutes?: number): void;
  scheduleNextRecognition(durationSeconds?: number): void;
}

interface RecognizeOptions {
  sampleDuration: number;  // segundos (default: 10)
  trigger: 'manual' | 'automatic';
}

interface RecognitionResult {
  success: boolean;
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  year?: number;
  isrc?: string;
  durationSeconds?: number;  // Duração da faixa retornada pelo serviço
  confidence: number;
  source: 'acrcloud' | 'audd';
  rawResponse?: unknown;
}

interface AutoRecognitionStatus {
  enabled: boolean;
  intervalMinutes: number;
  lastRecognizedAt?: Date;
  nextRecognitionAt?: Date;
  currentTrackDuration?: number;  // Usado para timing inteligente
}

// Lógica de timing inteligente:
// - Se durationSeconds disponível: próximo reconhecimento em (durationSeconds - 30) segundos
// - Se não disponível: usa intervalMinutes configurado
// - Mínimo entre reconhecimentos: 60 segundos (evitar spam de API)
```

**Collection Matcher Interface:**

```typescript
// backend/src/services/collection-matcher.ts
interface CollectionMatcher {
  findMatches(track: RecognitionResult, threshold?: number): Promise<AlbumMatch[]>;
}

interface AlbumMatch {
  album: Album;
  confidence: number;      // 0-1 (Levenshtein similarity)
  matchedOn: 'artist+album' | 'artist' | 'album';
  needsConfirmation: boolean; // true se confidence < threshold
}

// Threshold padrão: 0.8 (80% similaridade)
// needsConfirmation: true se confidence entre 0.5 e 0.8
// Descartado: confidence < 0.5
```

### Workflows and Sequencing

**Workflow 1: Reconhecimento Manual**

```
1. Usuário clica "Identificar música"
2. Frontend POST /api/recognize { trigger: 'manual' }
3. Backend:
   a. FFmpeg captura 10s do stream atual (arquivo temporário WAV)
   b. Envia para ACRCloud
   c. Se ACRCloud falhar (timeout, erro, no match) → tenta AudD
   d. Se sucesso:
      - Busca matches na coleção (CollectionMatcher)
      - Cria Track no banco (vinculado à sessão atual)
      - Emite evento track.recognized via EventBus
      - Calcula nextRecognitionIn baseado em durationSeconds
4. Retorna resultado com albumMatch (se encontrado)
5. Frontend atualiza NowPlaying
6. Se needsConfirmation: mostra modal MatchConfirmation
7. Usuário seleciona álbum correto (ou "nenhum")
8. Frontend POST /api/recognize/confirm
9. Backend atualiza Track.albumId
```

**Workflow 2: Reconhecimento Automático**

```
1. Usuário habilita via PATCH /api/recognition/auto { enabled: true }
2. Backend inicia timer inteligente:
   a. Se track anterior tem durationSeconds:
      - Agenda próximo reconhecimento para (durationSeconds - 30) segundos
   b. Se não tem duração:
      - Usa intervalMinutes configurado (default: 3 min)
   c. Mínimo entre reconhecimentos: 60 segundos
3. Quando timer dispara (se sessão ativa):
   a. Executa POST /api/recognize { trigger: 'automatic' }
   b. Mesmo fluxo do manual
4. WebSocket broadcast track_recognized
5. Frontend atualiza NowPlaying automaticamente
6. Timer recalculado baseado na nova durationSeconds
```

**Workflow 3: Importação Discogs**

```
1. Usuário abre modal "Importar do Discogs"
2. Digita número de catálogo ou barcode
3. Frontend POST /api/albums/import-discogs
4. Backend:
   a. Busca no Discogs API
   b. Se múltiplos resultados → retorna lista para seleção
   c. Se único resultado → importa automaticamente
5. Cria Album com dados do Discogs:
   - title, artist, year, label, format (mapeado para enum)
   - coverUrl (maior resolução disponível)
   - discogsId (para referência futura)
   - discogsAvailable = true
6. Retorna álbum criado
7. Frontend navega para página do álbum
```

**Workflow 4: Re-sincronização Discogs**

```
1. Usuário clica "Sincronizar" em álbum com discogsId
2. Frontend POST /api/albums/:id/sync-discogs
3. Backend:
   a. Busca release no Discogs por discogsId
   b. Se encontrado:
      - Atualiza APENAS campos vazios localmente (não sobrescreve edições do usuário)
      - Atualiza coverUrl se maior resolução disponível
      - discogsAvailable = true
   c. Se NÃO encontrado (404 ou removido):
      - discogsAvailable = false
      - NÃO apaga dados locais
      - Retorna warning: "Álbum não encontrado no Discogs. Dados locais preservados."
4. Retorna álbum atualizado com status de sync
```

**Workflow 5: Fuzzy Matching**

```
1. RecognitionService obtém resultado (title, artist, album)
2. CollectionMatcher.findMatches():
   a. Busca todos álbuns do banco (WHERE archived = false)
   b. Para cada álbum:
      - Calcula Levenshtein(track.artist, album.artist)
      - Calcula Levenshtein(track.album, album.title)
      - Score = (artistScore * 0.6) + (albumScore * 0.4)
   c. Filtra score >= 0.5
   d. Ordena por score desc
   e. Retorna top 5 matches
3. Se melhor match score >= 0.8:
   - Vincula automaticamente
   - needsConfirmation = false
4. Se melhor match score entre 0.5 e 0.8:
   - needsConfirmation = true
   - Frontend mostra opções para usuário
5. Se nenhum match >= 0.5:
   - albumMatch = null
   - Opção "Adicionar à coleção" disponível
```

**Workflow 6: Arquivar Álbum**

```
1. Usuário marca álbum como "Não tenho mais"
2. Frontend PATCH /api/albums/:id/archive { archived: true }
3. Backend:
   a. Atualiza Album.archived = true
   b. Álbum permanece no banco (histórico preservado)
   c. Álbum não aparece mais em listagens padrão (archived=false)
   d. Álbum não é considerado no fuzzy matching
4. Para desarquivar: PATCH /api/albums/:id/archive { archived: false }
```

**Sequência de Eventos (EventBus):**

```typescript
// Novos eventos V2
'track.recognized'      // Payload: { track, albumMatch?, sessionId }
'album.created'         // Payload: { album }
'album.updated'         // Payload: { album }
'album.deleted'         // Payload: { albumId }
'collection.imported'   // Payload: { album, source: 'discogs' }
```

**WebSocket Events (Socket.io):**

```typescript
// Server → Client
{ type: 'track_recognized', data: { track, albumMatch?, cached } }
{ type: 'album_created', data: { album } }
{ type: 'album_updated', data: { album } }
{ type: 'album_deleted', data: { albumId } }
```

## Non-Functional Requirements

### Performance

| Métrica | Target | Notas |
|---------|--------|-------|
| Reconhecimento end-to-end | < 15s | Captura (10s) + API call (~3-5s) |
| Listagem de álbuns (500 itens) | < 200ms | Paginação obrigatória |
| Busca fuzzy (500 álbuns) | < 100ms | Levenshtein otimizado |
| Importação Discogs | < 5s | Inclui download de capa |
| API ACRCloud timeout | 10s | Fallback para AudD após timeout |
| API AudD timeout | 10s | Erro após timeout |
| Discogs API rate limit | 60 req/min | Implementar throttling |

**Otimizações:**
- Índices no banco para queries frequentes (artist, title, year, archived)
- Lazy loading de capas de álbuns no frontend
- Paginação server-side para listagens grandes

### Security

| Aspecto | Implementação |
|---------|---------------|
| API Keys externas | Armazenadas em `.env`, nunca no código |
| Validação de input | Zod schemas para todos endpoints |
| Rate limiting | Mantido de V1.5 (100 req/min) |
| CORS | Mantido de V1.5 (rede local apenas) |
| Dados sensíveis | API keys não expostas em logs ou respostas |
| Discogs OAuth | Opcional - pode usar API key pública para busca |

**Variáveis de ambiente novas:**
```env
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com
ACRCLOUD_ACCESS_KEY=xxx
ACRCLOUD_ACCESS_SECRET=xxx
AUDD_API_TOKEN=xxx
DISCOGS_CONSUMER_KEY=xxx
DISCOGS_CONSUMER_SECRET=xxx
```

### Reliability/Availability

| Cenário | Comportamento |
|---------|---------------|
| ACRCloud indisponível | Fallback automático para AudD |
| AudD indisponível | Retorna erro amigável, não crash |
| Discogs indisponível | Retorna erro, permite criar álbum manualmente |
| Discogs álbum removido | `discogsAvailable=false`, dados preservados |
| Sem sessão ativa | Reconhecimento retorna erro "Nenhuma sessão ativa" |
| Reconhecimento falha | Track não criado, erro retornado, sistema continua |

**Graceful Degradation:**
- Reconhecimento é feature opcional - streaming continua funcionando
- Se APIs externas falharem, coleção manual ainda funciona 100%
- Histórico de escuta funciona mesmo sem reconhecimento (baseado em sessões)

### Observability

| Sinal | Implementação |
|-------|---------------|
| Logs de reconhecimento | `[Recognition] ACRCloud: success/fail, confidence, duration` |
| Logs de Discogs | `[Discogs] import/sync: releaseId, status` |
| Métricas de API externa | Contador de calls, taxa de sucesso, latência média |
| Erros | Sentry para erros de API externa com contexto |
| WebSocket events | `track_recognized` broadcast para debugging |

**Novos logs:**
```
[Recognition] Captura iniciada: sessionId=xxx, duration=10s
[Recognition] ACRCloud response: confidence=0.95, track="Song Name - Artist"
[Recognition] Fallback para AudD: ACRCloud timeout
[Discogs] Import: releaseId=12345, title="Album Name"
[Discogs] Sync failed: releaseId=12345 não encontrado (404)
[CollectionMatcher] Match encontrado: albumId=xxx, confidence=0.87
```

## Dependencies and Integrations

### Novas Dependências Backend

```json
{
  "dependencies": {
    "fastest-levenshtein": "^1.0.16",  // Fuzzy matching otimizado
    "form-data": "^4.0.0"               // Upload de áudio para APIs
  }
}
```

**Nota:** Não adicionar clientes específicos para ACRCloud/AudD/Discogs. Usar `fetch` nativo do Node.js 20+ para requests HTTP. Menos dependências = menos superfície de ataque e manutenção.

### Novas Dependências Frontend

```json
{
  "dependencies": {
    // Nenhuma nova dependência necessária
    // Usar componentes shadcn/ui existentes
  }
}
```

### Integrações Externas

| Serviço | Uso | Documentação | Custo |
|---------|-----|--------------|-------|
| **ACRCloud** | Reconhecimento musical primário | [docs.acrcloud.com](https://docs.acrcloud.com/reference/identification-api) | Free tier: 500 req/mês |
| **AudD** | Fallback de reconhecimento | [docs.audd.io](https://docs.audd.io/) | Free tier: 300 req/mês |
| **Discogs** | Metadados de álbuns | [discogs.com/developers](https://www.discogs.com/developers/) | Gratuito (rate limit 60/min) |

**ACRCloud Integration:**
```typescript
// Endpoint: POST https://{host}/v1/identify
// Auth: HMAC-SHA1 signature
// Input: audio file (WAV), sample rate, duration
// Output: { status, metadata: { music: [{ title, artists, album, duration_ms }] } }
```

**AudD Integration:**
```typescript
// Endpoint: POST https://api.audd.io/
// Auth: API token
// Input: audio file ou URL
// Output: { status, result: { title, artist, album, release_date } }
```

**Discogs Integration:**
```typescript
// Search: GET https://api.discogs.com/database/search
// Release: GET https://api.discogs.com/releases/{release_id}
// Auth: Consumer key/secret (header ou query param)
// Rate limit: 60 requests/minuto
```

### FFmpeg (existente)

Usado para captura de sample de áudio:
```bash
# Captura 10s do stream atual para arquivo temporário
ffmpeg -f s16le -ar 48000 -ac 2 -i /tmp/vinyl-audio.fifo \
  -t 10 -acodec pcm_s16le -ar 44100 -ac 1 \
  /tmp/recognition-sample.wav
```

**Notas:**
- Downmix para mono (APIs preferem mono)
- Resample para 44100Hz (padrão de APIs de reconhecimento)
- Arquivo temporário deletado após envio

## Acceptance Criteria (Authoritative)

### Gestão de Coleção

**AC-01**: CRUD de álbuns funciona
- Given: Usuário na página de coleção
- When: Cria, edita, lista e deleta álbuns
- Then: Operações persistidas no banco, UI atualiza

**AC-02**: Campos obrigatórios validados
- Given: POST/PUT /api/albums sem title ou artist
- When: Request processada
- Then: Response 400 com mensagem de validação em português

**AC-03**: Busca e filtros funcionam
- Given: 50 álbuns no banco
- When: GET /api/albums?search=beatles&format=LP
- Then: Retorna apenas álbuns que matcham critérios

**AC-04**: Paginação funciona
- Given: 100 álbuns no banco
- When: GET /api/albums?limit=20&offset=40
- Then: Retorna 20 álbuns, meta.total=100

**AC-05**: Álbum arquivado não aparece em listagem padrão
- Given: Álbum com archived=true
- When: GET /api/albums (sem ?archived=true)
- Then: Álbum não retornado na lista

### Integração Discogs

**AC-06**: Importação por catálogo funciona
- Given: Número de catálogo válido
- When: POST /api/albums/import-discogs { catalogNumber: "ABC-123" }
- Then: Álbum criado com metadados do Discogs, coverUrl preenchido

**AC-07**: Re-sync atualiza apenas campos vazios
- Given: Álbum com title editado manualmente
- When: POST /api/albums/:id/sync-discogs
- Then: title preservado, campos vazios atualizados do Discogs

**AC-08**: Álbum removido do Discogs marcado corretamente
- Given: Álbum com discogsId que não existe mais
- When: POST /api/albums/:id/sync-discogs
- Then: discogsAvailable=false, warning retornado, dados preservados

### Reconhecimento Musical

**AC-09**: Reconhecimento manual funciona
- Given: Sessão ativa com áudio tocando
- When: POST /api/recognize { trigger: 'manual' }
- Then: Track identificado e salvo, NowPlaying atualizado

**AC-10**: Fallback para AudD funciona
- Given: ACRCloud timeout ou erro
- When: Reconhecimento executado
- Then: AudD usado automaticamente, source='audd'

**AC-11**: durationSeconds usado para timing
- Given: Track reconhecido com durationSeconds=180
- When: Reconhecimento automático habilitado
- Then: Próximo reconhecimento agendado para ~150s (180-30)

**AC-12**: Reconhecimento sem sessão retorna erro
- Given: Nenhuma sessão ativa
- When: POST /api/recognize
- Then: Response 400 "Nenhuma sessão ativa"

### Fuzzy Matching

**AC-13**: Match automático com alta confiança
- Given: Track "The Beatles - Hey Jude", Álbum "Hey Jude" de "The Beatles" na coleção
- When: Reconhecimento executado
- Then: Track vinculado ao álbum automaticamente (confidence >= 0.8)

**AC-14**: Match com confirmação para média confiança
- Given: Track "Beatles - Hey Jude", Álbum "Hey Jude" de "The Beatles"
- When: Reconhecimento executado (confidence 0.5-0.8)
- Then: needsConfirmation=true, UI mostra opções

**AC-15**: Álbuns arquivados não considerados no matching
- Given: Álbum correspondente com archived=true
- When: CollectionMatcher.findMatches()
- Then: Álbum arquivado não retornado como match

### Histórico e Estatísticas

**AC-16**: Histórico de tracks acessível
- Given: 10 tracks reconhecidos em sessões anteriores
- When: GET /api/tracks
- Then: Lista de tracks com metadados e albumMatch

**AC-17**: Filtro por sessão funciona
- Given: Tracks em múltiplas sessões
- When: GET /api/tracks?sessionId=xxx
- Then: Apenas tracks da sessão especificada

### WebSocket

**AC-18**: track_recognized broadcast funciona
- Given: Frontend conectado via WebSocket
- When: Track reconhecido
- Then: Evento track_recognized recebido, NowPlaying atualiza

## Traceability Mapping

| AC | Story | Spec Section | Component(s) | Test Idea |
|----|-------|--------------|--------------|-----------|
| AC-01 | V2-02 | APIs/Albums CRUD | albums.ts route, Album model | CRUD operations, verify persistence |
| AC-02 | V2-02 | APIs/Albums CRUD | albums.schema.ts | POST sem title, verificar 400 |
| AC-03 | V2-02 | APIs/Albums CRUD | albums.ts route | GET com search/format, verificar filtro |
| AC-04 | V2-02 | APIs/Albums CRUD | albums.ts route | GET com offset, verificar paginação |
| AC-05 | V2-02 | Workflows/Arquivar | albums.ts route | Criar archived, GET sem param, verificar ausente |
| AC-06 | V2-04 | APIs/import-discogs | discogs.ts service | Mock Discogs API, verificar Album criado |
| AC-07 | V2-04 | Workflows/Re-sync | discogs.ts service | Editar title, sync, verificar preservado |
| AC-08 | V2-04 | Workflows/Re-sync | discogs.ts service | Mock 404, verificar discogsAvailable=false |
| AC-09 | V2-05 | APIs/Recognition | recognition.ts service | Mock ACRCloud, verificar Track criado |
| AC-10 | V2-05 | APIs/Recognition | recognition.ts service | Mock ACRCloud timeout, verificar AudD usado |
| AC-11 | V2-12 | Workflows/Auto | recognition.ts service | Verificar timer agendado corretamente |
| AC-12 | V2-05 | APIs/Recognition | recognition.ts route | POST sem sessão, verificar 400 |
| AC-13 | V2-06 | Workflows/Fuzzy | collection-matcher.ts | Album exato, verificar vinculação auto |
| AC-14 | V2-07 | Workflows/Fuzzy | collection-matcher.ts | Album similar, verificar needsConfirmation |
| AC-15 | V2-06 | Workflows/Fuzzy | collection-matcher.ts | Album archived, verificar não retornado |
| AC-16 | V2-09 | APIs/Tracks | tracks.ts route | GET /api/tracks, verificar lista |
| AC-17 | V2-09 | APIs/Tracks | tracks.ts route | GET com sessionId, verificar filtro |
| AC-18 | V2-08 | WebSocket Events | websocket handler | Mock recognition, verificar broadcast |

## Risks, Assumptions, Open Questions

### Risks

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | ACRCloud/AudD não reconhecem vinis antigos/raros | Alta | Médio | Aceitar limitação, permitir input manual, considerar Discogs como fonte alternativa |
| R2 | Ruído do vinil afeta qualidade do reconhecimento | Alta | Médio | Capturar sample mais longo (10-15s), testar com diferentes níveis de ruído |
| R3 | Free tier de APIs insuficiente para uso intenso | Média | Alto | Monitorar uso, implementar reconhecimento automático desabilitado por padrão |
| R4 | Discogs rate limit (60/min) bloqueado | Baixa | Médio | Implementar throttling, cache local de releases já importados |
| R5 | Fuzzy matching gera muitos falsos positivos | Média | Baixo | Threshold conservador (0.8), sempre oferecer confirmação manual |
| R6 | Migration V1→V2 quebra dados existentes | Baixa | Alto | Backup automático antes de migration, script de rollback |

### Assumptions

| # | Assumption | Validação |
|---|------------|-----------|
| A1 | Usuário tem conta no ACRCloud e/ou AudD | Documentar processo de criação de conta no README |
| A2 | Discogs tem a maioria dos vinis do usuário | Oferecer criação manual como fallback |
| A3 | 500 req/mês (ACRCloud free) é suficiente | ~16 reconhecimentos/dia; usuário médio escuta ~3-5 discos/dia |
| A4 | Levenshtein é suficiente para fuzzy matching | Testar com dataset real antes de considerar alternativas |
| A5 | FFmpeg consegue capturar do FIFO existente | Já validado em V1; captura adicional não deve interferir |

### Open Questions

| # | Questão | Status | Decisão |
|---|---------|--------|---------|
| Q1 | Armazenar capas localmente ou só URL? | **Decidido** | Apenas URL (menos storage, Discogs serve as imagens) |
| Q2 | Suportar múltiplos artistas por álbum? | Adiado para V3 | V2 usa string única; coletâneas usam "Various Artists" |
| Q3 | Suportar tracklist do álbum? | Adiado para V3 | V2 não armazena tracklist, apenas tracks reconhecidos |
| Q4 | Reconhecimento automático habilitado por padrão? | **Decidido** | Não - usuário habilita manualmente (economia de API calls) |
| Q5 | Cache de reconhecimento local? | **Decidido** | Não para V2 - usar durationSeconds para timing inteligente |

## Test Strategy Summary

### Unit Tests

**Backend (Jest):**
```
backend/src/services/__tests__/
├── recognition.test.ts       # Mock ACRCloud/AudD responses
├── discogs.test.ts           # Mock Discogs API
├── collection-matcher.test.ts # Levenshtein com casos de borda

backend/src/schemas/__tests__/
├── albums.schema.test.ts     # Validação de campos
└── recognition.schema.test.ts

backend/src/routes/__tests__/
├── albums.test.ts            # CRUD endpoints
├── recognition.test.ts       # Trigger e confirm
└── tracks.test.ts            # Histórico
```

**Frontend (Vitest):**
```
frontend/src/hooks/__tests__/
├── useAlbums.test.ts
└── useRecognition.test.ts

frontend/src/components/__tests__/
├── AlbumCard.test.tsx
├── AlbumForm.test.tsx
└── NowPlaying.test.tsx
```

### Integration Tests

| Teste | Descrição |
|-------|-----------|
| CRUD completo | Criar → Listar → Editar → Arquivar → Deletar |
| Discogs import | Mock API → Criar album → Verificar campos |
| Recognition flow | Mock ACRCloud → Criar track → Match album → Confirm |
| Fallback | Mock ACRCloud fail → Verificar AudD chamado |
| WebSocket | Trigger recognition → Verificar broadcast |

### Test Data

**Fixtures:**
- 10 álbuns de teste (diversos artistas, formatos, anos)
- Mock responses de ACRCloud/AudD (success, no match, error)
- Mock responses de Discogs (single result, multiple, 404)

### Coverage Targets

| Módulo | Target |
|--------|--------|
| recognition.ts | ≥ 85% |
| discogs.ts | ≥ 80% |
| collection-matcher.ts | ≥ 90% |
| Schemas | 100% |
| Routes | ≥ 75% |
| Frontend hooks | ≥ 70% |

### Test Environment

- Node.js 20.x
- SQLite in-memory para testes rápidos
- Mock de todas APIs externas (nenhuma chamada real em testes)
- Fixtures compartilhadas entre testes

---

**Última revisão:** 2025-12-04
**Próxima revisão:** Após implementação das primeiras stories V2
