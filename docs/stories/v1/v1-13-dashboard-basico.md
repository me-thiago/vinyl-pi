# Story V1.13: Dashboard Básico

**Epic:** V1 - Foundation Core (MVP)
**Status:** done

**User Story:**
Como usuário,
quero ver o estado atual do sistema em um dashboard,
para que possa monitorar status de streaming e sessão ativa.

## Critérios de Aceitação

- [x] 1. Página Dashboard criada com React em rota `/dashboard`
- [x] 2. Exibe estado atual: streaming on/off, sessão ativa, última atividade
- [x] 3. Últimos eventos detectados (lista simplificada, últimos 10)
- [x] 4. Quick stats: duração da sessão atual
- [x] 5. Layout responsivo básico

## Pré-requisitos

- V1.6 - Frontend Player Básico
- V1.11 - Detecção de Sessão

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.5 (Interface Web - Dashboard)
- [Epics](../epics.md) - Epic V1

---

## Notas de Implementação

### Regras do Frontend

1. **NÃO modificar a página atual (`/`)** - O player existente deve permanecer intacto
2. **Criar nova rota `/dashboard`** - Dashboard será uma página separada
3. **Usar componentes shadcn** - Sempre que possível usar os componentes em `src/components/ui/`
4. **Usar variáveis CSS** - Nunca hardcode de cores, fontes ou tamanhos; usar variáveis do `index.css`

### Componentes shadcn Disponíveis

- `Button` - botões com variantes (default, secondary, outline, destructive)
- `Card` - containers com CardHeader, CardTitle, CardDescription, CardContent
- `Badge` - labels/tags com variantes
- `Separator` - divisores horizontais
- `Switch` - toggles on/off
- `Slider` - controles deslizantes
- `DropdownMenu` - menus suspensos

### Variáveis CSS Principais (index.css)

**Cores semânticas:**
- `--background` / `--foreground` - cores base
- `--card` / `--card-foreground` - cards
- `--primary` / `--primary-foreground` - cor principal (laranja/âmbar)
- `--secondary` / `--secondary-foreground` - cor secundária
- `--muted` / `--muted-foreground` - elementos sutis
- `--accent` / `--accent-foreground` - destaques
- `--destructive` / `--destructive-foreground` - erros/alertas
- `--border` / `--input` / `--ring` - bordas e inputs

**Charts (para gráficos futuros):**
- `--chart-1` a `--chart-5` - paleta para visualizações

**Tipografia:**
- `--font-sans` / `--font-serif` / `--font-mono`

**Espaçamento e raio:**
- `--radius` (0.5rem) com variantes sm, md, lg, xl
- `--spacing` (0.25rem base)

### Suporte a Dark Mode

O tema já suporta dark mode via classe `.dark`. Usar classes Tailwind como:
- `bg-background` (não `bg-white`)
- `text-foreground` (não `text-black`)
- `text-muted-foreground` (não `text-gray-500`)
- `border-border` (não `border-gray-200`)

### APIs Disponíveis (Backend)

- `GET /api/status` - estado completo (streaming, audio, session)
- `GET /api/sessions` - lista de sessões com paginação
- `GET /api/sessions/active` - sessão ativa atual
- `GET /api/events` - lista de eventos com paginação e filtros

---

## Dev Agent Record

### Context Reference
- Contexto carregado das stories V1.7 a V1.11 (sem arquivo XML separado)

### File List
- **Created:**
  - `frontend/src/pages/Dashboard.tsx` - Página Dashboard completa com status, eventos e quick stats

- **Modified:**
  - `frontend/src/main.tsx` - Configuração do React Router com rota `/dashboard`
  - `frontend/src/App.tsx` - Adicionado botão de navegação para Dashboard no header

### Change Log
- 2025-11-30: V1.13 Dashboard Básico implementado
  - React Router configurado com BrowserRouter, Routes e Route
  - Página Dashboard criada em `/dashboard`
  - 4 cards de status: Streaming, Sessão, Duração, Áudio
  - Lista de últimos 10 eventos com tradução e formatação
  - Atualização automática a cada 5 segundos
  - Botão de refresh manual
  - Navegação bidirecional (Home ↔ Dashboard)
  - Build validado: 368.54 kB gzipped

### Completion Notes

**Implementation Summary:**
Dashboard de monitoramento em tempo real implementado como página separada, consumindo APIs existentes do backend (V1.10, V1.11).

**Key Features:**
- ✅ Rota `/dashboard` criada sem modificar página principal
- ✅ Status de streaming (on/off, bitrate, mount point)
- ✅ Status de sessão (ativa/inativa, duração, contagem de eventos)
- ✅ Indicadores de áudio (nível dB, clipping, silêncio)
- ✅ Lista dos 10 últimos eventos com badges coloridos por tipo
- ✅ Formatação de duração (HH:MM:SS) e timestamps relativos
- ✅ Tradução de tipos de evento para português
- ✅ Atualização automática a cada 5s + botão de refresh
- ✅ Layout responsivo (mobile-first, grid adaptativo)
- ✅ Suporte completo a dark mode via variáveis CSS
- ✅ Tratamento de erros com card de alerta

**Technical Decisions:**
- Usado `react-router-dom` já instalado no projeto
- Polling de 5s para atualizações (WebSocket será V1.14)
- Componentes shadcn reutilizados: Card, Badge, Button, Separator
- API base configurável via `VITE_API_URL` (default: localhost:3001)
- Formatação de tempo em português brasileiro

**APIs Consumidas:**
- `GET /api/status` - Estado do streaming, áudio e sessão
- `GET /api/events?limit=10` - Últimos 10 eventos

