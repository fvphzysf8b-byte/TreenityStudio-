import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { BRAND_LABEL, KNOWN_FORMATS, PROJECT_STATUS_LABEL, PROJECT_TYPE_LABEL } from '../../domain/labels'
import { createProject, updateProject, type ProjectDraft } from '../../domain/operations'
import { membersOf, projectById } from '../../domain/selectors'
import { BRAND_AREAS, PROJECT_STATUSES, PROJECT_TYPES, RELEASE_AREAS, type ProjectStatus } from '../../domain/types'
import { hasErrors, validateProject, type Errors } from '../../domain/validation'
import { useStore } from '../../state/store'
import { Field, FormActions, PersonPicker, focusFirstError } from '../components/form'
import { Button, ButtonLink, PageHeader } from '../components/ui'
import { NotFound } from './NotFound'

type EditableStatus = Exclude<ProjectStatus, 'archiviert'>
const STATUS_OPTIONS = PROJECT_STATUSES.filter((s): s is EditableStatus => s !== 'archiviert')

export function ProjectFormView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data, apply } = useStore()
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const existing = id ? projectById(data, id) : undefined

  const [draft, setDraft] = useState<ProjectDraft>(() => {
    if (existing) {
      return {
        title: existing.title,
        type: existing.type,
        brand: existing.brand,
        releaseArea: existing.releaseArea,
        format: existing.format,
        description: existing.description,
        goal: existing.goal,
        status: (existing.status === 'archiviert' ? (existing.statusBeforeArchive ?? 'vorbereitung') : existing.status) as EditableStatus,
        dueDate: existing.dueDate,
        memberIds: membersOf(data, existing.id).map((p) => p.id),
      }
    }
    const initialStatus = params.get('status')
    return {
      title: '',
      type: 'musik',
      brand: 'studio',
      releaseArea: null,
      format: '',
      description: '',
      goal: '',
      status: STATUS_OPTIONS.includes(initialStatus as EditableStatus) ? (initialStatus as EditableStatus) : 'vorbereitung',
      dueDate: null,
      memberIds: [],
    }
  })
  const [firstAction, setFirstAction] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  if (id && !existing) return <NotFound what="Projekt" />

  function update<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs = validateProject(draft)
    setErrors(errs)
    if (hasErrors(errs)) {
      focusFirstError(formRef.current)
      return
    }
    if (existing) {
      if (apply((d) => updateProject(d, existing.id, draft), { success: 'Projekt gespeichert.' }))
        navigate(`/projekte/${existing.id}`)
    } else {
      let newId = ''
      const ok = apply(
        (d) => {
          const r = createProject(d, draft, { firstAction })
          newId = r.id
          return r.data
        },
        { success: 'Projekt angelegt.' },
      )
      if (ok) navigate(`/projekte/${newId}`, { replace: true })
    }
  }

  return (
    <>
      <PageHeader
        title={existing ? 'Projekt bearbeiten' : 'Projekt anlegen'}
        intro={existing ? existing.title : 'Was entsteht hier, und was soll am Ende stehen?'}
      />
      <form ref={formRef} onSubmit={submit} noValidate className="card max-w-3xl space-y-5 p-4 sm:p-6">
        <Field label="Titel" required error={errors.title}>
          <input className="input" value={draft.title} onChange={(e) => update('title', e.target.value)} maxLength={140} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Projekttyp" required>
            <select className="input" value={draft.type} onChange={(e) => update('type', e.target.value as ProjectDraft['type'])}>
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROJECT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Status"
            required
            hint={existing?.status === 'archiviert' ? 'Das Projekt ist archiviert. Dieser Status gilt nach dem Wiederherstellen.' : 'Ideen erscheinen getrennt von laufenden Projekten.'}
          >
            <select className="input" value={draft.status} onChange={(e) => update('status', e.target.value as EditableStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Primärer Markenbereich" required>
            <select className="input" value={draft.brand} onChange={(e) => update('brand', e.target.value as ProjectDraft['brand'])}>
              {BRAND_AREAS.map((b) => (
                <option key={b} value={b}>
                  {BRAND_LABEL[b]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Veröffentlichung über" error={errors.releaseArea} hint="Wo das Ergebnis später erscheinen soll.">
            <select
              className="input"
              value={draft.releaseArea ?? ''}
              onChange={(e) => update('releaseArea', (e.target.value || null) as ProjectDraft['releaseArea'])}
            >
              <option value="">Noch offen</option>
              {RELEASE_AREAS.map((b) => (
                <option key={b} value={b}>
                  {BRAND_LABEL[b]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Format" hint="z. B. TreenitySignal">
            <input className="input" list="known-formats" value={draft.format} onChange={(e) => update('format', e.target.value)} />
          </Field>
          <Field label="Zieltermin" error={errors.dueDate}>
            <input
              type="date"
              className="input"
              value={draft.dueDate ?? ''}
              onChange={(e) => update('dueDate', e.target.value || null)}
            />
          </Field>
        </div>
        <datalist id="known-formats">
          {KNOWN_FORMATS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>

        <Field label="Kurzbeschreibung">
          <textarea className="input min-h-20" value={draft.description} onChange={(e) => update('description', e.target.value)} />
        </Field>
        <Field label="Gewünschtes Ergebnis" hint="Woran erkennen wir, dass das Projekt fertig ist?">
          <textarea className="input min-h-20" value={draft.goal} onChange={(e) => update('goal', e.target.value)} />
        </Field>

        <PersonPicker legend="Beteiligte" people={data.people} value={draft.memberIds} onChange={(ids) => update('memberIds', ids)} />

        {!existing && (
          <Field label="Nächste konkrete Handlung" hint="Der erste Schritt – erscheint auf der Startseite. Weitere Aufgaben kannst du im Projekt ergänzen.">
            <input
              className="input"
              value={firstAction}
              onChange={(e) => setFirstAction(e.target.value)}
              placeholder="z. B. Demo-Spur an Christian schicken"
            />
          </Field>
        )}

        <FormActions>
          <ButtonLink to={existing ? `/projekte/${existing.id}` : '/projekte'}>Abbrechen</ButtonLink>
          <Button type="submit" variant="primary">
            {existing ? 'Änderungen speichern' : 'Projekt anlegen'}
          </Button>
        </FormActions>
      </form>
    </>
  )
}
