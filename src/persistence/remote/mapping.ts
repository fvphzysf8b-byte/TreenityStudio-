/**
 * Abbildung zwischen App-Datenmodell (camelCase) und Datenbank-Tabellen (snake_case).
 */
import type { AppData } from '../../domain/types'

export type Collection = Exclude<keyof AppData, 'schemaVersion'>

/** Reihenfolge so, dass übergeordnete Datensätze vor abhängigen geschrieben werden. */
export const COLLECTIONS: { key: Collection; table: string }[] = [
  { key: 'people', table: 'people' },
  { key: 'projects', table: 'projects' },
  { key: 'projectMembers', table: 'project_members' },
  { key: 'sessions', table: 'sessions' },
  { key: 'tasks', table: 'tasks' },
  { key: 'audioVersions', table: 'audio_versions' },
  { key: 'feedback', table: 'feedback' },
  { key: 'resourceLinks', table: 'resource_links' },
]

/** Felder, deren Name in der Datenbank abweicht (über die reine snake_case-Umwandlung hinaus). */
const RENAMES: Record<string, string> = { order: 'position' }
const RENAMES_BACK: Record<string, string> = Object.fromEntries(Object.entries(RENAMES).map(([a, b]) => [b, a]))

/** Zeitstempel-Spalten werden beim Lesen auf ein einheitliches ISO-Format gebracht. */
const TIMESTAMP_FIELDS = new Set(['createdAt', 'updatedAt', 'doneAt', 'completedAt'])

const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

export function toRow(record: object): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) row[RENAMES[k] ?? toSnake(k)] = v
  return row
}

export function fromRow(row: Record<string, unknown>): Record<string, unknown> {
  const rec: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const key = RENAMES_BACK[k] ?? toCamel(k)
    rec[key] = TIMESTAMP_FIELDS.has(key) && typeof v === 'string' ? new Date(v).toISOString() : v
  }
  return rec
}
