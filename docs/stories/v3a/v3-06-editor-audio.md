# Story V3-06: Editor de Áudio

**Epic:** V3a - Gravação & Fundação
**Status:** done

**User Story:**
Como usuário,
quero editar minhas gravações com trim e marcação de faixas,
para que eu possa preparar o áudio para reconhecimento offline (V3b).

## Critérios de Aceitação

### Página do Editor (/recordings/:id/edit)

1. Rota `/recordings/:id/edit` criada
2. Carrega dados da gravação e waveform
3. Exibe informações básicas (nome, duração, álbum vinculado)

### Visualização Waveform

4. Waveform renderizado usando wavesurfer.js
5. Zoom in/out funcional
6. Scroll horizontal para arquivos longos
7. Cursor de posição atual
8. Playback do áudio sincronizado com waveform

### Controles de Playback

9. Play/Pause
10. Stop (volta ao início)
11. Seek (click na waveform)
12. Volume
13. Indicador de tempo atual / duração total

### Trim

14. Handles visuais para início e fim do trim
15. Preview do segmento selecionado
16. Botão "Aplicar Trim" executa o corte
17. Confirmação antes de aplicar (operação destrutiva)
18. Após trim, waveform recarrega com nova duração

### Marcadores de Faixa

19. Criar marcador: click no ponto + botão "Adicionar Marcador"
20. Marcadores visuais na waveform (linhas verticais)
21. Cada marcador tem:
    - Número da faixa (auto-incremento)
    - Título (opcional, editável)
    - Offset de início
    - Offset de fim (início do próximo ou fim do arquivo)
22. Arrastar marcador para reposicionar
23. Deletar marcador (ícone X)
24. Lista de marcadores lateral com edição inline

### API de Edição

```typescript
// POST /api/recordings/:id/trim
Body: { startOffset: number; endOffset: number; }
Response: { data: Recording; previousDuration: number; }

// GET /api/recordings/:id/waveform
Query: { resolution?: number }  // pontos por segundo
Response: { data: { peaks: number[]; duration: number; sampleRate: number; } }

// GET /api/recordings/:id/stream
Response: audio/flac (streaming para playback)

// CRUD de Markers (existente de V3-01)
GET    /api/recordings/:id/markers
POST   /api/recordings/:id/markers
PUT    /api/recordings/:id/markers/:markerId
DELETE /api/recordings/:id/markers/:markerId
```

## Dependência Frontend

```json
{
  "dependencies": {
    "wavesurfer.js": "^7.x"
  }
}
```

## Componentes

```
frontend/src/
├── pages/
│   └── RecordingEditor.tsx       # Página principal
├── components/
│   └── Editor/
│       ├── WaveformEditor.tsx    # Wrapper wavesurfer.js
│       ├── PlaybackControls.tsx  # Play, pause, seek
│       ├── TrimControls.tsx      # Handles + botão aplicar
│       ├── MarkerList.tsx        # Lista lateral de marcadores
│       └── MarkerLine.tsx        # Linha visual na waveform
└── hooks/
    └── useWaveform.ts            # Integração wavesurfer.js
```

## Backend: FLAC Editor Utility

```typescript
// backend/src/utils/flac-editor.ts

interface FlacEditor {
  trim(input: string, output: string, start: number, end: number): Promise<void>;
  getDuration(filePath: string): Promise<number>;
  generateWaveformData(filePath: string, resolution: number): Promise<WaveformData>;
}
```

**FFmpeg para trim:**
```bash
ffmpeg -i input.flac -ss 10.5 -to 180.0 -c:a flac -y output.flac
```

**FFmpeg para waveform data:**
```bash
ffmpeg -i input.flac -af "aresample=8000,asetnsamples=n=800" -f f32le -
```

## Pré-requisitos

- V3-03 - Gravação FLAC Manual (arquivos FLAC existem)
- V3-04 - UI Gravações (navegação para editor)

## Notas de Implementação

### wavesurfer.js Setup

```typescript
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#4F46E5',
  progressColor: '#818CF8',
  plugins: [RegionsPlugin.create()],
});

wavesurfer.load('/api/recordings/:id/stream');
```

### Ajuste de Marcadores após Trim

Quando trim é aplicado com `startOffset`:
1. Subtrair `startOffset` de todos os marcadores
2. Remover marcadores que ficam fora do novo range
3. Atualizar no banco de dados

### Cache de Waveform

- Gerar waveform data uma vez e cachear
- Invalidar cache quando trim é aplicado
- Considerar salvar em arquivo JSON ao lado do FLAC

## Testes

- [ ] Waveform renderiza corretamente
- [ ] Playback funciona sincronizado
- [ ] Zoom e scroll funcionam
- [ ] Trim aplica corretamente
- [ ] Marcadores são salvos no banco
- [ ] Arrastar marcador atualiza offset
- [ ] Deletar marcador funciona
- [ ] Marcadores ajustados após trim

## Referências

- [Tech Spec V3a](../../tech-spec-epic-v3a.md) - Seção Editor, Workflow 3-4
- [wavesurfer.js Docs](https://wavesurfer.xyz/)
