# 🚀 FinIA — Guia de Deploy (nuvem, 24/7)

Este guia coloca o FinIA **no ar de verdade** mantendo tudo: dashboard web, WhatsApp,
IA, filas e tempo real. É escrito para quem **não é técnico** — siga na ordem.

> Nossa aplicação é um **servidor que fica ligado o tempo todo** (tem filas, workers,
> cron e conexões em tempo real). Por isso usamos um host de **container** (Railway ou
> Render), e **não** o Vercel (que é serverless e não roda esse tipo de backend).
> O Vercel é ótimo só para sites estáticos.

---

## 🧩 O que vamos usar

| Peça | Serviço | Para quê |
|---|---|---|
| Código | **GitHub** | de onde o host publica |
| App (backend + dashboard + WhatsApp) | **Railway** ou **Render** | roda a imagem Docker |
| Banco de dados | **Railway Postgres** ou **Supabase** | guarda usuários, transações… |
| Redis (filas/cache) | **Railway Redis** ou **Upstash** | processa mensagens em segundo plano |
| WhatsApp | **Evolution API** (container) | conecta seu número via QR |

**Custo:** dá para começar no **tier grátis** de todos. Conforme o uso crescer, os
planos pagos são baratos (poucos dólares/mês).

---

## Passo 1 — Subir o código no GitHub

1. Crie uma conta em https://github.com (se ainda não tiver).
2. Crie um repositório novo (ex: `finia`) — pode ser **privado**.
3. No seu computador, dentro da pasta `finia/`, rode os comandos que o GitHub mostra
   na tela de "push an existing repository", algo como:
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/finia.git
   git branch -M main
   git push -u origin main
   ```
   > O repositório já está pronto e commitado. Os arquivos `.env` com segredos **não**
   > vão para o GitHub (estão no `.gitignore`) — só os modelos `.env.example`.

---

## Passo 2 — Banco de dados

### Opção A (mais simples): Postgres do próprio Railway
No Passo 4, o Railway cria o Postgres com **um clique** e te dá a `DATABASE_URL`
automaticamente. Recomendado para começar.

### Opção B: Supabase
1. Crie um projeto em https://supabase.com (grátis).
2. Em **Project Settings → Database → Connection string**, copie a string do modo
   **"Session"** (porta 5432). Ela vira sua `DATABASE_URL`.
   > Use a conexão **direta** (Session, 5432), não a "Transaction/pooler" — as
   > migrations do banco precisam da conexão direta.

---

## Passo 3 — Redis

### Opção A (mais simples): Redis do Railway
Um clique no Passo 4, e você recebe a `REDIS_URL`. Recomendado.

### Opção B: Upstash
1. Crie um banco Redis em https://upstash.com (grátis).
2. Copie a **URL com TLS** (`rediss://default:senha@host:porta`) → vira sua `REDIS_URL`.

---

## Passo 4 — Publicar no Railway

1. Acesse https://railway.app e entre com o GitHub.
2. **New Project → Deploy from GitHub repo** → escolha o repositório `finia`.
   O Railway detecta o `Dockerfile` e faz o build sozinho.
3. Se escolheu a Opção A do banco/Redis: **New → Database → Add PostgreSQL** e
   **Add Redis**. O Railway conecta e cria `DATABASE_URL`/`REDIS_URL`.
4. **Adicione o serviço da Evolution (WhatsApp):** New → **Deploy a Docker Image** →
   `evoapicloud/evolution-api:v2.2.3`. Configure as variáveis dele (ver abaixo).
5. Configure as **variáveis de ambiente** do app (próxima seção).
6. Em **Settings → Networking → Generate Domain**, gere a URL pública (ex:
   `https://finia-production.up.railway.app`). Use-a em `APP_URL`.

> O **Render** funciona igual: New → Web Service (from repo, Docker) + Managed
> Postgres + Key Value (Redis) + um serviço para a Evolution.

---

## Passo 5 — Variáveis de ambiente

### No serviço **app** (FinIA)

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | do Passo 2 (Railway injeta, ou cole a do Supabase) |
| `REDIS_URL` | do Passo 3 |
| `JWT_SECRET` | gere: `openssl rand -hex 64` |
| `APP_URL` | a URL pública gerada no Railway |
| `WHATSAPP_PROVIDER` | `evolution` |
| `EVOLUTION_API_URL` | URL interna do serviço Evolution (ex: `http://evolution:8080`) |
| `EVOLUTION_API_KEY` | um segredo forte (o mesmo no serviço Evolution) |
| `EVOLUTION_INSTANCE_NAME` | `finia` |
| `EVOLUTION_WEBHOOK_SECRET` | gere: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | sua chave `sk-ant-...` (opcional; sem ela a IA fica off) |
| `FRONTEND_DIST` | `/app/public` |
| `STORAGE_PATH` | `/app/storage/reports` |

### No serviço **evolution**

| Variável | Valor |
|---|---|
| `AUTHENTICATION_API_KEY` | mesmo valor de `EVOLUTION_API_KEY` |
| `DATABASE_ENABLED` | `true` |
| `DATABASE_PROVIDER` | `postgresql` |
| `DATABASE_CONNECTION_URI` | um Postgres para a Evolution (Railway Postgres #2, ou a mesma instância num banco separado) |
| `CACHE_REDIS_ENABLED` | `true` |
| `CACHE_REDIS_URI` | seu Redis + `/1` no fim (ex: `rediss://...:6379/1`) |
| `CACHE_REDIS_PREFIX_KEY` | `evolution` |
| `CACHE_LOCAL_ENABLED` | `false` |

---

## Passo 6 — Conectar seu WhatsApp

1. Com tudo no ar, o app já cria a instância e configura o webhook no primeiro boot
   (ou faça manualmente — ver `docs/CONECTAR-WHATSAPP.md`).
2. Abra o **manager da Evolution**: `https://SEU-EVOLUTION.up.railway.app/manager`
   e entre com a `EVOLUTION_API_KEY`.
3. Encontre a instância **finia** → **escaneie o QR code** com o WhatsApp Business do
   número do robô (Configurações → Aparelhos conectados → Conectar aparelho).
4. Pronto: mande "oi" ou "mercado 50" para o número e veja acontecer. 🎉

> ⚠️ **Use um número só para o robô.** A Evolution usa o protocolo não-oficial
> (WhatsApp Web); há risco de banimento em volumes altos. Para produção séria, o
> caminho oficial é a Meta WhatsApp Cloud API (nossa arquitetura já é preparada para
> trocar o provedor).

---

## 🔒 Segurança

- **Nunca** comite arquivos `.env` (já estão no `.gitignore`).
- Gere segredos fortes (`openssl rand -hex 32` / `64`).
- Após terminar os testes, **rotacione a chave da Anthropic** que foi usada em
  desenvolvimento.
- Em produção, `APP_URL` deve ser **https** — os cookies de sessão são marcados como
  `Secure` automaticamente quando `NODE_ENV=production`.

---

## ✅ Checklist final

- [ ] Código no GitHub
- [ ] `DATABASE_URL` e `REDIS_URL` configuradas
- [ ] `JWT_SECRET` forte gerado
- [ ] `APP_URL` = URL pública (https)
- [ ] App respondendo em `https://.../health`
- [ ] Dashboard abre na raiz `https://...`
- [ ] Evolution conectada (QR escaneado)
- [ ] Uma mensagem de teste no WhatsApp virou transação no dashboard
