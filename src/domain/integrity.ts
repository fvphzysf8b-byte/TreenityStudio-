import type { AppData } from './types'

/**
 * Prüft die Konsistenz verknüpfter Datensätze.
 * Gibt eine Liste verständlicher Probleme zurück (leer = alles konsistent).
 */
export function checkIntegrity(data: AppData): string[] {
  const problems: string[] = []
  const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id))
  const people = ids(data.people)
  const projects = ids(data.projects)
  const sessions = ids(data.sessions)
  const versions = ids(data.audioVersions)

  const all = [
    ...data.people,
    ...data.projects,
    ...data.projectMembers,
    ...data.sessions,
    ...data.tasks,
    ...data.audioVersions,
    ...data.feedback,
    ...data.resourceLinks,
  ]
  const seen = new Set<string>()
  for (const r of all) {
    if (seen.has(r.id)) problems.push(`Die ID ${r.id} kommt mehrfach vor.`)
    seen.add(r.id)
  }

  for (const m of data.projectMembers) {
    if (!projects.has(m.projectId)) problems.push('Eine Projektzuordnung verweist auf ein fehlendes Projekt.')
    if (!people.has(m.personId)) problems.push('Eine Projektzuordnung verweist auf eine fehlende Person.')
  }
  for (const s of data.sessions) {
    if (!projects.has(s.projectId)) problems.push(`Die Session „${s.title}“ gehört zu keinem vorhandenen Projekt.`)
    if (s.participantIds.some((p) => !people.has(p)))
      problems.push(`Die Session „${s.title}“ verweist auf eine fehlende Person.`)
  }
  for (const t of data.tasks) {
    if (!projects.has(t.projectId)) problems.push(`Die Aufgabe „${t.title}“ gehört zu keinem vorhandenen Projekt.`)
    if (t.sessionId) {
      const s = data.sessions.find((x) => x.id === t.sessionId)
      if (!s || !sessions.has(t.sessionId)) problems.push(`Die Aufgabe „${t.title}“ verweist auf eine fehlende Session.`)
      else if (s.projectId !== t.projectId)
        problems.push(`Die Aufgabe „${t.title}“ verweist auf eine Session eines anderen Projekts.`)
    }
  }
  const currentPerProject = new Map<string, number>()
  for (const v of data.audioVersions) {
    if (!projects.has(v.projectId)) problems.push(`Die Audio-Version „${v.name}“ gehört zu keinem vorhandenen Projekt.`)
    if (v.isCurrent) currentPerProject.set(v.projectId, (currentPerProject.get(v.projectId) ?? 0) + 1)
  }
  for (const [pid, n] of currentPerProject) {
    if (n > 1) problems.push(`Im Projekt ${pid} sind ${n} Versionen als aktueller Arbeitsstand markiert.`)
  }
  for (const f of data.feedback) {
    if (!versions.has(f.audioVersionId)) problems.push('Ein Feedback verweist auf eine fehlende Audio-Version.')
    if (f.authorId && !people.has(f.authorId)) problems.push('Ein Feedback verweist auf eine fehlende Person.')
  }
  for (const l of data.resourceLinks) {
    if (!projects.has(l.projectId)) problems.push(`Der Link „${l.label}“ gehört zu keinem vorhandenen Projekt.`)
  }
  if (data.projects.filter((p) => p.pinned).length > 3) problems.push('Mehr als drei Projekte sind angeheftet.')
  return [...new Set(problems)]
}
