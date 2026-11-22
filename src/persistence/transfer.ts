/** Export, Import-Prüfung und Zusammenführen von Datenständen. */
import { checkIntegrity } from '../domain/integrity'
import type { AppData } from '../domain/types'
import { SCHEMA_VERSION } from '../domain/types'
import { EXPORT_APP_ID, appDataSchema, migrate, type Envelope } from './schema'

export function serializeExport(data: AppData): string {
  const envelope: Envelope = {
    app: EXPORT_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
  return JSON.stringify(envelope, null, 2)
}

export function exportFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `treenitystudio-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}.json`
}

export type ParseResult = { ok: true; data: AppData; exportedAt: string | null } | { ok: false; error: string }

/**
 * Liest und prüft einen Datenstand (aus Datei oder Speicher).
 * Prüft Format, Version, Felder und Verknüpfungen.
 */
export function parseEnvelope(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Die Datei ist keine gültige JSON-Datei.' }
  }
  if (typeof raw !== 'object' || raw === null || (raw as Envelope).app !== EXPORT_APP_ID) {
    return { ok: false, error: 'Die Datei ist kein TreenityStudio-Backup.' }
  }
  const env = raw as Envelope
  if (typeof env.schemaVersion !== 'number') {
    return { ok: false, error: 'Die Datei enthält keine Formatversion.' }
  }
  let migrated: unknown
  try {
    migrated = migrate(env.schemaVersion, env.data)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  const parsed = appDataSchema.safeParse(migrated)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.join(' › ') || 'Datenstruktur'
    return {
      ok: false,
      error: `Die Datei ist unvollständig oder beschädigt (Fehler bei: ${where}). Es wurden keine Daten übernommen.`,
    }
  }
  const problems = checkIntegrity(parsed.data)
  if (problems.length) {
    return {
      ok: false,
      error: `Die Datei enthält widersprüchliche Verknüpfungen: ${problems.slice(0, 3).join(' ')}${problems.length > 3 ? ' …' : ''}`,
    }
  }
  return { ok: true, data: parsed.data, exportedAt: typeof env.exportedAt === 'string' ? env.exportedAt : null }
}

export function countRecords(data: AppData) {
  return {
    Projekte: data.projects.length,
    Sessions: data.sessions.length,
    Aufgaben: data.tasks.length,
    'Audio-Versionen': data.audioVersions.length,
    Feedback: data.feedback.length,
    Links: data.resourceLinks.length,
    Personen: data.people.length,
  }
}

export interface MergeReport {
  added: number
  skipped: number
  data: AppData
}

/**
 * Ergänzt vorhandene Daten um importierte Datensätze.
 * Datensätze mit bereits vorhandener ID werden nicht überschrieben (vorhandene Version bleibt).
 * Personen mit gleichem Namen werden zusammengeführt, damit keine Dubletten entstehen.
 */
export function mergeData(current: AppData, incoming: AppData): MergeReport {
  let added = 0
  let skipped = 0

  // Personen nach ID oder gleichem Namen zuordnen.
  const personMap = new Map<string, string>()
  const people = [...current.people]
  for (const p of incoming.people) {
    const byId = people.find((x) => x.id === p.id)
    const byName = people.find((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase())
    const match = byId ?? byName
    if (match) {
      personMap.set(p.id, match.id)
      skipped++
    } else {
      people.push(p)
      personMap.set(p.id, p.id)
      added++
    }
  }
  const mapPerson = (id: string) => personMap.get(id) ?? id

  function mergeList<T extends { id: string }>(existing: T[], extra: T[], transform: (x: T) => T = (x) => x): T[] {
    const ids = new Set(existing.map((x) => x.id))
    const out = [...existing]
    for (const item of extra) {
      if (ids.has(item.id)) {
        skipped++
      } else {
        out.push(transform(item))
        added++
      }
    }
    return out
  }

  const projects = mergeList(current.projects, incoming.projects, (p) => ({ ...p, pinned: false }))
  const audioVersions = mergeList(current.audioVersions, incoming.audioVersions)
  // Pro Projekt höchstens ein aktueller Arbeitsstand: vorhandene Markierung hat Vorrang.
  const currentSeen = new Set<string>()
  const existingCurrent = new Set(current.audioVersions.filter((v) => v.isCurrent).map((v) => v.projectId))
  const fixedVersions = audioVersions.map((v) => {
    if (!v.isCurrent) return v
    const isExisting = current.audioVersions.some((x) => x.id === v.id)
    if ((!isExisting && existingCurrent.has(v.projectId)) || currentSeen.has(v.projectId)) return { ...v, isCurrent: false }
    currentSeen.add(v.projectId)
    return v
  })

  const memberKey = (m: { projectId: string; personId: string }) => `${m.projectId}|${m.personId}`
  const memberKeys = new Set(current.projectMembers.map(memberKey))
  const projectMembers = [...current.projectMembers]
  for (const m of incoming.projectMembers) {
    const mapped = { ...m, personId: mapPerson(m.personId) }
    if (memberKeys.has(memberKey(mapped)) || projectMembers.some((x) => x.id === m.id)) {
      skipped++
    } else {
      projectMembers.push(mapped)
      memberKeys.add(memberKey(mapped))
      added++
    }
  }

  const result: AppData = {
    schemaVersion: current.schemaVersion,
    people,
    projects,
    projectMembers,
    sessions: mergeList(current.sessions, incoming.sessions, (s) => ({
      ...s,
      participantIds: [...new Set(s.participantIds.map(mapPerson))],
    })),
    tasks: mergeList(current.tasks, incoming.tasks),
    audioVersions: fixedVersions,
    feedback: mergeList(current.feedback, incoming.feedback, (f) => ({
      ...f,
      authorId: f.authorId ? mapPerson(f.authorId) : null,
    })),
    resourceLinks: mergeList(current.resourceLinks, incoming.resourceLinks),
  }

  // Sicherheitsnetz: Wenn das Ergebnis inkonsistent wäre, abbrechen statt fehlerhafte Daten zu speichern.
  const problems = checkIntegrity(result)
  if (problems.length) {
    throw new Error(
      `Die Daten lassen sich nicht widerspruchsfrei ergänzen (${problems[0]}). Verwende stattdessen „Ersetzen“ oder prüfe die Datei.`,
    )
  }
  return { added, skipped, data: result }
}
