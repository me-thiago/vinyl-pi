# Vinyl-OS - Epic Breakdown

**Author:** Thiago
**Date:** 2025-11-02
**Project Level:** 3
**Target Scale:** Single-user Raspberry Pi deployment

---

## Overview

Este documento fornece o breakdown detalhado de épicos para Vinyl-OS, expandindo o roadmap de alto nível no [PRD](./prd-v3.md).

Cada épico inclui:

- Objetivo expandido e proposta de valor
- Breakdown completo de histórias com user stories
- Critérios de aceitação para cada história
- Sequenciamento de histórias e dependências

**Princípios de Sequenciamento de Épicos:**

- Epic V1 estabelece infraestrutura fundacional e funcionalidade inicial
- Épicos subsequentes constroem progressivamente, cada um entregando valor end-to-end significativo
- Histórias dentro de épicos são verticalmente fatiadas e sequencialmente ordenadas
- Sem dependências futuras - cada história constrói apenas sobre trabalho anterior

---

## Epic V1 - Foundation Core (MVP)

**Objetivo:** Estabelecer funcionalidade MVP com streaming estável, detecção de eventos sonoros básicos, e interface web minimalista.

**Valor:** Sistema funcional que permite streaming de áudio do toca-discos para casa, com detecção de eventos básicos (silêncio, sessões, troca de faixa) e interface web para monitoramento.

**Dependências:** Nenhuma (épico fundacional)

**Duração Estimada:** 8-10 semanas (8 sprints)

---

### Story V1.1: Setup Inicial do Projeto

**Como** desenvolvedor,  
**quero** ter a estrutura base do projeto configurada com dependências e ferramentas necessárias,  
**para que** possa começar a implementação das funcionalidades principais.

**Critérios de Aceitação:**
1. Estrutura de diretórios criada conforme arquitetura (backend/, frontend/, config/, data/, scripts/)
2. Backend inicializado com Express, TypeScript, Prisma configurados
3. Frontend inicializado com React, Vite, TypeScript configurados
4. Package.json root com scripts de conveniência (dev, build, start)
5. .gitignore configurado apropriadamente
6. README.md básico criado

**Pré-requisitos:** Nenhum

---

### Story V1.2: Configuração Prisma e Database

**Como** desenvolvedor,  
**quero** ter o banco de dados SQLite configurado com Prisma e schema V1 inicial,  
**para que** possa persistir dados de sessões e eventos.

**Critérios de Aceitação:**
1. Prisma schema criado com modelos Session, AudioEvent, Setting
2. Migration inicial criada e aplicada
3. Prisma Client gerado e configurado
4. Database SQLite criado em `data/vinyl-os.db`
5. Scripts de backup documentados

**Pré-requisitos:** V1.1

---

### Story V1.3: Configuração Icecast2

**Como** desenvolvedor,  
**quero** ter Icecast2 configurado e pronto para receber streams,  
**para que** possa fazer streaming de áudio.

**Critérios de Aceitação:**
1. Icecast2 instalado (ou instruções de instalação documentadas)
2. Arquivo `config/icecast.xml` configurado com mount point `/stream`
3. Senhas configuradas (source password)
4. Serviço Icecast2 iniciado e acessível na porta 8000
5. Teste manual de conexão bem-sucedido

**Pré-requisitos:** V1.1

---

### Story V1.4: Captura de Áudio ALSA via FFmpeg

**Como** usuário,  
**quero** que o sistema capture áudio do dispositivo ALSA configurado,  
**para que** possa processar e fazer streaming do áudio do toca-discos.

**Critérios de Aceitação:**
1. Serviço `audio-manager.ts` criado com captura ALSA via FFmpeg
2. Device de áudio configurável (default: `plughw:1,0`)
3. Formato: 48kHz/16-bit/stereo (configurável)
4. Buffer size configurável (512-2048 samples)
5. Detecção de dispositivo desconectado com tratamento de erro
6. Logging adequado de status de captura

**Pré-requisitos:** V1.2, V1.3

---

### Story V1.5: Pipeline FFmpeg → Icecast (Streaming Engine)

**Como** usuário,  
**quero** que o áudio capturado seja codificado e enviado para Icecast2,  
**para que** possa ouvir o stream em qualquer dispositivo na rede local.

**Critérios de Aceitação:**
1. FFmpeg processa captura ALSA e codifica para MP3 320kbps CBR
2. Stream enviado para Icecast2 mount point `/stream` via HTTP POST
3. Fallback: loop de silêncio quando sem input
4. Suporte a até 20 clientes simultâneos
5. Buffer do servidor: 64KB (latência vs estabilidade)
6. Status de streaming disponível via API (`GET /api/status`)

**Pré-requisitos:** V1.4

---

### Story V1.6: Frontend Player Básico (Baixa Latência)

**Como** usuário,  
**quero** poder ouvir o stream de áudio através de um player web com latência mínima,  
**para que** possa ter uma experiência próxima do tempo real ao ouvir meu toca-discos.

**Critérios de Aceitação:**
1. Componente Player criado com **Web Audio API** (não HTML5 Audio)
2. Play/Pause funcional
3. Volume local (não afeta source)
4. Indicador visual de streaming ativo
5. URL do stream: `http://localhost:3001/stream.wav` (RAW PCM dual-path)
6. Tratamento de erros de conexão com auto-reconexão
7. **Latência end-to-end <500ms** (target: ~150ms alcançado)
8. Buffer configurável (100-500ms) com default de 200ms
9. Monitoramento de latência em tempo real

**Pré-requisitos:** V1.5

**Status:** ✅ **DONE** (2025-11-07)  
**Notas de Implementação:**
- Latência real alcançada: ~150ms (target superado)
- Tecnologia: Web Audio API com processamento manual de RAW PCM
- Dual streaming implementado: PCM (frontend) + MP3 128k (Icecast2)
- Bitrate otimizado para Raspberry Pi: 128kbps com libmp3lame

---

### Story V1.7: EventBus Core

**Como** desenvolvedor,  
**quero** ter um sistema de eventos pub/sub interno,  
**para que** componentes possam comunicar eventos de forma desacoplada.

**Critérios de Aceitação:**
1. Utilitário `event-bus.ts` criado com padrão publish/subscribe
2. Eventos suportados: `audio.start`, `audio.stop`, `silence.detected`, `silence.ended`, `turntable.idle`, `turntable.active`, `track.change.detected`, `session.started`, `session.ended`, `clipping.detected`
3. Múltiplos listeners por evento
4. Payload serializável (objeto plano)
5. Handlers async que não lançam exceções não tratadas

**Pré-requisitos:** V1.4

---

### Story V1.8: Detecção de Silêncio

**Como** usuário,  
**quero** que o sistema detecte quando não há áudio (silêncio),  
**para que** possa identificar quando o toca-discos está parado.

**Critérios de Aceitação:**
1. Serviço `event-detector.ts` analisa nível de áudio em tempo real
2. Threshold configurável (default: -50dB)
3. Duração configurável (default: 10s)
4. Evento `silence.detected` emitido via EventBus quando detectado
5. Evento `silence.ended` emitido quando áudio retorna
6. Status disponível via API

**Pré-requisitos:** V1.7

---

### Story V1.9: Detecção de Clipping

**Como** usuário,  
**quero** ser alertado quando o áudio está saturado (clipping),  
**para que** possa ajustar o volume de entrada.

**Critérios de Aceitação:**
1. Detecção de clipping quando nível > threshold (default: -1dB)
2. Evento `clipping.detected` emitido via EventBus
3. Metadata inclui timestamp e nível de áudio
4. Contador de eventos de clipping disponível

**Pré-requisitos:** V1.8

---

### Story V1.10: Persistência de Eventos

**Como** usuário,  
**quero** que todos os eventos detectados sejam salvos no banco de dados,  
**para que** possa consultar histórico posteriormente.

**Critérios de Aceitação:**
1. Eventos salvos na tabela `audio_events` via Prisma
2. Relacionamento com sessões (session_id quando aplicável)
3. Metadata armazenada como JSON
4. Índices criados para queries eficientes
5. API endpoint `GET /api/events` funcional

**Pré-requisitos:** V1.9, V1.2

---

### Story V1.11: Detecção de Sessão (Start/End)

**Como** usuário,  
**quero** que o sistema detecte quando começo e termino uma sessão de escuta,  
**para que** possa ter histórico organizado por sessões.

**Critérios de Aceitação:**
1. Sessão inicia: primeira detecção de áudio após período idle
2. Sessão termina: silêncio prolongado (30min configurável)
3. Eventos `session.started` e `session.ended` emitidos via EventBus
4. Sessão salva na tabela `sessions` via Prisma
5. Contador de eventos por sessão atualizado
6. API endpoint `GET /api/sessions` funcional

**Pré-requisitos:** V1.10

---

### Story V1.12: Detecção de Troca de Faixa

**Como** usuário,  
**quero** que o sistema detecte quando uma faixa termina e outra começa,  
**para que** possa ter eventos marcando trocas de faixa.

**Critérios de Aceitação:**
1. Detecção baseada em mudança abrupta de nível + silêncio curto
2. Thresholds ajustáveis (nível, duração do silêncio)
3. Evento `track.change.detected` emitido via EventBus
4. Precisão inicial pode ser <80% (aceitável)
5. Metadata inclui timestamp da detecção

**Pré-requisitos:** V1.9

**Nota:** Calibração manual via UI será adicionada em V1.15

---

### Story V1.13: Dashboard Básico

**Como** usuário,  
**quero** ver o estado atual do sistema em um dashboard,  
**para que** possa monitorar status de streaming e sessão ativa.

**Critérios de Aceitação:**
1. Página Dashboard criada com React
2. Exibe estado atual: streaming on/off, sessão ativa, última atividade
3. Últimos eventos detectados (lista simplificada, últimos 10)
4. Quick stats: duração da sessão atual
5. Layout responsivo básico

**Pré-requisitos:** V1.6, V1.11

---

### Story V1.14: WebSocket Real-Time Updates

**Como** usuário,  
**quero** receber atualizações em tempo real sobre eventos e status,  
**para que** a interface seja sempre atualizada sem refresh.

**Critérios de Aceitação:**
1. Socket.io configurado no backend e frontend
2. Cliente pode subscrever canais: `status`, `events`, `session`
3. Status update a cada 5s: streaming, listeners, sessão ativa, nível de áudio
4. Eventos emitidos em tempo real quando detectados
5. Reconexão automática em caso de desconexão

**Pré-requisitos:** V1.13

---

### Story V1.15: UI de Diagnóstico (VU Meter e Thresholds)

**Como** usuário,  
**quero** poder ver o nível de áudio em tempo real e ajustar thresholds de detecção,  
**para que** possa calibrar o sistema para meu toca-discos específico.

**Critérios de Aceitação:**
1. Página Diagnostics criada
2. VU meter em tempo real mostrando nível de áudio (dB)
3. Configuração de thresholds:
   - Silence threshold (dB)
   - Silence duration (segundos)
   - Track change sensitivity (0-1)
   - Session timeout (minutos)
4. Botões de teste manual (trigger de eventos para teste)
5. Mudanças salvas via API e aplicadas imediatamente

**Pré-requisitos:** V1.14

---

### Story V1.16: Log de Eventos na UI

**Como** usuário,  
**quero** ver um log scrollable dos últimos eventos detectados,  
**para que** possa acompanhar o que o sistema está detectando.

**Critérios de Aceitação:**
1. Seção de log de eventos na página Diagnostics
2. Lista scrollable mostrando últimos 100 eventos
3. Cada evento mostra: tipo, timestamp, metadata (quando aplicável)
4. Cores diferentes por tipo de evento
5. Auto-scroll para eventos mais recentes (opcional)

**Pré-requisitos:** V1.15

---

### Story V1.17: Histórico de Sessões

**Como** usuário,  
**quero** ver uma lista de todas as sessões de escuta anteriores,  
**para que** possa revisar meu histórico de uso.

**Critérios de Aceitação:**
1. Página Sessions criada
2. Lista de sessões com: início, fim, duração, contador de eventos
3. Filtros por data (date_from, date_to)
4. Paginação (limit/offset)
5. Link para detalhes de sessão (mostrar eventos da sessão)

**Pré-requisitos:** V1.14

---

### Story V1.18: Configurações Básicas

**Como** usuário,  
**quero** poder configurar o dispositivo de áudio e outras opções básicas,  
**para que** o sistema funcione com meu hardware específico.

**Critérios de Aceitação:**
1. Página Settings criada
2. Dropdown de dispositivos de áudio detectados
3. Configuração de thresholds (já disponível em Diagnostics, mas também aqui)
4. Tema claro/escuro (toggle)
5. Mudanças salvas via API `PUT /api/settings`
6. Configurações persistidas na tabela `settings`

**Pré-requisitos:** V1.17

---

### Story V1.19: Error Handling Robusto

**Como** desenvolvedor,  
**quero** ter tratamento de erros robusto em toda a aplicação,  
**para que** o sistema seja estável e forneça feedback útil em caso de problemas.

**Critérios de Aceitação:**
1. Middleware de error handling global no Express
2. Try-catch em todas operações async
3. Logging de erros via Winston
4. Respostas HTTP apropriadas (400, 404, 500)
5. Mensagens de erro user-friendly em português BR
6. Error boundaries no React para erros de UI

**Pré-requisitos:** V1.18

---

### Story V1.20: PM2 Config e Auto-Start

**Como** usuário,  
**quero** que o sistema inicie automaticamente após reboot,  
**para que** funcione sem intervenção manual.

**Critérios de Aceitação:**
1. Arquivo `ecosystem.config.js` criado para PM2
2. Script de start configurado
3. Auto-restart habilitado
4. Logs configurados (app.log, error.log)
5. Comando `pm2 startup` executado e configurado
6. Documentação de como iniciar/parar serviço

**Pré-requisitos:** V1.19

---

### Story V1.21: Install Script Completo

**Como** usuário,  
**quero** ter um script de instalação que configure tudo automaticamente,  
**para que** o setup seja simples e reproduzível.

**Critérios de Aceitação:**
1. Script `scripts/install.sh` criado
2. Instala dependências do sistema (Node.js, FFmpeg, Icecast2, etc.)
3. Instala dependências do projeto (npm install)
4. Configura Prisma e database
5. Configura Icecast2
6. Setup inicial de PM2
7. Testes básicos de funcionamento
8. Documentação do processo de instalação

**Pré-requisitos:** V1.20

---

### Story V1.22: Documentação Básica

**Como** usuário,  
**quero** ter documentação suficiente para usar o sistema,  
**para que** possa configurar e operar sem ajuda externa.

**Critérios de Aceitação:**
1. README.md atualizado com:
   - Visão geral do projeto
   - Requisitos de hardware
   - Instruções de instalação
   - Como usar (player, dashboard, diagnóstico)
   - Troubleshooting comum
2. Documentação inline no código (JSDoc/TSDoc)
3. Comentários em configurações importantes

**Pré-requisitos:** V1.21

---

## Epic V2 - Coleção & Reconhecimento Musical

**Objetivo:** Adicionar gestão completa de coleção física de discos e reconhecimento musical com validação contra a coleção.

**Valor:** Usuários podem gerenciar sua coleção de discos físicos, reconhecer músicas que estão tocando, e validar reconhecimentos contra sua coleção para reduzir erros.

**Dependências:** V1 completo e estável

**Duração Estimada:** 8-10 semanas (8 sprints)

---

### Story V2.1: Schema de Dados V2 (Albums e Tracks)

**Como** desenvolvedor,  
**quero** ter as tabelas de álbuns e tracks no banco de dados,  
**para que** possa persistir dados da coleção e reconhecimentos.

**Critérios de Aceitação:**
1. Migration V1→V2 criada adicionando tabelas: `albums`, `tracks`, `recognition_cache`
2. Relacionamentos definidos: Album 1:N Track, Session 1:N Track, Track N:1 Album (opcional)
3. Índices criados para queries eficientes
4. Migration aplicada e testada
5. Schema Prisma atualizado

**Pré-requisitos:** V1 completo

---

### Story V2.2: CRUD de Álbuns (Backend)

**Como** usuário,  
**quero** poder adicionar, editar e remover álbuns da minha coleção,  
**para que** possa gerenciar minha coleção física.

**Critérios de Aceitação:**
1. API endpoints criados: `GET /api/albums`, `POST /api/albums`, `GET /api/albums/:id`, `PUT /api/albums/:id`, `DELETE /api/albums/:id`
2. Campos suportados: título, artista, ano, label, formato (LP, 7", 12"), coverUrl, discogsId, condition, tags, notes
3. Validação de campos obrigatórios (título, artista)
4. Busca e filtros funcionais (search, filter por artista/ano/label)
5. Paginação implementada

**Pré-requisitos:** V2.1

---

### Story V2.3: UI de Gestão de Coleção

**Como** usuário,  
**quero** uma interface para gerenciar minha coleção de discos,  
**para que** possa adicionar e organizar meus álbuns facilmente.

**Critérios de Aceitação:**
1. Página Collection criada
2. Lista/grid de álbuns com capas
3. Formulário para adicionar/editar álbum
4. Upload de capa ou URL de imagem
5. Busca e filtros na UI
6. Ações: adicionar, editar, remover

**Pré-requisitos:** V2.2

---

### Story V2.4: Integração Discogs (Busca e Importação)

**Como** usuário,  
**quero** poder buscar álbuns no Discogs e importar metadados automaticamente,  
**para que** não precise digitar todas as informações manualmente.

**Critérios de Aceitação:**
1. Service `discogs.ts` criado com cliente da API Discogs
2. Endpoint `POST /api/albums/import-discogs` funcional
3. Busca por catálogo/barcode
4. Importação de metadados: título, artista, ano, label, formato, capa
5. Tratamento de rate limits da API
6. Cache local de dados importados

**Pré-requisitos:** V2.3

---

### Story V2.5: Integração AudD/ACRCloud (Reconhecimento Musical)

**Como** usuário,  
**quero** que o sistema reconheça qual música está tocando,  
**para que** possa saber automaticamente o que está escutando.

**Critérios de Aceitação:**
1. Service `recognition.ts` criado
2. Integração com ACRCloud API
3. Fallback para AudD API se ACRCloud falhar
4. Captura de 5-10s do stream (FFmpeg → WAV)
5. Envio para API de reconhecimento
6. Parse de resposta e extração de metadados
7. Cache de reconhecimentos (30 min TTL)

**Pré-requisitos:** V1.5 (streaming funcionando)

---

### Story V2.6: Validação Contra Coleção (Fuzzy Matching)

**Como** usuário,  
**quero** que reconhecimentos sejam validados contra minha coleção,  
**para que** erros sejam reduzidos e reconhecimentos sejam vinculados aos meus álbuns.

**Critérios de Aceitação:**
1. Após reconhecimento, busca automática na coleção
2. Fuzzy matching por artista + álbum (algoritmo Levenshtein)
3. Threshold de confiança configurável
4. Se múltiplos matches: retorno com flag `needs_confirmation`
5. Se nenhum match: opção para adicionar à coleção
6. Match de album vinculado ao track reconhecido

**Pré-requisitos:** V2.5, V2.2

---

### Story V2.7: UI de Matching/Confirmação

**Como** usuário,  
**quero** poder confirmar ou corrigir matches de reconhecimento contra minha coleção,  
**para que** dados estejam sempre corretos.

**Critérios de Aceitação:**
1. Quando reconhecimento tem match, UI mostra opções de confirmação
2. Lista de matches possíveis (se múltiplos)
3. Botão "Confirmar match"
4. Botão "Adicionar à coleção" se nenhum match
5. Notificação toast quando reconhecimento acontece

**Pré-requisitos:** V2.6

---

### Story V2.8: Link Reconhecimento → Coleção no Player

**Como** usuário,  
**quero** ver a capa do álbum e metadados completos quando uma música é reconhecida,  
**para que** tenha uma experiência visual rica.

**Critérios de Aceitação:**
1. Player atualizado para mostrar capa do álbum quando reconhecido
2. Metadados completos: artista, título, álbum, ano
3. Link para álbum na coleção (se encontrado)
4. Botão "Adicionar à coleção" se não encontrado
5. WebSocket event `track_recognized` atualiza player em tempo real

**Pré-requisitos:** V2.7, V1.6

---

### Story V2.9: Histórico de Escuta Expandido

**Como** usuário,  
**quero** ver histórico completo de escuta com tracks reconhecidos,  
**para que** possa revisar o que escutei.

**Critérios de Aceitação:**
1. Página Sessions expandida para mostrar tracks reconhecidos por sessão
2. Visualização de sessão mostra lista de tracks com capas
3. Link de track para álbum na coleção (se vinculado)
4. Filtros e busca avançada
5. Estatísticas básicas: total de tracks, álbuns únicos

**Pré-requisitos:** V2.8

---

### Story V2.10: Estatísticas da Coleção

**Como** usuário,  
**quero** ver estatísticas sobre minha coleção,  
**para que** possa entender melhor minha coleção.

**Critérios de Aceitação:**
1. Seção de estatísticas na página Collection
2. Total de álbuns
3. Total de artistas únicos
4. Distribuição por ano (gráfico)
5. Distribuição por formato (LP, 7", 12")
6. Álbuns mais tocados (se houver histórico)

**Pré-requisitos:** V2.9

---

### Story V2.11: Export de Dados

**Como** usuário,  
**quero** poder exportar meus dados (coleção, histórico),  
**para que** tenha backup dos meus dados.

**Critérios de Aceitação:**
1. Endpoint `GET /api/export/collection` (CSV/JSON)
2. Endpoint `GET /api/export/history` (CSV/JSON)
3. Botões de export na UI
4. Download de arquivos formatados

**Pré-requisitos:** V2.10

---

### Story V2.12: Background Recognition Worker (Opcional)

**Como** usuário,  
**quero** que reconhecimentos sejam processados em background,  
**para que** a UI não trave durante reconhecimento.

**Critérios de Aceitação:**
1. Worker `recognition-worker.ts` usando Bull Queue (SQLite adapter)
2. Jobs de reconhecimento processados assincronamente
3. Status de job disponível via API
4. UI mostra status "Reconhecendo..." durante processamento

**Pré-requisitos:** V2.5

**Nota:** Opcional para V2, pode ser adiado se performance for aceitável

---

## Epic V3 - Gravação & Análise

**Objetivo:** Implementar gravação FLAC lossless paralela, chromaprint local para reconhecimento offline, e análise de qualidade (QA).

**Valor:** Usuários podem gravar sessões em qualidade máxima, reconhecer álbuns offline, e analisar qualidade de gravações para identificar problemas.

**Dependências:** V2 completo

**Duração Estimada:** 12-14 semanas (14 sprints)

---

### Story V3.1: Schema de Dados V3 (Recordings, Chromaprints, QA Reports)

**Como** desenvolvedor,  
**quero** ter as tabelas para gravações, chromaprints e relatórios de QA,  
**para que** possa persistir dados de gravações e análises.

**Critérios de Aceitação:**
1. Migration V2→V3 criada adicionando tabelas: `recordings`, `chromaprints`, `qa_reports`
2. Relacionamentos definidos
3. Índices criados
4. Migration aplicada

**Pré-requisitos:** V2 completo

---

### Story V3.2: Dual-Path Architecture - Recording Path

**Como** desenvolvedor,  
**quero** ter um segundo processo FFmpeg para gravação paralela,  
**para que** possa gravar sem degradar o streaming.

**Critérios de Aceitação:**
1. Recording path paralelo implementado em `recording.ts`
2. Dois processos FFmpeg separados (stream path + recording path)
3. Buffer circular compartilhado para sincronização
4. Sincronização sample-accurate entre paths
5. Pré-roll de 30s via buffer circular
6. Overhead <5% no stream path (validado com testes)

**Pré-requisitos:** V3.1, V1.5

---

### Story V3.3: Gravação FLAC Automática por Sessão

**Como** usuário,  
**quero** que sessões sejam gravadas automaticamente em FLAC,  
**para que** tenha backup lossless de tudo que escuto.

**Critérios de Aceitação:**
1. Gravação automática inicia com sessão
2. Formato FLAC 48kHz/16-bit ou 44.1kHz/16-bit
3. Arquivo salvo em `data/recordings/` com nome único
4. Metadata embedding (tags Vorbis) com informações da sessão
5. Gravação para quando sessão termina
6. Sidecar JSON com offsets e eventos

**Pré-requisitos:** V3.2

---

### Story V3.4: Segmentação Automática por Eventos

**Como** usuário,  
**quero** que gravações sejam segmentadas automaticamente por eventos (silêncio/troca de faixa),  
**para que** tenha arquivos separados por faixa/álbum.

**Critérios de Aceitação:**
1. Detecção de pontos de segmentação via eventos
2. Criação de múltiplos arquivos FLAC por sessão quando aplicável
3. Metadata específica por segmento
4. Relacionamento de segmentos com sessão original

**Pré-requisitos:** V3.3

---

### Story V3.5: Gravação Manual com Pré-roll

**Como** usuário,  
**quero** poder iniciar gravação manualmente com captura de 5-10s antes do comando,  
**para que** não perca início de faixas.

**Critérios de Aceitação:**
1. Botão "Gravar" na UI
2. Pré-roll captura 5-10s antes do comando (via buffer circular)
3. Gravação manual cria arquivo FLAC
4. Parar gravação manualmente
5. Arquivo disponível imediatamente após parar

**Pré-requisitos:** V3.4

---

### Story V3.6: UI de Gravações

**Como** usuário,  
**quero** ver lista de gravações e poder baixar/excluir,  
**para que** possa gerenciar meus arquivos de áudio.

**Critérios de Aceitação:**
1. Página Recordings criada
2. Lista de gravações com: sessão, data, duração, tamanho, formato
3. Download de arquivo FLAC
4. Exclusão de gravação
5. Link para sessão relacionada

**Pré-requisitos:** V3.5

---

### Story V3.7: Geração de Chromaprint

**Como** desenvolvedor,  
**quero** gerar fingerprints de áudio usando chromaprint,  
**para que** possa reconhecer álbuns localmente.

**Critérios de Aceitação:**
1. Service `chromaprint.ts` criado
2. Integração com chromaprint (fpcalc)
3. Geração de fingerprint para arquivos FLAC
4. Armazenamento na tabela `chromaprints` vinculado ao álbum
5. Processamento assíncrono (não bloqueia streaming)

**Pré-requisitos:** V3.6

---

### Story V3.8: Reconhecimento Offline

**Como** usuário,  
**quero** que reconhecimentos sejam feitos localmente quando possível,  
**para que** não dependa de internet e tenha resultados instantâneos.

**Critérios de Aceitação:**
1. Ao reconhecer, primeiro tenta match local (chromaprint)
2. Compara fingerprint capturado com fingerprints da coleção
3. Se match local encontrado: retorna imediatamente (sem API externa)
4. Se não encontrado: fallback para cloud (ACRCloud/AudD)
5. Meta: 70%+ de álbuns da coleção reconhecidos localmente

**Pré-requisitos:** V3.7, V2.5

---

### Story V3.9: Análise de Qualidade - SNR e Wow/Flutter

**Como** usuário,  
**quero** saber a qualidade das minhas gravações,  
**para que** possa identificar problemas com discos ou equipamento.

**Critérios de Aceitação:**
1. Análise de SNR (Signal-to-Noise Ratio) em dB
2. Detecção de wow/flutter (variação de pitch)
3. Cálculo de métricas via análise de áudio
4. Métricas salvas em `qa_reports`
5. Relatório disponível via API

**Pré-requisitos:** V3.6

---

### Story V3.10: Detecção de Clicks/Pops

**Como** usuário,  
**quero** que o sistema detecte clicks e pops nas gravações,  
**para que** saiba se há problemas físicos com o disco.

**Critérios de Aceitação:**
1. Detecção de clicks (ruídos abruptos de curta duração)
2. Detecção de pops (ruídos mais graves)
3. Contagem de eventos por tipo
4. Localização temporal dos eventos
5. Métricas salvas em `qa_reports`

**Pré-requisitos:** V3.9

---

### Story V3.11: Health Score e Relatórios

**Como** usuário,  
**quero** um score de qualidade (0-100) para cada gravação,  
**para que** possa rapidamente identificar problemas.

**Critérios de Aceitação:**
1. Health score calculado (0-100) baseado em todas métricas
2. Fórmula considera: SNR, wow/flutter, clicks, pops, clipping
3. Relatório completo gerado e salvo
4. UI mostra score e breakdown de métricas
5. Comparação temporal (degradação ao longo do tempo)

**Pré-requisitos:** V3.10

---

### Story V3.12: UI de QA com Visualizações

**Como** usuário,  
**quero** ver relatórios de QA com gráficos e visualizações,  
**para que** entenda facilmente a qualidade das gravações.

**Critérios de Aceitação:**
1. Página QA criada ou expandida na página Recordings
2. Gráfico de espectro de frequência
3. Timeline de eventos (clicks, clipping marcados)
4. Tabela de métricas com cores indicativas (verde/amarelo/vermelho)
5. Comparação entre gravações

**Pré-requisitos:** V3.11

---

## Epic V4 - Polimento & Controles Avançados

**Objetivo:** Refinar UI, adicionar controles administrativos avançados, e integrações opcionais.

**Valor:** Experiência polida e profissional, com controles avançados e integrações para power users.

**Dependências:** V3 completo

**Duração Estimada:** 6-8 semanas (8 sprints)

---

### Story V4.1: Mobile-Responsive Completo

**Como** usuário,  
**quero** que a interface funcione perfeitamente em smartphones,  
**para que** possa usar de qualquer dispositivo.

**Critérios de Aceitação:**
1. Todas as páginas responsivas (breakpoints mobile/tablet/desktop)
2. Player adaptado para mobile (controles touch-friendly)
3. Grid de coleção adaptável
4. Navegação mobile-friendly
5. Testes em dispositivos reais

**Pré-requisitos:** V3 completo

---

### Story V4.2: Performance Otimizada (Code Splitting, Lazy Loading)

**Como** usuário,  
**quero** que a interface carregue rapidamente,  
**para que** tenha boa experiência mesmo em redes mais lentas.

**Critérios de Aceitação:**
1. Code splitting por rota implementado
2. Lazy loading de componentes pesados
3. Otimização de assets (imagens, etc.)
4. Tempo de carregamento <2s em redes locais
5. Lighthouse score >90 performance

**Pré-requisitos:** V4.1

---

### Story V4.3: Acessibilidade Básica (WCAG 2.1 AA)

**Como** usuário com necessidades especiais,  
**quero** que a interface seja acessível,  
**para que** possa usar o sistema independentemente.

**Critérios de Aceitação:**
1. Navegação por teclado funcional
2. Contraste de cores adequado (WCAG AA)
3. Labels adequados para screen readers
4. foco visível em elementos interativos
5. Testes com screen reader

**Pré-requisitos:** V4.2

---

### Story V4.4: Configurações Avançadas via UI

**Como** usuário avançado,  
**quero** poder configurar aspectos técnicos avançados via UI,  
**para que** não precise editar arquivos de configuração.

**Critérios de Aceitação:**
1. Seção avançada na página Settings
2. Ajuste fino de codec/bitrate
3. Configuração de múltiplos dispositivos de áudio
4. Buffer sizes configuráveis
5. Todas configurações persistidas

**Pré-requisitos:** V3 completo

---

### Story V4.5: Dashboard de Métricas Detalhadas

**Como** usuário avançado,  
**quero** ver métricas detalhadas do sistema em tempo real,  
**para que** possa monitorar performance e saúde do sistema.

**Critérios de Aceitação:**
1. Dashboard expandido com métricas:
   - CPU, memória, temperatura (Pi)
   - Latência do stream
   - Throughput de rede
   - Estatísticas de reconhecimento
2. Gráficos em tempo real (Recharts)
3. Histórico de métricas (últimas 24h)
4. Export de métricas

**Pré-requisitos:** V4.4

---

### Story V4.6: Integração Last.fm Scrobbling

**Como** usuário,  
**quero** que plays sejam enviados automaticamente para Last.fm,  
**para que** meu perfil Last.fm seja atualizado.

**Critérios de Aceitação:**
1. Service `lastfm.ts` criado
2. Configuração de API keys via Settings
3. Scrobbling automático quando track é reconhecido
4. Opção de enable/disable
5. Tratamento de erros e retry

**Pré-requisitos:** V2.5

---

### Story V4.7: Integração MQTT

**Como** usuário com home automation,  
**quero** que eventos sejam publicados via MQTT,  
**para que** possa integrar com outros sistemas.

**Critérios de Aceitação:**
1. Service `mqtt.ts` criado
2. Configuração de broker MQTT
3. Publicação de eventos: session.started, session.ended, track_recognized
4. Tópicos configuráveis
5. Opção de enable/disable

**Pré-requisitos:** V1.7 (EventBus)

---

### Story V4.8: Webhooks

**Como** desenvolvedor/integrador,  
**quero** poder configurar webhooks para eventos,  
**para que** possa integrar com sistemas externos.

**Critérios de Aceitação:**
1. Sistema de webhooks configurável
2. Endpoints configuráveis por tipo de evento
3. Payload personalizável
4. Retry logic em caso de falha
5. Logs de tentativas de webhook

**Pré-requisitos:** V4.7

---

### Story V4.9: Notificações (Slack/Discord) - Opcional

**Como** usuário,  
**quero** receber notificações em Slack/Discord quando eventos importantes acontecem,  
**para que** saiba o que está tocando sem abrir a interface.

**Critérios de Aceitação:**
1. Configuração de webhooks Slack/Discord
2. Notificações para: session.started, track_recognized
3. Formato de mensagem configurável
4. Opção de enable/disable por tipo de notificação

**Pré-requisitos:** V4.8

---

### Story V4.10: Logs e Debugging Tools

**Como** desenvolvedor,  
**quero** ter ferramentas avançadas de debugging via UI,  
**para que** possa diagnosticar problemas facilmente.

**Critérios de Aceitação:**
1. Página de logs (ou seção em Settings)
2. Visualização de logs Winston em tempo real
3. Filtros por nível (error, warn, info, debug)
4. Busca em logs
5. Export de logs

**Pré-requisitos:** V4.5

---

### Story V4.11: Backup/Restore via UI

**Como** usuário,  
**quero** poder fazer backup e restore do banco de dados via UI,  
**para que** possa proteger meus dados facilmente.

**Critérios de Aceitação:**
1. Botão "Backup" na página Settings
2. Download de arquivo de backup (SQLite + configurações)
3. Upload e restore de backup
4. Validação de backup antes de restore
5. Confirmação antes de restore (destrutivo)

**Pré-requisitos:** V4.10

---

### Story V4.12: EventBus Extensível para Plugins

**Como** desenvolvedor,  
**quero** que o EventBus suporte plugins customizados,  
**para que** possa estender funcionalidades facilmente.

**Critérios de Aceitação:**
1. Sistema de hooks no EventBus
2. Plugins podem registrar listeners para eventos
3. Exemplo de plugin documentado
4. API para desenvolvimento de plugins

**Pré-requisitos:** V1.7 (EventBus)

---

## Story Guidelines Reference

**Formato de História:**

```
**Story [EPIC.N]: [Story Title]**

As a [user type],
I want [goal/desire],
So that [benefit/value].

**Acceptance Criteria:**
1. [Specific testable criterion]
2. [Another specific criterion]
3. [etc.]

**Prerequisites:** [Dependencies on previous stories, if any]
```

**Requisitos de Histórias:**

- **Vertical slices** - Entrega funcionalidade completa e testável
- **Sequencial ordering** - Progressão lógica dentro do épico
- **No forward dependencies** - Apenas depende de trabalho anterior
- **AI-agent sized** - Completável em sessão focada de 2-4 horas
- **Value-focused** - Integra enablers técnicos em histórias de valor

---

**Para implementação:** Use o workflow `create-story` para gerar planos de implementação individuais de histórias a partir deste breakdown de épicos.

