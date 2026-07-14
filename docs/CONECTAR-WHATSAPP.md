# 📱 Conectar o WhatsApp (Evolution API)

Passo a passo para criar a instância do WhatsApp e ligá-la ao FinIA. Funciona igual
em local (`docker-compose.prod.yml`) e na nuvem — muda só a URL da Evolution.

> Variáveis usadas abaixo (do seu `.env.production`):
> - `EVOLUTION_API_KEY` — a chave da Evolution
> - `EVOLUTION_WEBHOOK_SECRET` — o token que autentica o webhook Evolution → FinIA
> - `EVOLUTION_URL` — onde a Evolution responde (local: `http://localhost:8080`)
> - `APP_INTERNAL_URL` — como a Evolution enxerga o app
>   (local/nuvem no mesmo projeto: `http://app:3000`)

---

## 1. Criar a instância `finia`

```bash
curl -X POST "$EVOLUTION_URL/instance/create" \
  -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d '{"instanceName":"finia","integration":"WHATSAPP-BAILEYS","qrcode":true}'
```

## 2. Ligar o webhook ao FinIA (com o token)

```bash
curl -X POST "$EVOLUTION_URL/webhook/set/finia" \
  -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d "{\"webhook\":{\"enabled\":true,
       \"url\":\"$APP_INTERNAL_URL/webhook/evolution\",
       \"headers\":{\"x-finia-token\":\"$EVOLUTION_WEBHOOK_SECRET\",\"Content-Type\":\"application/json\"},
       \"byEvents\":false,\"base64\":false,
       \"events\":[\"MESSAGES_UPSERT\"]}}"
```

> Por que um **token** e não a assinatura HMAC? A Evolution não gera HMAC; ela envia
> headers estáticos. O FinIA aceita as duas formas (token OU HMAC) — ver
> `backend/src/modules/whatsapp/providers/evolution/evolution.provider.ts`.

## 3. Escanear o QR

Abra `"$EVOLUTION_URL/manager"` no navegador, entre com a `EVOLUTION_API_KEY`, achhe a
instância **finia** e escaneie o QR com o WhatsApp do número do robô
(**Aparelhos conectados → Conectar aparelho**).

## 4. Testar

Mande uma mensagem para o número conectado:
- `oi` → recebe as boas-vindas
- `mercado 89,90` → vira uma transação (confira no dashboard)
- `quanto gastei esse mês?` → recebe o total

## Conferir se está conectado

```bash
curl "$EVOLUTION_URL/instance/connectionState/finia" -H "apikey: $EVOLUTION_API_KEY"
# → { "state": "open" }  quando conectado
```

## Reconectar / novo QR (se cair)

```bash
curl "$EVOLUTION_URL/instance/connect/finia" -H "apikey: $EVOLUTION_API_KEY"
```
