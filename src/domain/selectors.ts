import type { AppData, AudioVersion, ID, Person, Project, Session, Task } from './types'
import { nowLocalDateTime } from './util'

export function projectById(data: AppData, id: ID | undefined): Project | undefined {
  return data.projects.find((p) => p.id === id)
}

export function personName(data: AppData, id: ID | null): string {
  if (!id) return 'Gelöschte Person'
  return data.people.find((p) => p.id === id)?.name ?? 'Gelöschte Person'
}

export function membersOf(data: AppData, projectId: ID): Person[] {
  const ids = new Set(data.projectMembers.filter((m) => m.projectId === projectId).map((m) => m.personId))
  return data.people.filter((p) => ids.has(p.id))
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

export function tasksOf(data: AppData, projectId: ID): Task[] {
  return sortTasks(data.tasks.filter((t) => t.projectId === projectId))
}

/** Die nächste konkrete Handlung ist die erste offene Aufgabe des Projekts. */
export function nextAction(data: AppData, projectId: ID): Task | undefined {
  return tasksOf(data, projectId).find((t) => !t.done)
}

export function isActive(p: Project): boolean {
  return p.status !== 'idee' && p.status !== 'archiviert' && p.status !== 'veroeffentlicht'
}

export function focusProjects(data: AppData): Project[] {
  return data.projects.filter((p) => p.pinned && p.status !== 'archiviert')
}

/** Aktive, nicht angeheftete Projekte, zuletzt geänderte zuerst. */
export function otherActiveProjects(data: AppData): Project[] {
  return data.projects
    .filter((p) => !p.pinned && isActive(p))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function sortSessionsAsc(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export function upcomingSessions(data: AppData, now = nowLocalDateTime()): Session[] {
  return sortSessionsAsc(data.sessions.filter((s) => s.status === 'geplant' && s.startsAt >= now.slice(0, 10)))
}

/** Geplante Sessions, deren Termin vorbei ist – sie sollten abgeschlossen oder abgesagt werden. */
export function overdueSessions(data: AppData, now = nowLocalDateTime()): Session[] {
  return sortSessionsAsc(data.sessions.filter((s) => s.status === 'geplant' && s.startsAt < now.slice(0, 10)))
}

export function sessionsOf(data: AppData, projectId: ID): Session[] {
  return data.sessions.filter((s) => s.projectId === projectId).sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}

/** Offene Aufgaben aus nicht archivierten Projekten, Fokusprojekte zuerst. */
export function openTasksOverview(data: AppData): { task: Task; project: Project; isNext: boolean }[] {
  const result: { task: Task; project: Project; isNext: boolean }[] = []
  const projects = data.projects
    .filter((p) => p.status !== 'archiviert' && p.status !== 'veroeffentlicht')
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  for (const project of projects) {
    const open = tasksOf(data, project.id).filter((t) => !t.done)
    open.forEach((task, i) => result.push({ task, project, isNext: i === 0 }))
  }
  return result
}

export function versionsOf(data: AppData, projectId: ID): AudioVersion[] {
  return data.audioVersions.filter((v) => v.projectId === projectId).sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}

export function feedbackOf(data: AppData, versionId: ID) {
  return data.feedback.filter((f) => f.audioVersionId === versionId).sort((a, b) => {
    if (a.timestampSec !== null && b.timestampSec !== null) return a.timestampSec - b.timestampSec
    if (a.timestampSec !== null) return -1
    if (b.timestampSec !== null) return 1
    return a.createdAt.localeCompare(b.createdAt)
  })
}
