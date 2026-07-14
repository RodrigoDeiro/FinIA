import { describe, it, expect } from 'vitest'
import {
  hmacSha256Hex,
  verifyHmacSignature,
  sha256Hex,
  randomToken,
  secretsMatch,
} from '@shared/utils/crypto.util.js'

// =============================================================================
// FinIA — Testes: Crypto Util
// =============================================================================

const SECRET = 'um_segredo_de_teste_bem_longo_123'
const PAYLOAD = '{"event":"messages.upsert","value":42}'

describe('verifyHmacSignature', () => {
  it('aceita assinatura válida (roundtrip)', () => {
    const sig = hmacSha256Hex(PAYLOAD, SECRET)
    expect(verifyHmacSignature(PAYLOAD, sig, SECRET)).toBe(true)
  })

  it('aceita prefixo "sha256="', () => {
    const sig = hmacSha256Hex(PAYLOAD, SECRET)
    expect(verifyHmacSignature(PAYLOAD, `sha256=${sig}`, SECRET)).toBe(true)
  })

  it('rejeita assinatura inválida', () => {
    expect(verifyHmacSignature(PAYLOAD, 'deadbeef', SECRET)).toBe(false)
  })

  it('rejeita assinatura ausente', () => {
    expect(verifyHmacSignature(PAYLOAD, undefined, SECRET)).toBe(false)
  })

  it('rejeita segredo errado', () => {
    const sig = hmacSha256Hex(PAYLOAD, SECRET)
    expect(verifyHmacSignature(PAYLOAD, sig, 'segredo_errado')).toBe(false)
  })

  it('rejeita payload adulterado', () => {
    const sig = hmacSha256Hex(PAYLOAD, SECRET)
    expect(verifyHmacSignature(PAYLOAD + 'x', sig, SECRET)).toBe(false)
  })
})

describe('secretsMatch', () => {
  it('true para segredos iguais', () => {
    expect(secretsMatch('token-abc-123', 'token-abc-123')).toBe(true)
  })
  it('false para segredos diferentes', () => {
    expect(secretsMatch('token-abc-123', 'token-abc-124')).toBe(false)
  })
  it('false quando algum é vazio', () => {
    expect(secretsMatch('', 'x')).toBe(false)
    expect(secretsMatch('x', '')).toBe(false)
  })
  it('difere no comprimento sem lançar', () => {
    expect(secretsMatch('curto', 'um-segredo-bem-mais-longo')).toBe(false)
  })
})

describe('sha256Hex', () => {
  it('é determinístico', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'))
  })

  it('produz 64 caracteres hex', () => {
    expect(sha256Hex('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('randomToken', () => {
  it('gera tokens distintos do tamanho pedido', () => {
    const a = randomToken(16)
    const b = randomToken(16)
    expect(a).not.toBe(b)
    expect(a).toHaveLength(32) // 16 bytes = 32 hex chars
  })
})
