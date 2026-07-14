import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto'

// =============================================================================
// FinIA — Utilitários de Criptografia
// =============================================================================
//
// Funções de baixo nível usadas na validação de webhooks (HMAC) e em hashes
// determinísticos. Usa o módulo nativo node:crypto — sem dependências externas.
//
// =============================================================================

/**
 * Calcula o HMAC-SHA256 de um payload e retorna o digest em hexadecimal.
 * É a assinatura que o provider de WhatsApp envia no header do webhook.
 */
export function hmacSha256Hex(payload: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verifica a assinatura HMAC de um webhook em tempo constante.
 *
 * Comparação em tempo constante (timingSafeEqual) evita timing attacks: uma
 * comparação ingênua (===) vaza, pelo tempo de resposta, quantos caracteres
 * iniciais batem, ajudando um atacante a adivinhar a assinatura byte a byte.
 *
 * @param payload          corpo bruto da requisição (string ou Buffer)
 * @param signatureHex     valor recebido no header (hex)
 * @param secret           segredo compartilhado (EVOLUTION_WEBHOOK_SECRET)
 */
export function verifyHmacSignature(
  payload: string | Buffer,
  signatureHex: string,
  secret: string,
): boolean {
  // Defesa: header ausente/vazio nunca é válido
  if (!signatureHex) return false

  const expected = hmacSha256Hex(payload, secret)

  // Alguns providers prefixam o algoritmo: "sha256=abc...". Aceitamos ambos.
  const received = signatureHex.startsWith('sha256=')
    ? signatureHex.slice('sha256='.length)
    : signatureHex

  // timingSafeEqual exige buffers do MESMO tamanho, senão lança. Comparar o
  // tamanho antes evita a exceção e já descarta assinaturas obviamente erradas.
  const expectedBuf = Buffer.from(expected, 'hex')
  const receivedBuf = Buffer.from(received, 'hex')
  if (expectedBuf.length !== receivedBuf.length) return false

  return timingSafeEqual(expectedBuf, receivedBuf)
}

/**
 * Compara dois segredos em tempo constante (evita timing attack). Faz o SHA-256
 * de cada um antes do timingSafeEqual, garantindo buffers do mesmo tamanho e não
 * vazando o comprimento dos segredos.
 */
export function secretsMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/**
 * SHA-256 hexadecimal de uma string. Determinístico — mesma entrada, mesmo hash.
 * Usado para chaves de cache e deduplicação (NÃO para senhas — use bcrypt).
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Token aleatório seguro em hexadecimal (ex: para magic links — Sprint 3).
 * @param bytes quantidade de bytes de entropia (32 = 256 bits)
 */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}
