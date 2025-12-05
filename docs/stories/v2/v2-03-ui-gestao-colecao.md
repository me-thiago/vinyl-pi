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

## Componentes

```
frontend/src/
├── pages/Collection.tsx
├── components/Collection/
│   ├── AlbumCard.tsx
│   ├── AlbumGrid.tsx
│   ├── AlbumForm.tsx
│   └── CollectionFilters.tsx
└── hooks/useAlbums.ts
```

## Pré-requisitos

- V2-02 - CRUD de Álbuns (Backend)

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Services and Modules
- [PRD v3.0](../prd-v3.md) - Seção 5.2.1, 5.2.4

