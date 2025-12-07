# Story V3-04: UI Gravações

**Epic:** V3a - Gravação & Fundação
**Status:** drafted

**User Story:**
Como usuário,
quero ver minhas gravações e controlar a gravação pelo player,
para que eu possa gerenciar meus arquivos FLAC facilmente.

## Critérios de Aceitação

### Botão Record no Footer

1. Botão de gravação visível no footer do player (ao lado do volume)
2. Estado inicial: ícone de círculo vermelho (⏺️)
3. Durante gravação: ícone pulsante + indicador de tempo
4. Click inicia gravação (POST /api/recordings/start)
5. Click para gravação (POST /api/recordings/stop)

### Indicador de Gravação

6. Quando gravando, mostrar:
   - Ícone pulsante vermelho
   - Duração em tempo real (mm:ss)
   - Opcional: tamanho do arquivo em tempo real
7. WebSocket recebe `recording_progress` para atualizar

### Página de Listagem (/recordings)

8. Rota `/recordings` criada
9. Lista de gravações em cards/tabela
10. Ordenação por data (mais recente primeiro)
11. Paginação (20 por página)
12. Cada item mostra:
    - Nome do arquivo
    - Álbum vinculado (se houver)
    - Duração (mm:ss)
    - Tamanho (MB)
    - Data de criação
    - Status (badge)

### Filtros e Ações

13. Filtro por álbum (dropdown)
14. Filtro por status
15. Busca por nome
16. Ação: Deletar gravação (com confirmação)
17. Ação: Editar (navega para editor - V3-06)
18. Ação: Vincular a álbum (modal com seletor)

### Menu de Navegação

19. Link "Gravações" adicionado ao menu/sidebar
20. Badge com contagem de gravações (opcional)

### CRUD API

```typescript
// GET /api/recordings
Query: { limit, offset, albumId?, status?, sort?, order? }

// GET /api/recordings/:id
Response: Recording com trackMarkers

// PUT /api/recordings/:id
Body: { fileName?, albumId?, notes? }

// DELETE /api/recordings/:id
// Remove arquivo FLAC também
```

## Componentes

```
frontend/src/
├── pages/
│   └── Recordings.tsx
├── components/
│   └── Recording/
│       ├── RecordButton.tsx      # Botão no footer
│       ├── RecordingStatus.tsx   # Indicador durante gravação
│       ├── RecordingCard.tsx     # Card na listagem
│       └── RecordingList.tsx     # Lista completa
└── hooks/
    └── useRecording.ts           # Estado e controle
```

## Hook useRecording

```typescript
interface UseRecordingReturn {
  isRecording: boolean;
  currentRecording: RecordingProgress | null;
  startRecording: (albumId?: string) => Promise<void>;
  stopRecording: () => Promise<Recording>;
  error: string | null;
}

interface RecordingProgress {
  id: string;
  startedAt: Date;
  durationSeconds: number;
  fileSizeBytes?: number;
}
```

## Pré-requisitos

- V3-03 - Gravação FLAC Manual (API pronta)

## Notas de Implementação

- Usar shadcn/ui components (Button, Card, Table, Badge, Dialog)
- RecordButton no footer ao lado do volume
- Animação CSS para ícone pulsante
- Polling ou WebSocket para progress (preferir WebSocket)
- Confirmação antes de deletar (AlertDialog)
- Toast de sucesso/erro nas ações

## Estados do Botão Record

```
┌─────────────────────────────────────────┐
│  Não gravando  │  Gravando              │
├─────────────────────────────────────────┤
│  ⏺️ Record     │  ⏹️ 03:45 ●            │
│  (cinza)       │  (vermelho pulsante)   │
└─────────────────────────────────────────┘
```

## Testes

- [ ] Botão Record aparece no footer
- [ ] Click inicia gravação
- [ ] Click para gravação
- [ ] Indicador de tempo atualiza
- [ ] Listagem carrega corretamente
- [ ] Filtros funcionam
- [ ] Delete remove arquivo e registro
- [ ] Vincular a álbum funciona

## Referências

- [Tech Spec V3a](../../tech-spec-epic-v3a.md) - Seção UI Gravação
