import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/operations'
import { addExamples, initialData } from '../domain/seed'
import { mergeData, parseEnvelope, serializeExport } from './transfer'

describe('Export und Import', () => {
  it('Roundtrip: Export lässt sich unverändert wieder einlesen', () => {
    const data = addExamples(initialData())
    const r = parseEnvelope(serializeExport(data))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual(data)
  })

  it('lehnt kaputtes JSON ab', () => {
    const r = parseEnvelope('{ nicht json')
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('JSON') })
  })

  it('lehnt fremde Dateien ab', () => {
    const r = parseEnvelope(JSON.stringify({ foo: 1 }))
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('kein TreenityStudio-Backup') })
  })

  it('lehnt neuere Formatversion ab', () => {
    const r = parseEnvelope(JSON.stringify({ app: 'treenitystudio', schemaVersion: 99, data: {} }))
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('neueren App-Version') })
  })

  it('lehnt fehlende Felder ab', () => {
    const data = initialData()
    const env = JSON.parse(serializeExport(data))
    delete env.data.projects
    const r = parseEnvelope(JSON.stringify(env))
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('projects') })
  })

  it('lehnt verwaiste Verknüpfungen ab', () => {
    const data = addExamples(initialData())
    const env = JSON.parse(serializeExport(data))
    env.data.projects = []
    const r = parseEnvelope(JSON.stringify(env))
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('widersprüchliche') })
  })

  it('Ergänzen überschreibt nichts und vermeidet Personen-Dubletten', () => {
    const current = createProject(initialData(), {
      title: 'Lokal',
      type: 'musik',
      brand: 'studio',
      releaseArea: null,
      format: '',
      description: '',
      goal: '',
      status: 'vorbereitung',
      dueDate: null,
      memberIds: [],
    }).data
    // Andere Datei mit eigenen IDs, aber gleichen Personennamen
    const incoming = addExamples(initialData())
    const r = mergeData(current, incoming)
    expect(r.data.people).toHaveLength(3)
    expect(r.data.projects.map((p) => p.title)).toContain('Lokal')
    expect(r.data.projects).toHaveLength(1 + incoming.projects.length)

    // Zweimal ergänzen = keine Duplikate
    const again = mergeData(r.data, incoming)
    expect(again.added).toBe(0)
    expect(again.data.projects).toHaveLength(r.data.projects.length)
  })
})
