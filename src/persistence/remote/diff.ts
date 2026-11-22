/**
 * Ermittelt, welche Datensätze sich zwischen zwei Datenständen geändert haben.
 * So bleibt die gesamte Geschäftslogik unverändert: Sie erzeugt einen neuen Datenstand,
 * und an die Datenbank gehen nur die tatsächlich geänderten oder gelöschten Datensätze.
 */
import type { AppData } from '../../domain/types'
import { COLLECTIONS, type Collection } from './mapping'

export interface ChangeSet {
  upserts: Partial<Record<Collection, object[]>>
  deletes: Partial<Record<Collection, string[]>>
}

function sameRecord(a: unknown, b: unknown): boolean {
  if (a === b) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

export function diffData(before: AppData, after: AppData): ChangeSet {
  const changes: ChangeSet = { upserts: {}, deletes: {} }
  for (const { key } of COLLECTIONS) {
    const prev = before[key] as { id: string }[]
    const next = after[key] as { id: string }[]
    if (prev === next) continue
    const prevById = new Map(prev.map((r) => [r.id, r]))
    const nextIds = new Set(next.map((r) => r.id))
    const up = next.filter((r) => !sameRecord(prevById.get(r.id), r))
    const del = prev.filter((r) => !nextIds.has(r.id)).map((r) => r.id)
    if (up.length) changes.upserts[key] = up
    if (del.length) changes.deletes[key] = del
  }
  return changes
}

export function isEmpty(c: ChangeSet): boolean {
  return Object.keys(c.upserts).length === 0 && Object.keys(c.deletes).length === 0
}
