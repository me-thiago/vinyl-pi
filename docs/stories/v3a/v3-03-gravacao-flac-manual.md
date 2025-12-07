# Story V3-03: Gravação FLAC Manual

**Epic:** V3a - Gravação & Fundação
**Status:** done

**User Story:**
Como usuário,
quero iniciar e parar gravações FLAC manualmente,
para que eu possa arquivar meus discos em qualidade lossless.

## Critérios de Aceitação

### RecordingManager Service

1. Service `recording-manager.ts` criado em `backend/src/services/`
2. Método `startRecording(options)` inicia gravação
3. Método `stopRecording()` para gravação
4. Método `getStatus()` retorna estado atual
5. Singleton - apenas uma gravação ativa por vez

### Iniciar Gravação

6. `POST /api/recordings/start` inicia gravação
7. Cria registro `Recording` no banco (status: 'recording')
8. Cria diretório `data/recordings/YYYY-MM/` se não existir
9. Spawna FFmpeg #4 escrevendo em `rec-{id}.flac`
10. Retorna `{ id, status, startedAt, filePath }`

### Parar Gravação

11. `POST /api/recordings/stop` para gravação
12. Envia SIGTERM para FFmpeg #4
13. Aguarda FFmpeg finalizar (max 5s)
14. Calcula `durationSeconds` usando FFprobe
15. Calcula `fileSizeBytes` usando fs.stat
16. Atualiza Recording (status: 'completed')
17. Retorna recording completo

### Vinculação a Álbum

18. `albumId` opcional no start
19. Se fornecido, Recording.albumId é preenchido
20. Se não, Recording fica "órfã" (albumId = null)

### Proteção

21. Se gravação já ativa, `POST /start` retorna 409 Conflict
22. Se não há gravação ativa, `POST /stop` retorna 404

### Eventos

23. EventBus emit `recording.started` com payload `{ recording }`
24. EventBus emit `recording.stopped` com payload `{ recording }`
25. WebSocket broadcast `recording_started` e `recording_stopped`

## API Contracts

```typescript
// POST /api/recordings/start
Request: {
  albumId?: string;
  fileName?: string;  // default: timestamp
}
Response: {
  data: {
    id: string;
    status: 'recording';
    startedAt: string;
    filePath: string;
  }
}

// POST /api/recordings/stop
Request: {
  recordingId: string;
}
Response: {
  data: Recording;  // com durationSeconds e fileSizeBytes
}

// GET /api/recordings/status
Response: {
  data: {
    isRecording: boolean;
    currentRecording?: {
      id: string;
      startedAt: string;
      durationSeconds: number;
    };
  }
}
```

## Zod Schema

```typescript
// backend/src/schemas/recordings.schema.ts

export const startRecordingSchema = z.object({
  albumId: z.string().uuid().optional(),
  fileName: z.string().max(255).optional(),
});

export const stopRecordingSchema = z.object({
  recordingId: z.string().uuid(),
});
```

## Pré-requisitos

- V3-01 - Schema Dados V3
- V3-02 - Quad-Path Architecture (FIFO3 + FFmpeg #4)

## Notas de Implementação

- RecordingManager deve seguir padrão EventBus safety (destroy method)
- Usar `ffprobe -show_entries format=duration` para duração
- `filePath` no banco é relativo: `2025-12/rec-abc123.flac`
- Path completo: `data/recordings/{filePath}`
- Garantir cleanup se FFmpeg #4 falhar

## Estrutura de Arquivos

```
data/recordings/
├── 2025-12/
│   ├── rec-abc123.flac
│   └── rec-def456.flac
└── 2026-01/
    └── rec-ghi789.flac
```

## Testes

- [x] Start recording cria arquivo e registro
- [x] Stop recording finaliza FFmpeg e atualiza registro
- [x] Duração calculada corretamente
- [x] Vinculação a álbum funciona
- [x] Gravação órfã permitida
- [x] Apenas uma gravação ativa por vez
- [x] Eventos emitidos corretamente

## Dev Agent Record

### Debug Log

**Implementação completada - 2025-12-07**

Todo o core da gravação FLAC já estava implementado:
- ✅ RecordingManager (V3-02) com arquitetura Always-On FFmpeg #4
- ✅ Routes /api/recordings (start, stop, status, CRUD)
- ✅ Integração com AudioManager (streaming_started/stopped events)
- ✅ Eventos EventEmitter funcionais

**Tarefas realizadas:**
1. Criado `recordings.schema.ts` separado conforme story (AC conforme spec)
2. Atualizado EventBus para incluir eventos V3a:
   - recording.started
   - recording.stopped
   - recording.deleted
   - recording.trimmed
   - storage.alert
   - storage.ok
3. RecordingManager agora emite via EventBus além de EventEmitter
4. SocketManager subscrito aos eventos de recording, broadcasts via WebSocket
5. Criados testes completos:
   - recording-manager.test.ts: 25 testes ✅
   - recordings.test.ts (routes): 17 testes ✅
   - recordings.schema.test.ts: 18 testes ✅
   - **Total: 60 testes passando**

### Completion Notes

**Arquivos modificados:**
- `backend/src/schemas/recordings.schema.ts` (CRIADO)
- `backend/src/routes/recordings.ts` (atualizado import)
- `backend/src/utils/event-bus.ts` (tipos V3a adicionados)
- `backend/src/services/recording-manager.ts` (EventBus integration)
- `backend/src/services/socket-manager.ts` (recording events)

**Arquivos de teste criados:**
- `backend/src/__tests__/routes/recordings.test.ts` (CRIADO)
- `backend/src/__tests__/schemas/recordings.schema.test.ts` (CRIADO)

**Todos os 25 critérios de aceitação atendidos:**
✅ AC1-5: RecordingManager service funcional
✅ AC6-10: Iniciar gravação completo
✅ AC11-17: Parar gravação completo
✅ AC18-20: Vinculação a álbum funcional
✅ AC21-22: Proteção contra estados inválidos
✅ AC23-25: Eventos EventBus e WebSocket

## File List

**Criados:**
- backend/src/schemas/recordings.schema.ts
- backend/src/__tests__/routes/recordings.test.ts
- backend/src/__tests__/schemas/recordings.schema.test.ts

**Modificados:**
- backend/src/routes/recordings.ts
- backend/src/utils/event-bus.ts
- backend/src/services/recording-manager.ts
- backend/src/services/socket-manager.ts

## Change Log

- 2025-12-07: Story V3-03 implementada (60 testes criados, todos passando)

## Referências

- [Tech Spec V3a](../../tech-spec-epic-v3a.md) - Seção Recording Manager, Workflows 1-2
