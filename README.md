# FinIA

> Assistente financeiro pessoal via WhatsApp.

Sistema que interpreta mensagens em texto livre ("Mercado 89,90", "Recebi salário 5000"),
estrutura os dados financeiros e fornece análises via WhatsApp e dashboard web.

## 📚 Documentação

**Leia [`ARCHITECTURE.md`](./ARCHITECTURE.md) antes de qualquer modificação.** É a fonte de
verdade da arquitetura, decisões técnicas, anti-padrões e estado de implementação.

## 🚀 Setup

```bash
# 1. Variáveis de ambiente
cp .env.example .env
# Edite .env substituindo todos os _change_me
# Gere secrets com: openssl rand -hex 32

# 2. Subir infraestrutura
docker compose up -d postgres redis

# 3. Validar saúde dos containers
docker compose ps  # postgres e redis devem estar healthy

# 4. Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed

# 5. Subir o backend (escolha um)
npm run dev                              # local (recomendado para dev)
# OU
docker compose up -d backend             # dentro do Docker
```

## 🧪 Testando

```bash
# Backend deve responder
curl http://localhost:3000/health

# Verificar dados do seed
# pgAdmin: http://localhost:5050 (admin@finia.local / admin)
# → schema public → tabelas categories (12) e merchants (60)
```

## 🛠 Ferramentas

| URL | O que é |
|---|---|
| http://localhost:3000 | Backend Fastify |
| http://localhost:3000/admin/queues | Bull Board (filas BullMQ) |
| http://localhost:5050 | pgAdmin (Postgres UI) |
| http://localhost:8081 | Redis Commander |

## 📁 Estrutura

```
finia/
├── ARCHITECTURE.md       ← LEIA PRIMEIRO
├── docker-compose.yml
├── backend/
│   ├── prisma/           # schema.prisma + seed.ts + migrations
│   └── src/
│       ├── config/       # env, logger, constants
│       ├── database/     # prisma singleton
│       ├── cache/        # redis + cache.service
│       ├── queue/        # bullmq + workers + jobs
│       ├── modules/      # whatsapp, user, parse, transaction, message, notification
│       └── shared/       # errors, middleware, utils
└── frontend/             # React 18 + Vite + Tailwind + TanStack Query + Recharts
```

## 📌 Status do projeto

✅ **COMPLETO — Sprints 1 a 5 entregues e validados ao vivo.**
- **Sprint 1** — Pipeline WhatsApp → parser determinístico → transação (Postgres).
- **Sprint 2** — IA (Haiku) para mensagens ambíguas + consultas ("quanto gastei…").
- **Sprint 3** — Auth web (magic link + JWT cookie + rotação de refresh + isolamento
  de tenant), API REST `/api/v1` e SSE.
- **Sprint 4** — Orçamentos (alerta no WhatsApp), metas, InsightEngine (regras +
  narrativa Sonnet no cron semanal), relatórios HTML assíncronos.
- **Sprint 5** — Dashboard React (7 páginas), validado no navegador.

**228 testes do backend passando**; frontend com `tsc`+`vite build` e ESLint limpos.
Ver [`ARCHITECTURE.md` §8 e §10](./ARCHITECTURE.md#8-estado-da-implementação).

## 🐳 Rodar tudo em produção (1 comando)

Imagem Docker única: o backend compila e **serve o dashboard** (mesma origem, sem CORS).
A stack sobe backend + banco + Redis + Evolution (WhatsApp):

```bash
cp .env.production.example .env.production   # edite e gere segredos (openssl rand -hex 32/64)
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
# Dashboard: http://localhost:3000   ·   Evolution/WhatsApp: http://localhost:8080/manager
```

## ☁️ Publicar na nuvem (24/7)

Guia passo-a-passo para leigos em **[`DEPLOY.md`](./DEPLOY.md)**: Supabase (banco) +
Railway/Render (imagem Docker) — mantém WhatsApp, IA, filas e tempo real.
Conectar o WhatsApp: **[`docs/CONECTAR-WHATSAPP.md`](./docs/CONECTAR-WHATSAPP.md)**.

> Por que não Vercel? Nosso backend é um **servidor persistente** (filas, workers, cron,
> SSE) — não cabe no modelo serverless do Vercel. Use um host de **container**.

### Rodando o frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 (proxy /api → backend :3000)
```

Acesso: digite **dashboard** no WhatsApp e abra o link, ou gere um magic link e
acesse `/auth/magic?token=...`.

```bash
# Rodar os testes (precisa de postgres + redis no ar)
cd backend && npm test
npm run test:unit        # só unitários — não precisa de banco
```

## 📜 Licença

Privado.
