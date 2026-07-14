// =============================================================================
// FinIA — Utilitários de Telefone
// =============================================================================
//
// O número de WhatsApp é a identidade canônica do usuário (princípio 1).
// O provider (Evolution) entrega o número em formatos variados:
//
//   "5511999999999@s.whatsapp.net"   (JID individual)
//   "5511999999999@c.us"             (formato alternativo)
//   "5511999999999"                  (só dígitos)
//   "+55 11 99999-9999"              (formatado)
//
// Normalizamos tudo para E.164: "+5511999999999".
// E.164 = '+' seguido de até 15 dígitos, sem espaços nem pontuação.
//
// =============================================================================

/**
 * Extrai apenas os dígitos de uma string (remove @sufixo, espaços, +, -, etc.).
 */
function digitsOnly(raw: string): string {
  // Corta qualquer sufixo de JID (@s.whatsapp.net, @c.us, @g.us) antes de limpar
  const beforeAt = raw.split('@')[0] ?? ''
  return beforeAt.replace(/\D/g, '')
}

/**
 * Normaliza um identificador de telefone para o formato E.164 (+<dígitos>).
 *
 * Retorna null se não houver dígitos suficientes para um número plausível.
 * NÃO inventa código de país: se o número chegar sem DDI, ele é mantido como
 * veio (apenas com o '+'). O provider de WhatsApp sempre envia com DDI, então
 * na prática os números chegam completos.
 *
 * @example normalizePhone('5511999999999@s.whatsapp.net') → '+5511999999999'
 * @example normalizePhone('+55 11 99999-9999')            → '+5511999999999'
 */
export function normalizePhone(raw: string): string | null {
  const digits = digitsOnly(raw)

  // E.164 permite de 8 a 15 dígitos. Abaixo de 8 não é um número discável.
  if (digits.length < 8 || digits.length > 15) {
    return null
  }

  return `+${digits}`
}

/**
 * Valida se uma string está no formato E.164.
 *   - começa com '+'
 *   - primeiro dígito de 1 a 9 (sem zero à esquerda no código de país)
 *   - total de 8 a 15 dígitos
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone)
}

/**
 * Converte um número E.164 de volta para o JID do WhatsApp (formato Evolution).
 * Usado ao ENVIAR mensagens: o provider espera "5511999999999@s.whatsapp.net".
 *
 * @example toWhatsAppJid('+5511999999999') → '5511999999999@s.whatsapp.net'
 */
export function toWhatsAppJid(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}
