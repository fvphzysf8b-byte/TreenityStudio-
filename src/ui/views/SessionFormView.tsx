import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { createSession, updateSession, type SessionDraft } from '../../domain/operations'
import { membersOf } from '../../domain/selectors'
import type { ChecklistItem } from '../../domain/types'
import { newId } from '../../domain/util'
import { hasErrors, validateSession, type Errors } from '../../domain/validation'
import { useStore } from '../../state/store'
import { Field, FormActions, PersonPicker, focusFirstError } from '../components/form'
import { Button, ButtonLink, EmptyState, PageHeader } from '../components/ui'
import { NotFound } from './NotFound'

const CHECKLIST_TEMPLATE = [
  'Mikrofone, Kabel und Interface prüfen',
  'Kopfhörermix vorbereiten',
  'DAW-Projekt/Template öffnen und Aufnahmeformat prüfen',
  'Freien Speicherplatz und Backup prüfen',
  'Material (Texte, Referenzen, Noten) bereitlegen',
]

export function SessionFormView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data, apply } = useStore()
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const existing = id ? data.sessions.find((s) => s.id === id) : undefined

  const [draft, setDraft] = useState<SessionDraft>(() => {
    if (existing) {
      return {
        projectId: existing.projectId,
        title: existing.title,
        startsAt: existing.startsAt,
        durationMinutes: existing.durationMinutes,
        participantIds: existing.participantIds,
        goal: existing.goal,
        checklist: existing.checklist,
        setupNotes: existing.setupNotes,
      }
    }
    const projectId = params.get('projekt') ?? ''
    const valid = data.projects.some((p) => p.id === projectId && p.status !== 'archiviert')
    return {
      projectId: valid ? projectId : '',
      title: '',
      startsAt: '',
      durationMinutes: 120,
      participantIds: valid ? membersOf(data, projectId).map((p) => p.id) : [],
      goal: '',
      checklist: [],
      setupNotes: '',
    }
  })
  const [errors, setErrors] = useState<Errors>({})

  if (id && !existing) return <NotFound what="Session" />

  const projects = data.projects.filter((p) => p.status !== 'archiviert' || p.id === existing?.projectId)
  if (projects.length === 0) {
    return (
      <>
        <PageHeader title="Session planen" />
        <EmptyState
          title="Zuerst ein Projekt anlegen"
          text="Jede Session gehört zu einem Projekt."
          action={
            <ButtonLink to="/projekte/neu" variant="primary">
              + Projekt anlegen
            </ButtonLink>
          }
        />
      </>
    )
  }

  function update<K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function setChecklist(fn: (items: ChecklistItem[]) => ChecklistItem[]) {
    setDraft((d) => ({ ...d, checklist: fn(d.checklist) }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs = validateSession(draft)
    setErrors(errs)
    if (hasErrors(errs)) return focusFirstError(formRef.current)
    if (existing) {
      if (apply((d) => updateSession(d, existing.id, draft), { success: 'Session gespeichert.' })) navigate(`/sessions/${existing.id}`)
    } else {
      let sid = ''
      const ok = apply(
        (d) => {
          const r = createSession(d, draft)
          sid = r.id
          return r.data
        },
        { success: 'Session geplant.' },
      )
      if (ok) navigate(`/sessions/${sid}`, { replace: true })
    }
  }

  return (
    <>
      <PageHeader title={existing ? 'Session bearbeiten' : 'Session planen'} intro="Ein klares Ziel macht die Session fokussiert." />
      <form ref={formRef} noValidate onSubmit={submit} className="card max-w-3xl space-y-5 p-4 sm:p-6">
        <Field label="Projekt" required error={errors.projectId}>
          <select
            className="input"
            value={draft.projectId}
            onChange={(e) => {
              const pid = e.target.value
              setDraft((d) => ({
                ...d,
                projectId: pid,
                // Beteiligte des Projekts vorschlagen, solange noch niemand gewählt ist.
                participantIds: d.participantIds.length ? d.participantIds : membersOf(data, pid).map((p) => p.id),
              }))
            }}
          >
            <option value="">Bitte wählen …</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Titel" required error={errors.title}>
          <input className="input" value={draft.title} onChange={(e) => update('title', e.target.value)} placeholder="z. B. Recording Vocals" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Datum und Uhrzeit" required error={errors.startsAt}>
            <input type="datetime-local" className="input" value={draft.startsAt} onChange={(e) => update('startsAt', e.target.value)} />
          </Field>
          <Field label="Geplante Dauer (Minuten)" required error={errors.durationMinutes}>
            <input
              type="number"
              inputMode="numeric"
              min={5}
              step={15}
              className="input"
              value={Number.isFinite(draft.durationMinutes) ? draft.durationMinutes : ''}
              onChange={(e) => update('durationMinutes', e.target.value === '' ? NaN : Number(e.target.value))}
            />
          </Field>
        </div>

        <Field
          label="Session-Ziel: „Am Ende dieser Session haben wir …“"
          required
          error={errors.goal}
          hint="Ein konkretes, überprüfbares Ergebnis."
        >
          <textarea
            className="input min-h-16"
            value={draft.goal}
            onChange={(e) => update('goal', e.target.value)}
            placeholder="zwei vollständige Vocal-Takes für den Refrain."
          />
        </Field>
        <p className="-mt-3 text-sm text-gold-300" aria-hidden="true">
          „Am Ende dieser Session haben wir {draft.goal.trim() || '…'}“
        </p>

        <PersonPicker legend="Beteiligte" people={data.people} value={draft.participantIds} onChange={(ids) => update('participantIds', ids)} />

        <fieldset>
          <legend className="mb-1 text-sm font-medium">
            Vorbereitungscheckliste <span className="font-normal text-faint">(optional)</span>
          </legend>
          {draft.checklist.length > 0 && (
            <ul className="mb-2 space-y-2">
              {draft.checklist.map((item, i) => (
                <li key={item.id} className="flex gap-2">
                  <label className="sr-only" htmlFor={`cl-${item.id}`}>
                    Punkt {i + 1}
                  </label>
                  <input
                    id={`cl-${item.id}`}
                    className="input"
                    value={item.text}
                    onChange={(e) => setChecklist((items) => items.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x)))}
                  />
                  <Button size="sm" variant="ghost" onClick={() => setChecklist((items) => items.filter((x) => x.id !== item.id))} aria-label={`Punkt ${i + 1} entfernen`}>
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                const nid = newId()
                setChecklist((items) => [...items, { id: nid, text: '', done: false }])
                requestAnimationFrame(() => document.getElementById(`cl-${nid}`)?.focus())
              }}
            >
              + Punkt hinzufügen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setChecklist((items) => [
                  ...items,
                  ...CHECKLIST_TEMPLATE.filter((t) => !items.some((x) => x.text === t)).map((text) => ({ id: newId(), text, done: false })),
                ])
              }
            >
              Recording-Vorlage einfügen
            </Button>
          </div>
          <p className="mt-1 text-xs text-faint">Leere Punkte werden beim Speichern ignoriert.</p>
        </fieldset>

        <Field label="Setup-Notizen" hint="Mikrofone, Signalweg, DAW-Template, Raum …">
          <textarea className="input min-h-20" value={draft.setupNotes} onChange={(e) => update('setupNotes', e.target.value)} />
        </Field>

        <FormActions>
          <ButtonLink to={existing ? `/sessions/${existing.id}` : '/sessions'}>Abbrechen</ButtonLink>
          <Button type="submit" variant="primary">
            {existing ? 'Änderungen speichern' : 'Session planen'}
          </Button>
        </FormActions>
      </form>
    </>
  )
}
