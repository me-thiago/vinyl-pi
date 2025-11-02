# Análise de Divisão de Versões - Vinyl-OS PRD

**Data:** 2025-01-27  
**Analista:** John (Product Manager)  
**Documento Base:** prd-v0.md

---

## Resumo Executivo

Após análise do PRD v0 e proposta de divisão, **recomendo 4 versões** com ajustes estratégicos para otimizar valor incremental, reduzir riscos e garantir base sólida.

### Mudanças Críticas Propostas:
1. **SQLite básico na V1** (mesmo sem reconhecimento musical)
2. **Gravação de sessões** move para V3 (depende de Dual-Path)
3. **V2 foca em gestão de coleção** antes de reconhecimento musical avançado
4. **Reconhecimento sonoro** na V1 é MVP mais inteligente que o original

---

## Versão 1: Foundation Core (MVP Estável)

### Objetivo
Sistema funcional de streaming com detecção de eventos básicos, sem reconhecimento musical ainda.

### Funcionalidades

#### ✅ Captura de Áudio
- ALSA via plughw (device configurável)
- 48kHz/16-bit/stereo
- Buffer configurável (512-2048 samples)
- **Monitoramento de clipping**

#### ✅ Streaming Engine  
- Icecast2 server
- FFmpeg encoder (MP3 320kbps CBR)
- Suporte a múltiplos clients (até 20)
- Fallback para silêncio quando sem input

#### ✅ Reconhecimento Sonoro (NÃO Musical)
**Novo escopo - foco em eventos físicos:**
- Detecção de silêncio (>10s = pause)
- Detecção de toca-discos rodando em vazio (ruído de fundo baixo)
- Detecção de troca de faixa (mudança abrupta de nível + silêncio curto)
- Detecção de início/fim de sessão
- **UI de diagnóstico:**
  - Indicador de nível de áudio (VU meter)
  - Thresholds ajustáveis (silence, clipping)
  - Log de eventos em tempo real
  - Parâmetros de detecção (sensibilidade, timeouts)

#### ✅ Interface Web (MVP)
- Player principal:
  - Play/Pause do stream
  - Volume local
  - Indicador visual de streaming ativo
  - Status do sistema (streaming on/off, sessão ativa)
- Dashboard básico:
  - Estado atual (sessão, eventos recentes)
  - Indicadores de áudio (nível, clipping)
- Configurações básicas:
  - Device de áudio (dropdown)
  - Thresholds de detecção de eventos
  - Tema claro/escuro

#### ✅ EventBus Core
- Sistema de eventos interno básico
- Eventos: `audio.start`, `audio.stop`, `silence.detected`, `session.started`, `session.ended`
- Padrão publish/subscribe simples
- **Não precisa plugins ainda** (V3+)

#### ✅ Persistência Básica (SQLite)
**Ajuste crítico:** Mesmo sem reconhecimento musical, precisamos salvar:
- `sessions` (id, started_at, ended_at, duration_seconds)
- `audio_events` (id, session_id, type, timestamp, metadata_json)
  - Tipos: `silence`, `clipping`, `track_change`, `session_start`, `session_end`
- `settings` (key, value, updated_at)

**Não precisa ainda:**
- Tabela `tracks` (V2)
- `recognition_cache` (V2)

### Critérios de Aceitação V1
- [ ] Stream funciona por 24h sem interrupção
- [ ] Detecção de eventos sonoros com >85% precisão em testes
- [ ] UI carrega em <2s na rede local
- [ ] Sessões são detectadas e salvas corretamente
- [ ] Interface de diagnóstico permite ajustar parâmetros e ver eventos em tempo real
- [ ] Install script funciona no Pi OS 64-bit limpo

### Riscos V1
- **Alto:** Detecção de troca de faixa pode ser difícil → Mitigação: UI para calibração manual, thresholds ajustáveis
- **Médio:** EventBus pode precisar refatoração → Mitigação: Design simples, extensível depois

---

## Versão 2: Gestão de Coleção + Reconhecimento Musical

### Objetivo  
Adicionar gestão da coleção física e reconhecimento musical com validação contra coleção.

### Funcionalidades

#### ✅ Gestão da Coleção de Discos
- CRUD de álbuns na coleção:
  - Título, artista, ano, label, formatos (LP, 7", 12")
  - Upload de capa (ou busca automática)
  - Tags/categorias
  - Estado físico (mint, VG+, etc.)
- Integração com Discogs API:
  - Busca por catálogo/barcode
  - Importação automática de metadados
  - Sincronização de capas
- UI de gestão:
  - Lista/grid de coleção
  - Busca e filtros
  - Estatísticas (total de discos, artistas, etc.)

#### ✅ Reconhecimento Musical
- Integração com AudD/ACRCloud
- **Validação contra coleção:**
  - Ao reconhecer, verifica se existe na coleção
  - Match por artista + álbum (fuzzy matching)
  - Confirmação manual se múltiplos matches
  - Evita chamar música certa do álbum errado
- Cache de reconhecimentos
- Fallback manual se não reconhecer

#### ✅ Gravação de Sessões (Metadados)
**Ajuste:** Apenas metadados, não gravação de áudio ainda (V3)
- Salvar tracks reconhecidos por sessão
- Histórico de escuta
- Estatísticas (mais ouvidos, etc.)

#### ✅ Persistência Expandida
- `albums` (id, title, artist, year, label, cover_url, discogs_id, ...)
- `tracks` (id, session_id, album_id, title, artist, confidence, recognized_at, ...)
- `recognition_cache` (hash, track_data, expires_at)
- Relacionamentos: tracks → albums (opcional, pode ser null)

#### ✅ UI Expandida
- Atualização do player:
  - Mostrar capa do álbum quando reconhecido
  - Metadados completos (artista, título, álbum)
  - Link para álbum na coleção
- Histórico de escuta:
  - Lista de sessões com tracks reconhecidos
  - Filtros e busca
- Integração com gestão de coleção:
  - Adicionar álbum direto do reconhecimento
  - "Adicionar à coleção" quando não existe

### Critérios de Aceitação V2
- [ ] Reconhecimento musical funciona com >80% de acurácia em coleção testada
- [ ] Validação contra coleção reduz falsos positivos em >50%
- [ ] Gestão de coleção suporta 500+ álbuns sem performance issues
- [ ] Integração Discogs importa metadados corretamente

### Riscos V2
- **Médio:** Fuzzy matching pode gerar matches incorretos → Mitigação: Thresholds ajustáveis, confirmação manual
- **Baixo:** Discogs API rate limits → Mitigação: Cache agressivo, importação em batch

---

## Versão 3: Dual-Path + Gravação + QA

### Objetivo
Adicionar gravação lossless, análise de qualidade e reconhecimento offline.

### Funcionalidades

#### ✅ Dual-Path Architecture (Finalizar)
- Stream path (atual) + Recording path (novo)
- Sincronização por sample counter
- Buffer circular de 30s para pré-roll
- Sem impacto no stream path

#### ✅ Gravação FLAC/Lossless
- Gravação automática por sessão
- Segmentação por silêncio/troca de faixa
- Metadata embedding (tags Vorbis)
- Sidecar JSON com offsets e eventos
- Opção de gravação manual
- **Pré-roll:** Capturar 5-10s antes do comando

#### ✅ Chromaprint + Reconhecimento Offline
- Chromaprint local do disco completo
- Linkar com DB (associar fingerprint a álbum na coleção)
- Reconhecimento offline usando fingerprints locais
- Cache de fingerprints por álbum
- Fallback para cloud quando não encontrado localmente

#### ✅ Quality Analysis (QA)
- Análise de qualidade do vinil:
  - SNR (Signal-to-Noise Ratio)
  - Wow/flutter detection
  - Clicks/pops counting
  - Desgaste de alta frequência
- Health Score 0-100
- Relatórios por álbum/lado
- Comparação entre prensagens (futuro)

### Critérios de Aceitação V3
- [ ] Dual-path não degrada performance do streaming
- [ ] Gravação FLAC mantém sincronização precisa com eventos
- [ ] Chromaprint reconhece >70% dos álbuns da coleção offline
- [ ] QA detecta problemas comuns (cracks, wear) com >75% precisão

### Riscos V3
- **Alto:** Dual-path pode causar problemas de sincronização → Mitigação: Testes extensivos, buffer robusto
- **Médio:** Chromaprint pode ser lento → Mitigação: Processamento assíncrono, cache agressivo

---

## Versão 4: Integração Final + Admin Avançado

### Objetivo
Polimento final, controles avançados e otimizações.

### Funcionalidades

#### ✅ Integração Final de UI
- UX refinado baseado em feedback
- Mobile-responsive completo
- Performance otimizada
- Acessibilidade (WCAG básico)

#### ✅ Advanced Admin Controls
- Configurações avançadas:
  - Ajuste fino de codec/bitrate
  - Configuração de múltiplos dispositivos
  - Backup/restore completo
  - Logs avançados e debugging
- Monitoramento:
  - Dashboard de métricas detalhadas
  - Alertas configuraveis
  - Export de relatórios
- Integrações opcionais:
  - Last.fm scrobbling
  - MQTT para home automation
  - Webhooks customizados

### Critérios de Aceitação V4
- [ ] UI funciona perfeitamente em mobile
- [ ] Admin controls permitem configuração avançada sem editar arquivos
- [ ] Integrações funcionam estáveis por 30+ dias

---

## Comparação: Proposta Original vs Recomendada

| Aspecto | Sua Proposta | Recomendação | Motivo |
|---------|--------------|--------------|---------|
| **SQLite V1** | ❌ Não mencionado | ✅ Básico | Precisamos salvar eventos e sessões mesmo sem reconhecimento musical |
| **Gravação V2** | ✅ Metadados + Áudio | ⚠️ Apenas Metadados V2, Áudio V3 | Gravação de áudio depende de Dual-Path (V3) |
| **EventBus V1** | ✅ Core criado | ✅ Core básico | OK, mas manter simples, extensão V3 |
| **Reconhecimento Sonoro V1** | ✅ Excelente ideia | ✅ Mantido | Reduz risco, valida eventos antes de musical |
| **V4 Admin Controls** | ✅ Vago | ✅ Detalhado | Define escopo claro para polimento final |

---

## Recomendações Finais

### ✅ Aprovado para Implementação
1. Divisão em 4 versões faz sentido estratégico
2. Reconhecimento sonoro na V1 é abordagem mais inteligente
3. V2 focada em coleção antes de reconhecimento offline

### ⚠️ Ajustes Necessários
1. **Adicionar SQLite básico na V1** - necessário para eventos e sessões
2. **Gravação de áudio move para V3** - depende de Dual-Path Architecture
3. **"Gravar sessões V2"** = apenas metadados, não áudio ainda

### 📋 Próximos Passos Sugeridos
1. Refinar especificação técnica do "Reconhecimento Sonoro" na V1
2. Definir schema SQLite detalhado para cada versão
3. Criar mockups da UI de diagnóstico para V1
4. Validar complexidade da detecção de troca de faixa (pode ser mais difícil que esperado)

---

## Questões para Discussão

1. **Detecção de troca de faixa:** Qual nível de precisão é aceitável na V1? Se for <80%, devemos deixar para V2?
2. **EventBus V1:** Precisa ser extensível desde o início ou podemos fazer refactor na V3?
3. **Discogs na V2:** Requer API key? Isso aumenta complexidade de setup?
4. **Chromaprint V3:** Precisamos de MusicBrainz mirror ou apenas fingerprints locais da coleção?

---

**Status:** ⚠️ **Requer Ajustes** - Fundamentos sólidos, mas precisam refinamento em persistência V1 e gravação de áudio.

