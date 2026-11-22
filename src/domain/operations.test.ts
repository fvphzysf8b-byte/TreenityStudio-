import { describe, expect, it } from 'vitest'
import { checkIntegrity } from './integrity'
import {
  addFeedback,
  addResourceLink,
  addTask,
  archiveProject,
  completeSession,
  createAudioVersion,
  createProject,
  createSession,
  deleteAudioVersion,
  deletePerson,
  deleteProject,
  deleteSession,
  makeNextAction,
  restoreProject,
  setCurrentVersion,
  setPinned,
  setTaskDone,
  type ProjectDraft,
} from './operations'
import { addExamples, initialData, removeExamples } from './seed'
import { focusProjects, nextAction, openTasksOverview, upcomingSessions } from './selectors'
import type { AppData } from './types'
import { parseTimestamp } from './util'

const draft = (over: Partial<ProjectDraft> = {}): ProjectDraft => ({
  title: 'Testtrack',
  type: 'musik',
  brand: 'studio',
  releaseArea: null,
  format: '',
  description: '',
  goal: '',
  status: 'vorbereitung',
  dueDate: null,
  memberIds: [],
  ...over,
})

function person(data: AppData, name: string) {
  return data.people.find((p) => p.name.startsWith(name))!.id
}

describe('Abnahme-Ablauf', () => {
  it('Projekt → Session → Ergebnis → nächste Handlung → Audio → Feedback', () => {
    let data = initialData()
    const christian = person(data, 'Christian')

    // 1. Musikprojekt mit Christian
    const p = createProject(data, draft({ memberIds: [christian] }))
    data = p.data
    expect(data.projectMembers).toHaveLength(1)

    // 2. Recording-Session mit Ziel und Checkliste
    const s = createSession(data, {
      projectId: p.id,
      title: 'Recording',
      startsAt: '2099-01-10T18:00',
      durationMinutes: 120,
      participantIds: [christian],
      goal: 'zwei Takes',
      checklist: [
        { id: '', text: 'Mikro testen', done: false },
        { id: '', text: '   ', done: false },
      ],
      setupNotes: '',
    })
    data = s.data
    expect(data.sessions[0].checklist).toHaveLength(1)
    expect(upcomingSessions(data, '2099-01-01T00:00')).toHaveLength(1)

    // 3. Abschließen mit Ergebnis + nächstem Schritt
    data = completeSession(data, s.id, {
      result: 'Zwei Takes aufgenommen',
      notes: '',
      recordingLinks: [],
      nextSteps: ['Comping', ''],
      projectStatus: 'bearbeitung',
    })
    const session = data.sessions[0]
    expect(session.status).toBe('abgeschlossen')
    expect(session.completedAt).not.toBeNull()
    expect(data.projects[0].status).toBe('bearbeitung')

    // 6. Nächste Aufgabe auf der Startseite
    const next = nextAction(data, p.id)
    expect(next?.title).toBe('Comping')
    expect(next?.sessionId).toBe(s.id)
    expect(openTasksOverview(data)[0]).toMatchObject({ isNext: true })

    // 4. Mix verlinken, 5. Feedback mit Zeitbezug
    const v = createAudioVersion(data, {
      projectId: p.id,
      name: 'Mix 01',
      date: '2099-01-11',
      url: 'https://example.com/mix.wav',
      changes: '',
      isCurrent: true,
    })
    data = v.data
    data = addFeedback(data, { audioVersionId: v.id, authorId: christian, comment: 'Snare lauter', timestampSec: parseTimestamp('01:24') }).data
    expect(data.feedback[0].timestampSec).toBe(84)

    expect(checkIntegrity(data)).toEqual([])
  })

  it('lehnt Abschluss ohne Ergebnis ab', () => {
    let data = initialData()
    const p = createProject(data, draft())
    data = p.data
    const s = createSession(data, {
      projectId: p.id,
      title: 'X',
      startsAt: '2099-01-10T18:00',
      durationMinutes: 60,
      participantIds: [],
      goal: 'y',
      checklist: [],
      setupNotes: '',
    })
    expect(() =>
      completeSession(s.data, s.id, { result: '  ', notes: '', recordingLinks: [], nextSteps: [], projectStatus: null }),
    ).toThrow(/Ergebnis/)
  })
})

describe('Regeln', () => {
  it('erlaubt höchstens drei Fokusprojekte', () => {
    let data = initialData()
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      const r = createProject(data, draft({ title: `P${i}` }))
      data = r.data
      ids.push(r.id)
    }
    for (const id of ids.slice(0, 3)) data = setPinned(data, id, true)
    expect(() => setPinned(data, ids[3], true)).toThrow(/höchstens 3/)
    expect(focusProjects(data)).toHaveLength(3)
  })

  it('markiert pro Projekt nur eine Version als aktuellen Arbeitsstand', () => {
    let data = initialData()
    const p = createProject(data, draft())
    data = p.data
    const base = { projectId: p.id, date: '2099-01-01', url: 'https://x.de/a.mp3', changes: '', isCurrent: true }
    const a = createAudioVersion(data, { ...base, name: 'A' })
    data = a.data
    const b = createAudioVersion(data, { ...base, name: 'B' })
    data = b.data
    expect(data.audioVersions.filter((v) => v.isCurrent).map((v) => v.name)).toEqual(['B'])
    data = setCurrentVersion(data, a.id)
    expect(data.audioVersions.filter((v) => v.isCurrent).map((v) => v.name)).toEqual(['A'])
  })

  it('makeNextAction setzt eine Aufgabe an die erste Stelle', () => {
    let data = initialData()
    const p = createProject(data, draft(), { firstAction: 'Erste' })
    data = p.data
    const t2 = addTask(data, p.id, 'Zweite')
    data = makeNextAction(t2.data, t2.id)
    expect(nextAction(data, p.id)?.title).toBe('Zweite')
    data = setTaskDone(data, t2.id, true)
    expect(nextAction(data, p.id)?.title).toBe('Erste')
  })

  it('Archivieren behält Daten, löst Fokus und lässt sich wiederherstellen', () => {
    let data = initialData()
    const p = createProject(data, draft({ status: 'aufnahme' }), { firstAction: 'A' })
    data = setPinned(p.data, p.id, true)
    data = archiveProject(data, p.id)
    expect(data.projects[0]).toMatchObject({ status: 'archiviert', pinned: false })
    expect(data.tasks).toHaveLength(1)
    data = restoreProject(data, p.id)
    expect(data.projects[0].status).toBe('aufnahme')
  })
})

describe('Löschen ohne verwaiste Datensätze', () => {
  function fullProject() {
    let data = initialData()
    const christian = person(data, 'Christian')
    const p = createProject(data, draft({ memberIds: [christian] }))
    data = p.data
    const s = createSession(data, {
      projectId: p.id,
      title: 'S',
      startsAt: '2099-01-10T18:00',
      durationMinutes: 60,
      participantIds: [christian],
      goal: 'g',
      checklist: [],
      setupNotes: '',
    })
    data = s.data
    data = addTask(data, p.id, 'T', s.id).data
    const v = createAudioVersion(data, { projectId: p.id, name: 'Mix', date: '2099-01-01', url: 'https://x.de/a.mp3', changes: '', isCurrent: true })
    data = v.data
    data = addFeedback(data, { audioVersionId: v.id, authorId: christian, comment: 'gut', timestampSec: null }).data
    data = addResourceLink(data, p.id, { kind: 'ordner', label: 'Ordner', target: '~/Musik/X' }).data
    return { data, projectId: p.id, sessionId: s.id, versionId: v.id, christian }
  }

  it('Projekt löschen entfernt alle abhängigen Daten', () => {
    const { data, projectId } = fullProject()
    const after = deleteProject(data, projectId)
    expect(after.sessions).toHaveLength(0)
    expect(after.tasks).toHaveLength(0)
    expect(after.audioVersions).toHaveLength(0)
    expect(after.feedback).toHaveLength(0)
    expect(after.resourceLinks).toHaveLength(0)
    expect(after.projectMembers).toHaveLength(0)
    expect(after.people).toHaveLength(3)
    expect(checkIntegrity(after)).toEqual([])
  })

  it('Session löschen behält Aufgaben ohne Session-Bezug', () => {
    const { data, sessionId } = fullProject()
    const after = deleteSession(data, sessionId)
    expect(after.tasks).toHaveLength(1)
    expect(after.tasks[0].sessionId).toBeNull()
    expect(checkIntegrity(after)).toEqual([])
  })

  it('Audio-Version löschen entfernt Feedback', () => {
    const { data, versionId } = fullProject()
    const after = deleteAudioVersion(data, versionId)
    expect(after.feedback).toHaveLength(0)
    expect(checkIntegrity(after)).toEqual([])
  })

  it('Person löschen bereinigt Zuordnungen, Feedback bleibt anonym', () => {
    const { data, christian } = fullProject()
    const after = deletePerson(data, christian)
    expect(after.projectMembers).toHaveLength(0)
    expect(after.sessions[0].participantIds).toEqual([])
    expect(after.feedback[0].authorId).toBeNull()
    expect(checkIntegrity(after)).toEqual([])
  })
})

describe('Beispieldaten', () => {
  it('sind konsistent und vollständig entfernbar', () => {
    const data = addExamples(initialData())
    expect(checkIntegrity(data)).toEqual([])
    expect(data.projects.every((p) => p.isExample && p.title.startsWith('Beispiel'))).toBe(true)
    const cleaned = removeExamples(data)
    expect(cleaned.projects).toHaveLength(0)
    expect(cleaned.sessions).toHaveLength(0)
    expect(cleaned.tasks).toHaveLength(0)
    expect(cleaned.people).toHaveLength(3)
  })
})
