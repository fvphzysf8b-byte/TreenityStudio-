import type { ID } from './types'

/** Erzeugt eine stabile ID. Fallback für unsichere Kontexte (z. B. http über LAN-IP auf dem Smartphone). */
export function newId(): ID {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      /* unsicherer Kontext */
    }
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Prüft, ob ein Text eine gültige http(s)-Adresse ist. */
export function isWebUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.length > 0
  } catch {
    return false
  }
}

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'webm']

/**
 * Schätzt, ob eine URL direkt abspielbar ist (direkte Audiodatei).
 * Freigabelinks (z. B. Google Drive) gelten bewusst nicht als abspielbar.
 */
export function isLikelyPlayableAudio(url: string): boolean {
  if (!isWebUrl(url)) return false
  const u = new URL(url)
  const ext = u.pathname.split('.').pop()?.toLowerCase() ?? ''
  return AUDIO_EXTENSIONS.includes(ext)
}

/** „mm:ss“ → Sekunden. Gibt null bei ungültiger Eingabe zurück. */
export function parseTimestamp(value: string): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Heutiges lokales Datum im Format YYYY-MM-DD. */
export function todayLocal(): string {
  return toLocalDate(new Date())
}

export function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function toLocalDateTime(d: Date): string {
  return `${toLocalDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function nowLocalDateTime(): string {
  return toLocalDateTime(new Date())
}

const dateFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

/** Formatiert YYYY-MM-DD oder YYYY-MM-DDTHH:mm für die Anzeige. */
export function formatDate(value: string): string {
  const d = parseLocal(value)
  return d ? dateFmt.format(d) : value
}

export function formatDateTime(value: string): string {
  const d = parseLocal(value)
  return d ? `${dateFmt.format(d)}, ${timeFmt.format(d)} Uhr` : value
}

export function formatIso(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : `${dateFmt.format(d)}, ${timeFmt.format(d)} Uhr`
}

function parseLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0))
}

export function isValidLocalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && parseLocal(value) !== null
}

export function isValidLocalDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && parseLocal(value) !== null
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} Min.`
  const h = Math.floor(min / 60)
  const r = min % 60
  return r ? `${h} Std. ${r} Min.` : `${h} Std.`
}
