# Story V2-05: Integração ACRCloud/AudD (Reconhecimento Musical)

**Epic:** V2 - Coleção & Reconhecimento Musical
**Status:** drafted

**User Story:**
Como usuário,
quero que o sistema reconheça qual música está tocando,
para que possa saber automaticamente o que está escutando.

## Critérios de Aceitação

### Backend Service
1. Service `recognition.ts` criado
2. Captura de sample via FFmpeg (10s, mono, 44100Hz WAV)
3. Integração ACRCloud como serviço primário
4. Fallback automático para AudD se ACRCloud falhar (timeout 10s, erro, no match)
5. Extração de metadados: title, artist, album, year, durationSeconds, isrc, albumArt
6. **Sem cache por hash** - cada request faz chamada real à API

### Endpoints
7. `POST /api/recognize` - Trigger reconhecimento
   - Body: { trigger: 'manual' | 'automatic', sampleDuration?: number }
   - Requer sessão ativa (retorna 400 se não houver)
8. `POST /api/recognize/confirm` - Confirmar match de álbum
   - Body: { trackId, albumId | null }

### Resposta
9. Retorna track criado com:
   - Metadados do reconhecimento
   - `durationSeconds` da faixa (para timing de próximo reconhecimento)
   - `nextRecognitionIn` calculado (durationSeconds - 30, mínimo 60s)
   - `albumMatch` se encontrado na coleção (via V2-06)

### Track Persistence
10. Track criado no banco vinculado à sessão atual
11. recognitionSource: 'acrcloud' ou 'audd'
12. confidence salvo para referência
13. Evento `track.recognized` emitido via EventBus

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
AUDD_API_TOKEN=xxx
```

## Pré-requisitos

- V2-01 - Schema de Dados V2 (model Track)
- Pipeline FFmpeg funcionando (V1)

## Referências

- [Tech Spec V2](../tech-spec-epic-v2.md) - Seção Recognition Service, Workflow 1
- [ACRCloud Docs](https://docs.acrcloud.com/reference/identification-api)
- [AudD Docs](https://docs.audd.io/)
- [PRD v3.0](../prd-v3.md) - Seção 5.2.2, 6.5

