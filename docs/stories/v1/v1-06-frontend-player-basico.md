# Story V1.6: Frontend Player Básico (Baixa Latência)

**Epic:** V1 - Foundation Core (MVP)
**Status:** ready-for-dev

**User Story:**
Como usuário,
quero poder ouvir o stream de áudio através de um player web com latência mínima,
para que possa ter uma experiência próxima do tempo real ao ouvir meu toca-discos.

## Critérios de Aceitação

1. Componente Player criado com **Web Audio API** (não HTML5 Audio)
2. Play/Pause funcional
3. Volume local (não afeta source)
4. Indicador visual de streaming ativo
5. URL do stream: `http://localhost:8000/stream` (ou `pi.local` se configurado)
6. Tratamento de erros de conexão
7. **Latência end-to-end <500ms** (target: ~300ms)
8. Buffer configurável (100-500ms) com default de 200ms

## Pré-requisitos

- V1.5 - Pipeline FFmpeg → Icecast

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.5 (Interface Web - Player Principal)
- [Epics](../epics.md) - Epic V1

## Tasks/Subtasks

### Core Implementation
- [ ] **Task 1**: Criar componente AudioPlayer com Web Audio API
  - [ ] Criar hook customizado `useAudioStream()`
  - [ ] Implementar AudioContext setup
  - [ ] Implementar fetch() chunked streaming
  - [ ] Implementar decode e scheduling de audio buffers
  - [ ] Gerenciar estado: playing, buffering, error
- [ ] **Task 2**: Implementar controles do player
  - [ ] Botão Play/Pause com loading state
  - [ ] Slider de volume (GainNode)
  - [ ] Indicador visual de streaming ativo (animated)
  - [ ] Display de latência atual
- [ ] **Task 3**: Implementar tratamento de erros
  - [ ] Detecção de stream offline
  - [ ] Auto-reconexão com backoff exponencial
  - [ ] Mensagens de erro user-friendly
  - [ ] Fallback para HTML5 Audio se Web Audio não suportado
- [ ] **Task 4**: Otimização de latência
  - [ ] Buffer configurável (slider ou config)
  - [ ] Monitoramento de latência em tempo real
  - [ ] Ajuste dinâmico de buffer se necessário
- [ ] **Task 5**: Integração na UI existente
  - [ ] Adicionar Player na página principal (App.tsx ou nova rota)
  - [ ] Styling com Tailwind + shadcn/ui
  - [ ] Responsivo (mobile/tablet/desktop)
- [ ] **Task 6**: Testes e validação
  - [ ] Testar playback contínuo (10+ minutos)
  - [ ] Medir latência real (end-to-end)
  - [ ] Testar reconexão após stream stop/start
  - [ ] Validar em diferentes browsers (Chrome, Firefox, Safari)

## Dev Notes

### Arquitetura Web Audio API

**Por que Web Audio API em vez de HTML5 Audio?**
- HTML5 `<audio>` tem buffer adaptativo de 2-5s (não configurável)
- Web Audio API permite controle fino do buffer (~100-300ms possível)
- Compatível com streaming MP3 chunked

**Abordagem Técnica:**

```typescript
// Pseudocódigo da implementação

const audioContext = new AudioContext();
const gainNode = audioContext.createGain(); // Volume control
gainNode.connect(audioContext.destination);

// Fetch chunked stream
const response = await fetch('http://localhost:8000/stream');
const reader = response.body.getReader();

// Buffer queue para manter ~200ms de áudio
const bufferQueue = [];
let nextStartTime = audioContext.currentTime;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Decode MP3 chunk
  const audioBuffer = await audioContext.decodeAudioData(value.buffer);

  // Schedule playback
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(gainNode);
  source.start(nextStartTime);

  nextStartTime += audioBuffer.duration;
}
```

**Desafios:**
1. **MP3 decoding assíncrono**: `decodeAudioData()` pode adicionar latência
2. **Chunking**: Garantir que chunks são válidos (frame boundaries)
3. **Buffer underrun**: Se processamento for lento, pode ter gaps
4. **Browser support**: Safari tem limitações no Web Audio API

**Solução para Desafios:**
- Manter buffer queue pequeno mas suficiente (~200ms)
- Monitorar `audioContext.currentTime` vs `nextStartTime` para detectar underruns
- Pre-decode próximo chunk enquanto atual está tocando
- Fallback para HTML5 Audio se Web Audio falhar

### Latência Total Esperada

Com `burst-size=8192` (200ms) no Icecast:

| Etapa | Latência |
|-------|----------|
| ALSA buffer | 21ms |
| FFmpeg encoding | 50-70ms |
| Icecast burst | 200ms |
| Network (localhost) | <1ms |
| Web Audio decode | 10-30ms |
| Web Audio buffer | 100-200ms |
| **TOTAL** | **~380-520ms** |

Target: **<500ms** ✅

### Configuração Icecast Recomendada

Verificar que `/home/thiago/projects/vinyl-os/config/icecast.xml` tem:
```xml
<burst-size>8192</burst-size>  <!-- ~200ms @ 320kbps -->
```

Se ainda estiver em 65536, latência será ~1.6s maior.

## Dev Agent Record

### Context Reference
- [Story Context XML](v1-6-frontend-player-basico.context.xml) - Generated 2025-11-03

