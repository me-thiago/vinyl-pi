# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado
- Sentry error tracking no frontend
- Enum `EventType` no Prisma para validação de tipos de eventos
- Code splitting e layout persistente com PlayerBar
- Swagger/OpenAPI documentação da API (em andamento)

### Melhorado
- Performance do frontend com lazy loading de rotas
- Validação de input com Zod em todas as rotas

## [1.5.0] - 2025-12-04

### Adicionado
- **CORS restrito** - Apenas origens configuradas são permitidas
- **Validação de input** - Zod schemas em todas as rotas da API
- **Logger centralizado** - Winston com rotação de logs
- **Rate limiting** - Proteção contra abuso da API
- **CI/CD** - GitHub Actions com testes e build automatizados
- **Contador de listeners** - Mostra ouvintes conectados ao Icecast
- **Testes de frontend** - Cobertura básica com Vitest

### Corrigido
- Arquivos temporários não são mais commitados
- Cleanup de código archived/obsoleto

### Segurança
- Headers de segurança adicionados (helmet)
- Sanitização de inputs em todas as rotas

## [1.0.0] - 2025-11-15

### Adicionado
- **Streaming de áudio** - Pipeline ALSA → FFmpeg → Icecast2
- **Player web** - Baixa latência (~150ms) com visualização
- **VinylVisualizer** - Disco girando com waveform em tempo real
- **Detecção de silêncio** - Alerta quando áudio fica abaixo do threshold
- **Detecção de clipping** - Alerta quando áudio satura
- **Detecção de sessões** - Agrupa eventos por sessão de escuta
- **Dashboard** - Monitoramento em tempo real do sistema
- **Interface de diagnóstico** - VU meter e log de eventos
- **Configurações** - Interface web para ajustar thresholds
- **WebSocket** - Atualizações em tempo real via Socket.io
- **Persistência** - SQLite + Prisma para eventos e sessões
- **Error Boundaries** - Tratamento robusto de erros no frontend
- **Histórico de sessões** - Visualização de sessões passadas
- **Tema dark/light** - Suporte a temas via shadcn/ui

### Técnico
- Backend: Node.js + Express + TypeScript
- Frontend: React 19 + Vite 7 + shadcn/ui
- Database: SQLite com Prisma ORM
- Streaming: Icecast2 + FFmpeg
- Real-time: Socket.io
- Process Manager: PM2

## [0.1.0] - 2025-10-01

### Adicionado
- Estrutura inicial do projeto
- Configuração básica de desenvolvimento
- Documentação inicial (README, CLAUDE.md)

---

[Unreleased]: https://github.com/me-thiago/vinyl-os/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/me-thiago/vinyl-os/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/me-thiago/vinyl-os/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/me-thiago/vinyl-os/releases/tag/v0.1.0
