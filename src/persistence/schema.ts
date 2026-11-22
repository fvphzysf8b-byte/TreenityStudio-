/**
 * Versioniertes Datenformat für Speicherung, Export und Import.
 * Bei Änderungen am Modell: SCHEMA_VERSION erhöhen und Migration in migrate() ergänzen.
 */
import { z } from 'zod'
import {
  BRAND_AREAS,
  LINK_KINDS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  RELEASE_AREAS,
  SCHEMA_VERSION,
  SESSION_STATUSES,
  type AppData,
} from '../domain/types'

const id = z.string().min(1)
const base = { id, createdAt: z.string(), updatedAt: z.string() }
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)

export const appDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  people: z.array(z.object({ ...base, name: z.string().min(1), role: z.string() })),
  projects: z.array(
    z.object({
      ...base,
      title: z.string().min(1),
      type: z.enum(PROJECT_TYPES),
      brand: z.enum(BRAND_AREAS),
      releaseArea: z.enum(RELEASE_AREAS).nullable(),
      format: z.string(),
      description: z.string(),
      goal: z.string(),
      status: z.enum(PROJECT_STATUSES),
      statusBeforeArchive: z.enum(PROJECT_STATUSES).nullable(),
      dueDate: localDate.nullable(),
      pinned: z.boolean(),
      isExample: z.boolean(),
    }),
  ),
  projectMembers: z.array(z.object({ ...base, projectId: id, personId: id })),
  sessions: z.array(
    z.object({
      ...base,
      projectId: id,
      title: z.string().min(1),
      startsAt: localDateTime,
      durationMinutes: z.number().int().positive(),
      participantIds: z.array(id),
      goal: z.string(),
      checklist: z.array(z.object({ id, text: z.string(), done: z.boolean() })),
      setupNotes: z.string(),
      notes: z.string(),
      result: z.string(),
      recordingLinks: z.array(z.object({ id, label: z.string(), url: z.string() })),
      status: z.enum(SESSION_STATUSES),
      completedAt: z.string().nullable(),
    }),
  ),
  tasks: z.array(
    z.object({
      ...base,
      projectId: id,
      sessionId: id.nullable(),
      title: z.string().min(1),
      done: z.boolean(),
      doneAt: z.string().nullable(),
      order: z.number(),
    }),
  ),
  audioVersions: z.array(
    z.object({
      ...base,
      projectId: id,
      name: z.string().min(1),
      date: localDate,
      url: z.string(),
      changes: z.string(),
      isCurrent: z.boolean(),
    }),
  ),
  feedback: z.array(
    z.object({
      ...base,
      audioVersionId: id,
      authorId: id.nullable(),
      comment: z.string().min(1),
      timestampSec: z.number().nonnegative().nullable(),
    }),
  ),
  resourceLinks: z.array(
    z.object({ ...base, projectId: id, kind: z.enum(LINK_KINDS), label: z.string(), target: z.string() }),
  ),
}) satisfies z.ZodType<AppData>

export const EXPORT_APP_ID = 'treenitystudio'

/** Hülle für gespeicherte und exportierte Daten. */
export interface Envelope {
  app: typeof EXPORT_APP_ID
  schemaVersion: number
  exportedAt?: string
  data: unknown
}

/**
 * Migriert ältere Datenstände auf die aktuelle Version.
 * Aktuell existiert nur Version 1.
 */
export function migrate(schemaVersion: number, data: unknown): unknown {
  if (schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Die Daten stammen aus einer neueren App-Version (Format ${schemaVersion}). Bitte aktualisiere die App.`,
    )
  }
  // Platz für künftige Migrationen: if (schemaVersion === 1) { …; schemaVersion = 2 }
  return data
}
