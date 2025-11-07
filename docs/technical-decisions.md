# Vinyl-OS - Decisões Técnicas

**Autor:** Amelia (Developer Agent)  
**Última Atualização:** 2025-11-07

---

## Índice

1. [MP3 Bitrate e Codec](#mp3-bitrate-e-codec)
2. [Dual Streaming Architecture](#dual-streaming-architecture)
3. [RAW PCM vs MP3 no Frontend](#raw-pcm-vs-mp3-no-frontend)

---

## MP3 Bitrate e Codec

### Decisão: 128kbps com libmp3lame

**Data:** 2025-11-07  
**Contexto:** Story V1-05 e V1-06 (Pipeline FFmpeg → Icecast + Frontend Player)  
**Status:** ✅ Implementado e Validado

### Problema

Durante implementação do streaming MP3 para Icecast2, testamos diferentes configurações de bitrate e codecs:

1. **320kbps com libmp3lame:** Qualidade máxima, mas causou problemas no Raspberry Pi
   - Sintomas: Áudio distorcido/choppy
   - Causa provável: CPU do Pi não conseguia manter encoding em tempo real
   - Resultado: ❌ Rejeitado

2. **320kbps com libshine:** Encoder otimizado para ARM (fixed-point)
   - CPU reduzido ~30% vs libmp3lame
   - Qualidade inferior ao libmp3lame
   - Resultado: ⚠️ Parcialmente testado, mas não escolhido

3. **128kbps com libmp3lame:** Balanceamento entre qualidade e performance
   - CPU dentro dos limites do Raspberry Pi
   - Qualidade adequada para streaming doméstico
   - Áudio limpo sem distorção
   - Resultado: ✅ **ESCOLHIDO**

### Justificativa

**Por que 128kbps?**
- Qualidade mais que suficiente para streaming doméstico (vinyl já tem limitações analógicas)
- CPU do Raspberry Pi consegue manter encoding em tempo real sem problemas
- Bitrate compatível com a maioria dos players e integrações (TuneIn, etc.)
- Reduz uso de largura de banda (importante para acesso remoto)

**Por que libmp3lame em vez de libshine?**
- Melhor qualidade de encoding
- Mais maduro e estável
- Amplamente suportado
- Performance aceitável no Pi com 128kbps

### Configuração FFmpeg

```bash
ffmpeg -f s16le -ar 48000 -ac 2 -i /tmp/vinyl-audio.fifo \
  -c:a libmp3lame \
  -b:a 128k \
  -f mp3 \
  -content_type audio/mpeg \
  icecast://source:PASSWORD@localhost:8000/stream
```

### Testes de Validação

| Teste | Resultado |
|-------|-----------|
| Streaming contínuo 24h | ✅ Estável |
| CPU usage | ✅ ~35% de 1 core |
| Qualidade de áudio | ✅ Sem distorção |
| Latência end-to-end | ✅ ~150ms (PCM) + ~2-5s (MP3) |
| Múltiplos clientes | ✅ Até 20 simultâneos (configurado) |

### Alternativas Consideradas

**Se no futuro precisar de mais qualidade:**
- **Opção 1:** Usar 192kbps com libmp3lame (se Pi aguentar)
- **Opção 2:** Migrar para Raspberry Pi 4/5 (mais CPU) e voltar para 320kbps
- **Opção 3:** Usar libshine 256kbps (ARM-optimized, qualidade intermediária)

**Se precisar reduzir CPU:**
- **Opção 1:** Usar libshine 128kbps (economia ~30% CPU, perda de qualidade)
- **Opção 2:** Reduzir para 96kbps (ainda aceitável para vinyl)

### Referências

- Story: `docs/stories/v1/v1-05-pipeline-ffmpeg-icecast.md`
- Story: `docs/stories/v1/v1-06-frontend-player-basico.md`
- Arquitetura: `docs/dual-streaming-architecture.md`
- Commits: `40b9475` (redução para 128k), `9cb7862` (otimização 24/7)

---

## Dual Streaming Architecture

### Decisão: RAW PCM (frontend) + MP3 (Icecast2)

**Data:** 2025-11-04  
**Contexto:** Story V1-06 (Frontend Player) + adiantamento parcial de V3-02  
**Status:** ✅ Implementado e Validado

### Problema

Requisitos conflitantes:
1. **Frontend player:** Latência mínima (<500ms, ideal ~150ms)
2. **TuneIn/Compatibilidade:** Stream MP3 via Icecast2

### Solução

Implementamos **dual streaming** com Named Pipe (FIFO):

```
                    ┌──────────────┐
                    │  ALSA Input  │
                    │  plughw:1,0  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  FFmpeg #1   │
                    │ Dual Output  │
                    └──┬────────┬──┘
                       │        │
            stdout     │        │ FIFO
            (RAW PCM)  │        │ (RAW PCM)
                       │        │
             ┌─────────▼─┐   ┌─▼────────┐
             │  Express  │   │FFmpeg #2 │
             │Broadcaster│   │MP3 Encode│
             └─────┬─────┘   └────┬─────┘
                   │              │
            ┌──────▼──────┐  ┌────▼─────┐
            │   Frontend  │  │ Icecast2 │
            │  ~150ms     │  │  ~2-5s   │
            └─────────────┘  └──────────┘
```

### Características

**FFmpeg #1 (Producer):**
- Input: ALSA plughw:1,0 (48kHz stereo s16le)
- Output 1: stdout → Express (RAW PCM)
- Output 2: `/tmp/vinyl-audio.fifo` → FFmpeg #2 (RAW PCM)

**FFmpeg #2 (Consumer MP3):**
- Input: FIFO (RAW PCM)
- Encoding: libmp3lame 128kbps
- Output: Icecast2 via protocolo `icecast://`

**Named Pipe (FIFO):**
- Tipo: Unix FIFO
- Localização: `/tmp/vinyl-audio.fifo`
- Função: Comunicação inter-processo sem blocking
- Vantagem: Desconexão de consumidores não quebra o producer

### Benefícios

1. ✅ **Latência frontend:** ~150ms (target <500ms superado)
2. ✅ **Compatibilidade:** MP3 via Icecast2 para TuneIn/VLC/etc
3. ✅ **Múltiplos clientes:** PassThrough broadcaster suporta N conexões
4. ✅ **Isolamento:** Problemas no MP3 não afetam frontend
5. ✅ **Preparação V3:** Arquitetura pronta para adicionar recording path (FLAC)

### Impacto no Roadmap

Esta implementação **adianta ~80% do Story V3.2** (Dual-Path Architecture):
- ✅ Dual FFmpeg separados
- ✅ Named Pipe para comunicação
- ✅ Sincronização sample-accurate (mesmo ALSA input)
- ⏳ Falta: Buffer circular para pré-roll (30s)
- ⏳ Falta: Recording path (FLAC output)

**Quando implementar V3.2:**
- Adicionar terceiro output no FFmpeg #1: FLAC via FIFO
- Implementar buffer circular em memória
- FFmpeg #3 para consumir FIFO de recording

### Referências

- Arquitetura detalhada: `docs/dual-streaming-architecture.md` (1380 linhas)
- Troubleshooting: `docs/prob-dual-streaming.md`
- Story atual: `docs/stories/v1/v1-06-frontend-player-basico.md`
- Story futuro: `docs/stories/v3/v3-02-dual-path-architecture.md`

---

## RAW PCM vs MP3 no Frontend

### Decisão: RAW PCM (s16le) processado manualmente

**Data:** 2025-11-04  
**Contexto:** Story V1-06 (Frontend Player)  
**Status:** ✅ Implementado

### Problema

**Tentativa inicial:** Streaming MP3 chunked com Web Audio API

**Sintomas:**
- Buffer underruns frequentes
- Áudio choppy (picotado)
- Erro: `EncodingError: Unable to decode audio data`

**Causa Raiz:**
```javascript
// ❌ PROBLEMA: decodeAudioData() espera arquivo MP3 completo
audioContext.decodeAudioData(arrayBuffer)
```

A Web Audio API `decodeAudioData()` não consegue processar **chunks fragmentados de MP3** porque:
1. MP3 usa frames com headers que podem estar incompletos nos chunks
2. A API espera um arquivo MP3 válido e completo
3. Clientes conectando mid-stream não recebem o header inicial

### Solução

**RAW PCM (s16le) com construção manual de AudioBuffer:**

```typescript
// Processar chunk RAW PCM
const int16Data = new Int16Array(chunk.buffer);
const numSamples = Math.floor(int16Data.length / 2); // 2 channels

// Criar AudioBuffer
const audioBuffer = context.createBuffer(2, numSamples, 48000);

// Converter Int16 → Float32 e separar canais
const leftChannel = audioBuffer.getChannelData(0);
const rightChannel = audioBuffer.getChannelData(1);

for (let i = 0; i < numSamples; i++) {
  // Int16 range: -32768 to 32767 → Float32 range: -1.0 to 1.0
  leftChannel[i] = int16Data[i * 2] / 32768.0;
  rightChannel[i] = int16Data[i * 2 + 1] / 32768.0;
}
```

### Vantagens

1. ✅ **Sem buffer underruns:** Processamento determinístico
2. ✅ **Latência previsível:** ~150ms consistente
3. ✅ **Mid-stream connection:** Clientes podem conectar a qualquer momento
4. ✅ **Controle fino:** Buffer queue gerenciado manualmente
5. ✅ **Performance:** Conversão Int16→Float32 é rápida

### Desvantagens

1. ⚠️ **Largura de banda:** RAW PCM usa mais banda que MP3 (192KB/s vs 16KB/s)
2. ⚠️ **Complexidade:** Código mais complexo que HTML5 Audio

**Mitigação:** Aplicação é doméstica (rede local), largura de banda não é problema.

### Alternativas Consideradas

**Opção 1: WAV streaming**
- Resultado: Header no início, mesmo problema mid-stream

**Opção 2: MP3 parser (mp3-parser, codec-parser)**
- Resultado: Bibliotecas não suportam streaming ou muito complexas

**Opção 3: HTML5 Audio**
- Resultado: Buffer adaptativo 2-5s (não atende requisito <500ms)

### Formato RAW PCM

```
Format:        s16le (signed 16-bit little endian)
Sample Rate:   48000 Hz
Channels:      2 (stereo)
Bit Depth:     16 bits
Byte Rate:     192 KB/s (48000 * 2 * 16 / 8 / 1024)
Frame Size:    4 bytes (2 channels * 2 bytes/sample)
```

### Referências

- Hook: `frontend/src/hooks/useAudioStream.ts`
- Arquitetura: `docs/dual-streaming-architecture.md` (seção "Processamento de Áudio no Frontend")
- Story: `docs/stories/v1/v1-06-frontend-player-basico.md`

---

## Índice de Decisões por Story

| Story | Decisões Técnicas |
|-------|-------------------|
| V1-05 | MP3 Bitrate e Codec |
| V1-06 | Dual Streaming Architecture, RAW PCM vs MP3 |
| V3-02 | (Parcialmente adiantado em V1-06) |

---

**Última revisão:** 2025-11-07  
**Próxima revisão:** Quando implementar V3-02 (recording path)

