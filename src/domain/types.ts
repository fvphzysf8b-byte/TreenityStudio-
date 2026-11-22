/**
 * Fachliches Datenmodell der TreenityStudio App.
 * Alle Datensätze haben stabile IDs sowie Erstellungs- und Änderungszeitpunkt (ISO 8601).
 */

export type ID = string

export interface BaseRecord {
  id: ID
  createdAt: string
  updatedAt: string
}

export const PROJECT_TYPES = ['musik', 'podcast', 'set', 'soundscape'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

export const BRAND_AREAS = ['studio', 'records', 'radio'] as const
export type BrandArea = (typeof BRAND_AREAS)[number]

export const RELEASE_AREAS = ['records', 'radio'] as const
export type ReleaseArea = (typeof RELEASE_AREAS)[number]

export const PROJECT_STATUSES = [
  'idee',
  'vorbereitung',
  'aufnahme',
  'bearbeitung',
  'bereit',
  'veroeffentlicht',
  'archiviert',
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const SESSION_STATUSES = ['geplant', 'abgeschlossen', 'abgesagt'] as const
export type SessionStatus = (typeof SESSION_STATUSES)[number]

export const LINK_KINDS = ['notion', 'drive', 'ordner', 'referenz', 'sonstiges'] as const
export type LinkKind = (typeof LINK_KINDS)[number]

export interface Person extends BaseRecord {
  name: string
  /** Kurze Rollenbeschreibung, z. B. „Tontechnik & Produktion“. */
  role: string
}

export interface Project extends BaseRecord {
  title: string
  type: ProjectType
  brand: BrandArea
  releaseArea: ReleaseArea | null
  /** Optionales Format, z. B. „TreenitySignal“. */
  format: string
  description: string
  goal: string
  status: ProjectStatus
  /** Status vor dem Archivieren, um Wiederherstellen zu ermöglichen. */
  statusBeforeArchive: ProjectStatus | null
  /** Zieltermin im Format YYYY-MM-DD. */
  dueDate: string | null
  pinned: boolean
  /** Kennzeichnet klar markierte Beispieldaten. */
  isExample: boolean
}

export interface ProjectMember extends BaseRecord {
  projectId: ID
  personId: ID
}

export interface ChecklistItem {
  id: ID
  text: string
  done: boolean
}

export interface LabeledLink {
  id: ID
  label: string
  url: string
}

export interface Session extends BaseRecord {
  projectId: ID
  title: string
  /** Lokales Datum mit Uhrzeit im Format YYYY-MM-DDTHH:mm. */
  startsAt: string
  durationMinutes: number
  participantIds: ID[]
  /** Ergänzt den Satz „Am Ende dieser Session haben wir …“. */
  goal: string
  checklist: ChecklistItem[]
  setupNotes: string
  notes: string
  result: string
  recordingLinks: LabeledLink[]
  status: SessionStatus
  completedAt: string | null
}

export interface Task extends BaseRecord {
  projectId: ID
  /** Optional: Session, aus der die Aufgabe stammt oder für die sie gilt. */
  sessionId: ID | null
  title: string
  done: boolean
  doneAt: string | null
  /** Reihenfolge innerhalb des Projekts; kleinste offene = nächste Handlung. */
  order: number
}

export interface AudioVersion extends BaseRecord {
  projectId: ID
  name: string
  /** Datum der Version im Format YYYY-MM-DD. */
  date: string
  url: string
  changes: string
  isCurrent: boolean
}

export interface Feedback extends BaseRecord {
  audioVersionId: ID
  /** null, falls die verfassende Person gelöscht wurde. */
  authorId: ID | null
  comment: string
  /** Zeitbezug in Sekunden. */
  timestampSec: number | null
}

export interface ResourceLink extends BaseRecord {
  projectId: ID
  kind: LinkKind
  label: string
  /** Web-Adresse (https://…) oder lokaler Pfad. */
  target: string
}

export const SCHEMA_VERSION = 1

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION
  people: Person[]
  projects: Project[]
  projectMembers: ProjectMember[]
  sessions: Session[]
  tasks: Task[]
  audioVersions: AudioVersion[]
  feedback: Feedback[]
  resourceLinks: ResourceLink[]
}

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    people: [],
    projects: [],
    projectMembers: [],
    sessions: [],
    tasks: [],
    audioVersions: [],
    feedback: [],
    resourceLinks: [],
  }
}
