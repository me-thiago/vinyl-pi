# V3a-09: Relação Direta Session ↔ Album (SessionAlbum)

## Story

**Como** usuário do Vinyl-OS
**Quero** ter uma relação direta entre sessões e álbuns ouvidos
**Para** manter meu histórico de escuta correto, independente do reconhecimento automático

## Contexto

### Problema Arquitetural

O modelo atual usa `Track` para vincular álbuns às sessões:

```
Session (1) ───→ (N) Track (N) ───→ (1) Album
```

**Track** é uma tabela de **log de reconhecimento** — registra eventos técnicos (confidence, source, timestamp). Usar ela para "álbuns ouvidos" mistura dois conceitos diferentes:

| Conceito | Propósito |
|----------|-----------|
| **Log de reconhecimento** | "O sistema reconheceu X às 14:30 com 85% confiança" |
| **Álbuns da sessão** | "Nesta sessão, ouvi Miles Davis e Coltrane" |

### Solução: Tabela SessionAlbum

Criar relação many-to-many direta:

```
Session (N) ←────→ (N) Album
               │
         SessionAlbum
```

- **Track**: Continua sendo log técnico de reconhecimento (NÃO MODIFICAR)
- **SessionAlbum**: Representa álbuns ouvidos (curadoria do usuário)

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    RECONHECIMENTO AUTOMÁTICO                 │
├─────────────────────────────────────────────────────────────┤
│  AudD API → Match na Coleção (score >= 0.8)                 │
│      │                                                       │
│      ├──→ Cria Track (log técnico) ← JÁ EXISTE              │
│      │                                                       │
│      └──→ Cria SessionAlbum (se não existir)  ← ADICIONAR   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      EDIÇÃO MANUAL                           │
├─────────────────────────────────────────────────────────────┤
│  Usuário na página /sessions/:id                            │
│      │                                                       │
│      ├──→ Botão "+ Adicionar Álbum" → Cria SessionAlbum     │
│      │                                                       │
│      └──→ Botão "Remover" → Deleta SessionAlbum             │
│           (NÃO afeta Track nem Album)                        │
└─────────────────────────────────────────────────────────────┘
```

## Status: DONE (2025-12-13)

## Acceptance Criteria

### AC1: Schema SessionAlbum
- [x] Nova tabela `SessionAlbum` no Prisma schema
- [x] Campos: `id`, `sessionId`, `albumId`, `source`, `addedAt`, `notes`
- [x] Constraint unique em `[sessionId, albumId]` (álbum aparece 1x por sessão)
- [x] Migration aplicada sem perda de dados

### AC2: Reconhecimento Automático Popula SessionAlbum
- [x] Quando reconhecimento encontra match com score >= 0.8:
  - Cria Track (como hoje - NÃO MODIFICAR essa parte)
  - **ADICIONAR**: Cria SessionAlbum com `source: 'recognition'` (se não existir)
- [x] Não duplica SessionAlbum se álbum já está na sessão

### AC3: API - Adicionar Álbum Manualmente
- [x] `POST /api/sessions/:id/albums`
- [x] Body: `{ albumId: string, notes?: string }`
- [x] Cria SessionAlbum com `source: 'manual'`
- [x] Retorna 409 Conflict se álbum já está na sessão
- [x] Retorna 404 se sessão ou álbum não existe

### AC4: API - Remover Álbum da Sessão
- [x] `DELETE /api/sessions/:id/albums/:albumId`
- [x] Remove apenas o SessionAlbum (não afeta Track nem Album)
- [x] Retorna 404 se vínculo não existe

### AC5: API - Listar Álbuns da Sessão (Atualizar)
- [x] `GET /api/sessions/:id` retorna álbuns via SessionAlbum (NÃO mais via Track)
- [x] Incluir `source` ('manual' | 'recognition') na resposta
- [x] Incluir `notes` na resposta
- [x] Ordenar por `addedAt`

### AC6: API - Contagem de Álbuns (Atualizar)
- [x] `GET /api/sessions` deve contar álbuns via SessionAlbum (NÃO mais via Track)

### AC7: UI - Botão Adicionar Álbum
- [x] Na página `/sessions/:id`, botão "+ Adicionar Álbum" na seção "Álbuns Tocados"
- [x] Abre dialog com busca na coleção (Command component)
- [x] Mostra capa, artista, título no dropdown
- [x] Campo opcional para notas (ex: "Lado A", "Disco 2")
- [x] Feedback de sucesso/erro

### AC8: UI - Remover Álbum
- [x] Botão de remover (ícone X) em cada álbum da lista
- [x] Dialog de confirmação antes de remover
- [x] Feedback de sucesso

### AC9: UI - Badge de Origem
- [x] Mostrar badge "Manual" ou "Auto" em cada álbum
- [x] Estilo diferenciado (cores/ícones)

---

## Implementação Detalhada

### 1. Schema Prisma

**Arquivo:** `backend/prisma/schema.prisma`

**Adicionar o model SessionAlbum:**

```prisma
model SessionAlbum {
  id        String   @id @default(uuid())
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  albumId   String
  album     Album    @relation(fields: [albumId], references: [id], onDelete: Cascade)
  source    String   @default("manual") // "manual" | "recognition"
  addedAt   DateTime @default(now())
  notes     String?  // "Lado A", "Primeiro disco", etc.

  @@unique([sessionId, albumId])
  @@index([sessionId])
  @@index([albumId])
}
```

**Adicionar relation em Session (linha ~15):**

```prisma
model Session {
  // ... campos existentes ...
  sessionAlbums SessionAlbum[]  // ADICIONAR
}
```

**Adicionar relation em Album (linha ~85):**

```prisma
model Album {
  // ... campos existentes ...
  sessionAlbums SessionAlbum[]  // ADICIONAR
}
```

**Rodar migration:**
```bash
cd backend
npx prisma migrate dev --name add_session_album
```

---

### 2. Modificar Reconhecimento (ADICIONAR, não trocar)

**Arquivo:** `backend/src/services/recognition.ts`

**Localização:** Após criar o Track (linha ~538), ADICIONAR criação de SessionAlbum:

```typescript
// Linha 538 atual:
logger.info(`Track persistido: id=${track.id}, albumId=${linkedAlbumId}`);

// ADICIONAR APÓS (linha ~540):
// V3a-09: Criar SessionAlbum se houve vinculação automática
if (linkedAlbumId) {
  try {
    await prisma.sessionAlbum.upsert({
      where: {
        sessionId_albumId: {
          sessionId,
          albumId: linkedAlbumId,
        },
      },
      create: {
        sessionId,
        albumId: linkedAlbumId,
        source: 'recognition',
      },
      update: {}, // Não atualiza se já existe
    });
    logger.info(`SessionAlbum criado/existente: sessionId=${sessionId}, albumId=${linkedAlbumId}`);
  } catch (err) {
    // Não falhar o reconhecimento se SessionAlbum falhar
    logger.warn('Falha ao criar SessionAlbum', { error: err });
  }
}
```

**IMPORTANTE:** A lógica de match >= 0.8 já existe (linha 501). Você está apenas ADICIONANDO a criação de SessionAlbum, NÃO modificando a criação do Track.

---

### 3. Schema Zod para Validação

**Arquivo:** `backend/src/schemas/sessions.schema.ts` (CRIAR ou adicionar ao existente)

```typescript
import { z } from 'zod';

/**
 * Schema para adicionar álbum à sessão
 * POST /api/sessions/:id/albums
 */
export const addSessionAlbumSchema = z.object({
  albumId: z.string().uuid('ID do álbum inválido'),
  notes: z.string().max(200, 'Notas devem ter no máximo 200 caracteres').optional(),
});

export type AddSessionAlbumInput = z.infer<typeof addSessionAlbumSchema>;
```

---

### 4. Rotas de Sessão (Modificar)

**Arquivo:** `backend/src/routes/sessions.ts`

#### 4.1 Adicionar imports no topo:

```typescript
import { addSessionAlbumSchema, AddSessionAlbumInput } from '../schemas/sessions.schema';
```

#### 4.2 Modificar GET /api/sessions (listagem) - linhas 123-142:

**ANTES (usa tracks para contar):**
```typescript
const [sessions, total] = await Promise.all([
  prisma.session.findMany({
    // ...
    select: {
      // ...
      tracks: {
        where: { albumId: { not: null } },
        select: { albumId: true }
      }
    }
  }),
  // ...
]);

// E depois:
const uniqueAlbumIds = new Set(session.tracks.map(t => t.albumId));
albumCount: uniqueAlbumIds.size
```

**DEPOIS (usa sessionAlbums):**
```typescript
const [sessions, total] = await Promise.all([
  prisma.session.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      eventCount: true,
      _count: {
        select: { sessionAlbums: true }  // V3a-09: Contar via SessionAlbum
      }
    }
  }),
  prisma.session.count({ where })
]);

// Formatar resposta:
const response: SessionsResponse = {
  sessions: sessions.map(session => ({
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() || null,
    durationSeconds: session.durationSeconds,
    eventCount: session.eventCount,
    albumCount: session._count.sessionAlbums  // V3a-09
  })),
  total,
  hasMore: offset + sessions.length < total
};
```

#### 4.3 Modificar GET /api/sessions/:id (detalhes) - linhas 212-261:

**ANTES (agrupa tracks por albumId):**
```typescript
const session = await prisma.session.findUnique({
  where: { id },
  include: {
    audioEvents: { orderBy: { timestamp: 'asc' }, /* ... */ },
    tracks: {
      where: { albumId: { not: null } },
      orderBy: { recognizedAt: 'asc' },
      include: {
        album: { select: { id: true, title: true, artist: true, year: true, coverUrl: true } }
      }
    }
  }
});

// Agrupamento manual por albumId...
const albumsMap = new Map<string, SessionAlbum>();
for (const track of session.tracks) {
  // ...
}
```

**DEPOIS (usa sessionAlbums diretamente):**
```typescript
const session = await prisma.session.findUnique({
  where: { id },
  include: {
    audioEvents: {
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        eventType: true,
        timestamp: true,
        metadata: true
      }
    },
    // V3a-09: Usar sessionAlbums em vez de tracks
    sessionAlbums: {
      orderBy: { addedAt: 'asc' },
      include: {
        album: {
          select: { id: true, title: true, artist: true, year: true, coverUrl: true }
        }
      }
    }
  }
});

if (!session) {
  return res.status(404).json({
    error: { message: `Sessão não encontrada: nenhuma sessão com id '${id}'`, code: 'SESSION_NOT_FOUND' }
  });
}

// V3a-09: Mapear sessionAlbums para formato da resposta
const albums = session.sessionAlbums.map((sa) => ({
  id: sa.album.id,
  title: sa.album.title,
  artist: sa.album.artist,
  year: sa.album.year,
  coverUrl: sa.album.coverUrl,
  source: sa.source,      // 'manual' | 'recognition'
  addedAt: sa.addedAt.toISOString(),
  notes: sa.notes,
}));

const response: SessionDetailResponse = {
  id: session.id,
  startedAt: session.startedAt.toISOString(),
  endedAt: session.endedAt?.toISOString() || null,
  durationSeconds: session.durationSeconds,
  eventCount: session.eventCount,
  events: session.audioEvents.map(event => ({
    id: event.id,
    eventType: event.eventType,
    timestamp: event.timestamp.toISOString(),
    metadata: event.metadata as object | null
  })),
  albums
};

res.json(response);
```

#### 4.4 Adicionar POST /api/sessions/:id/albums (NOVO):

```typescript
/**
 * POST /api/sessions/:id/albums
 * Adiciona um álbum manualmente à sessão
 */
router.post('/sessions/:id/albums', validate(addSessionAlbumSchema, 'body'), async (req: Request<{ id: string }, unknown, AddSessionAlbumInput>, res: Response) => {
  try {
    const { id } = req.params;
    const { albumId, notes } = req.body;

    // Verificar se sessão existe
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({
        error: { message: 'Sessão não encontrada', code: 'SESSION_NOT_FOUND' }
      });
    }

    // Verificar se álbum existe
    const album = await prisma.album.findUnique({ where: { id: albumId } });
    if (!album) {
      return res.status(404).json({
        error: { message: 'Álbum não encontrado', code: 'ALBUM_NOT_FOUND' }
      });
    }

    // Verificar se já existe vínculo
    const existing = await prisma.sessionAlbum.findUnique({
      where: { sessionId_albumId: { sessionId: id, albumId } },
    });
    if (existing) {
      return res.status(409).json({
        error: { message: 'Álbum já está nesta sessão', code: 'ALBUM_ALREADY_IN_SESSION' }
      });
    }

    // Criar vínculo
    const sessionAlbum = await prisma.sessionAlbum.create({
      data: {
        sessionId: id,
        albumId,
        source: 'manual',
        notes,
      },
      include: {
        album: {
          select: { id: true, title: true, artist: true, year: true, coverUrl: true },
        },
      },
    });

    logger.info(`Álbum adicionado manualmente à sessão: sessionId=${id}, albumId=${albumId}`);

    res.status(201).json({
      data: {
        id: sessionAlbum.album.id,
        title: sessionAlbum.album.title,
        artist: sessionAlbum.album.artist,
        year: sessionAlbum.album.year,
        coverUrl: sessionAlbum.album.coverUrl,
        source: sessionAlbum.source,
        addedAt: sessionAlbum.addedAt.toISOString(),
        notes: sessionAlbum.notes,
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Erro ao adicionar álbum à sessão', { error: errorMsg });
    res.status(500).json({
      error: { message: 'Erro ao adicionar álbum', code: 'ADD_ALBUM_ERROR' }
    });
  }
});
```

#### 4.5 Adicionar DELETE /api/sessions/:id/albums/:albumId (NOVO):

```typescript
/**
 * DELETE /api/sessions/:id/albums/:albumId
 * Remove um álbum da sessão
 */
router.delete('/sessions/:id/albums/:albumId', async (req: Request<{ id: string; albumId: string }>, res: Response) => {
  try {
    const { id, albumId } = req.params;

    const deleted = await prisma.sessionAlbum.deleteMany({
      where: { sessionId: id, albumId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        error: { message: 'Álbum não encontrado nesta sessão', code: 'ALBUM_NOT_IN_SESSION' }
      });
    }

    logger.info(`Álbum removido da sessão: sessionId=${id}, albumId=${albumId}`);

    res.json({ data: { deleted: deleted.count } });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Erro ao remover álbum da sessão', { error: errorMsg });
    res.status(500).json({
      error: { message: 'Erro ao remover álbum', code: 'REMOVE_ALBUM_ERROR' }
    });
  }
});
```

#### 4.6 Atualizar interface SessionDetailResponse:

```typescript
/**
 * Álbum na sessão (via SessionAlbum)
 */
interface SessionAlbumResponse {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
  source: string;      // 'manual' | 'recognition'
  addedAt: string;
  notes: string | null;
}

/**
 * Resposta do endpoint GET /api/sessions/:id
 */
interface SessionDetailResponse {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  eventCount: number;
  events: { /* ... */ }[];
  albums: SessionAlbumResponse[];  // Atualizado
}
```

---

### 5. Frontend - Tipos Atualizados

**Arquivo:** `frontend/src/components/Sessions/AlbumsPlayed.tsx`

**Atualizar interface SessionAlbum (linhas 24-31):**

```typescript
/**
 * Álbum tocado na sessão (V3a-09: via SessionAlbum)
 */
export interface SessionAlbum {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
  source: string;      // 'manual' | 'recognition' - NOVO
  addedAt: string;     // ISO string - NOVO
  notes: string | null; // NOVO
}
```

**REMOVER interface RecognizedTrackInfo** (linhas 16-19) - não mais necessária.

---

### 6. Frontend - Componente AlbumsPlayed (Modificar)

**Arquivo:** `frontend/src/components/Sessions/AlbumsPlayed.tsx`

**Modificar props para incluir edição:**

```typescript
interface AlbumsPlayedProps {
  albums: SessionAlbum[];
  sessionId: string;        // NOVO - para API calls
  onRefresh: () => void;    // NOVO - para atualizar após add/remove
}
```

**Componente completo atualizado:**

```typescript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Disc, ExternalLink, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddAlbumDialog } from './AddAlbumDialog';

const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

export interface SessionAlbum {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
  source: string;
  addedAt: string;
  notes: string | null;
}

interface AlbumsPlayedProps {
  albums: SessionAlbum[];
  sessionId: string;
  onRefresh: () => void;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AlbumsPlayed({ albums, sessionId, onRefresh }: AlbumsPlayedProps) {
  const { t } = useTranslation();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [albumToRemove, setAlbumToRemove] = useState<SessionAlbum | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!albumToRemove) return;

    setRemoving(true);
    try {
      const res = await fetch(
        `${API_HOST}/api/sessions/${sessionId}/albums/${albumToRemove.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to remove album:', err);
    } finally {
      setRemoving(false);
      setAlbumToRemove(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Disc className="w-5 h-5" />
            {t('sessionDetail.albumsPlayed')}
            {albums.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {albums.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {albums.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Disc className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('sessionDetail.noAlbumsPlayed')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {albums.map((album) => (
                <div
                  key={album.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  {/* Capa do álbum */}
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt={`${album.title} - ${album.artist}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Disc className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Info do álbum */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{album.title}</h3>
                      {/* Badge de origem */}
                      <Badge variant={album.source === 'manual' ? 'secondary' : 'outline'} className="shrink-0">
                        {album.source === 'manual' ? t('sessionDetail.manual') : t('sessionDetail.auto')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {album.artist}
                      {album.year && ` (${album.year})`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('sessionDetail.addedAt', { time: formatTime(album.addedAt) })}
                      {album.notes && ` • ${album.notes}`}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Link to={`/collection/${album.id}`}>
                      <Button variant="ghost" size="sm">
                        {t('sessionDetail.viewAlbum')}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setAlbumToRemove(album)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Botão adicionar */}
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('sessionDetail.addAlbum')}
          </Button>
        </CardContent>
      </Card>

      {/* Dialog de adicionar */}
      <AddAlbumDialog
        sessionId={sessionId}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={onRefresh}
      />

      {/* Dialog de confirmação de remoção */}
      <AlertDialog open={!!albumToRemove} onOpenChange={() => setAlbumToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sessionDetail.removeAlbumTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sessionDetail.removeAlbumDesc', { title: albumToRemove?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing}>
              {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

---

### 7. Frontend - Componente AddAlbumDialog (CRIAR)

**Arquivo:** `frontend/src/components/Sessions/AddAlbumDialog.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Disc, Loader2 } from 'lucide-react';

const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

interface Album {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
}

interface Props {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddAlbumDialog({ sessionId, open, onOpenChange, onSuccess }: Props) {
  const { t } = useTranslation();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar álbuns quando dialog abre
  useEffect(() => {
    if (open) {
      fetchAlbums();
    } else {
      // Reset state quando fecha
      setSelectedAlbum(null);
      setNotes('');
      setSearch('');
      setError(null);
    }
  }, [open]);

  const fetchAlbums = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_HOST}/api/albums?limit=500`);
      const data = await res.json();
      setAlbums(data.data || []);
    } catch (err) {
      console.error('Failed to fetch albums:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar álbuns pelo search
  const filtered = albums.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.artist.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedAlbum) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_HOST}/api/sessions/${sessionId}/albums`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            albumId: selectedAlbum.id,
            notes: notes || undefined,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to add album');
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('sessionDetail.addAlbumTitle')}</DialogTitle>
        </DialogHeader>

        {!selectedAlbum ? (
          <Command className="border rounded-md">
            <CommandInput
              placeholder={t('sessionDetail.searchAlbumPlaceholder')}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-64">
              {loading && (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              <CommandEmpty>
                {t('sessionDetail.noAlbumsFound')}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((album) => (
                  <CommandItem
                    key={album.id}
                    value={`${album.artist} ${album.title}`}
                    onSelect={() => setSelectedAlbum(album)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Disc className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{album.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {album.artist}
                        {album.year && ` (${album.year})`}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="space-y-4">
            {/* Álbum selecionado */}
            <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
              {selectedAlbum.coverUrl ? (
                <img
                  src={selectedAlbum.coverUrl}
                  alt={selectedAlbum.title}
                  className="w-12 h-12 rounded object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <Disc className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium">{selectedAlbum.title}</p>
                <p className="text-sm text-muted-foreground">{selectedAlbum.artist}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedAlbum(null)}>
                {t('common.change')}
              </Button>
            </div>

            {/* Campo de notas */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {t('sessionDetail.notesLabel')}
              </Label>
              <Input
                id="notes"
                placeholder={t('sessionDetail.notesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedAlbum || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 8. Frontend - Atualizar SessionDetail.tsx

**Arquivo:** `frontend/src/pages/SessionDetail.tsx`

**Modificar chamada do AlbumsPlayed (linha 265):**

```typescript
// ANTES:
<AlbumsPlayed albums={session.albums} />

// DEPOIS:
<AlbumsPlayed
  albums={session.albums}
  sessionId={session.id}
  onRefresh={fetchSession}
/>
```

---

### 9. Frontend - Atualizar index do componente Sessions

**Arquivo:** `frontend/src/components/Sessions/index.ts`

```typescript
export { AlbumsPlayed, type SessionAlbum } from './AlbumsPlayed';
export { AddAlbumDialog } from './AddAlbumDialog';
```

---

### 10. Chaves i18n (Adicionar)

**Arquivo:** `frontend/src/i18n/locales/pt-BR.json`

Adicionar na seção `sessionDetail`:

```json
{
  "sessionDetail": {
    "...": "...",
    "manual": "Manual",
    "auto": "Auto",
    "addedAt": "Adicionado às {{time}}",
    "addAlbum": "Adicionar Álbum",
    "addAlbumTitle": "Adicionar Álbum à Sessão",
    "searchAlbumPlaceholder": "Buscar álbum...",
    "noAlbumsFound": "Nenhum álbum encontrado",
    "notesLabel": "Notas (opcional)",
    "notesPlaceholder": "Ex: Lado A, Disco 2...",
    "removeAlbumTitle": "Remover Álbum",
    "removeAlbumDesc": "Tem certeza que deseja remover \"{{title}}\" desta sessão?"
  },
  "common": {
    "...": "...",
    "change": "Alterar",
    "add": "Adicionar",
    "remove": "Remover"
  }
}
```

**Arquivo:** `frontend/src/i18n/locales/en.json`

```json
{
  "sessionDetail": {
    "...": "...",
    "manual": "Manual",
    "auto": "Auto",
    "addedAt": "Added at {{time}}",
    "addAlbum": "Add Album",
    "addAlbumTitle": "Add Album to Session",
    "searchAlbumPlaceholder": "Search album...",
    "noAlbumsFound": "No albums found",
    "notesLabel": "Notes (optional)",
    "notesPlaceholder": "E.g.: Side A, Disc 2...",
    "removeAlbumTitle": "Remove Album",
    "removeAlbumDesc": "Are you sure you want to remove \"{{title}}\" from this session?"
  },
  "common": {
    "...": "...",
    "change": "Change",
    "add": "Add",
    "remove": "Remove"
  }
}
```

---

### 11. Instalar Componentes shadcn/ui

```bash
cd frontend
npx shadcn@latest add command alert-dialog
```

---

### 12. Migration de Dados (Opcional)

Se quiser migrar dados existentes de Track para SessionAlbum:

```sql
-- Rodar APÓS a migration do Prisma
-- Migrar dados de Track para SessionAlbum (álbuns já reconhecidos)
INSERT INTO SessionAlbum (id, sessionId, albumId, source, addedAt)
SELECT
  lower(hex(randomblob(16))),
  t.sessionId,
  t.albumId,
  'recognition',
  t.recognizedAt
FROM Track t
WHERE t.albumId IS NOT NULL
GROUP BY t.sessionId, t.albumId;
```

---

## Arquivos a Criar/Modificar

### Backend

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `prisma/schema.prisma` | Modificar | Adicionar model SessionAlbum + relations |
| `src/routes/sessions.ts` | Modificar | GET usar SessionAlbum, POST/DELETE novos |
| `src/schemas/sessions.schema.ts` | Criar | Schema Zod para validação |
| `src/services/recognition.ts` | Modificar | Adicionar criação de SessionAlbum (linha ~540) |

### Frontend

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/Sessions/AddAlbumDialog.tsx` | Criar | Dialog de adicionar álbum |
| `src/components/Sessions/AlbumsPlayed.tsx` | Modificar | Tipos + badge + botões |
| `src/components/Sessions/index.ts` | Modificar | Export AddAlbumDialog |
| `src/pages/SessionDetail.tsx` | Modificar | Passar props para AlbumsPlayed |
| `src/i18n/locales/pt-BR.json` | Modificar | Adicionar chaves |
| `src/i18n/locales/en.json` | Modificar | Adicionar chaves |

---

## Out of Scope

- Editar notas de SessionAlbum existente
- Reordenar álbuns na sessão
- Bulk add (adicionar múltiplos de uma vez)
- Migração automática de dados (manual SQL se necessário)

## Story Points

**5 pontos** — Schema novo + migration + API + UI + integração com reconhecimento

## Dependencies

- V2-09 (histórico de sessões) — Já implementado
- shadcn/ui Command, AlertDialog — Instalar se necessário

## Testing Checklist

- [ ] Migration do Prisma aplica sem erros
- [ ] Criar SessionAlbum manualmente via API
- [ ] Criar SessionAlbum via reconhecimento automático (disparar reconhecimento)
- [ ] Não duplicar SessionAlbum se álbum já na sessão (testar 409)
- [ ] Remover SessionAlbum não afeta Track
- [ ] GET /api/sessions retorna albumCount correto
- [ ] GET /api/sessions/:id retorna álbuns com source
- [ ] UI exibe badge correto (Manual/Auto)
- [ ] Busca de álbuns funciona no dialog
- [ ] Confirmação de remoção funciona
- [ ] Chaves i18n funcionam em pt-BR e en
