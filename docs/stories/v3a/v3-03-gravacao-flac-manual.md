# Story V3-03: Gravação FLAC Manual

**Epic:** V3a - Gravação & Fundação
**Status:** drafted

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

- [ ] Start recording cria arquivo e registro
- [ ] Stop recording finaliza FFmpeg e atualiza registro
- [ ] Duração calculada corretamente
- [ ] Vinculação a álbum funciona
- [ ] Gravação órfã permitida
- [ ] Apenas uma gravação ativa por vez
- [ ] Eventos emitidos corretamente

## Referências

- [Tech Spec V3a](../../tech-spec-epic-v3a.md) - Seção Recording Manager, Workflows 1-2
