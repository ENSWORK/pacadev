// Garde par mot de passe du cockpit operations (lecture seule cote donnee)

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const GATE_COOKIE_NAME = 'pacadev_operations'
export const GATE_TOKEN_MESSAGE = 'pacadev-operations-gate'
export const GATE_MAX_AGE_SECONDS = 8 * 60 * 60

// comparaison en temps constant sur des empreintes de longueur fixe
export function safeEqual(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest()
  const digestB = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(digestA, digestB)
}

export function isConfigured(password: string | undefined | null): boolean {
  return typeof password === 'string' && password.length > 0
}

export function sessionToken(password: string): string {
  return createHmac('sha256', password).update(GATE_TOKEN_MESSAGE, 'utf8').digest('hex')
}

export function passwordMatches(candidate: unknown, expected: string | undefined): boolean {
  if (typeof candidate !== 'string' || candidate.length === 0) return false
  if (!isConfigured(expected)) return false
  return safeEqual(candidate, expected as string)
}

export function isValidSessionToken(
  received: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (typeof received !== 'string' || received.length === 0) return false
  if (!isConfigured(expected)) return false
  return safeEqual(received, sessionToken(expected as string))
}

export function readGateCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const name = part.slice(0, separator).trim()
    if (name !== GATE_COOKIE_NAME) continue
    const value = part.slice(separator + 1).trim()
    return value.length > 0 ? decodeURIComponent(value) : null
  }
  return null
}

export function gateCookieOptions(): {
  name: string
  httpOnly: true
  sameSite: 'strict'
  path: string
  maxAge: number
  secure: boolean
} {
  return {
    name: GATE_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: GATE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  }
}
