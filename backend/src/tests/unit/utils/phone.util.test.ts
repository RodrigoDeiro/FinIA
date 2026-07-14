import { describe, it, expect } from 'vitest'
import { normalizePhone, isValidE164, toWhatsAppJid } from '@shared/utils/phone.util.js'

// =============================================================================
// FinIA — Testes: Phone Util
// =============================================================================

describe('normalizePhone', () => {
  it('extrai E.164 de um JID do WhatsApp', () => {
    expect(normalizePhone('5511999999999@s.whatsapp.net')).toBe('+5511999999999')
  })

  it('aceita formato @c.us', () => {
    expect(normalizePhone('5511988887777@c.us')).toBe('+5511988887777')
  })

  it('limpa número formatado', () => {
    expect(normalizePhone('+55 11 99999-9999')).toBe('+5511999999999')
  })

  it('retorna null para entrada curta demais', () => {
    expect(normalizePhone('123')).toBeNull()
  })

  it('retorna null para entrada sem dígitos', () => {
    expect(normalizePhone('abc@s.whatsapp.net')).toBeNull()
  })
})

describe('isValidE164', () => {
  it('valida números corretos', () => {
    expect(isValidE164('+5511999999999')).toBe(true)
  })

  it('rejeita sem +', () => {
    expect(isValidE164('5511999999999')).toBe(false)
  })

  it('rejeita com zero à esquerda', () => {
    expect(isValidE164('+0511999999999')).toBe(false)
  })
})

describe('toWhatsAppJid', () => {
  it('converte E.164 de volta para JID', () => {
    expect(toWhatsAppJid('+5511999999999')).toBe('5511999999999@s.whatsapp.net')
  })
})
