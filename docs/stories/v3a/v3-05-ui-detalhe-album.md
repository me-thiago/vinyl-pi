# Story V3-05: UI Detalhe Álbum

**Epic:** V3a - Gravação & Fundação
**Status:** done

**User Story:**
Como usuário,
quero ver as gravações associadas a um álbum na página de detalhe,
para que eu possa acessar e gerenciar gravações de forma contextualizada.

## Critérios de Aceitação

### Página de Detalhe do Álbum (/albums/:id)

1. Rota `/albums/:id` criada (ou expandida se existir)
2. Exibe informações do álbum:
   - Capa (se disponível)
   - Título, artista, ano
   - Label, formato, condição
   - Tags e notas
3. Seção "Gravações" listando recordings vinculadas

### Seção de Gravações

4. Mostra lista de gravações do álbum
5. Cada gravação exibe:
   - Nome do arquivo
   - Duração
   - Tamanho
   - Data de gravação
   - Status
6. Link para editar gravação (navega para editor)
7. Ação: Desvincular gravação (não deleta, apenas remove albumId)

### Botão Gravar Álbum

8. Botão "Gravar este álbum" visível na página
9. Inicia gravação já vinculada ao álbum atual
10. Após gravar, gravação aparece automaticamente na lista

### API

```typescript
// GET /api/albums/:id
Response: {
  data: Album & {
    recordings: Recording[];  // NOVO: incluir gravações
  }
}

// GET /api/recordings?albumId=xxx
// Filtrar gravações por álbum
```

## Layout Proposto

```
┌────────────────────────────────────────────────────┐
│  [← Voltar]          Album Detail                   │
├────────────────────────────────────────────────────┤
│  ┌──────────┐  Abbey Road                          │
│  │          │  The Beatles • 1969                  │
│  │  [Capa]  │  Apple Records • LP                  │
│  │          │  Condição: VG+                       │
│  └──────────┘  Tags: Rock, Classic                 │
│                                                     │
│  [🎤 Gravar este álbum] [✏️ Editar] [🗑️ Excluir]  │
├────────────────────────────────────────────────────┤
│  Gravações (2)                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Lado A - 24:30 - 180MB - 05/12/2025          │  │
│  │ [Editar] [Desvincular]                       │  │
│  ├──────────────────────────────────────────────┤  │
│  │ Lado B - 22:15 - 165MB - 05/12/2025          │  │
│  │ [Editar] [Desvincular]                       │  │
│  └──────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────┤
│  Histórico de Escuta (últimas 5)                   │
│  • 05/12/2025 14:30 - Reconhecido: Side 1          │
│  • 01/12/2025 20:15 - Reconhecido: Side 2          │
└────────────────────────────────────────────────────┘
```

## Componentes

```
frontend/src/
├── pages/
│   └── AlbumDetail.tsx           # Nova página
├── components/
│   └── Album/
│       ├── AlbumHeader.tsx       # Info do álbum
│       ├── AlbumRecordings.tsx   # Lista de gravações
│       └── AlbumHistory.tsx      # Histórico de escuta
```

## Pré-requisitos

- V3-04 - UI Gravações (componentes de recording)
- V2-03 - UI Gestão Coleção (lista de álbuns)

## Notas de Implementação

- Expandir query do album para incluir recordings
- Usar React Query ou SWR para cache/refetch
- Link na lista de álbuns navega para detalhe
- Botão "Gravar" usa mesma lógica do RecordButton
- Após gravação, refetch da página para mostrar nova gravação

## Testes

- [ ] Página carrega informações do álbum
- [ ] Gravações vinculadas são listadas
- [ ] Botão "Gravar este álbum" inicia gravação vinculada
- [ ] Desvincular remove albumId mas não deleta
- [ ] Link para editor funciona
- [ ] Álbum sem gravações mostra estado vazio

## Referências

- [Tech Spec V3a](../../tech-spec-epic-v3a.md) - Seção UI Album Detail, AC-18/19

---

## Dev Agent Record

**Implementado em:** 2025-12-07
**Status:** ✅ Done

### Resumo da Implementação

Story V3-05 implementa a visualização de gravações na página de detalhe do álbum, permitindo aos usuários:
- Ver todas as gravações vinculadas a um álbum
- Iniciar novas gravações já linkadas ao álbum
- Vincular gravações existentes a álbuns (modal de seleção)
- Desvincular gravações sem deletá-las
- Gerenciar gravações de forma contextualizada

### Decisões de Implementação

1. **Backend: Expansão da API `/albums/:id`**
   - Modificado para incluir `recordings` com Prisma `include`
   - Retorna gravações ordenadas por `startedAt desc`
   - Inclui `_count` para trackMarkers

2. **Frontend: Componente `AlbumRecordings`**
   - Criado como seção reutilizável para qualquer página de álbum
   - Usa `RecordingCard` existente (sem mostrar álbum, já que estamos no contexto dele)
   - Botão "Gravar este álbum" chama `useRecording().startRecording(albumId)`
   - Ação "Desvincular" faz `PATCH /api/recordings/:id` com `albumId: null`

3. **Frontend: Modal `LinkRecordingDialog`**
   - Busca todos os álbuns da coleção (limite 100, não arquivados)
   - Permite busca local por título/artista
   - Seleção visual com highlight e capa
   - Vincula fazendo `PATCH /api/recordings/:id` com `albumId`

4. **Frontend: Integração em `Recordings.tsx`**
   - Botão "Link to Album" agora funcional (antes era placeholder)
   - Abre modal de seleção de álbum
   - Atualiza lista após vincular com sucesso

5. **Frontend: Integração em `CollectionDetail.tsx`**
   - Página já existia, apenas adicionamos seção `<AlbumRecordings />`
   - Posicionada entre os metadados do álbum e o histórico de escuta
   - Usa `refresh()` do hook para atualizar após mudanças

6. **i18n: Novas traduções**
   - `album.recordings`, `album.recordThisAlbum`, `album.noRecordings`
   - `recording.linkAction`, `recording.linkDialogDescription`
   - `recording.linked`, `recording.unlinked`, `recording.startedForAlbum`
   - Todos os textos em PT-BR e EN

### Mapeamento de Critérios de Aceitação

| # | Critério | Status | Implementação |
|---|----------|--------|---------------|
| 1 | Rota `/albums/:id` existente | ✅ | Página `CollectionDetail.tsx` já existia desde V2 |
| 2 | Exibe informações do álbum | ✅ | Página já mostrava todos os dados do álbum |
| 3 | Seção "Gravações" listando recordings | ✅ | Componente `AlbumRecordings.tsx` |
| 4 | Mostra lista de gravações do álbum | ✅ | Usa `RecordingCard` para cada gravação |
| 5 | Exibe metadados de gravação | ✅ | Nome, duração, tamanho, data, status, trackMarkers |
| 6 | Link para editar gravação | ⏳ | Placeholder para V3-06 (Editor) |
| 7 | Ação desvincular | ✅ | Botão overlay + PATCH API |
| 8 | Botão "Gravar este álbum" | ✅ | No header da seção `AlbumRecordings` |
| 9 | Inicia gravação vinculada | ✅ | `startRecording(albumId)` |
| 10 | Gravação aparece automaticamente | ✅ | `onRecordingsChange` chama `refresh()` após 1s |
| API | Backend inclui recordings | ✅ | Modificado `/albums/:id` com Prisma include |

### Arquivos Criados/Modificados

**Backend:**
- `backend/src/routes/albums.ts` - Adicionado `include: { recordings }` no GET /:id

**Frontend - Componentes:**
- `frontend/src/components/Album/AlbumRecordings.tsx` *(novo)*
- `frontend/src/components/Recording/LinkRecordingDialog.tsx` *(novo)*
- `frontend/src/pages/CollectionDetail.tsx` - Integração do `AlbumRecordings`
- `frontend/src/pages/Recordings.tsx` - Implementação do modal de linking

**Frontend - Hooks/Types:**
- `frontend/src/hooks/useAlbums.ts` - Tipo `Album` expandido com `recordings?`

**Frontend - Testes:**
- `frontend/src/components/Album/__tests__/AlbumRecordings.test.tsx` *(novo)*
- `frontend/src/components/Recording/__tests__/LinkRecordingDialog.test.tsx` *(novo)*

**Frontend - i18n:**
- `frontend/src/i18n/locales/pt-BR.json` - Novas keys: `album.*`, `recording.*`
- `frontend/src/i18n/locales/en.json` - Mesmas keys em inglês

### Testes Implementados

**`AlbumRecordings.test.tsx` (4 testes):**
- ✅ Renderiza com nenhuma gravação (estado vazio)
- ✅ Renderiza lista de gravações
- ✅ Mostra badge de contagem
- ✅ Chama `onRecordingsChange` ao iniciar gravação

**`LinkRecordingDialog.test.tsx` (5 testes):**
- ✅ Renderiza quando aberto
- ✅ Não renderiza quando fechado
- ✅ Busca álbuns ao abrir
- ✅ Mostra estado vazio quando não há álbuns
- ✅ Filtra álbuns por busca
- ✅ Habilita botão ao selecionar álbum

**Resultado:**
```
Test Files  15 passed (15)
Tests       205 passed (205)
```

### Validação e Deploy

✅ **Backend tests:** 661 passed
✅ **Frontend lint:** Sem erros
✅ **Frontend tests:** 205 passed
✅ **Frontend build:** Sucesso (646 kB)
✅ **Backend build:** Sucesso
✅ **PM2 restart:** Todos os processos online

### Próximos Passos (Futuras Stories)

- **V3-06:** Implementar editor de gravação (waveform, trim, marcadores)
- **Melhoria (opcional):** Migrar progress polling para WebSocket
- **Melhoria (opcional):** Filtro por álbum na página `/recordings`

### Notas Adicionais

- O "Link to Album" que era placeholder na V3-04 agora está **funcional** ✅
- A ação "Editar" ainda é placeholder (V3-06)
- Histórico de escuta já existia desde V2-09
- Página `CollectionDetail` usou estrutura existente, apenas expandimos
