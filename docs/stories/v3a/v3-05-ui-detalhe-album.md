# Story V3-05: UI Detalhe Álbum

**Epic:** V3a - Gravação & Fundação
**Status:** drafted

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
