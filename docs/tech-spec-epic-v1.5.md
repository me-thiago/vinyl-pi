# Epic Technical Specification: Hardening & Quality (Post-Audit)

Date: 2025-12-03
Author: Thiago
Epic ID: v1.5
Status: Draft

---

## Overview

Epic V1.5 - Hardening & Quality implementa melhorias de segurança, qualidade de código e developer experience identificadas no relatório de auditoria de Dezembro 2025. Este épico foca em fortalecer o sistema MVP existente (V1) antes de avançar para features mais complexas (V2+), abordando vulnerabilidades de segurança (CORS permissivo, ausência de validação de input), inconsistências de código (loggers duplicados), e melhorias de manutenibilidade (cleanup de código morto, CI/CD, documentação de API).

O Epic V1.5 é um épico de "hardening" - não adiciona features para usuário final, mas melhora segurança, estabilidade, e experiência de desenvolvimento. Todas as stories são derivadas diretamente do relatório de auditoria (`docs/audit-report-2025-12-03.md`), priorizadas por criticidade: Crítico (segurança) → Alto (qualidade) → Médio (DX) → Baixo (nice-to-have).

## Objectives and Scope

**In Scope:**
- **Segurança**: Restringir CORS para rede local, adicionar validação de input com Zod, rate limiting
- **Qualidade de Código**: Centralizar logger Winston, remover código arquivado e morto, criar enum para EventType
- **Developer Experience**: CI/CD com GitHub Actions, documentação Swagger/OpenAPI, CONTRIBUTING.md e CHANGELOG.md
- **Observabilidade**: Implementar query de listeners do Icecast
- **Performance**: Code splitting no frontend
- **Futuro**: Estrutura i18n preparatória, testes E2E com Playwright (foundation)

**Out of Scope (V1.5):**
- Novas features para usuário final
- Mudanças na arquitetura de streaming
- Mudanças no schema de banco de dados (exceto enum EventType)
- Autenticação (sistema permanece single-user local)

## System Architecture Alignment

O Epic V1.5 não altera a arquitetura existente definida em `docs/architecture.md`. As mudanças são focadas em:

**Backend Hardening:**
- Middleware CORS customizado com validação de origem (rede local)
- Middleware de validação Zod para todas as rotas que recebem dados
- Middleware de rate limiting para proteção contra abuso
- Centralização de logger Winston (remover duplicações)
- Query periódica ao Icecast2 stats endpoint

**Frontend Optimization:**
- Code splitting por rota (React.lazy)
- Estrutura preparatória para i18n (react-i18next)
- Aumento de cobertura de testes

**DevOps:**
- GitHub Actions para CI (testes + build + lint)
- Swagger UI para documentação de API

**Cleanup:**
- Remoção de `archived_project/`
- Remoção de código morto identificado
- Migration para enum EventType no Prisma

**Alinhamento com Padrões Existentes:**
- Mensagens de erro em português BR (padrão do projeto)
- Formato de erro: `{ error: { message, code, details? } }`
- Logger via `createLogger('ServiceName')` de `utils/logger.ts`
- Testes com Jest (backend) e Vitest (frontend)

## Detailed Design

### Services and Modules

| Service/Module | Responsibilities | Changes in V1.5 |
|----------------|------------------|-----------------|
| `backend/src/utils/cors-validator.ts` | Validar origens de requisições CORS | **NOVO** - Validar IPs de rede local |
| `backend/src/middleware/validate.ts` | Middleware de validação Zod | **NOVO** - Validar body/query/params |
| `backend/src/schemas/*.ts` | Schemas Zod para endpoints | **NOVO** - Schemas para settings, events, sessions |
| `backend/src/middleware/rate-limit.ts` | Rate limiting | **NOVO** - Limitar requisições por IP |
| `backend/src/utils/logger.ts` | Logger centralizado | **EXISTENTE** - Garantir uso único |
| `backend/src/services/audio-manager.ts` | Gerenciador de áudio | **MODIFICAR** - Usar createLogger, remover logger local |
| `backend/src/services/icecast-stats.ts` | Query Icecast listeners | **NOVO** - Consultar stats endpoint |
| `backend/prisma/schema.prisma` | Schema do banco | **MODIFICAR** - Adicionar enum EventType |
| `.github/workflows/ci.yml` | CI/CD pipeline | **NOVO** - Testes, build, lint |
| `frontend/src/pages/*.tsx` | Páginas do frontend | **MODIFICAR** - Lazy loading |

### Data Models and Contracts

**Mudança no Prisma Schema - EventType Enum:**

```prisma
// ANTES (V1)
model AudioEvent {
  eventType   String   // 'silence', 'clipping', etc.
}

// DEPOIS (V1.5)
enum EventType {
  SILENCE_DETECTED
  SILENCE_ENDED
  CLIPPING_DETECTED
  SESSION_STARTED
  SESSION_ENDED
  TURNTABLE_IDLE
  TURNTABLE_ACTIVE
  TRACK_CHANGE_DETECTED
}

model AudioEvent {
  eventType   EventType
}
```

**Migration Strategy:**
1. Criar enum no Prisma schema
2. Migration com conversão de dados existentes
3. Atualizar código TypeScript para usar enum

### APIs and Interfaces

**Novos Endpoints:**

```typescript
// Swagger UI
GET /api/docs
Response: Swagger UI HTML

// Icecast Stats (interno, exposto via /api/status)
GET /api/status
Response: {
  ...existing,
  streaming: {
    active: boolean,
    listeners: number,  // NOVO - Query real do Icecast
    bitrate: number,
    mount_point: string
  }
}
```

**Schemas Zod (novos):**

```typescript
// backend/src/schemas/settings.schema.ts
export const settingsUpdateSchema = z.object({
  'silence.threshold': z.number().min(-100).max(0).optional(),
  'silence.duration': z.number().min(1).max(300).optional(),
  'clipping.threshold': z.number().min(-20).max(0).optional(),
  'clipping.cooldown': z.number().min(100).max(10000).optional(),
  'session.timeout': z.number().min(60).max(7200).optional(),
  'stream.bitrate': z.number().min(64).max(320).optional(),
});

// backend/src/schemas/pagination.schema.ts
export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// backend/src/schemas/events.schema.ts
export const eventsQuerySchema = paginationSchema.extend({
  session_id: z.string().uuid().optional(),
});
```

**CORS Validator Interface:**

```typescript
// backend/src/utils/cors-validator.ts
export function isLocalOrigin(origin: string | undefined): boolean;
export function getCorsConfig(): CorsOptions;

// IPs permitidos:
// - localhost, 127.0.0.1
// - 192.168.x.x (Class C private)
// - 10.x.x.x (Class A private)
// - 172.16.x.x - 172.31.x.x (Class B private)
// - Configuráveis via ALLOWED_ORIGINS env var
```

### Workflows and Sequencing

**Workflow 1: Request Validation**
1. Request chega ao Express
2. CORS middleware valida origem (isLocalOrigin)
3. Rate limit middleware verifica limite por IP
4. Validation middleware (Zod) valida body/query/params
5. Route handler processa request
6. Error handler formata erros em português

**Workflow 2: CI/CD Pipeline**
1. Push/PR para main
2. GitHub Actions trigger
3. Checkout code
4. Setup Node.js 20.x
5. Install dependencies (npm ci)
6. Run ESLint (backend + frontend)
7. Run backend tests (Jest)
8. Run frontend tests (Vitest)
9. Build backend (tsc)
10. Build frontend (vite build)
11. Report status (badge)

**Workflow 3: Icecast Listeners Query**
1. Timer a cada 10s
2. IcecastStats service query `http://localhost:8000/status-json.xsl`
3. Parse JSON response
4. Extract listeners count
5. Update status cache
6. WebSocket broadcast status update

## Non-Functional Requirements

### Performance

- **CORS Validation**: < 1ms overhead per request
- **Zod Validation**: < 5ms per request (típico)
- **Rate Limiting**: < 1ms overhead per request
- **Code Splitting**: Initial bundle < 100KB gzipped
- **Icecast Query**: Timeout 2s, cache 10s

### Security

- **CORS**: Restrito a rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost)
- **Input Validation**: Todos endpoints com body/query validados via Zod
- **Rate Limiting**: 100 requests/min por IP (configurável)
- **Error Messages**: Sem stack traces em produção, mensagens user-friendly
- **Sensitive Data**: Nenhum dado sensível exposto em erros

### Reliability/Availability

- **Backwards Compatibility**: Todas mudanças são backwards-compatible
- **Graceful Degradation**: Rate limiting retorna 429, não crash
- **Validation Errors**: Retornam 400, não crash
- **Migration Safety**: Enum migration é reversível

### Observability

- **Logger Centralizado**: Todos serviços usam `createLogger('ServiceName')`
- **Formato Consistente**: `[timestamp] [level] [ServiceName]: message`
- **Icecast Metrics**: Listeners count disponível via `/api/status`
- **CI/CD Logs**: Visíveis no GitHub Actions

## Dependencies and Integrations

**Novas Dependências Backend:**

```json
{
  "dependencies": {
    "zod": "^3.23.x",
    "express-rate-limit": "^7.x"
  },
  "devDependencies": {
    "swagger-jsdoc": "^6.x",
    "swagger-ui-express": "^5.x",
    "@types/swagger-jsdoc": "^6.x",
    "@types/swagger-ui-express": "^4.x"
  }
}
```

**Novas Dependências Frontend:**

```json
{
  "dependencies": {
    "react-i18next": "^14.x",
    "i18next": "^23.x"
  },
  "devDependencies": {
    "@playwright/test": "^1.x"
  }
}
```

**Integração Icecast Stats:**
- Endpoint: `http://localhost:8000/status-json.xsl`
- Formato: JSON com listeners, mount points, etc.
- Fallback: 0 listeners se Icecast indisponível

**GitHub Actions:**
- Runner: ubuntu-latest
- Node: 20.x
- Triggers: push/PR to main

## Acceptance Criteria (Authoritative)

**AC-01**: CORS restringe origens não-locais
- Given: Request de origem externa (https://evil.com)
- When: Request chega ao backend
- Then: Response 403 Forbidden

**AC-02**: CORS permite rede local
- Given: Request de 192.168.1.100 ou localhost
- When: Request chega ao backend
- Then: Request processada normalmente

**AC-03**: Validação Zod rejeita payload inválido
- Given: PATCH /api/settings com `{ "silence.threshold": 50 }` (valor > 0)
- When: Request processada
- Then: Response 400 com mensagem em português

**AC-04**: Rate limiting funciona
- Given: 101 requests em 1 minuto do mesmo IP
- When: Request 101 chega
- Then: Response 429 Too Many Requests

**AC-05**: Logger centralizado em todos serviços
- Given: Sistema rodando
- When: Logs são gerados
- Then: Todos logs têm formato `[timestamp] [level] [ServiceName]: message`

**AC-06**: Código arquivado removido
- Given: Branch main
- When: `ls archived_project/`
- Then: Diretório não existe

**AC-07**: CI pipeline passa
- Given: Push para main
- When: GitHub Actions executa
- Then: Testes passam, build sucede, badge verde

**AC-08**: Listeners count disponível
- Given: Streaming ativo com 2 listeners
- When: GET /api/status
- Then: Response inclui `streaming.listeners: 2`

**AC-09**: Swagger UI funciona
- Given: Backend rodando
- When: GET /api/docs
- Then: Swagger UI renderiza com todos endpoints

**AC-10**: Code splitting funciona
- Given: Frontend build
- When: Analisar bundle
- Then: Chunks separados por rota, initial < 100KB gzip

**AC-11**: EventType enum funciona
- Given: Evento de silêncio detectado
- When: Salvo no database
- Then: eventType é enum `SILENCE_DETECTED`

**AC-12**: CONTRIBUTING.md existe
- Given: Repositório
- When: `cat CONTRIBUTING.md`
- Then: Arquivo existe com guia de contribuição

## Traceability Mapping

| AC | Story | Spec Section | Component(s) | Test Idea |
|----|-------|--------------|--------------|-----------|
| AC-01 | V1.5-01 | Security | cors-validator.ts | Request de origem externa, validar 403 |
| AC-02 | V1.5-01 | Security | cors-validator.ts | Request de 192.168.x.x, validar sucesso |
| AC-03 | V1.5-02 | APIs | validate.ts, schemas/ | Payload inválido, validar 400 + mensagem PT |
| AC-04 | V1.5-05 | Security | rate-limit.ts | 101 requests/min, validar 429 |
| AC-05 | V1.5-04 | Observability | utils/logger.ts, services/ | Grep logs, validar formato consistente |
| AC-06 | V1.5-03 | Cleanup | git, .gitignore | ls archived_project/, validar não existe |
| AC-07 | V1.5-06 | DevOps | .github/workflows/ci.yml | Push to main, validar badge verde |
| AC-08 | V1.5-07 | APIs | icecast-stats.ts | Streaming com listeners, validar count |
| AC-09 | V1.5-09 | APIs | swagger config | GET /api/docs, validar UI renderiza |
| AC-10 | V1.5-10 | Performance | vite config, React.lazy | Bundle analysis, validar chunks |
| AC-11 | V1.5-11 | Data Models | Prisma schema | Criar evento, validar enum no DB |
| AC-12 | V1.5-15 | Documentation | CONTRIBUTING.md | cat file, validar conteúdo |

## Risks, Assumptions, Open Questions

**Risks:**

1. **Risk**: Migration de eventType para enum pode falhar com dados existentes
   - **Probability**: Média
   - **Impact**: Alto (database inconsistente)
   - **Mitigation**: Backup antes de migration, script de rollback, testar em dev primeiro

2. **Risk**: Rate limiting muito restritivo pode afetar uso legítimo
   - **Probability**: Baixa
   - **Impact**: Médio (UX degradada)
   - **Mitigation**: Limite conservador (100/min), configurável via env var

3. **Risk**: Zod adiciona overhead em requests
   - **Probability**: Baixa
   - **Impact**: Baixo (< 5ms)
   - **Mitigation**: Benchmark antes/depois, schemas otimizados

4. **Risk**: Icecast stats endpoint pode não estar disponível
   - **Probability**: Média (versões antigas)
   - **Impact**: Baixo (fallback para 0)
   - **Mitigation**: Verificar versão Icecast, fallback graceful

**Assumptions:**

1. GitHub Actions disponível para repositório
2. Icecast2 versão >= 2.4.0 com status-json.xsl
3. Todos desenvolvedores usam Node.js 20.x
4. Testes existentes passam antes de iniciar V1.5

**Open Questions:**

1. **Q**: Rate limit de 100/min é apropriado?
   - **Status**: Assumir 100, monitorar em produção, ajustar se necessário

2. **Q**: Incluir frontend tests no CI?
   - **Status**: Sim, rodar Vitest no pipeline

3. **Q**: Swagger em produção ou só dev?
   - **Status**: Ambos, mas desabilitável via env var

## Test Strategy Summary

**Unit Tests:**
- `cors-validator.test.ts`: Validar IPs locais vs externos
- `validate.test.ts`: Middleware com payloads válidos/inválidos
- `rate-limit.test.ts`: Verificar limite e headers
- `schemas/*.test.ts`: Validar cada schema com casos de borda
- `icecast-stats.test.ts`: Mock do stats endpoint

**Integration Tests:**
- CORS + Express: Request de origem externa retorna 403
- Zod + Routes: PATCH /api/settings com payload inválido retorna 400
- Rate Limit + Routes: 101 requests retornam 429
- Logger migration: Grep logs por formato consistente

**E2E Tests (foundation para V1.5-14):**
- Playwright setup
- Smoke test: abrir player, verificar streaming

**CI Tests:**
- GitHub Actions workflow funciona
- Badge atualiza corretamente

**Test Environment:**
- Node.js 20.x (mesmo de produção)
- SQLite em memória para testes rápidos
- Mock de Icecast stats endpoint

**Coverage Target:**
- Novos módulos: ≥90% coverage
- Schemas: 100% coverage (crítico)
- Middleware: ≥80% coverage

**Test Tools:**
- Jest: Backend unit + integration
- Supertest: API tests
- Vitest: Frontend tests
- Playwright: E2E tests (foundation)
