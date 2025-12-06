# Story V2-03: UI de Gestão de Coleção

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** drafted

**User Story:**
Como usuário,
quero uma interface para gerenciar minha coleção de discos,
para que possa adicionar e organizar meus álbuns facilmente.

## Critérios de Aceitação

### Página Collection
1. Nova rota `/collection` com lazy loading
2. Toggle Grid/Lista para visualização
3. Cards de álbum com: capa (ou placeholder), título, artista, ano, formato
4. Lazy loading de imagens de capa

### Formulário de Álbum
5. Modal/drawer para criar/editar álbum
6. Campos: título*, artista*, ano, label, formato (dropdown enum), condição (dropdown enum), notas
7. Campo coverUrl (input de URL, sem upload de arquivo)
8. Validação client-side antes de submit

### Busca e Filtros
9. Campo de busca (título + artista)
10. Filtros: formato, ano, condição
11. Toggle "Mostrar arquivados" (default: off)

### Ações
12. Botão "Adicionar Álbum"
13. Menu de contexto por álbum: Editar, Arquivar, Excluir
14. Confirmação antes de excluir
15. Badge visual para álbuns com `discogsAvailable=false` (ícone de warning)

### Paginação
16. Infinite scroll ou botão "Carregar mais"
17. Contador: "Mostrando X de Y álbuns"

## Wireframes UI (ASCII)

### Navegação Atualizada

```
Header:
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎵 Home / Coleção               [Collection] [Sessions]                │
└─────────────────────────────────────────────────────────────────────────┘
     ↑ Logo + Breadcrumb                ↑ Navegação de conteúdo

Footer (PlayerBar):
┌─────────────────────────────────────────────────────────────────────────┐
│ [▶] Backend: ● Ativo  [═══VU Meter═══]  [Volume] --ms  [⋮ Menu]       │
└─────────────────────────────────────────────────────────────────────────┘
                                                            ↑ Dropdown com:
                                                              - Settings
                                                              - Dashboard
                                                              - Diagnostics
                                                              - Theme Toggle

Nova Organização:
- Header: Navegação de CONTEÚDO (Collection, Sessions)
- Footer: Player + ferramentas de MONITORAMENTO (Dashboard, Diagnostics, Settings)
- Breadcrumb dinâmico mostra sempre onde você está
```

### Página Principal da Coleção (`/collection`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎵 Home / Coleção               [Collection] [Sessions]                │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│                                  [+ Adicionar Álbum] [↓ Importar Discogs]│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔍 Buscar álbuns...                    [Formato ▼] [Ano ▼] [⊞⊟] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │       │
│  │ │         │ │ │ │         │ │ │ │         │ │ │ │         │ │       │
│  │ │  CAPA   │ │ │ │  CAPA   │ │ │ │  CAPA   │ │ │ │  CAPA   │ │       │
│  │ │         │ │ │ │         │ │ │ │         │ │ │ │         │ │       │
│  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │       │
│  │ Abbey Road  │ │ Dark Side   │ │ Rumours     │ │ Thriller    │       │
│  │ The Beatles │ │ Pink Floyd  │ │ Fleetwood.. │ │ Michael J.. │       │
│  │ 1969 · LP   │ │ 1973 · LP   │ │ 1977 · LP   │ │ 1982 · LP   │       │
│  │ [VG+]       │ │ [Mint]      │ │ [VG]        │ │ [NM]        │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │             │       │
│  │ │         │ │ │ │         │ │ │ │         │ │ │  [Carregar  │       │
│  │ │  CAPA   │ │ │ │  CAPA   │ │ │ │  CAPA   │ │ │    mais]    │       │
│  │ │         │ │ │ │         │ │ │ │         │ │ │             │       │
│  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │             │       │
│  │ ...         │ │ ...         │ │ ...         │ │             │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Mostrando 8 de 127 álbuns                              [◀ 1 2 3 4 ▶]   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Notas de implementação:**
- **Header Global:** Usa o mesmo header de todas as páginas (logo + breadcrumb + nav)
- **Sem header duplicado:** Não criar header secundário na página
- **Botões de ação:** Posicionados no topo da área de conteúdo (não no header)
- Grid responsivo: 4 cols (lg), 3 cols (md), 2 cols (sm), 1 col (xs)
- Cards clicáveis → navegam para `/collection/:id`
- Hover no card: overlay com ações rápidas (Editar, Arquivar)
- Badge de condição (VG+, Mint, etc) com cores por nível
- Placeholder de capa: ícone de disco genérico

### Detalhe do Álbum (`/collection/:id`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎵 Home / Coleção / Abbey Road          [Collection] [Sessions]        │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│                                                  [✏️ Editar] [🗑️ Excluir]│
│                                                                         │
│  ┌───────────────────┐                                                  │
│  │                   │    Abbey Road                                    │
│  │                   │    ───────────────────────────────────           │
│  │       CAPA        │    Artista: The Beatles                          │
│  │     (grande)      │    Ano: 1969                                     │
│  │                   │    Label: Apple Records                          │
│  │                   │    Formato: LP                                   │
│  │                   │    Condição: VG+                                 │
│  │                   │    Tags: [rock] [60s] [favoritos]                │
│  └───────────────────┘                                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📝 Notas                                                         │   │
│  │ Edição brasileira, capa laminada original. Comprado na Feira... │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🎵 Histórico de Reprodução (V2-09)                               │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ Come Together         │ 05/12/2025 14:32  │ 95%                  │   │
│  │ Something             │ 05/12/2025 14:35  │ 92%                  │   │
│  │ Here Comes the Sun    │ 28/11/2025 20:15  │ 88%                  │   │
│  │ ...mais 12 faixas reconhecidas                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────┐  ┌──────────────────────────┐            │
│  │ 🔗 Ver no Discogs        │  │ 🔄 Sincronizar Discogs   │            │
│  └──────────────────────────┘  └──────────────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Notas de implementação:**
- **Breadcrumb automático:** "Home / Coleção / [Nome do Álbum]" gerado pelo sistema
- **Botões de ação:** No topo da área de conteúdo (Editar, Excluir)
- Capa grande: aspect-ratio 1:1, max 300px
- Seção "Histórico de Reprodução" mostra tracks vinculados a este álbum (depende V2-09)
- Botões Discogs só aparecem se `discogsId` existir
- Se `discogsAvailable=false`: mostrar warning "Álbum removido do Discogs"

### Modal de Adicionar/Editar Álbum (Dialog)

```
┌─────────────────────────────────────────────────────────────────┐
│  ➕ Novo Álbum                                              [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Título *                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Abbey Road                                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Artista *                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ The Beatles                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ Ano                │  │ Label              │                │
│  │ ┌────────────────┐ │  │ ┌────────────────┐ │                │
│  │ │ 1969           │ │  │ │ Apple Records  │ │                │
│  │ └────────────────┘ │  │ └────────────────┘ │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ Formato            │  │ Condição           │                │
│  │ ┌────────────────┐ │  │ ┌────────────────┐ │                │
│  │ │ LP           ▼ │ │  │ │ VG+          ▼ │ │                │
│  │ └────────────────┘ │  │ └────────────────┘ │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                 │
│  URL da Capa (opcional)                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ https://i.discogs.com/...                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Tags (separadas por vírgula)                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ rock, 60s, favoritos                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Notas                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Edição brasileira, capa laminada original...             │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│           [Cancelar]                     [💾 Salvar Álbum]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Notas de implementação:**
- Usar shadcn/ui Dialog
- Validação: título e artista obrigatórios
- Formato: Select com enum AlbumFormat (LP, EP, SINGLE_7, SINGLE_12, DOUBLE_LP, BOX_SET)
- Condição: Select com enum AlbumCondition (mint, near_mint, vg_plus, vg, good, fair, poor)
- Tags: Input que converte string → array no submit
- Notas: Textarea (precisa adicionar componente shadcn)

### Modal de Importar do Discogs (V2-04 - referência)

```
┌─────────────────────────────────────────────────────────────────┐
│  📦 Importar do Discogs                                     [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Buscar por:                                                    │
│  ○ Número de Catálogo    ● Código de Barras    ○ ID Discogs    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 5099969944604                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                          [🔍 Buscar]                            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Resultados encontrados:                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○  Abbey Road (2019 Remaster)                            │   │
│  │    The Beatles · Apple Records · 2019                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ ●  Abbey Road (Original UK Pressing)                     │   │
│  │    The Beatles · Apple Records · 1969                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ ○  Abbey Road (Japanese Pressing)                        │   │
│  │    The Beatles · Apple Records · 1970                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│           [Cancelar]                    [📥 Importar Seleção]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Nota:** Este modal será implementado na story V2-04. O botão "Importar Discogs" pode ficar desabilitado até V2-04 ser implementada.

## Componentes shadcn/ui Utilizados

| Componente | Uso | Status |
|------------|-----|--------|
| **Card** | AlbumCard (grid), detalhes do álbum | ✅ Já existe |
| **Button** | Adicionar, Salvar, Cancelar, ações | ✅ Já existe |
| **Input** | Busca, campos do formulário | ✅ Já existe |
| **Select** | Formato, Condição, filtros | ✅ Já existe |
| **Badge** | Tags, condição do disco | ✅ Já existe |
| **Dialog** | Modal de adicionar/editar | ✅ Já existe |
| **Label** | Labels dos campos | ✅ Já existe |
| **Separator** | Divisões visuais | ✅ Já existe |
| **ScrollArea** | Lista de resultados, histórico | ✅ Já existe |
| **DropdownMenu** | Menu de contexto do card | ✅ Já existe |
| **Textarea** | Campo de notas | ⚠️ Adicionar via `npx shadcn@latest add textarea` |
| **RadioGroup** | Tipo de busca Discogs (V2-04) | ⚠️ Adicionar via `npx shadcn@latest add radio-group` |
| **Skeleton** | Loading states das capas | ⚠️ Adicionar via `npx shadcn@latest add skeleton` |

## Responsividade

| Breakpoint | Grid Colunas | Comportamento |
|------------|--------------|---------------|
| `lg` (1024px+) | 4 colunas | Layout completo |
| `md` (768px) | 3 colunas | Filtros colapsáveis |
| `sm` (640px) | 2 colunas | Header compacto |
| `< sm` | 1 coluna | Mobile-first |

## Estrutura de Arquivos

```
frontend/src/
├── pages/
│   ├── Collection.tsx          # Página principal /collection
│   └── CollectionDetail.tsx    # Página detalhe /collection/:id
├── components/Collection/
│   ├── AlbumCard.tsx           # Card individual do álbum
│   ├── AlbumGrid.tsx           # Grid de cards com loading
│   ├── AlbumForm.tsx           # Modal de criar/editar
│   ├── AlbumDetail.tsx         # Componente de detalhe
│   ├── CollectionFilters.tsx   # Barra de busca + filtros
│   └── CollectionEmpty.tsx     # Estado vazio (sem álbuns)
└── hooks/
    └── useAlbums.ts            # Hook CRUD + query de álbuns
```

## Padrões de UI Estabelecidos

### Header Global (já implementado)
- **Estrutura:** Logo (link home) + Breadcrumb dinâmico + Navegação de Conteúdo
- **Navegação no Header:** Collection, Sessions (conteúdo do usuário)
- **Breadcrumb:** Atualiza automaticamente baseado na rota
- **Consistência:** Todas as páginas usam o mesmo header

### Footer/PlayerBar (já implementado)
- **Player:** Play/Pause, Volume, VU Meter, Latency
- **Dropdown Menu (⋮):** Agrupa ferramentas e configurações
  - Settings (⚙️)
  - Dashboard (📊)
  - Diagnostics (🔧)
  - Theme Toggle (🌓)
- **Lógica:** Separa navegação de conteúdo (header) de ferramentas (footer)

### Layout de Páginas
- **Sem headers duplicados:** Não criar `<header>` dentro das páginas
- **Container:** `<main className="container mx-auto px-4 py-6">`
- **Ações no topo:** Botões de ação principais no início do conteúdo
- **Espaçamento:** `px-4` consistente com o PlayerBar (footer)

## Chaves i18n Necessárias

```json
{
  "collection": {
    "title": "Minha Coleção",
    "add_album": "Adicionar Álbum",
    "import_discogs": "Importar do Discogs",
    "search_placeholder": "Buscar álbuns...",
    "showing_count": "Mostrando {{count}} de {{total}} álbuns",
    "load_more": "Carregar mais",
    "empty_title": "Sua coleção está vazia",
    "empty_description": "Adicione seu primeiro álbum ou importe do Discogs",
    "form": {
      "new_album": "Novo Álbum",
      "edit_album": "Editar Álbum",
      "title": "Título",
      "artist": "Artista",
      "year": "Ano",
      "label": "Gravadora",
      "format": "Formato",
      "condition": "Condição",
      "cover_url": "URL da Capa",
      "tags": "Tags",
      "tags_hint": "Separadas por vírgula",
      "notes": "Notas",
      "save": "Salvar Álbum",
      "cancel": "Cancelar"
    },
    "actions": {
      "edit": "Editar",
      "archive": "Arquivar",
      "unarchive": "Desarquivar",
      "delete": "Excluir",
      "confirm_delete": "Tem certeza que deseja excluir este álbum?"
    },
    "filters": {
      "format": "Formato",
      "year": "Ano",
      "condition": "Condição",
      "show_archived": "Mostrar arquivados",
      "all": "Todos"
    },
    "format": {
      "LP": "LP",
      "EP": "EP",
      "SINGLE_7": "7\"",
      "SINGLE_12": "12\"",
      "DOUBLE_LP": "2xLP",
      "BOX_SET": "Box Set"
    },
    "condition": {
      "mint": "Mint",
      "near_mint": "Near Mint",
      "vg_plus": "VG+",
      "vg": "VG",
      "good": "Good",
      "fair": "Fair",
      "poor": "Poor"
    },
    "detail": {
      "notes": "Notas",
      "play_history": "Histórico de Reprodução",
      "view_discogs": "Ver no Discogs",
      "sync_discogs": "Sincronizar Discogs",
      "discogs_unavailable": "Álbum removido do Discogs"
    }
  },
  "nav": {
    "collection": "Coleção"
  }
}

Nota: "Voltar à Coleção" não é necessário - o breadcrumb já fornece navegação
```

## Pré-requisitos

- V2-02 - CRUD de Álbuns (Backend) ✅ done

## Tasks de Implementação

1. [ ] Adicionar componentes shadcn necessários (textarea, skeleton)
2. [ ] Criar hook `useAlbums.ts` com CRUD e queries
3. [ ] Criar página `Collection.tsx` com grid e filtros
4. [ ] Criar `AlbumCard.tsx` com lazy loading de imagem
5. [ ] Criar `AlbumForm.tsx` (modal Dialog)
6. [ ] Criar `CollectionFilters.tsx` (busca + dropdowns)
7. [ ] Criar página `CollectionDetail.tsx`
8. [ ] Adicionar rota `/collection` e `/collection/:id` no router (com lazy loading)
9. [ ] Adicionar "collection" no mapeamento de breadcrumb (`DynamicBreadcrumb.tsx`) ✅ **DONE**
10. [ ] Adicionar botão "Collection" no header (`Header.tsx`) ✅ **DONE**
11. [ ] Adicionar chaves i18n em pt-BR e en (`nav.collection`, `nav.theme`) ✅ **DONE**
12. [ ] Testes: hook useAlbums, componentes principais

**Importante:** Seguir o padrão estabelecido das outras páginas:
- Não criar header secundário dentro da página
- Usar `<main className="container mx-auto px-4 py-6">` como container
- Botões de ação no início do conteúdo, não em header separado

**Nota sobre navegação (atualizado):**
- Header contém: Collection, Sessions (navegação de conteúdo do usuário)
- Footer contém: Dropdown menu com Dashboard, Diagnostics, Settings, Theme Toggle
- Esta separação mantém o header focado em conteúdo e o footer em ferramentas/monitoramento

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Services and Modules
- [PRD v3.0](../prd-v3.md) - Seção 5.2.1, 5.2.4
- [Architecture](../architecture.md) - Padrões de componentes React
