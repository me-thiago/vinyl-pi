# Story V2-07: UI de Matching/Confirmação

**Epic:** V2 - Coleção & Reconhecimento Musical  
**Status:** done

---

## User Story

Como usuário,  
quero poder identificar a música que está tocando e confirmar/corrigir matches contra minha coleção,  
para que os dados de escuta estejam sempre corretos.

---

## Contexto Técnico

Esta story implementa a UI de reconhecimento musical com integração à coleção. Cria:

1. **Botão de reconhecimento no PlayerBar** (footer)
2. **Modal MatchConfirmation** para seleção/confirmação de álbum
3. **Integração com API** `/api/recognize` e `/api/recognize/confirm`

### Localização dos Componentes

```
frontend/src/components/
├── Layout/
│   └── PlayerBar.tsx          ← Adicionar botão de reconhecimento
└── Recognition/               ← NOVA PASTA
    ├── index.ts
    ├── MatchConfirmation.tsx  ← Modal principal
    └── RecognitionButton.tsx  ← Botão com estado (loading, success, etc.)
```

### Posição do Botão no PlayerBar

O botão será adicionado **após o VU Meter, antes do Volume**:

```
[Play] [Backend] --- [VU Meter] [🎵 Identify] --- [Volume] [Latency] [Menu]
```

- Ícone: `Music2` ou `Disc3` do lucide-react
- Aparece apenas quando streaming está ativo
- Estados visuais: idle, loading (spinner), success (check), error (x)

---

## Critérios de Aceitação

### AC-1: Botão de Reconhecimento
- [x] Botão com ícone `Music2` aparece no PlayerBar após VU Meter
- [x] Botão habilitado apenas quando `isStreaming === true`
- [x] Botão mostra spinner durante reconhecimento
- [x] Tooltip: "Identificar música" (i18n)

### AC-2: Trigger de Reconhecimento
- [x] Clicar no botão dispara `POST /api/recognize { trigger: 'manual' }`
- [x] Durante loading, botão desabilitado
- [x] Timeout de 15s com mensagem de erro

### AC-3: Modal de Confirmação
- [x] Modal abre automaticamente quando `needsConfirmation: true`
- [x] Mostra lista de matches possíveis (até 5)
- [x] Cada match mostra: capa, título, artista, confiança (%)
- [x] Opção "Nenhum destes" no final da lista
- [x] Botão "Adicionar à coleção" se nenhum match encontrado

### AC-4: Confirmação de Match
- [x] Selecionar álbum dispara `POST /api/recognize/confirm { trackId, albumId }`
- [x] "Nenhum destes" envia `albumId: null`
- [x] Modal fecha após confirmação
- [x] Toast de sucesso: "Música vinculada a {álbum}"

### AC-5: Feedback Visual
- [x] Reconhecimento bem-sucedido (sem confirmação): ícone muda para ✓ por 3s
- [x] Reconhecimento com match automático: toast "Tocando: {música} - {artista}"
- [x] Erro: toast vermelho com mensagem

### AC-6: Estado "Adicionar à Coleção"
- [x] Botão abre formulário simplificado de criação de álbum
- [x] Pré-preenche título, artista, ano, capa do reconhecimento
- [x] Toast com ação "Adicionar" quando música não encontrada na coleção
- [x] Navegação para `/collection?add=true&...` com query params

---

## Design do Modal

```
┌────────────────────────────────────────────────┐
│  🎵 Confirmar Álbum                        [X] │
├────────────────────────────────────────────────┤
│  Música identificada:                          │
│  "Hey Jude" - The Beatles                      │
│                                                │
│  ─────────────────────────────────────────     │
│                                                │
│  Selecione o álbum da sua coleção:             │
│                                                │
│  ┌────┐  Hey Jude (1968)                       │
│  │ 🖼️ │  The Beatles                    87%   │
│  └────┘  [Selecionar]                          │
│                                                │
│  ┌────┐  1 (Compilation, 2000)                 │
│  │ 🖼️ │  The Beatles                    72%   │
│  └────┘  [Selecionar]                          │
│                                                │
│  ─────────────────────────────────────────     │
│                                                │
│  [ Nenhum destes ]  [ ➕ Adicionar à coleção ] │
└────────────────────────────────────────────────┘
```

---

## Implementação Técnica

### 1. RecognitionButton.tsx

```typescript
interface RecognitionButtonProps {
  disabled?: boolean;
  onRecognitionComplete?: (result: RecognitionResult) => void;
}

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

// Estados visuais:
// idle: Music2 icon
// loading: Loader2 spinning
// success: Check icon (verde, 3s timeout)
// error: X icon (vermelho, 3s timeout)
```

### 2. MatchConfirmation.tsx

```typescript
interface MatchConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: {
    id: string;
    title: string;
    artist: string;
    albumArt?: string;
  };
  matches: Array<{
    albumId: string;
    title: string;
    artist: string;
    coverUrl?: string;
    confidence: number;
  }>;
  onConfirm: (albumId: string | null) => Promise<void>;
  onAddToCollection: () => void;
}
```

### 3. Hook useRecognition.ts

```typescript
interface UseRecognitionReturn {
  recognize: () => Promise<RecognitionResult>;
  confirm: (trackId: string, albumId: string | null) => Promise<void>;
  isRecognizing: boolean;
  lastResult: RecognitionResult | null;
  error: string | null;
}
```

### 4. Endpoints Utilizados

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/recognize` | POST | Trigger reconhecimento |
| `/api/recognize/confirm` | POST | Confirmar match de álbum |

---

## Fluxo de Dados

```
1. Usuário clica no botão [🎵] no PlayerBar
2. RecognitionButton → useRecognition.recognize()
3. POST /api/recognize { trigger: 'manual' }
4. Backend:
   a. Captura 10s do stream
   b. Envia para AudD
   c. Busca matches na coleção (CollectionMatcher)
   d. Retorna resultado
5. Frontend recebe response:
   a. Se !albumMatch → toast "Música não identificada"
   b. Se albumMatch.needsConfirmation === false → toast + ícone ✓
   c. Se albumMatch.needsConfirmation === true → abre Modal
6. Modal (se há matches na coleção):
   a. Usuário seleciona álbum → botão "Confirmar seleção"
   b. Ou clica "Adicionar à coleção" → navega para /collection com prefill
   c. POST /api/recognize/confirm { trackId, albumId }
   d. Toast de sucesso, modal fecha

7. Toast com ação (se não há matches na coleção):
   a. Mostra toast "Tocando: X - Y" com botão "Adicionar à coleção"
   b. Clique navega para /collection?add=true&title=...&artist=...
   c. AlbumForm abre pré-preenchido com dados do reconhecimento
```

---

## i18n Keys

Adicionar ao `locales/pt-BR.json`:

```json
{
  "recognition": {
    "identify": "Identificar música",
    "identifying": "Identificando...",
    "success": "Música identificada",
    "error": "Erro ao identificar",
    "noMatch": "Música não encontrada",
    "confirmTitle": "Confirmar Álbum",
    "identifiedAs": "Música identificada:",
    "selectAlbum": "Selecione o álbum da sua coleção:",
    "confidence": "{{percent}}% de correspondência",
    "select": "Selecionar",
    "noneOfThese": "Nenhum destes",
    "addToCollection": "Adicionar à coleção",
    "linkedTo": "Música vinculada a {{album}}",
    "playing": "Tocando: {{title}} - {{artist}}"
  }
}
```

---

## Testes

### Unit Tests

- [x] `RecognitionButton.test.tsx`: estados visuais, click handler
- [ ] `MatchConfirmation.test.tsx`: renderiza matches, callbacks de seleção (future)
- [x] `useRecognition.test.ts`: mock API, estados de loading/error

### Integration Tests

- [ ] Fluxo completo: botão → modal → confirmação (manual testing)
- [x] Erro de rede: mostra toast de erro
- [x] Timeout: mostra mensagem apropriada

---

## Dependências

### Pré-requisitos (já implementados)

- [x] V2-05: Reconhecimento Musical (backend)
- [x] V2-06: Validação Contra Coleção (CollectionMatcher)

### Componentes shadcn/ui Necessários

```bash
npx shadcn@latest add dialog toast
```

> Verificar se já estão instalados antes de adicionar.

---

## Estimativa

- **Complexidade:** Média
- **Pontos:** 5
- **Tempo estimado:** 4-6 horas

---

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.2 (Reconhecimento Musical - Validação contra Coleção)
- [PRD v3.0](../prd-v3.md) - Seção 5.2.4 (UI Expandida - Player Atualizado)
- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção "Novos Componentes V2", Workflow 1, AC-14
- [Epics](../epics.md) - Epic V2
- [Arquitetura](../architecture.md) - Seção "Triple-Path Architecture"
