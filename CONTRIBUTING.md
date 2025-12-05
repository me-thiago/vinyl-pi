# Contribuindo para o Vinyl-OS

Obrigado pelo interesse em contribuir! Este guia ajudará você a começar.

## Pré-requisitos

- Node.js 20+
- npm 10+
- Git
- Raspberry Pi (para testes de hardware) ou ambiente de desenvolvimento

## Configuração do Ambiente

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/me-thiago/vinyl-os.git
   cd vinyl-os
   ```

2. **Instale as dependências:**
   ```bash
   npm install        # Instala dependências do monorepo
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Configure o ambiente:**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   npx prisma migrate dev

   # Frontend
   cd ../frontend
   cp .env.example .env
   ```

4. **Inicie o desenvolvimento:**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

## Estrutura do Projeto

```
vinyl-os/
├── backend/           # Node.js + Express + Prisma
│   ├── src/
│   │   ├── routes/        # Endpoints da API
│   │   ├── services/      # Lógica de negócio
│   │   ├── middleware/    # Middlewares Express
│   │   └── utils/         # Utilitários (EventBus, Logger)
│   ├── prisma/            # Schema e migrations
│   └── data/              # SQLite database
├── frontend/          # React + Vite + shadcn/ui
│   └── src/
│       ├── components/    # Componentes React
│       ├── pages/         # Páginas/rotas
│       └── hooks/         # Hooks customizados
├── config/            # Configurações (Icecast, etc.)
├── docs/              # Documentação e stories
├── scripts/           # Scripts de automação
└── bmad/              # BMAD Method (metodologia de desenvolvimento)
```

## Convenções de Código

### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

| Prefixo | Uso |
|---------|-----|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `docs:` | Documentação |
| `style:` | Formatação (não altera código) |
| `refactor:` | Refatoração |
| `test:` | Testes |
| `chore:` | Manutenção |

**Exemplo:** `feat(player): adicionar contador de listeners`

### Fluxo de Commit por Story

**IMPORTANTE:** Cada story deve resultar em um commit ao ser completada.

```bash
# Após completar uma story:
npm run validate && git add -A && git commit -m "feat(v1-XX): descrição da story"
```

**Convenção para stories:**
- `feat(v1-05):` - Story V1-05 implementada
- `feat(v1.5-02):` - Story V1.5-02 implementada
- `fix(v1-05):` - Correção na story V1-05

**Por que commitar por story?**
- Histórico granular e rastreável
- Fácil identificar quando uma feature foi introduzida
- Rollback cirúrgico se necessário
- Alinhamento com sprint-status.yaml

### TypeScript

- Usar tipos explícitos quando não óbvios
- Preferir interfaces a types para objetos
- Documentar funções públicas com JSDoc

### React

- Componentes funcionais com hooks
- Um componente por arquivo
- Nomear arquivos em PascalCase

### EventBus (Backend)

⚠️ **Importante:** Sempre implementar cleanup de subscriptions para evitar memory leaks.

```typescript
// ✅ Correto
class MyService implements Destroyable {
  private subscriptions = createSubscriptionManager();

  constructor() {
    this.subscriptions.subscribe('event', handler);
  }

  async destroy() {
    this.subscriptions.cleanup();
  }
}
```

Veja `CLAUDE.md` para mais detalhes sobre o padrão EventBus.

## Submetendo Pull Requests

1. **Crie uma branch:**
   ```bash
   git checkout -b feat/minha-feature
   ```

2. **Faça suas alterações e commit:**
   ```bash
   git add .
   git commit -m "feat: descrição clara da mudança"
   ```

3. **Execute a validação completa:**
   ```bash
   npm run validate  # Lint + testes + build (backend + frontend)
   ```

   Este comando executa:
   - `prisma generate` (gera client Prisma)
   - Testes com coverage (backend)
   - Build TypeScript (backend)
   - Lint (frontend)
   - Testes (frontend)
   - Build Vite (frontend)

4. **Push e abra o PR:**
   ```bash
   git push origin feat/minha-feature
   ```

5. **No PR, inclua:**
   - Descrição clara da mudança
   - Screenshots (se houver mudanças visuais)
   - Referência a issues relacionadas

## Processo de Review

1. O CI deve passar (testes, lint, build)
2. Um maintainer revisará seu PR
3. Podem ser solicitadas alterações
4. Após aprovação, o PR será merged

## Executando Testes

```bash
# Backend - testes unitários
cd backend && npm test

# Backend - testes com coverage
cd backend && npm run test:coverage

# Frontend - testes
cd frontend && npm test

# Lint (backend + frontend)
npm run lint
```

## Dúvidas?

Abra uma issue com a tag `question` ou entre em contato.

---

Obrigado por contribuir! 🎶
