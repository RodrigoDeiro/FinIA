import { scrypt } from '@noble/hashes/scrypt'
import { randomBytes, timingSafeEqual } from 'node:crypto'

// =============================================================================
// FinIA — Hash de Senha (scrypt)
// =============================================================================
//
// Usado no login web por email + senha (alternativa ao magic link).
// scrypt é resistente a força bruta por hardware (memory-hard). Parâmetros:
//   N = 2^15, r = 8, p = 1  → custo recomendado para logins interativos.
//
// Formato armazenado: "scrypt$<saltHex>$<hashHex>" (self-describing).
//
// =============================================================================

const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 } as const

function derive(password: string, salt: Uint8Array): Uint8Array {
  return scrypt(new TextEncoder().encode(password), salt, SCRYPT_PARAMS)
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}

/** Gera o hash de uma senha em texto puro. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const dk = derive(password, salt)
  return `scrypt$${salt.toString('hex')}$${toHex(dk)}`
}

/** Verifica uma senha contra o hash armazenado (comparação em tempo constante). */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  const salt = Buffer.from(parts[1], 'hex')
  const expected = Buffer.from(parts[2], 'hex')
  if (salt.length === 0 || expected.length === 0) return false

  const actual = Buffer.from(derive(password, salt))
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}
