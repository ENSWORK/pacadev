// Utilitaires de date - fuseau Africa/Casablanca, sans dependance

export const OPERATIONS_TIMEZONE = 'Africa/Casablanca'

const DAY_MS = 86_400_000

const formatters = new Map<string, Intl.DateTimeFormat>()

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone)
  if (cached) return cached
  const created = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  formatters.set(timeZone, created)
  return created
}

export function isoDateIn(timeZone: string, at: Date): string {
  return dayFormatter(timeZone).format(at)
}

export function todayIso(at: Date = new Date(), timeZone: string = OPERATIONS_TIMEZONE): string {
  return isoDateIn(timeZone, at)
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

// affichage jj/mm/aaaa, sans passer par une locale serveur
export function formatIsoFr(value: string): string {
  if (!isIsoDate(value)) return value
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export function shiftIsoDate(iso: string, days: number): string {
  const base = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(base)) return iso
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10)
}

// nombre de jours de `to` par rapport a `from` (negatif = avant)
export function diffIsoDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN
  return Math.round((b - a) / DAY_MS)
}

export function ageSeconds(generatedAt: string, now: Date = new Date()): number {
  const stamp = Date.parse(generatedAt)
  if (Number.isNaN(stamp)) return Number.NaN
  return Math.max(0, Math.round((now.getTime() - stamp) / 1000))
}

export function formatAge(seconds: number): string {
  if (!Number.isFinite(seconds)) return '?'
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} j`
}
