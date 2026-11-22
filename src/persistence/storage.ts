/**
 * Persistenz im Browser (localStorage).
 * Die Daten liegen nur in diesem Browser auf diesem Gerät – kein gemeinsamer Projektspeicher.
 */
import type { AppData } from '../domain/types'
import { parseEnvelope, serializeExport } from './transfer'

export const STORAGE_KEY = 'treenitystudio:data'
/** Kopie des zuletzt nicht lesbaren Datenstands, damit nichts unbemerkt verloren geht. */
export const CORRUPT_KEY = 'treenitystudio:data:unlesbar'

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; data: AppData }
  | { status: 'corrupt'; error: string }
  | { status: 'unavailable' }

export function loadData(): LoadResult {
  let text: string | null
  try {
    text = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { status: 'unavailable' }
  }
  if (text === null) return { status: 'empty' }
  const result = parseEnvelope(text)
  if (!result.ok) {
    try {
      localStorage.setItem(CORRUPT_KEY, text)
    } catch {
      /* ignorieren */
    }
    return { status: 'corrupt', error: result.error }
  }
  return { status: 'ok', data: result.data }
}

export function saveData(data: AppData): { ok: true } | { ok: false; error: string } {
  try {
    localStorage.setItem(STORAGE_KEY, serializeExport(data))
    return { ok: true }
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)
    return {
      ok: false,
      error: quota
        ? 'Der Browserspeicher ist voll. Bitte exportiere deine Daten als Backup.'
        : 'Die Daten konnten nicht im Browser gespeichert werden (evtl. privater Modus). Bitte exportiere ein Backup.',
    }
  }
}

export function readCorruptBackup(): string | null {
  try {
    return localStorage.getItem(CORRUPT_KEY)
  } catch {
    return null
  }
}
