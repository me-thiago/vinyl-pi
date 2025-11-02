# Vinyl-OS - Histórias de Usuário

Este diretório contém todas as histórias de usuário individuais do projeto Vinyl-OS, organizadas por épico.

## Estrutura

As histórias estão organizadas em 4 épicos principais, cada um em seu diretório:

- **v1/** - Foundation Core (MVP) - 22 histórias
- **v2/** - Coleção & Reconhecimento Musical - 12 histórias  
- **v3/** - Gravação & Análise - 12 histórias
- **v4/** - Polimento & Controles Avançados - 12 histórias

**Total: 58 histórias**

## Epic V1 - Foundation Core (MVP)

**Duração Estimada:** 8-10 semanas

### Setup & Infraestrutura (V1.1 - V1.7)
- [V1.1 - Setup Inicial do Projeto](v1/v1-01-setup-inicial.md)
- [V1.2 - Configuração Prisma e Database](v1/v1-02-configuracao-prisma.md)
- [V1.3 - Configuração Icecast2](v1/v1-03-configuracao-icecast.md)
- [V1.4 - Captura de Áudio ALSA via FFmpeg](v1/v1-04-captura-audio-alsa.md)
- [V1.5 - Pipeline FFmpeg → Icecast](v1/v1-05-pipeline-ffmpeg-icecast.md)
- [V1.6 - Frontend Player Básico](v1/v1-06-frontend-player-basico.md)
- [V1.7 - EventBus Core](v1/v1-07-eventbus-core.md)

### Detecção de Eventos (V1.8 - V1.12)
- [V1.8 - Detecção de Silêncio](v1/v1-08-deteccao-silencio.md)
- [V1.9 - Detecção de Clipping](v1/v1-09-deteccao-clipping.md)
- [V1.10 - Persistência de Eventos](v1/v1-10-persistencia-eventos.md)
- [V1.11 - Detecção de Sessão](v1/v1-11-deteccao-sessao.md)
- [V1.12 - Detecção de Troca de Faixa](v1/v1-12-deteccao-troca-faixa.md)

### Interface & Features (V1.13 - V1.18)
- [V1.13 - Dashboard Básico](v1/v1-13-dashboard-basico.md)
- [V1.14 - WebSocket Real-Time Updates](v1/v1-14-websocket-realtime.md)
- [V1.15 - UI de Diagnóstico](v1/v1-15-ui-diagnostico.md)
- [V1.16 - Log de Eventos na UI](v1/v1-16-log-eventos-ui.md)
- [V1.17 - Histórico de Sessões](v1/v1-17-historico-sessoes.md)
- [V1.18 - Configurações Básicas](v1/v1-18-configuracoes-basicas.md)

### Polish & Deploy (V1.19 - V1.22)
- [V1.19 - Error Handling Robusto](v1/v1-19-error-handling.md)
- [V1.20 - PM2 Config e Auto-Start](v1/v1-20-pm2-config.md)
- [V1.21 - Install Script Completo](v1/v1-21-install-script.md)
- [V1.22 - Documentação Básica](v1/v1-22-documentacao-basica.md)

---

## Epic V2 - Coleção & Reconhecimento Musical

**Duração Estimada:** 8-10 semanas  
**Dependências:** V1 completo

### Database & Backend (V2.1 - V2.4)
- [V2.1 - Schema de Dados V2](v2/v2-01-schema-dados-v2.md)
- [V2.2 - CRUD de Álbuns (Backend)](v2/v2-02-crud-albums-backend.md)
- [V2.3 - UI de Gestão de Coleção](v2/v2-03-ui-gestao-colecao.md)
- [V2.4 - Integração Discogs](v2/v2-04-integracao-discogs.md)

### Reconhecimento Musical (V2.5 - V2.8)
- [V2.5 - Integração AudD/ACRCloud](v2/v2-05-reconhecimento-musical.md)
- [V2.6 - Validação Contra Coleção](v2/v2-06-validacao-colecao.md)
- [V2.7 - UI de Matching/Confirmação](v2/v2-07-ui-matching-confirmacao.md)
- [V2.8 - Link Reconhecimento → Coleção no Player](v2/v2-08-player-com-colecao.md)

### Features Adicionais (V2.9 - V2.12)
- [V2.9 - Histórico de Escuta Expandido](v2/v2-09-historico-escuta-expandido.md)
- [V2.10 - Estatísticas da Coleção](v2/v2-10-estatisticas-colecao.md)
- [V2.11 - Export de Dados](v2/v2-11-export-dados.md)
- [V2.12 - Background Recognition Worker](v2/v2-12-background-recognition-worker.md) *(Opcional)*

---

## Epic V3 - Gravação & Análise

**Duração Estimada:** 12-14 semanas  
**Dependências:** V2 completo

### Gravação (V3.1 - V3.6)
- [V3.1 - Schema de Dados V3](v3/v3-01-schema-dados-v3.md)
- [V3.2 - Dual-Path Architecture](v3/v3-02-dual-path-architecture.md)
- [V3.3 - Gravação FLAC Automática](v3/v3-03-gravacao-flac-automatica.md)
- [V3.4 - Segmentação Automática por Eventos](v3/v3-04-segmentacao-automatica.md)
- [V3.5 - Gravação Manual com Pré-roll](v3/v3-05-gravacao-manual-preroll.md)
- [V3.6 - UI de Gravações](v3/v3-06-ui-gravacoes.md)

### Reconhecimento Offline (V3.7 - V3.8)
- [V3.7 - Geração de Chromaprint](v3/v3-07-geracao-chromaprint.md)
- [V3.8 - Reconhecimento Offline](v3/v3-08-reconhecimento-offline.md)

### Análise de Qualidade (V3.9 - V3.12)
- [V3.9 - Análise de Qualidade - SNR e Wow/Flutter](v3/v3-09-analise-snr-wow-flutter.md)
- [V3.10 - Detecção de Clicks/Pops](v3/v3-10-deteccao-clicks-pops.md)
- [V3.11 - Health Score e Relatórios](v3/v3-11-health-score-relatorios.md)
- [V3.12 - UI de QA com Visualizações](v3/v3-12-ui-qa-visualizacoes.md)

---

## Epic V4 - Polimento & Controles Avançados

**Duração Estimada:** 6-8 semanas  
**Dependências:** V3 completo

### UI & Performance (V4.1 - V4.3)
- [V4.1 - Mobile-Responsive Completo](v4/v4-01-mobile-responsive.md)
- [V4.2 - Performance Otimizada](v4/v4-02-performance-otimizada.md)
- [V4.3 - Acessibilidade Básica](v4/v4-03-acessibilidade-basica.md)

### Controles Avançados (V4.4 - V4.5)
- [V4.4 - Configurações Avançadas via UI](v4/v4-04-configuracoes-avancadas.md)
- [V4.5 - Dashboard de Métricas Detalhadas](v4/v4-05-dashboard-metricas.md)

### Integrações (V4.6 - V4.9)
- [V4.6 - Integração Last.fm Scrobbling](v4/v4-06-integracao-lastfm.md)
- [V4.7 - Integração MQTT](v4/v4-07-integracao-mqtt.md)
- [V4.8 - Webhooks](v4/v4-08-webhooks.md)
- [V4.9 - Notificações (Slack/Discord)](v4/v4-09-notificacoes-slack-discord.md) *(Opcional)*

### Tools & Extensibilidade (V4.10 - V4.12)
- [V4.10 - Logs e Debugging Tools](v4/v4-10-logs-debugging-tools.md)
- [V4.11 - Backup/Restore via UI](v4/v4-11-backup-restore-ui.md)
- [V4.12 - EventBus Extensível para Plugins](v4/v4-12-eventbus-extensivel-plugins.md)

---

## Documentos de Referência

- [PRD v3.0](../prd-v3.md) - Product Requirements Document completo
- [Epics](../epics.md) - Breakdown detalhado de épicos

## Como Usar

Cada história individual contém:
- **User Story** formatada (Como/Quero/Para que)
- **Critérios de Aceitação** específicos e testáveis
- **Pré-requisitos** (dependências de outras histórias)
- **Referências** ao PRD e documentação relacionada

As histórias seguem os princípios:
- **Vertical slices** - Entrega funcionalidade completa e testável
- **Sequencial ordering** - Progressão lógica dentro do épico
- **No forward dependencies** - Apenas depende de trabalho anterior
- **AI-agent sized** - Completável em sessão focada de 2-4 horas
- **Value-focused** - Integra enablers técnicos em histórias de valor

---

**Última Atualização:** 2025-11-02

