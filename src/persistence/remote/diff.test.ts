import { describe, expect, it } from 'vitest'
import { addTask, createProject, deleteProject, setTaskDone, type ProjectDraft } from '../../domain/operations'
import { addExamples, initialData } from '../../domain/seed'
import { diffData, isEmpty } from './diff'
import { fromRow, toRow } from './mapping'

const draft: ProjectDraft = {
  title: 'P',
  type: 'musik',
  brand: 'studio',
  releaseArea: null,
  format: '',
  description: '',
  goal: '',
  status: 'vorbereitung',
  dueDate: null,
  memberIds: [],
}

describe('Änderungserkennung', () => {
  it('erkennt keine Änderung bei identischem Stand', () => {
    const d = addExamples(initialData())
    expect(isEmpty(diffData(d, d))).toBe(true)
  })

  it('schickt nur geänderte Datensätze', () => {
    const base = addExamples(initialData())
    const p = createProject(base, draft)
    const t = addTask(p.data, p.id, 'Neu')
    const after = setTaskDone(t.data, t.id, true)
    const c = diffData(base, after)
    expect(c.upserts.projects).toHaveLength(1)
    expect(c.upserts.tasks).toHaveLength(1)
    expect(c.upserts.sessions).toBeUndefined()
    expect(c.deletes).toEqual({})
  })

  it('meldet Löschungen inklusive abhängiger Datensätze', () => {
    const base = addExamples(initialData())
    const project = base.projects[0]
    const after = deleteProject(base, project.id)
    const c = diffData(base, after)
    expect(c.deletes.projects).toEqual([project.id])
    expect(c.deletes.sessions?.length).toBeGreaterThan(0)
    expect(c.upserts).toEqual({})
  })

  it('Rückgängig nach Löschen stellt alle Datensätze wieder her', () => {
    const base = addExamples(initialData())
    const after = deleteProject(base, base.projects[0].id)
    const undo = diffData(after, base)
    const restored = Object.values(undo.upserts).reduce((n, rows) => n + (rows?.length ?? 0), 0)
    const removed = Object.values(diffData(base, after).deletes).reduce((n, ids) => n + (ids?.length ?? 0), 0)
    expect(restored).toBe(removed)
  })
})

describe('Tabellen-Abbildung', () => {
  it('wandelt Feldnamen hin und zurück', () => {
    const d = addExamples(initialData())
    const task = d.tasks[0]
    const row = toRow(task)
    expect(row).toHaveProperty('project_id', task.projectId)
    expect(row).toHaveProperty('position', task.order)
    expect(row).not.toHaveProperty('order')
    expect(fromRow(row)).toEqual(task)
  })

  it('normalisiert Zeitstempel aus der Datenbank', () => {
    const rec = fromRow({ id: 'x', created_at: '2026-11-22T14:00:00+00:00', updated_at: '2026-11-22T14:00:00.5+00:00' })
    expect(rec.createdAt).toBe('2026-11-22T14:00:00.000Z')
    expect(rec.updatedAt).toBe('2026-11-22T14:00:00.500Z')
  })
})
