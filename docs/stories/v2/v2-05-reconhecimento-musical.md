# Story V2-05: Integração ACRCloud (Reconhecimento Musical)

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** done

**User Story:**
Como usuário,
quero que o sistema reconheça qual música está tocando,
para que possa saber automaticamente o que está escutando.

## Critérios de Aceitação

### Backend Service
1. ✅ Service `recognition.ts` criado
2. ✅ Captura de sample via FFmpeg (10s, mono, 44100Hz WAV)
3. ✅ Integração ACRCloud como serviço primário
4. ⚠️ ~~Fallback automático para AudD~~ - **Removido** (AudD tornou-se pago) - Fail gracefully sem fallback
5. ✅ Extração de metadados: title, artist, album, year, durationSeconds, isrc, albumArt
6. ✅ **Sem cache por hash** - cada request faz chamada real à API

### Endpoints
7. ✅ `POST /api/recognize` - Trigger reconhecimento
   - Body: { trigger: 'manual' | 'automatic', sampleDuration?: number }
   - Requer sessão ativa (retorna 400 se não houver)
8. ✅ `POST /api/recognize/confirm` - Confirmar match de álbum
   - Body: { trackId, albumId | null }
9. ✅ `GET /api/tracks` - Histórico de tracks reconhecidos

### Resposta
10. ✅ Retorna track criado com:
    - Metadados do reconhecimento
    - `durationSeconds` da faixa (para timing de próximo reconhecimento)
    - `nextRecognitionIn` calculado (durationSeconds - 30, mínimo 60s)
    - `albumMatch: null` (matching será V2-06)

### Track Persistence
11. ✅ Track criado no banco vinculado à sessão atual
12. ✅ recognitionSource: 'acrcloud' (único provider)
13. ✅ confidence salvo para referência
14. ✅ Evento `track.recognized` emitido via EventBus
15. ✅ WebSocket broadcast `track_recognized`

### FFmpeg Capture
```bash
ffmpeg -f s16le -ar 48000 -ac 2 -i /tmp/vinyl-audio.fifo \
  -t 10 -acodec pcm_s16le -ar 44100 -ac 1 \
  /tmp/recognition-sample-{timestamp}.wav
```

## Variáveis de Ambiente

```env
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com
ACRCLOUD_ACCESS_KEY=xxx
ACRCLOUD_ACCESS_SECRET=xxx
# AUDD_API_TOKEN - Removido (serviço pago)
```

## Pré-requisitos

- V2-01 - Schema de Dados V2 (model Track)
- Pipeline FFmpeg funcionando (V1)

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Recognition Service, Workflow 1
- [ACRCloud Docs](https://docs.acrcloud.com/reference/identification-api)
- [PRD v3.0](../prd-v3.md) - Seção 5.2.2, 6.5

## Arquivos Implementados

- `backend/src/services/recognition.ts` - Service principal
- `backend/src/routes/recognition.ts` - Endpoints da API
- `backend/src/schemas/recognition.schema.ts` - Validação Zod
- `backend/src/__tests__/services/recognition.test.ts` - Testes unitários
- `backend/src/__tests__/schemas/recognition.schema.test.ts` - Testes de schema

