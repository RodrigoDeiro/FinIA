# FinIA — Architecture & Implementation Guide

> **Documento canônico do projeto.** Este arquivo é a fonte de verdade da arquitetura, decisões técnicas e estado de implementação do FinIA. Deve ser lido por qualquer agente (humano ou IA) antes de modificar o projeto.

---

## 1. Visão Geral do Produto

**FinIA** é um assistente financeiro pessoal acessível via WhatsApp. O usuário envia mensagens em texto livre descrevendo gastos, receitas, investimentos e dívidas; o sistema interpreta, estrutura e armazena cada movimentação, oferecendo análises e relatórios via WhatsApp e dashboard web.

**Diferencial técnico:** o sistema usa um parser determinístico local para resolver ~75-85% das mensagens sem chamar IA, reservando Claude apenas para mensagens ambíguas, geração de insights e relatórios. Resultado: custo de IA reduzido em ~5x comparado a uma abordagem AI-first.

**Modelo de identidade:** o número de WhatsApp é a identidade canônica. Não há cadastro tradicional — primeira mensagem cria o usuário automaticamente.

---

## 2. Princípios Arquiteturais

Estes princípios guiam toda decisão técnica. Quando houver conflito entre eles, a ordem listada é a ordem de prioridade.

1. **Phone-first identity.** O número de WhatsApp é a chave natural. O dashboard é uma extensão, não a porta principal.
2. **Parse first, ask Claude never.** O sistema resolve tudo deterministicamente quando possível. Claude é último recurso.
3. **Async by default.** Nada que dependa de serviço externo bloqueia request handlers. Tudo passa por fila.
4. **Abstraction over implementation.** WhatsApp, Storage e AI são interfaces. Implementações são intercambiáveis sem mudar o resto do sistema.
5. **Tenant isolation at database level.** Isolamento não é só responsabilidade da aplicação. PostgreSQL reforça via RLS (Sprint 3+).
6. **Fail fast on configuration.** Variáveis ausentes ou inválidas encerram o processo imediatamente, com mensagem clara.
7. **Modules validate their own contract.** Variáveis específicas de módulo são validadas quando o módulo inicializa — não no boot global.

---

## 3. Stack Técnico

### Backend
- **Runtime:** Node.js 22 (ESM nativo)
- **Linguagem:** TypeScript 5.6+ com `strict: true`
- **Module system:** `NodeNext` (não `bundler`) — imports relativos com `.js` obrigatório
- **Framework HTTP:** Fastify 5
- **ORM:** Prisma 6 (PostgreSQL)
- **Queue:** BullMQ 5 + Redis 7 (client dedicado, não compartilhado com cache)
- **Cache:** ioredis 5 (client separado do queue)
- **Validation:** Zod 3
- **Logger:** Pino (incluso no Fastify) com pretty-print em dev, JSON em prod
- **Date:** dayjs com plugins UTC e timezone
- **HTTP client:** Axios (interceptors, timeout configurável)
- **Tests:** Vitest 2 + Supertest 7

### Frontend (Sprint 5+)
- **Framework:** React 18 + Vite
- **Linguagem:** TypeScript 5.6+
- **Styling:** TailwindCSS + shadcn/ui
- **Charts:** Recharts
- **State:** TanStack Query + Zustand (se necessário)
- **Real-time:** Server-Sent Events (SSE) — não WebSockets

### Infraestrutura
- **Containerização:** Docker Compose para dev
- **Database:** PostgreSQL 16 (Alpine)
- **Cache/Queue:** Redis 7 (Alpine)
- **Dev tools:** pgAdmin 4, Redis Commander, Bull Board (servido pelo backend)
- **WhatsApp:** Evolution API (provisório, com abstração para Meta Cloud API)
- **AI:** Anthropic Claude (Haiku para parsing/queries, Sonnet para insights/relatórios)

### Build & Tooling
- **Dev:** `tsx watch` (esbuild) — não `ts-node`
- **Build:** `tsc -p tsconfig.build.json && tsc-alias` — sem bundler de produção
- **Lint:** ESLint 9 + Prettier 3
- **Git hooks:** Husky + lint-staged

---

## 4. Decisões Técnicas Aprovadas

Estas decisões foram debatidas e aprovadas. Não devem ser revertidas sem nova discussão arquitetural.

### Banco de Dados
- **PostgreSQL desde o início**, não SQLite. Concorrência e tipos reais importam.
- **Decimal(15, 2)** para valores monetários — nunca `Float`. Precisão financeira.
- **Decimal(20, 8)** para quantidade de investimentos (criptomoedas precisam de 8 casas).
- **CUID** para IDs em vez de UUID. Sortável por tempo, mais curto, sem overhead.
- **Soft delete** via `deletedAt: DateTime?` em todas as tabelas tenant-scoped.
- **Datas em UTC** no banco, sempre. Timezone do usuário aplicado só na apresentação.
- **Categorias dual-mode:** `origin: SYSTEM | USER` na mesma tabela, com `userId` nullable.
- **Merchants dual-mode:** global (userId=null) + aprendidos por usuário.
- **Investimentos como campos opcionais na Transaction**, não tabela separada.

### Imports e Module Resolution
- **TypeScript `NodeNext`** — não `bundler`. Backend Node.js puro precisa de imports com `.js` no source para que o output do `tsc` funcione em runtime ESM.
- **Path aliases** (`@config/*`, `@modules/*`, etc.) resolvidos via `tsc-alias` no build de produção.
- **Em dev:** `tsx` resolve aliases nativamente via tsconfig.
- **Em vitest:** mesma resolução via tsconfig (sem `vite-tsconfig-paths`).

### Validação de Configuração
- **`env.ts`** valida apenas variáveis globais do processo (DATABASE_URL, REDIS_URL, NODE_ENV, etc.).
- **Variáveis de módulo** (EVOLUTION_*, ANTHROPIC_*, JWT_*) são validadas quando o módulo inicializa, via `assertWhatsAppEnv()`, `assertAiEnv()`, `assertAuthEnv()`.
- **Padrão `asserts`** do TypeScript permite type narrowing após o assert: variáveis `string | undefined` passam a ser `string`.
- **Fast fail:** `process.exit(1)` em vez de `throw` para erros de configuração — não são recuperáveis.

### Singletons (Prisma + Redis)
- **Padrão `globalThis`** para sobreviver ao hot reload do `tsx watch`. Sem isso, cada reload cria conexão nova e esgota o pool do PostgreSQL/Redis.
- **Em produção:** o padrão não tem efeito — o processo Docker tem uma instância única naturalmente.
- **Em test (`isTest`):** Prisma usa `log: []` para não poluir output dos testes.

### Redis: dois clients
- **`redis`** (cache geral): comportamento padrão do ioredis, `maxRetriesPerRequest` padrão.
- **`redisQueue`** (BullMQ): `maxRetriesPerRequest: null` obrigatório — BullMQ usa comandos bloqueantes que não podem abortar após N tentativas.

### Logging (Pino)
- **`*.password`** no `redact` NÃO redata `{ password: 'x' }` no root. É preciso listar ambos: `'password'` (root) e `'*.password'` (nível abaixo).
- **`loggerOptions`** é passado ao Fastify (que cria a instância e adiciona `request.log`).
- **`logger`** standalone exportado para workers, scripts e código fora do contexto HTTP.
- **`ECONNREFUSED`** durante reconexão é logado como `warn`, não `error`, para evitar paging em blips de rede.

### WhatsApp Gateway
- **Provider Interface (`IWhatsAppProvider`)** desacoplado da Evolution API. Migração futura para Meta Cloud API troca uma linha de configuração.
- **`NormalizedMessage`** é o tipo interno — Evolution e Meta normalizam para o mesmo formato antes de seguir no pipeline.
- **Webhook responde 200 imediatamente** após validação HMAC. Processamento real acontece em fila assíncrona.
- **Idempotência:** `messageId` do provider armazenado no Redis por 24h. Webhook duplicado é descartado.

### IA (Claude) — Estratégia de Custo
- **Parser determinístico primeiro.** Confidence score 0.00-1.00 com pontuação por componente extraído.
- **Thresholds:** ≥0.85 salva direto, 0.65-0.84 salva com flag de revisão, <0.65 vai para Claude.
- **Modelos:** Haiku 3 para parsing/queries (rápido e barato), Sonnet 4 para insights/relatórios (mais capaz).
- **Memória da IA em três camadas:**
  - **Camada 1 (Redis, 24h):** últimas 5 mensagens, estado da conversa, transações das últimas 2h
  - **Camada 2 (Redis, atualizado por evento):** perfil financeiro do mês
  - **Camada 3 (PostgreSQL):** perfil de longo prazo, só usado em insights/relatórios

### Build & Production
- **`tsc` puro + `tsc-alias`** — sem bundler de produção. Pipeline simples, fácil de debugar.
- **`postinstall: prisma generate`** garante que o Prisma Client está sempre gerado após `npm install`.
- **Dockerfile copia `prisma/` antes de `npm install`** porque `postinstall` precisa do schema.
- **`node_modules/.bin/tsx`** chamada direta no CMD do Dockerfile (não `npx`) — tsx vira PID 1 e recebe SIGTERM corretamente.

### Autenticação (Sprint 3+)
- **Magic Links via WhatsApp**, não senha. O telefone já é segundo fator.
- **JWT em cookie `httpOnly` + `Secure` + `SameSite=Lax`** — nunca em localStorage.
- **Refresh token com rotação** — detecta roubo de token (mesmo token usado duas vezes = ambas sessões revogadas).
- **Sessions tabela** armazena hash bcrypt do refresh token, metadata (IP, UA), e permite revogação granular.

---

## 5. Estrutura de Pastas

```
finia/
├── docker-compose.yml
├── ARCHITECTURE.md          # este arquivo
├── README.md
├── .env                     # gitignored
├── .env.example
│
├── backend/
│   ├── Dockerfile.dev
│   ├── .dockerignore
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   │
│   └── src/
│       ├── server.ts             # entry point
│       ├── app.ts                # registra plugins e módulos
│       │
│       ├── config/
│       │   ├── env.ts            # validação Zod + asserts por módulo
│       │   ├── logger.ts         # Pino options + instance
│       │   └── constants.ts
│       │
│       ├── database/
│       │   └── prisma.ts         # singleton + connect/disconnect
│       │
│       ├── cache/
│       │   ├── redis.ts          # dois singletons + connect/disconnect
│       │   └── cache.service.ts  # utilitários tipados
│       │
│       ├── queue/
│       │   ├── queue.config.ts   # config base BullMQ
│       │   ├── queues.ts         # definição das 4 filas
│       │   ├── workers/
│       │   │   ├── message.worker.ts
│       │   │   └── notification.worker.ts
│       │   └── jobs/
│       │       ├── message.job.ts
│       │       └── notification.job.ts
│       │
│       ├── modules/
│       │   ├── whatsapp/
│       │   │   ├── whatsapp.module.ts
│       │   │   ├── whatsapp.routes.ts
│       │   │   ├── whatsapp.controller.ts
│       │   │   ├── providers/
│       │   │   │   ├── whatsapp.provider.interface.ts
│       │   │   │   ├── evolution/
│       │   │   │   │   ├── evolution.provider.ts
│       │   │   │   │   ├── evolution.normalizer.ts
│       │   │   │   │   └── evolution.types.ts
│       │   │   │   └── meta/         # Sprint futuro
│       │   │   └── types/
│       │   │       └── normalized-message.type.ts
│       │   │
│       │   ├── user/
│       │   │   ├── user.module.ts
│       │   │   ├── user.repository.ts
│       │   │   ├── user.service.ts
│       │   │   └── user.types.ts
│       │   │
│       │   ├── parse/
│       │   │   ├── parse.module.ts
│       │   │   ├── parse.orchestrator.ts
│       │   │   ├── deterministic/
│       │   │   │   ├── deterministic.parser.ts
│       │   │   │   ├── amount.extractor.ts
│       │   │   │   ├── intent.extractor.ts
│       │   │   │   ├── date.extractor.ts
│       │   │   │   ├── merchant.extractor.ts
│       │   │   │   ├── confidence.calculator.ts
│       │   │   │   └── merchant-db/
│       │   │   │       └── merchant.db.ts
│       │   │   └── types/
│       │   │       └── parse-result.type.ts
│       │   │
│       │   ├── transaction/
│       │   │   ├── transaction.module.ts
│       │   │   ├── transaction.repository.ts
│       │   │   ├── transaction.service.ts
│       │   │   ├── transaction.validator.ts
│       │   │   └── transaction.types.ts
│       │   │
│       │   ├── message/
│       │   │   ├── message.router.service.ts
│       │   │   ├── message.processor.ts
│       │   │   ├── command/
│       │   │   │   ├── command.detector.ts
│       │   │   │   └── handlers/
│       │   │   └── types/
│       │   │
│       │   ├── notification/
│       │   │   ├── notification.service.ts
│       │   │   └── templates/
│       │   │
│       │   ├── auth/            # Sprint 3
│       │   ├── ai/              # Sprint 2
│       │   ├── insight/         # Sprint 4
│       │   └── report/          # Sprint 4
│       │
│       ├── shared/
│       │   ├── types/
│       │   │   ├── fastify.d.ts
│       │   │   └── index.ts
│       │   ├── errors/
│       │   │   ├── app.error.ts
│       │   │   ├── validation.error.ts
│       │   │   ├── not-found.error.ts
│       │   │   └── webhook.error.ts
│       │   ├── middleware/
│       │   │   ├── error-handler.ts
│       │   │   └── request-id.ts
│       │   └── utils/
│       │       ├── phone.util.ts
│       │       ├── currency.util.ts
│       │       ├── date.util.ts
│       │       └── crypto.util.ts
│       │
│       └── tests/
│           ├── unit/
│           ├── integration/
│           └── fixtures/
│
└── frontend/                # Sprint 5+
```

---

## 6. Modelo de Dados (Schema Resumido)

Schema completo está em `backend/prisma/schema.prisma`. Resumo das 12 entidades:

| Entidade | Sprint | Propósito |
|---|---|---|
| **User** | 1 | Identidade — `phoneNumber` (E.164) é a chave natural única |
| **Account** | 1 | Contas financeiras (Principal criada no onboarding) |
| **Category** | 1 | 12 categorias do sistema + customizadas por usuário |
| **Merchant** | 1 | MerchantDB global (~60) + aprendidos por usuário |
| **Transaction** | 1 | Todas as movimentações (com campos opcionais de investimento) |
| **MessageLog** | 1 | Idempotência de webhooks + auditoria de mensagens recebidas |
| **Session** | 3 | Sessões web — refresh token hash, metadata, revogação granular |
| **Budget** | 4 | Limites de gasto por categoria |
| **Goal** | 4 | Metas financeiras com progresso |
| **AIInsight** | 4 | Insights gerados (deterministicamente ou por Claude) |
| **Report** | 4 | Relatórios gerados sob demanda (HTML/PDF) |
| **AuditLog** | 1+ | Append-only de ações sensíveis |

### Enums Principais
- `TransactionType`: EXPENSE, INCOME, INVESTMENT, TRANSFER, DEBT
- `TransactionSource`: WHATSAPP, WEB, IMPORT, MANUAL
- `ParseMethod`: DETERMINISTIC, AI, HYBRID, MANUAL
- `AccountType`: CHECKING, SAVINGS, CREDIT_CARD, INVESTMENT, CASH, WALLET, OTHER
- `CategoryOrigin`: SYSTEM, USER
- `InsightType`: SPENDING_INCREASE, SPENDING_DECREASE, CATEGORY_RANKING, BUDGET_ALERT, GOAL_PROGRESS, SAVINGS_TREND, ANOMALY, GENERIC
- `ReportStatus`: PENDING, GENERATING, COMPLETED, FAILED

---

## 7. Fluxos Principais

### 7.1 Mensagem de Transação (Caminho Determinístico)

```
WhatsApp → Evolution API → POST /webhook/evolution
   ↓
Fastify Webhook Handler
   ├── Valida HMAC do header x-evolution-signature
   ├── EvolutionProvider.processIncomingWebhook() → NormalizedMessage
   ├── Verifica idempotência (Redis: messageId visto?)
   ├── Publica job em BullMQ queue "message.incoming"
   └── Retorna 200 OK imediatamente
   ↓
MessageProcessorWorker (consumer)
   ├── UserService.findOrCreateByPhone(phone)
   ├── MessageRouter.route(message, user)
   │     ├── Comando? → CommandHandler (ajuda, oi, dashboard)
   │     └── Texto livre? → ParseOrchestrator
   ↓
ParseOrchestrator
   ├── DeterministicParser.parse(text)
   │     ├── AmountExtractor    (regex + texto-para-número)
   │     ├── IntentExtractor    (keywords → EXPENSE/INCOME/INVESTMENT)
   │     ├── DateExtractor      (hoje/ontem/DD-MM)
   │     ├── MerchantExtractor  (lookup em MerchantDB)
   │     └── ConfidenceCalculator
   ├── confidence ≥ 0.85 → TransactionService.create()
   ├── confidence 0.65-0.85 → cria com needsReview: true
   └── confidence < 0.65 → AIOrchestrator (Sprint 2)
   ↓
TransactionService.create()
   ├── Valida com Zod
   ├── Salva no PostgreSQL (Prisma)
   ├── Invalida cache do usuário no Redis
   └── Publica evento "transaction.created"
   ↓
NotificationService.send()
   ├── Formata template de confirmação
   ├── Publica em queue "notification.outbound"
   └── Worker envia via EvolutionProvider.sendText()
```

### 7.2 Comando de Consulta (Sprint 2)

```
"quanto gastei esse mês" → CommandDetector identifica intent QUERY
   ↓
DeterministicQueryParser tenta resolver
   ├── Match com SQL pré-definido (sem Claude) → ~70% das queries
   └── Query complexa → AIOrchestrator com Haiku (formata resposta sobre dados SQL)
```

### 7.3 Geração de Insights Semanais (Sprint 4)

```
Cron (segunda-feira 8h) por usuário → queue "insight.generator"
   ↓
InsightEngine
   ├── Coleta dados agregados (PostgreSQL) — mês atual vs anterior, top merchants
   ├── Gera insights determinísticos (variações > 20%, etc.)
   └── Se há insights narrativos: 1x/semana → Sonnet
       prompt: dados agregados + histórico 3 meses → 3-5 insights estruturados
   ↓
Salva em ai_insights + envia resumo via WhatsApp
```

---

## 8. Estado da Implementação

### ✅ Concluído (13 arquivos)

| # | Arquivo | Função |
|---|---|---|
| 1 | `docker-compose.yml` | 5 serviços (postgres, redis, backend, pgadmin, redis-commander) com healthchecks |
| 2 | `backend/package.json` | Dependências completas incluindo @bull-board, tsc-alias |
| 3 | `backend/tsconfig.json` | NodeNext + path aliases |
| 4 | `backend/tsconfig.build.json` | Build de produção sem testes |
| 5 | `backend/Dockerfile.dev` | Hot reload via tsx watch + COPY prisma antes de npm install |
| 6 | `backend/.dockerignore` | 36 regras |
| 7 | `backend/.env.example` | 25 variáveis em 7 grupos, com placeholders e instruções |
| 8 | `backend/src/config/env.ts` | Validação Zod + asserts por módulo (assertWhatsAppEnv, assertAiEnv, assertAuthEnv) |
| 9 | `backend/src/config/logger.ts` | Pino com pretty em dev, JSON em prod, redação de campos sensíveis (root + nested) |
| 10 | `backend/src/database/prisma.ts` | Singleton globalThis + connect/disconnect + tipos PrismaDB, PrismaTx |
| 11 | `backend/src/cache/redis.ts` | Dois clients (cache + queue), backoff exponencial, reconnectOnError seletivo |
| 12 | `backend/prisma/schema.prisma` | 12 modelos + 10 enums, validado estruturalmente |
| 13 | `backend/prisma/seed.ts` | 12 categorias + 60 merchants brasileiros, idempotente (upsert) |

### ✅ Sprint 1 — Implementado, testado e validado (todos os arquivos abaixo prontos)

> Pipeline ponta-a-ponta validado: webhook (HMAC) → fila BullMQ → parser determinístico
> → transação no Postgres → confirmação enfileirada. 122 testes passando (113 unitários +
> 9 de integração), typecheck/lint/build verdes. Cobertura da lógica de parsing 95–100%.

**Cache + Queue (5)**
- `src/cache/cache.service.ts` — utilitários tipados (get<T>, set, delete, getOrSet)
- `src/queue/queue.config.ts` — config base BullMQ
- `src/queue/queues.ts` — 4 filas (message.incoming, notification.outbound, insight.generator, report.generator)
- `src/queue/jobs/message.job.ts` — tipos do job
- `src/queue/jobs/notification.job.ts` — tipos do job

**WhatsApp Gateway (6)**
- `src/modules/whatsapp/providers/whatsapp.provider.interface.ts`
- `src/modules/whatsapp/types/normalized-message.type.ts`
- `src/modules/whatsapp/providers/evolution/evolution.types.ts`
- `src/modules/whatsapp/providers/evolution/evolution.normalizer.ts`
- `src/modules/whatsapp/providers/evolution/evolution.provider.ts`
- `src/modules/whatsapp/whatsapp.module.ts` + `whatsapp.routes.ts` + `whatsapp.controller.ts`

**Parse Module (8) — coração do Sprint 1**
- `src/modules/parse/deterministic/amount.extractor.ts` — regex BR para R$ X,XX; X reais; mil; etc.
- `src/modules/parse/deterministic/intent.extractor.ts` — keywords EXPENSE/INCOME/INVESTMENT
- `src/modules/parse/deterministic/date.extractor.ts` — hoje/ontem/DD-MM
- `src/modules/parse/deterministic/merchant.extractor.ts` — fuzzy match em MerchantDB
- `src/modules/parse/deterministic/confidence.calculator.ts` — score 0-1
- `src/modules/parse/deterministic/merchant-db/merchant.db.ts` — load do Postgres + cache Redis
- `src/modules/parse/deterministic/deterministic.parser.ts` — orquestra os 4 extractors
- `src/modules/parse/parse.orchestrator.ts` — decide deterministic vs AI

**User + Transaction (4)**
- `src/modules/user/user.repository.ts` + `user.service.ts` (findOrCreateByPhone, onboarding)
- `src/modules/transaction/transaction.repository.ts` + `transaction.service.ts` + `transaction.validator.ts`

**Message Processing + Notification (5)**
- `src/modules/message/message.router.service.ts`
- `src/modules/message/message.processor.ts` — orquestra pipeline completo
- `src/modules/message/command/command.detector.ts` + handlers (help, greeting)
- `src/modules/notification/notification.service.ts`
- `src/modules/notification/templates/*.ts` — confirmação, welcome, help, error

**Workers + Server + Shared (5)**
- `src/queue/workers/message.worker.ts`
- `src/queue/workers/notification.worker.ts`
- `src/server.ts` + `src/app.ts` — graceful shutdown, health check
- `src/shared/errors/*.ts` — AppError, ValidationError, NotFoundError, WebhookError
- `src/shared/middleware/error-handler.ts` + `request-id.ts`
- `src/shared/utils/phone.util.ts` + `currency.util.ts` + `date.util.ts` + `crypto.util.ts`

**Tests (9 arquivos, 122 testes)**
- `tests/unit/parse/*` — amount (37 casos), intent, date, merchant, confidence, deterministic.parser
- `tests/unit/utils/*` — currency, phone, crypto
- `tests/integration/webhook.test.ts` — HMAC, idempotência, eventos ignorados (via app.inject)
- `tests/integration/pipeline.test.ts` — mensagem → usuário/conta/transação/MessageLog no DB
- `vitest.config.ts` + `tests/setup.ts` — aliases manuais, carga de .env, NODE_ENV=test

### 🔧 Ajustes e decisões durante a implementação do Sprint 1

Correções na fundação (os 13 arquivos iniciais não passavam em typecheck/lint/boot):
- **`prisma.ts`**: `as const` gerava tupla `readonly` incompatível com `Prisma.LogLevel[]`.
- **`logger.ts`**: `pino.stdTimeFunctions.localTime` não existe → `epochTime` (o pino-pretty
  formata a hora local via `translateTime`).
- **`redis.ts`**: parâmetro `delay` do evento `reconnecting` sem tipo (barrado por `strict`).
- **`tsconfig`**: `rootDir` movido para o build config (o typecheck inclui `prisma/seed.ts`).
- **`seed.ts`**: `upsert` em unique composta com `userId: null` falha no Prisma 6 → reescrito
  com `findFirst` + `create/update`. **Atenção:** `@@unique([userId, slug])` NÃO garante
  unicidade nas linhas SYSTEM (no Postgres, `NULL` é distinto em índice unique); a
  idempotência do seed vem do `findFirst`, não da constraint.
- **`.env.example`**: `JWT_SECRET` deixado comentado (é opcional no Sprint 1; se preenchido
  precisa ter ≥32 chars, senão o boot falha de propósito).

Dependências:
- **`ioredis` fixado em `5.10.1`** (mesma versão que o BullMQ usa) para evitar cópia
  duplicada e o conflito de tipos da conexão.
- **`@bull-board` atualizado para `^8.0.0`**: o pin `^5` puxava `@fastify/static@6`
  (era Fastify 4) e era incompatível com o Fastify 5 do projeto; o 8 usa `@fastify/static@9`.

Infra:
- **Redis `maxmemory-policy allkeys-lru`** (definido no compose para dev) gera um aviso do
  BullMQ. Em produção, o Redis das filas deve ser `noeviction` para não arriscar perder jobs.

Calibração do `confidence.calculator` (pesos): amount 0.45, contexto 0.20, tipo 0.20,
merchant 0.15. Ex.: "Mercado 89,90" → 0.65 (salva com revisão); "iFood 45,90" → 0.80;
"recebi salário 5000" → 0.85 (salva direto); número solto → 0.45 (vai para IA no Sprint 2).

---

## 9. Validação Crítica antes de Continuar

Antes de implementar mais código, **rodar localmente para validar a fundação:**

```bash
# 1. Setup
cp .env.example .env
# Editar .env: trocar todos os *_change_me por valores reais
# Gerar secrets: openssl rand -hex 32

# 2. Subir infraestrutura
docker compose up -d postgres redis

# 3. Validar conexões
docker compose ps  # postgres e redis devem estar healthy

# 4. Instalar deps localmente (para tsx funcionar fora do Docker se preferir)
cd backend
npm install

# 5. Gerar Prisma Client
npx prisma generate

# 6. Validar schema
npx prisma validate

# 7. Aplicar migration inicial
npx prisma migrate dev --name init

# 8. Rodar seed
npm run db:seed

# 9. Verificar dados no pgAdmin
# http://localhost:5050 (admin@finia.local / admin)
# Deve ver: 12 categorias, 60 merchants
```

**Se algum passo falhar, corrigir antes de continuar.** Erros típicos:
- Versões de pacotes incompatíveis → ajustar `package.json`
- Prisma binary não compila no Alpine → confirmar `binaryTargets` no schema
- Conexão Postgres recusada → verificar variáveis no `.env` vs `docker-compose.yml`

---

## 10. Próximos Sprints (Visão Resumida)

### Sprint 2 — AI Integration + Queries
- ✅ **AI Module para mensagens com confidence < 0.65 — CONCLUÍDO e validado ao vivo.**
  - Integração `@anthropic-ai/sdk`; modelo **`claude-haiku-4-5`** para parsing
    (IDs do doc original — claude-3-haiku/sonnet-4 — estavam defasados; ver
    `AI_MODELS` em `config/constants.ts`).
  - `ai.orchestrator` (híbrido: Claude extrai tipo/valor/merchant/categoria;
    o `date.extractor` determinístico resolve a data), `ai.transaction.parser`
    (tool use com saída tipada + validação defensiva), `prompt.factory`,
    `category.resolver` (mapeia slug→id), `anthropic.client`, `ai.module`.
  - Wired no `message.processor`: `ai_fallback` → Claude → transação `parseMethod=AI`.
  - **IA é opcional**: sem `ANTHROPIC_API_KEY` o pipeline degrada para "não entendi".
  - Provado ao vivo: "almocei fora hoje, saiu uns *trinta e cinco reais*" (número por
    extenso, que o determinístico não lê) → EXPENSE R$35 · alimentação · método AI.
- ✅ **Queries — CONCLUÍDO e validado ao vivo.** Módulo `query/`:
  - `query.detector` (isFinancialQuery — conservador, não sequestra transações;
    detectQueryMetric — EXPENSE_SUM/INCOME_SUM/BALANCE/SUMMARY/TOP_CATEGORIES),
    `period.extractor` (hoje/ontem/essa semana/mês passado..., semana começa na
    segunda), `deterministic-query.parser` (métrica+período+categoria; filtro de
    categoria só em EXPENSE_SUM; aliases tipo "comida"→alimentacao),
    `query.repository` (agregações Prisma), `query.templates`, `query.service`,
    `query.orchestrator` (determinístico → IA → fallback).
  - Roteamento: `message.router` decide comando → consulta → texto livre.
    "relatorio" migrou de comando dashboard para consulta SUMMARY.
  - ✅ **Memória da IA (§4):** Camada 1 = `ai/conversation.memory` (últimas 5 trocas,
    Redis TTL 24h); Camada 2 = `ai/context.builder` (snapshot mensal cacheado sob
    `user:{id}:summary`, invalidado por evento em transaction.created).
    `ai/ai.query.responder` (Haiku) responde consultas complexas APENAS sobre o
    snapshot + conversa (anti-alucinação).
  - Provado ao vivo: "quanto gastei esse mes?"→R$130 · "com transporte?"→R$30 ·
    "resumo"→balanço completo · "to gastando demais?"→resposta da IA com números
    reais do snapshot (calculou 2,6% da renda).
  - Infra: Redis migrado para `maxmemory-policy noeviction` (allkeys-lru podia
    descartar jobs BullMQ silenciosamente).

### Sprint 3 — Auth Web + Dashboard API — ✅ CONCLUÍDO e validado ao vivo
- ✅ **Magic Link via WhatsApp**: comando "dashboard" → `auth/magic-link.service`
  (token 32 bytes → Redis `magiclink:{token}` TTL 15min; consumo atômico via
  GETDEL — uso único garantido mesmo em corrida).
- ✅ **JWT em cookie httpOnly + refresh com rotação**: `auth/session.service` —
  refresh token no formato `{sessionId}.{segredo}`, hash bcrypt na tabela
  sessions, rotação a cada refresh, REUSO DE TOKEN ANTIGO ⇒ sessão revogada
  (roubo detectado). Access JWT: sub=sessionId, uid=userId; guard revalida a
  sessão no banco a cada request (revogação tem efeito imediato). Cookie de
  refresh com path restrito a /api/v1/auth.
- ✅ **Tenant isolation + soft delete**: `database/tenant.context.ts` (ALS) +
  `database/tenant.prisma.ts` ($extends: injeta userId em where/data, filtra
  deletedAt nas leituras, BLOQUEIA findUnique/update/delete — só operações
  filtráveis). ⚠️ Node 24 (AsyncContextFrame): `als.enterWith()` em hook async
  NÃO propaga para o handler — o padrão correto é onRequest com callback:
  `als.run(store, done)` + guard MUTA o store (mesma técnica do
  @fastify/request-context). Descoberto e corrigido com teste de integração.
- ✅ **REST /api/v1**: me, accounts, categories (dual-mode via client base),
  summary (snapshot cacheado), transactions (GET com filtros/paginação, POST
  manual source=WEB/parseMethod=MANUAL, PATCH, DELETE soft). Regra de segurança
  dos repos web: findFirst/updateMany/deleteMany (count 0 ⇒ 404), nunca
  operações por chave única.
- ✅ **SSE /api/v1/events**: event bus in-process (`shared/events/event.bus`) +
  reply.hijack(); transação criada/alterada/excluída chega em tempo real por
  usuário. Provado ao vivo: "ifood 47,90" via WhatsApp apareceu no stream.
- ✅ Auth: `POST /auth/magic|refresh|logout`, `GET /auth/sessions`,
  `POST /auth/sessions/:id/revoke`. 12 testes de integração (banco/Redis reais)
  + 201 testes totais.
- 🔜 Adiado: RLS nativo do PostgreSQL (a extension cobre o Sprint 3; RLS entra
  como endurecimento futuro).

### Sprint 4 — Budgets, Goals, Insights, Reports — ✅ CONCLUÍDO e validado ao vivo
- ✅ **Budgets**: CRUD /api/v1/budgets (um ativo por categoria+período; status
  calculado — spent/ratio/remaining na janela corrente via `budget.period`).
  **Alertas via WhatsApp**: `budget.watcher` escuta transaction.created no event
  bus; ao cruzar o alertThreshold envia alerta + registra insight BUDGET_ALERT.
  Anti-spam: 1 alerta por budget por período (SET NX no Redis com chave do
  período). Provado ao vivo: R$50→sem alerta; +R$40 (90% de R$100)→"⚠️ 90%".
- ✅ **Goals**: CRUD /api/v1/goals + POST /:id/deposit (incrementa progresso;
  ao atingir o alvo → status ACHIEVED + parabéns via WhatsApp).
- ✅ **InsightEngine (§7.3)**: `insight.data` (agregados: mês atual vs anterior,
  breakdown comparado, top merchants, maior gasto, histórico 4 meses) →
  `insight.rules` (puras: variação ±20% c/ piso R$50, categoria dominante ≥35%,
  economia ≥20% da renda, anomalia ≥3x média) → `insight.narrative` (Sonnet via
  tool use, 2-4 insights, SÓ no gatilho cron — controle de custo §4; sob demanda
  = determinístico grátis) → persiste em ai_insights com dedupe por
  tipo+título+período → resumo top-3 via WhatsApp (só cron).
  Cron: BullMQ upsertJobScheduler 'weekly-insights' (segunda 8h SP) → job
  fanout enumera usuários ativos (45d) → 1 job por usuário.
  API: GET /insights, POST /generate (202), PATCH /:id/seen|/:id/dismiss.
  Provado ao vivo: 9 insights (5 determinísticos + 4 narrativos do Sonnet).
- ✅ **Reports**: fluxo assíncrono PENDING→GENERATING→COMPLETED/FAILED via fila
  report.generator. `report.template` = HTML autocontido (CSS inline, escapeHtml
  anti-XSS, imprime bem). `shared/storage` = interface IStorage + LocalStorage
  (STORAGE_PATH, caminhos relativos no banco, guard anti path-traversal) —
  trocar para S3 = nova implementação da interface.
  API: POST /reports (202), GET /reports, GET /:id/download (marca downloadedAt).
  ⚠️ Decisão conservadora (§13): PDF server-side via Puppeteer ADIADO — evita
  ~150MB de Chromium e fragilidade no Windows; o HTML já imprime em PDF pelo
  navegador. Revisitar se o produto exigir PDF nativo.
- Workers novos: insight.worker (fanout + generate) e report.worker, com
  graceful shutdown no server.ts. 23 arquivos, 224 testes totais (6 novos de
  integração + 17 unitários).

### Sprint 5 — Frontend React — ✅ CONCLUÍDO e validado ao vivo (no navegador)
- ✅ **Stack**: Vite 5 + React 18 + TS (strict, `verbatimModuleSyntax`) +
  Tailwind v3 + TanStack Query v5 + React Router v6 + Recharts + lucide-react.
  Pasta `finia/frontend/`.
- ✅ **Same-origin via proxy do Vite** (`/api → :3000`): cookies httpOnly de
  sessão e SSE funcionam sem CORS. Componentes de UI escritos à mão no espírito
  shadcn (`components/ui.tsx`) — sem o CLI interativo.
- ✅ **Cliente HTTP** (`lib/api.ts`): `credentials:'include'` + auto-refresh
  ÚNICO em 401 (coalescido) → retry; falha → evento `finia:unauthorized`
  (Layout redireciona a /login).
- ✅ **Auth**: `/login` (instrui "dashboard" no WhatsApp) + `/auth/magic`
  (consome o token, StrictMode-safe via useRef).
- ✅ **Páginas**: Visão geral (KPIs + barras mês-a-mês + donut por categoria +
  últimas movimentações), Transações (filtros, paginação, criar/corrigir
  categoria/excluir, badges auto/IA/manual + flag "revisar"), Orçamentos
  (progress + %), Metas (progresso + depósito + "Concluída"), Insights (lista +
  gerar sob demanda + dispensar), Relatórios (gerar assíncrono + polling de
  status + baixar HTML), Configurações (perfil + contas).
- ✅ **Tempo real**: `useRealtime` abre EventSource em `/api/v1/events` e
  invalida as queries em transaction.created/updated/deleted.
- ✅ **Gráficos**: donut + barras (Recharts) no dashboard.
- ✅ **Validado no navegador** (preview): login por magic link → todas as 7
  páginas renderizando dados reais; relatório gerado ao vivo (fila → "Pronto" →
  download); build `tsc -b && vite build` limpo; ESLint flat config limpo.
- Detalhe corrigido na verificação: barra de progresso de META cheia agora é
  verde (antes reusava a semântica de orçamento — vermelho = estouro).
- ~35 arquivos. **PROJETO COMPLETO — Sprints 1 a 5 entregues e validados.**

---

## 11. Anti-padrões a Evitar

Estes erros foram explicitamente discutidos. Não os repita:

1. ❌ **Usar `bundler` em vez de `NodeNext`.** Quebra em produção quando `tsc` não adiciona `.js` nos imports.
2. ❌ **Compartilhar Redis client entre cache e BullMQ.** Comandos bloqueantes do BullMQ travam o cache.
3. ❌ **`*.password` no Pino redact apenas.** Não captura root-level. Listar ambos `'password'` e `'*.password'`.
4. ❌ **Validar EVOLUTION_* no boot global.** Bloqueia o servidor de subir sem credenciais WhatsApp.
5. ❌ **Float para valores monetários.** Perde precisão em soma de centavos. Use Decimal.
6. ❌ **Chamar Claude para toda mensagem.** Custo 5x maior. Parser determinístico primeiro.
7. ❌ **Processar webhook de forma síncrona.** Timeout do Evolution API gera mensagens duplicadas.
8. ❌ **`npx tsx` no Dockerfile CMD.** Overhead de 200ms + não recebe SIGTERM corretamente.
9. ❌ **`COPY src/` antes de `prisma/` no Dockerfile.** `postinstall` precisa do schema para gerar Prisma Client.
10. ❌ **Senhas em localStorage.** Use cookies httpOnly + Secure + SameSite.

---

## 12. Padrões de Código

### Naming Conventions
- **Arquivos:** kebab-case com sufixo de tipo (`user.service.ts`, `parse.orchestrator.ts`)
- **Classes/Interfaces:** PascalCase (`TransactionService`, `IWhatsAppProvider`)
- **Funções/variáveis:** camelCase
- **Constantes:** SCREAMING_SNAKE_CASE
- **Tipos exportados:** PascalCase com sufixo `.type.ts` em arquivos dedicados

### Imports (NodeNext)
```typescript
// ✅ Path alias — sem extensão
import { env } from '@config/env.js'
import { prisma } from '@database/prisma.js'

// ✅ Pacote npm — sem extensão
import Fastify from 'fastify'
import { Queue } from 'bullmq'

// ✅ Import relativo — COM .js obrigatório
import { foo } from './foo.js'

// ❌ Import relativo sem .js — erro de compilação
import { foo } from './foo'
```

### Error Handling
- Errors customizados estendem `AppError` (base)
- `AppError` tem `statusCode`, `code` (string identificador), `message`
- Error handler global converte para JSON padronizado
- Nunca expor stack trace em produção
- Sempre logar com `request.log.error({ err })` ou `logger.error({ err })`

### Testes
- **Unit:** funções puras (extractors, calculators, utils)
- **Integration:** fluxos com banco real (PostgreSQL de teste) + Redis
- **Fixtures:** dados em `tests/fixtures/`
- **Cobertura mínima:** 85% no Parse Module, 70% no geral

---

## 13. Como Pedir Ajuda Arquitetural

Quando bater em uma decisão não-óbvia (não listada em "Decisões Aprovadas"), antes de implementar:

1. **Leia novamente as seções 2, 4 e 11.** A resposta pode estar lá.
2. **Considere o princípio de menor surpresa.** A solução deve se alinhar com o que já existe.
3. **Se ainda for ambíguo:** documente o trade-off e implemente a opção mais conservadora.

Decisões arquiteturais novas devem ser **adicionadas a este documento** após implementação.

---

## 14. Comandos Frequentes

```bash
# Infraestrutura
docker compose up -d                    # sobe tudo
docker compose logs -f backend          # logs do backend
docker compose down                     # para containers (mantém volumes)
docker compose down -v                  # remove volumes (RESET TOTAL)

# Backend (dentro do container)
docker compose exec backend npm run dev
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed
docker compose exec backend npm run db:studio
docker compose exec backend npm test

# Backend (local, com containers de infra)
cd backend
npm run dev          # tsx watch
npm run typecheck    # tsc --noEmit
npm run lint
npm test
npm run db:studio    # abre Prisma Studio em :5555

# Acesso a UIs
# Backend:          http://localhost:3000
# Bull Board:       http://localhost:3000/admin/queues
# pgAdmin:          http://localhost:5050
# Redis Commander:  http://localhost:8081
```

---

**Última atualização:** Sprint 1 — **concluído** (backend completo, 122 testes, pipeline
WhatsApp→transação validado ponta-a-ponta).
**Próximo Sprint:** Sprint 2 — AI Integration + Queries (Claude para mensagens com
confidence < 0.65, DeterministicQueryParser, ContextBuilder).
