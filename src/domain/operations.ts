/**
 * Geschäftslogik als reine Funktionen: (Daten, Eingabe) → neue Daten.
 * Keine Abhängigkeit von UI oder Speicherung.
 *
 * Regeln für verknüpfte Datensätze:
 * - Projekt archivieren: Status „archiviert“, Fokus wird gelöst. Alle verknüpften Daten bleiben erhalten.
 * - Projekt löschen: löscht Sessions, Aufgaben, Audio-Versionen inkl. Feedback, Links und Zuordnungen mit.
 * - Session löschen: zugehörige Aufgaben bleiben im Projekt erhalten (Session-Bezug wird entfernt).
 * - Audio-Version löschen: zugehöriges Feedback wird mitgelöscht.
 * - Person löschen: Projekt-Zuordnungen und Session-Teilnahmen werden entfernt;
 *   Feedback bleibt erhalten und wird als „Gelöschte Person“ angezeigt.
 */
import type {
  AppData,
  AudioVersion,
  BrandArea,
  ChecklistItem,
  Feedback,
  ID,
  LabeledLink,
  LinkKind,
  Person,
  Project,
  ProjectStatus,
  ProjectType,
  ReleaseArea,
  ResourceLink,
  Session,
  Task,
} from './types'
import { newId, nowIso } from './util'

export class DomainError extends Error {}

export const MAX_PINNED = 3

function base() {
  const t = nowIso()
  return { id: newId(), createdAt: t, updatedAt: t }
}

function replaceById<T extends { id: ID }>(list: T[], id: ID, fn: (item: T) => T): T[] {
  let found = false
  const next = list.map((item) => {
    if (item.id !== id) return item
    found = true
    return fn(item)
  })
  if (!found) throw new DomainError('Datensatz wurde nicht gefunden.')
  return next
}

function requireProject(data: AppData, id: ID): Project {
  const p = data.projects.find((x) => x.id === id)
  if (!p) throw new DomainError('Projekt wurde nicht gefunden.')
  return p
}

// ───────────────────────── Personen ─────────────────────────

export interface PersonDraft {
  name: string
  role: string
}

export function createPerson(data: AppData, draft: PersonDraft): { data: AppData; id: ID } {
  const person: Person = { ...base(), name: draft.name.trim(), role: draft.role.trim() }
  return { data: { ...data, people: [...data.people, person] }, id: person.id }
}

export function updatePerson(data: AppData, id: ID, draft: PersonDraft): AppData {
  return {
    ...data,
    people: replaceById(data.people, id, (p) => ({ ...p, name: draft.name.trim(), role: draft.role.trim(), updatedAt: nowIso() })),
  }
}

export function deletePerson(data: AppData, id: ID): AppData {
  const t = nowIso()
  return {
    ...data,
    people: data.people.filter((p) => p.id !== id),
    projectMembers: data.projectMembers.filter((m) => m.personId !== id),
    sessions: data.sessions.map((s) =>
      s.participantIds.includes(id)
        ? { ...s, participantIds: s.participantIds.filter((x) => x !== id), updatedAt: t }
        : s,
    ),
    feedback: data.feedback.map((f) => (f.authorId === id ? { ...f, authorId: null, updatedAt: t } : f)),
  }
}

// ───────────────────────── Projekte ─────────────────────────

export interface ProjectDraft {
  title: string
  type: ProjectType
  brand: BrandArea
  releaseArea: ReleaseArea | null
  format: string
  description: string
  goal: string
  status: Exclude<ProjectStatus, 'archiviert'>
  dueDate: string | null
  memberIds: ID[]
}

function syncMembers(data: AppData, projectId: ID, memberIds: ID[]): AppData {
  const valid = new Set(data.people.map((p) => p.id))
  const wanted = [...new Set(memberIds)].filter((id) => valid.has(id))
  const kept = data.projectMembers.filter((m) => m.projectId !== projectId || wanted.includes(m.personId))
  const existing = new Set(kept.filter((m) => m.projectId === projectId).map((m) => m.personId))
  const added = wanted.filter((id) => !existing.has(id)).map((personId) => ({ ...base(), projectId, personId }))
  return { ...data, projectMembers: [...kept, ...added] }
}

export function createProject(
  data: AppData,
  draft: ProjectDraft,
  options: { firstAction?: string; isExample?: boolean } = {},
): { data: AppData; id: ID } {
  const project: Project = {
    ...base(),
    title: draft.title.trim(),
    type: draft.type,
    brand: draft.brand,
    releaseArea: draft.releaseArea,
    format: draft.format.trim(),
    description: draft.description.trim(),
    goal: draft.goal.trim(),
    status: draft.status,
    statusBeforeArchive: null,
    dueDate: draft.dueDate || null,
    pinned: false,
    isExample: options.isExample ?? false,
  }
  let next: AppData = { ...data, projects: [...data.projects, project] }
  next = syncMembers(next, project.id, draft.memberIds)
  if (options.firstAction?.trim()) next = addTask(next, project.id, options.firstAction).data
  return { data: next, id: project.id }
}

export function updateProject(data: AppData, id: ID, draft: ProjectDraft): AppData {
  const current = requireProject(data, id)
  const next: AppData = {
    ...data,
    projects: replaceById(data.projects, id, (p) => ({
      ...p,
      title: draft.title.trim(),
      type: draft.type,
      brand: draft.brand,
      releaseArea: draft.releaseArea,
      format: draft.format.trim(),
      description: draft.description.trim(),
      goal: draft.goal.trim(),
      // Archivierte Projekte behalten ihren Status; Wiederherstellen erfolgt separat.
      status: current.status === 'archiviert' ? 'archiviert' : draft.status,
      statusBeforeArchive: current.status === 'archiviert' ? draft.status : null,
      dueDate: draft.dueDate || null,
      updatedAt: nowIso(),
    })),
  }
  return syncMembers(next, id, draft.memberIds)
}

export function setProjectStatus(data: AppData, id: ID, status: Exclude<ProjectStatus, 'archiviert'>): AppData {
  return {
    ...data,
    projects: replaceById(data.projects, id, (p) => ({ ...p, status, statusBeforeArchive: null, updatedAt: nowIso() })),
  }
}

export function setPinned(data: AppData, id: ID, pinned: boolean): AppData {
  const project = requireProject(data, id)
  if (pinned) {
    if (project.status === 'archiviert') throw new DomainError('Archivierte Projekte können nicht angeheftet werden.')
    const count = data.projects.filter((p) => p.pinned && p.id !== id).length
    if (count >= MAX_PINNED)
      throw new DomainError(`Es können höchstens ${MAX_PINNED} Fokusprojekte angeheftet sein. Löse zuerst ein anderes.`)
  }
  return { ...data, projects: replaceById(data.projects, id, (p) => ({ ...p, pinned, updatedAt: nowIso() })) }
}

export function archiveProject(data: AppData, id: ID): AppData {
  return {
    ...data,
    projects: replaceById(data.projects, id, (p) =>
      p.status === 'archiviert'
        ? p
        : { ...p, statusBeforeArchive: p.status, status: 'archiviert', pinned: false, updatedAt: nowIso() },
    ),
  }
}

export function restoreProject(data: AppData, id: ID): AppData {
  return {
    ...data,
    projects: replaceById(data.projects, id, (p) => ({
      ...p,
      status: p.statusBeforeArchive ?? 'vorbereitung',
      statusBeforeArchive: null,
      updatedAt: nowIso(),
    })),
  }
}

export function projectDependents(data: AppData, id: ID) {
  const versionIds = new Set(data.audioVersions.filter((v) => v.projectId === id).map((v) => v.id))
  return {
    sessions: data.sessions.filter((s) => s.projectId === id).length,
    tasks: data.tasks.filter((t) => t.projectId === id).length,
    audioVersions: versionIds.size,
    feedback: data.feedback.filter((f) => versionIds.has(f.audioVersionId)).length,
    resourceLinks: data.resourceLinks.filter((l) => l.projectId === id).length,
  }
}

export function deleteProject(data: AppData, id: ID): AppData {
  requireProject(data, id)
  const versionIds = new Set(data.audioVersions.filter((v) => v.projectId === id).map((v) => v.id))
  return {
    ...data,
    projects: data.projects.filter((p) => p.id !== id),
    projectMembers: data.projectMembers.filter((m) => m.projectId !== id),
    sessions: data.sessions.filter((s) => s.projectId !== id),
    tasks: data.tasks.filter((t) => t.projectId !== id),
    audioVersions: data.audioVersions.filter((v) => v.projectId !== id),
    feedback: data.feedback.filter((f) => !versionIds.has(f.audioVersionId)),
    resourceLinks: data.resourceLinks.filter((l) => l.projectId !== id),
  }
}

// ───────────────────────── Aufgaben ─────────────────────────

export function addTask(
  data: AppData,
  projectId: ID,
  title: string,
  sessionId: ID | null = null,
): { data: AppData; id: ID } {
  requireProject(data, projectId)
  if (!title.trim()) throw new DomainError('Bitte beschreibe die Aufgabe.')
  if (sessionId && !data.sessions.some((s) => s.id === sessionId && s.projectId === projectId))
    throw new DomainError('Die Session gehört nicht zu diesem Projekt.')
  const maxOrder = Math.max(0, ...data.tasks.filter((t) => t.projectId === projectId).map((t) => t.order))
  const task: Task = {
    ...base(),
    projectId,
    sessionId,
    title: title.trim(),
    done: false,
    doneAt: null,
    order: maxOrder + 1,
  }
  return { data: { ...data, tasks: [...data.tasks, task] }, id: task.id }
}

export function setTaskDone(data: AppData, id: ID, done: boolean): AppData {
  const t = nowIso()
  return { ...data, tasks: replaceById(data.tasks, id, (x) => ({ ...x, done, doneAt: done ? t : null, updatedAt: t })) }
}

export function renameTask(data: AppData, id: ID, title: string): AppData {
  if (!title.trim()) throw new DomainError('Bitte beschreibe die Aufgabe.')
  return { ...data, tasks: replaceById(data.tasks, id, (x) => ({ ...x, title: title.trim(), updatedAt: nowIso() })) }
}

/** Setzt eine Aufgabe an die erste Stelle → sie wird zur nächsten Handlung. */
export function makeNextAction(data: AppData, id: ID): AppData {
  const task = data.tasks.find((t) => t.id === id)
  if (!task) throw new DomainError('Aufgabe wurde nicht gefunden.')
  const minOrder = Math.min(...data.tasks.filter((t) => t.projectId === task.projectId).map((t) => t.order))
  return { ...data, tasks: replaceById(data.tasks, id, (x) => ({ ...x, order: minOrder - 1, updatedAt: nowIso() })) }
}

export function deleteTask(data: AppData, id: ID): AppData {
  return { ...data, tasks: data.tasks.filter((t) => t.id !== id) }
}

// ───────────────────────── Sessions ─────────────────────────

export interface SessionDraft {
  projectId: ID
  title: string
  startsAt: string
  durationMinutes: number
  participantIds: ID[]
  goal: string
  checklist: ChecklistItem[]
  setupNotes: string
}

function cleanChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items
    .map((i) => ({ ...i, id: i.id || newId(), text: i.text.trim() }))
    .filter((i) => i.text.length > 0)
}

function validPeople(data: AppData, ids: ID[]): ID[] {
  const valid = new Set(data.people.map((p) => p.id))
  return [...new Set(ids)].filter((id) => valid.has(id))
}

export function createSession(data: AppData, draft: SessionDraft): { data: AppData; id: ID } {
  requireProject(data, draft.projectId)
  const session: Session = {
    ...base(),
    projectId: draft.projectId,
    title: draft.title.trim(),
    startsAt: draft.startsAt,
    durationMinutes: draft.durationMinutes,
    participantIds: validPeople(data, draft.participantIds),
    goal: draft.goal.trim(),
    checklist: cleanChecklist(draft.checklist),
    setupNotes: draft.setupNotes.trim(),
    notes: '',
    result: '',
    recordingLinks: [],
    status: 'geplant',
    completedAt: null,
  }
  return { data: { ...data, sessions: [...data.sessions, session] }, id: session.id }
}

export function updateSession(data: AppData, id: ID, draft: SessionDraft): AppData {
  requireProject(data, draft.projectId)
  const current = data.sessions.find((s) => s.id === id)
  if (!current) throw new DomainError('Session wurde nicht gefunden.')
  let next: AppData = {
    ...data,
    sessions: replaceById(data.sessions, id, (s) => ({
      ...s,
      projectId: draft.projectId,
      title: draft.title.trim(),
      startsAt: draft.startsAt,
      durationMinutes: draft.durationMinutes,
      participantIds: validPeople(data, draft.participantIds),
      goal: draft.goal.trim(),
      checklist: cleanChecklist(draft.checklist),
      setupNotes: draft.setupNotes.trim(),
      updatedAt: nowIso(),
    })),
  }
  // Wird die Session einem anderen Projekt zugeordnet, verlieren projektfremde Aufgaben den Session-Bezug.
  if (current.projectId !== draft.projectId) {
    next = {
      ...next,
      tasks: next.tasks.map((t) => (t.sessionId === id ? { ...t, sessionId: null, updatedAt: nowIso() } : t)),
    }
  }
  return next
}

export function toggleChecklistItem(data: AppData, sessionId: ID, itemId: ID): AppData {
  return {
    ...data,
    sessions: replaceById(data.sessions, sessionId, (s) => ({
      ...s,
      checklist: s.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
      updatedAt: nowIso(),
    })),
  }
}

export interface SessionCompletion {
  result: string
  notes: string
  recordingLinks: LabeledLink[]
  nextSteps: string[]
  projectStatus: Exclude<ProjectStatus, 'archiviert'> | null
}

export function completeSession(data: AppData, id: ID, input: SessionCompletion): AppData {
  const session = data.sessions.find((s) => s.id === id)
  if (!session) throw new DomainError('Session wurde nicht gefunden.')
  if (!input.result.trim()) throw new DomainError('Bitte halte das Ergebnis der Session fest.')
  const t = nowIso()
  let next: AppData = {
    ...data,
    sessions: replaceById(data.sessions, id, (s) => ({
      ...s,
      result: input.result.trim(),
      notes: input.notes.trim(),
      recordingLinks: input.recordingLinks
        .map((l) => ({ ...l, id: l.id || newId(), label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.url),
      status: 'abgeschlossen',
      completedAt: s.completedAt ?? t,
      updatedAt: t,
    })),
  }
  for (const step of input.nextSteps) {
    if (step.trim()) next = addTask(next, session.projectId, step, id).data
  }
  if (input.projectStatus) {
    const project = requireProject(next, session.projectId)
    if (project.status !== 'archiviert') next = setProjectStatus(next, session.projectId, input.projectStatus)
  }
  return next
}

export function setSessionStatus(data: AppData, id: ID, status: Session['status']): AppData {
  return {
    ...data,
    sessions: replaceById(data.sessions, id, (s) => ({
      ...s,
      status,
      completedAt: status === 'abgeschlossen' ? (s.completedAt ?? nowIso()) : null,
      updatedAt: nowIso(),
    })),
  }
}

export function deleteSession(data: AppData, id: ID): AppData {
  const t = nowIso()
  return {
    ...data,
    sessions: data.sessions.filter((s) => s.id !== id),
    tasks: data.tasks.map((x) => (x.sessionId === id ? { ...x, sessionId: null, updatedAt: t } : x)),
  }
}

// ───────────────────────── Audio-Versionen & Feedback ─────────────────────────

export interface AudioVersionDraft {
  projectId: ID
  name: string
  date: string
  url: string
  changes: string
  isCurrent: boolean
}

/** Stellt sicher, dass pro Projekt höchstens eine Version „aktueller Arbeitsstand“ ist. */
function enforceSingleCurrent(versions: AudioVersion[], projectId: ID, currentId: ID): AudioVersion[] {
  const t = nowIso()
  return versions.map((v) =>
    v.projectId === projectId && v.id !== currentId && v.isCurrent ? { ...v, isCurrent: false, updatedAt: t } : v,
  )
}

export function createAudioVersion(data: AppData, draft: AudioVersionDraft): { data: AppData; id: ID } {
  requireProject(data, draft.projectId)
  const version: AudioVersion = {
    ...base(),
    projectId: draft.projectId,
    name: draft.name.trim(),
    date: draft.date,
    url: draft.url.trim(),
    changes: draft.changes.trim(),
    isCurrent: draft.isCurrent,
  }
  let versions = [...data.audioVersions, version]
  if (version.isCurrent) versions = enforceSingleCurrent(versions, version.projectId, version.id)
  return { data: { ...data, audioVersions: versions }, id: version.id }
}

export function updateAudioVersion(data: AppData, id: ID, draft: AudioVersionDraft): AppData {
  requireProject(data, draft.projectId)
  let versions = replaceById(data.audioVersions, id, (v) => ({
    ...v,
    projectId: draft.projectId,
    name: draft.name.trim(),
    date: draft.date,
    url: draft.url.trim(),
    changes: draft.changes.trim(),
    isCurrent: draft.isCurrent,
    updatedAt: nowIso(),
  }))
  if (draft.isCurrent) versions = enforceSingleCurrent(versions, draft.projectId, id)
  return { ...data, audioVersions: versions }
}

export function setCurrentVersion(data: AppData, id: ID): AppData {
  const v = data.audioVersions.find((x) => x.id === id)
  if (!v) throw new DomainError('Audio-Version wurde nicht gefunden.')
  const versions = replaceById(data.audioVersions, id, (x) => ({ ...x, isCurrent: true, updatedAt: nowIso() }))
  return { ...data, audioVersions: enforceSingleCurrent(versions, v.projectId, id) }
}

export function deleteAudioVersion(data: AppData, id: ID): AppData {
  return {
    ...data,
    audioVersions: data.audioVersions.filter((v) => v.id !== id),
    feedback: data.feedback.filter((f) => f.audioVersionId !== id),
  }
}

export interface FeedbackDraft {
  audioVersionId: ID
  authorId: ID | null
  comment: string
  timestampSec: number | null
}

export function addFeedback(data: AppData, draft: FeedbackDraft): { data: AppData; id: ID } {
  if (!data.audioVersions.some((v) => v.id === draft.audioVersionId))
    throw new DomainError('Audio-Version wurde nicht gefunden.')
  if (draft.authorId && !data.people.some((p) => p.id === draft.authorId))
    throw new DomainError('Die verfassende Person existiert nicht.')
  if (!draft.comment.trim()) throw new DomainError('Bitte schreibe einen Kommentar.')
  const fb: Feedback = { ...base(), ...draft, comment: draft.comment.trim() }
  return { data: { ...data, feedback: [...data.feedback, fb] }, id: fb.id }
}

export function deleteFeedback(data: AppData, id: ID): AppData {
  return { ...data, feedback: data.feedback.filter((f) => f.id !== id) }
}

// ───────────────────────── Ressourcen-Links ─────────────────────────

export interface ResourceLinkDraft {
  kind: LinkKind
  label: string
  target: string
}

export function addResourceLink(data: AppData, projectId: ID, draft: ResourceLinkDraft): { data: AppData; id: ID } {
  requireProject(data, projectId)
  const link: ResourceLink = {
    ...base(),
    projectId,
    kind: draft.kind,
    label: draft.label.trim(),
    target: draft.target.trim(),
  }
  return { data: { ...data, resourceLinks: [...data.resourceLinks, link] }, id: link.id }
}

export function updateResourceLink(data: AppData, id: ID, draft: ResourceLinkDraft): AppData {
  return {
    ...data,
    resourceLinks: replaceById(data.resourceLinks, id, (l) => ({
      ...l,
      kind: draft.kind,
      label: draft.label.trim(),
      target: draft.target.trim(),
      updatedAt: nowIso(),
    })),
  }
}

export function deleteResourceLink(data: AppData, id: ID): AppData {
  return { ...data, resourceLinks: data.resourceLinks.filter((l) => l.id !== id) }
}
