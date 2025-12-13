# V3a-09: Edição Manual de Álbuns por Sessão

## Story

**Como** usuário do Vinyl-OS
**Quero** poder adicionar/editar manualmente os álbuns que ouvi em uma sessão
**Para** manter meu histórico de escuta completo mesmo quando o reconhecimento automático falha

## Contexto

O reconhecimento automático via AudD nem sempre funciona (álbuns raros, vinis ruidosos, etc.). Atualmente, se o reconhecimento não captura a música, a sessão fica sem registro do álbum ouvido.

**Modelo atual:**
- `Session` → `Track` (1:N) — tracks reconhecidos
- `Track` → `Album` (N:1) — link opcional com coleção

**Problema:** Se não há `Track`, não há registro. Precisamos permitir adição manual.

## Acceptance Criteria

### AC1: Adicionar Álbum Manualmente à Sessão
- [ ] Na página `/sessions/:id`, botão "+ Add Album" na seção "Albums Played"
- [ ] Abre dialog/modal com dropdown searchable da coleção
- [ ] Ao selecionar, cria um `Track` manual com:
  - `sessionId`: sessão atual
  - `albumId`: álbum selecionado
  - `title`: `album.title`
  - `artist`: `album.artist`
  - `recognitionSource`: `manual`
  - `recognizedAt`: timestamp atual
  - `confidence`: 1.0 (manual = certeza)

### AC2: Remover Álbum da Sessão
- [ ] Botão de remover (X) ao lado de cada álbum na lista
- [ ] Confirmação antes de deletar
- [ ] Deleta o(s) `Track`(s) associados ao álbum naquela sessão
- [ ] Não deleta o `Album` da coleção (apenas o vínculo)

### AC3: API Endpoints
- [ ] `POST /api/sessions/:id/albums` — Adicionar álbum à sessão
  - Body: `{ albumId: string }`
  - Cria Track manual
  - Retorna track criado
- [ ] `DELETE /api/sessions/:id/albums/:albumId` — Remover álbum da sessão
  - Deleta tracks com aquele albumId naquela sessão

### AC4: Exibição Melhorada
- [ ] Mostrar badge "Manual" vs "Auto" nos álbuns
- [ ] Ordenar por `recognizedAt`

## Technical Notes

### API Implementation
```typescript
// backend/src/routes/sessions.ts

// POST /api/sessions/:id/albums
router.post('/:id/albums', validateRequest(addAlbumSchema), async (req, res) => {
  const { id } = req.params;
  const { albumId } = req.body;

  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album) {
    return res.status(404).json({ error: { message: 'Album not found' } });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return res.status(404).json({ error: { message: 'Session not found' } });
  }

  const track = await prisma.track.create({
    data: {
      sessionId: id,
      albumId,
      title: album.title,
      artist: album.artist,
      albumName: album.title,
      albumArtUrl: album.coverUrl,
      year: album.year,
      label: album.label,
      recognitionSource: 'manual',
      confidence: 1.0,
    },
  });

  res.status(201).json({ data: track });
});

// DELETE /api/sessions/:id/albums/:albumId
router.delete('/:id/albums/:albumId', async (req, res) => {
  const { id, albumId } = req.params;

  const result = await prisma.track.deleteMany({
    where: {
      sessionId: id,
      albumId,
    },
  });

  if (result.count === 0) {
    return res.status(404).json({ error: { message: 'No tracks found for this album in session' } });
  }

  res.json({ data: { deleted: result.count } });
});
```

### Frontend Component
```typescript
// components/Sessions/AddAlbumDialog.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command';
import { useAlbums } from '@/hooks/useAlbums';

interface Props {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddAlbumDialog({ sessionId, open, onOpenChange, onSuccess }: Props) {
  const { albums } = useAlbums();
  const [search, setSearch] = useState('');

  const filtered = albums.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.artist.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (albumId: string) => {
    await fetch(`/api/sessions/${sessionId}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId }),
    });
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Álbum à Sessão</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput
            placeholder="Buscar álbum..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.map(album => (
              <CommandItem key={album.id} onSelect={() => handleSelect(album.id)}>
                {album.artist} - {album.title}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
```

## Files to Create/Modify

### Backend
- `backend/src/routes/sessions.ts` — Novos endpoints
- `backend/src/schemas/sessions.schema.ts` — Schema Zod para validação

### Frontend
- `frontend/src/components/Sessions/AddAlbumDialog.tsx` — Novo componente
- `frontend/src/pages/SessionDetail.tsx` — Adicionar botão e lógica

## Out of Scope
- Editar tracks individuais (apenas álbuns)
- Tabela de tracklist por álbum (V3b)

## Story Points
**3 pontos** — API simples + UI com componentes existentes

## Dependencies
- V2-09 (histórico de sessões) — Já implementado
- shadcn/ui Command component (pode precisar adicionar)
