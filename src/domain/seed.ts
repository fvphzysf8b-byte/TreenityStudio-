/**
 * Startdaten und klar gekennzeichnete Beispieldaten.
 * Beispielprojekte tragen „Beispiel:“ im Titel und isExample = true.
 * Termine sind relativ zum heutigen Datum gesetzt und keine echten Verabredungen.
 */
import { addFeedback, addResourceLink, addTask, completeSession, createAudioVersion, createPerson, createProject, createSession, deleteProject, setPinned } from './operations'
import type { AppData } from './types'
import { emptyData } from './types'
import { newId, toLocalDate, toLocalDateTime } from './util'

/** Beteiligte laut Projektauftrag. */
export function initialData(): AppData {
  let data = emptyData()
  data = createPerson(data, { name: 'Eugen (U-Geen)', role: 'Tontechnik, Produktion, kreative Leitung' }).data
  data = createPerson(data, { name: 'Christian', role: 'Musikentwicklung & Aufnahmen' }).data
  data = createPerson(data, { name: 'Alex', role: 'Musik- & Live-Projekte' }).data
  return data
}

function relDate(days: number, hour = 18): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return toLocalDateTime(d)
}

export function hasExamples(data: AppData): boolean {
  return data.projects.some((p) => p.isExample)
}

export function addExamples(input: AppData): AppData {
  let data = input
  // Beteiligte sicherstellen
  const ensure = (name: string, role: string) => {
    const found = data.people.find((p) => p.name.toLowerCase().startsWith(name.toLowerCase()))
    if (found) return found.id
    const r = createPerson(data, { name, role })
    data = r.data
    return r.id
  }
  const eugen = ensure('Eugen', 'Tontechnik, Produktion, kreative Leitung')
  const christian = ensure('Christian', 'Musikentwicklung & Aufnahmen')
  const alex = ensure('Alex', 'Musik- & Live-Projekte')

  const track = createProject(
    data,
    {
      title: 'Beispiel: Track „Wurzelwerk“',
      type: 'musik',
      brand: 'studio',
      releaseArea: 'records',
      format: '',
      description: 'Beispielprojekt zum Ausprobieren der App. Kein echter Projektstand.',
      goal: 'Fertig gemischter Track, bereit für das Mastering.',
      status: 'bearbeitung',
      dueDate: null,
      memberIds: [eugen, christian],
    },
    { isExample: true },
  )
  data = track.data
  if (data.projects.filter((p) => p.pinned).length < 3) data = setPinned(data, track.id, true)

  const past = createSession(data, {
    projectId: track.id,
    title: 'Beispiel: Vocal-Recording',
    startsAt: relDate(-5),
    durationMinutes: 180,
    participantIds: [eugen, christian],
    goal: 'zwei vollständige Vocal-Takes für Strophe und Refrain',
    checklist: [
      { id: newId(), text: 'Mikrofon und Preamp testen', done: true },
      { id: newId(), text: 'Kopfhörermix vorbereiten', done: true },
      { id: newId(), text: 'Lyrics ausdrucken', done: true },
    ],
    setupNotes: 'Beispiel: Großmembran-Mikrofon, Pop-Schutz, Logic-Template „Vocals“.',
  })
  data = past.data
  data = completeSession(data, past.id, {
    result: 'Beispiel: Zwei Takes aufgenommen, Refrain-Take 2 ist der Favorit.',
    notes: 'Entscheidung: Bridge wird gekürzt.',
    recordingLinks: [],
    nextSteps: ['Beispiel: Vocal-Comping für den Refrain'],
    projectStatus: null,
  })
  data = addTask(data, track.id, 'Beispiel: Rohmix an Christian schicken').data

  const mix = createAudioVersion(data, {
    projectId: track.id,
    name: 'Mix 01',
    date: toLocalDate(new Date()),
    url: 'https://example.com/beispiel-mix-01.mp3',
    changes: 'Beispiel: Erster Rohmix nach dem Vocal-Recording. (Beispiel-Link, nicht abspielbar.)',
    isCurrent: true,
  })
  data = mix.data
  data = addFeedback(data, {
    audioVersionId: mix.id,
    authorId: christian,
    comment: 'Beispiel: Die Snare könnte im Refrain etwas präsenter sein.',
    timestampSec: 84,
  }).data
  data = addResourceLink(data, track.id, {
    kind: 'ordner',
    label: 'Beispiel: Logic-Projektordner',
    target: '~/Musik/Treenity/Beispiel Wurzelwerk',
  }).data

  const podcast = createProject(
    data,
    {
      title: 'Beispiel: TreenitySignal Folge',
      type: 'podcast',
      brand: 'radio',
      releaseArea: 'radio',
      format: 'TreenitySignal',
      description: 'Beispielprojekt für das kurze Podcastformat. Kein echter Projektstand.',
      goal: 'Kurze Folge, fertig geschnitten.',
      status: 'vorbereitung',
      dueDate: null,
      memberIds: [eugen, alex],
    },
    { isExample: true, firstAction: 'Beispiel: Themenliste für die Folge schreiben' },
  )
  data = podcast.data
  data = createSession(data, {
    projectId: podcast.id,
    title: 'Beispiel: Aufnahme Talk',
    startsAt: relDate(3),
    durationMinutes: 90,
    participantIds: [eugen, alex],
    goal: 'eine vollständige Aufnahme der Folge',
    checklist: [
      { id: newId(), text: 'Zwei Mikrofone aufbauen', done: false },
      { id: newId(), text: 'Pegel testen', done: false },
    ],
    setupNotes: '',
  }).data

  data = createProject(
    data,
    {
      title: 'Beispiel: Idee Field Recording Wald',
      type: 'soundscape',
      brand: 'studio',
      releaseArea: null,
      format: '',
      description: 'Beispiel-Idee. Kein echter Projektstand.',
      goal: '',
      status: 'idee',
      dueDate: null,
      memberIds: [eugen],
    },
    { isExample: true },
  ).data
  return data
}

export function removeExamples(input: AppData): AppData {
  let data = input
  for (const p of input.projects.filter((x) => x.isExample)) data = deleteProject(data, p.id)
  return data
}
