# Story V2-06: Validação Contra Coleção (Fuzzy Matching)

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** done

**User Story:**
Como usuário,
quero que reconhecimentos sejam validados contra minha coleção,
para que erros sejam reduzidos e reconhecimentos sejam vinculados aos meus álbuns.

## Critérios de Aceitação

### Backend Service
1. Service `collection-matcher.ts` criado
2. Dependência: `fastest-levenshtein` para algoritmo otimizado
3. Busca em álbuns com `archived=false` apenas

### Algoritmo de Matching
4. Calcula similaridade Levenshtein para artist e album/title
5. Score combinado: (artistScore * 0.6) + (albumScore * 0.4)
6. Retorna top 5 matches com score >= 0.5

### Thresholds
7. Score >= 0.8: vinculação automática, `needsConfirmation=false`
8. Score 0.5-0.8: `needsConfirmation=true`, UI mostra opções
9. Score < 0.5: descartado, `albumMatch=null`

### Integração com Recognition
10. CollectionMatcher chamado após reconhecimento bem-sucedido
11. Resultado incluso na resposta de `/api/recognize`:
    ```typescript
    albumMatch?: {
      albumId: string;
      albumTitle: string;
      matchConfidence: number;
      needsConfirmation: boolean;
    }
    ```

### Confirmação
12. `POST /api/recognize/confirm` atualiza Track.albumId
13. albumId pode ser null ("nenhum álbum da coleção")

## Interface

```typescript
interface AlbumMatch {
  album: Album;
  confidence: number;      // 0-1
  matchedOn: 'artist+album' | 'artist' | 'album';
  needsConfirmation: boolean;
}

function findMatches(
  track: { artist: string; album: string },
  threshold?: number  // default: 0.5
): Promise<AlbumMatch[]>
```

## Pré-requisitos

- V2-02 - CRUD de Álbuns (Backend) - para ter álbuns no banco
- V2-05 - Reconhecimento Musical - para integrar

## Notas de Implementação (V2-05)

**Status após V2-05:** A estrutura base está pronta. O endpoint `POST /api/recognize` e `POST /api/recognize/confirm` já existem, mas:

1. **`albumMatch` é sempre `null`** - V2-05 não implementou o matching
2. **`POST /api/recognize/confirm`** já funciona - atualiza `Track.albumId`
3. **Evento `track.recognized`** inclui campo `albumMatch: null`

**O que V2-06 precisa fazer:**
1. Criar `collection-matcher.ts` com algoritmo Levenshtein
2. Instalar dependência `fastest-levenshtein`
3. Integrar CollectionMatcher na função `recognize()` em `services/recognition.ts`
4. Atualizar resposta para incluir `albumMatch` com dados reais
5. Atualizar evento WebSocket `track_recognized` com `albumMatch` preenchido

## Notas de Implementação Final

**Implementado em:** 2025-12-05

### Arquitetura de Captura de Áudio

Implementamos um **terceiro processo FFmpeg** com **Ring Buffer circular de 30 segundos**:

```
ALSA → FFmpeg #1 (main) → stdout (Express) + FIFO1 (MP3) + FIFO2 (Recognition)
                                ↓                              ↓
                          Frontend stream              FFmpeg #3 → Ring Buffer
                                                                      ↓
                                                            Recognition Service
                                                                      ↓
                                                              WAV → AudD API
```

**Benefícios do Ring Buffer:**
- **Captura instantânea**: Zero latência - áudio já disponível
- **Pré-roll**: Captura áudio de ANTES do trigger (útil para início de músicas)
- **Sem race conditions**: Buffer sempre populado quando streaming ativo

### Migração ACRCloud → AudD

Migramos de ACRCloud para **AudD** por problemas de autenticação com ACRCloud.

**AudD vantagens:**
- API mais simples (apenas API key, sem HMAC-SHA1)
- Boa cobertura de catálogo musical
- Retorna metadados Spotify/Apple Music/Deezer

**Implementação técnica:**
- Usamos **axios** em vez de fetch nativo (resolve problema de FormData com Node.js)
- Arquivo temporário WAV mono 44100Hz (convertido de PCM 48000Hz stereo)

### Arquivos Criados/Modificados

- `backend/src/utils/ring-buffer.ts` - Buffer circular de 30s
- `backend/src/services/collection-matcher.ts` - Fuzzy matching Levenshtein
- `backend/src/services/recognition.ts` - Migrado para AudD + captura do Ring Buffer
- `backend/src/services/audio-manager.ts` - FFmpeg #3 + integração Ring Buffer
- `backend/src/routes/recognition.ts` - Endpoint `/api/recognize/buffer-status`

### Configuração Necessária

```env
# backend/.env
AUDD_API_KEY=sua-api-key-aqui
```

### Testes

- 27 testes unitários para collection-matcher
- Teste manual confirmou reconhecimento de "Those Sweet Words" - Norah Jones
- Fuzzy matching vinculou automaticamente ao álbum "Feels Like Home" (100% confidence)

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Collection Matcher, Workflow 5
- [PRD v3.0](../prd-v3.md) - Seção 5.2.2
- [Technical Decisions](../../technical-decisions.md) - TD-016: Migração para AudD

