import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BRAND_LABEL, LINK_KIND_LABEL, PROJECT_STATUS_LABEL, PROJECT_TYPE_LABEL } from '../../domain/labels'
import {
  addResourceLink,
  addTask,
  archiveProject,
  deleteProject,
  deleteResourceLink,
  projectDependents,
  restoreProject,
  setPinned,
  setProjectStatus,
  type ResourceLinkDraft,
} from '../../domain/operations'
import { feedbackOf, membersOf, projectById, sessionsOf, tasksOf, versionsOf } from '../../domain/selectors'
import { LINK_KINDS, PROJECT_STATUSES, type ProjectStatus } from '../../domain/types'
import { formatDate, formatIso } from '../../domain/util'
import { hasErrors, validateResourceLink, type Errors } from '../../domain/validation'
import { useStore } from '../../state/store'
import { Field, focusFirstError } from '../components/form'
import { SessionRow, TaskItem } from '../components/items'
import { LinkTarget } from '../components/links'
import { Button, ButtonLink, ConfirmDialog, EmptyState, ProjectStatusBadge, Section, Tag } from '../components/ui'
import { NotFound } from './NotFound'

export function ProjectDetailView() {
  const { id = '' } = useParams()
  const { data, apply } = useStore()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const project = projectById(data, id)
  if (!project) return <NotFound what="Projekt" />

  const members = membersOf(data, project.id)
  const tasks = tasksOf(data, project.id)
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  const sessions = sessionsOf(data, project.id)
  const versions = versionsOf(data, project.id)
  const links = data.resourceLinks.filter((l) => l.projectId === project.id)
  const deps = projectDependents(data, project.id)
  const archived = project.status === 'archiviert'

  return (
    <>
      <nav aria-label="Brotkrumen" className="mb-3 text-sm">
        <Link to="/projekte" className="link">
          ← Projekte
        </Link>
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
          {project.pinned && <Tag>★ Fokusprojekt</Tag>}
          {project.isExample && <Tag>Beispiel</Tag>}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{project.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {PROJECT_TYPE_LABEL[project.type]} · {BRAND_LABEL[project.brand]}
          {project.releaseArea && ` → Veröffentlichung über ${BRAND_LABEL[project.releaseArea]}`}
          {project.format && ` · Format: ${project.format}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink to={`/projekte/${project.id}/bearbeiten`} size="sm">
            Bearbeiten
          </ButtonLink>
          {!archived && (
            <Button
              size="sm"
              aria-pressed={project.pinned}
              onClick={() =>
                apply((d) => setPinned(d, project.id, !project.pinned), {
                  success: project.pinned ? 'Fokus gelöst.' : 'Als Fokusprojekt angeheftet.',
                })
              }
            >
              {project.pinned ? '★ Fokus lösen' : '☆ Als Fokus anheften'}
            </Button>
          )}
          {archived ? (
            <Button size="sm" onClick={() => apply((d) => restoreProject(d, project.id), { success: 'Projekt wiederhergestellt.' })}>
              Wiederherstellen
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => apply((d) => archiveProject(d, project.id), { success: 'Projekt archiviert.', undoable: true })}
            >
              Archivieren
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
            Löschen
          </Button>
        </div>
      </header>

      <div className="grid gap-x-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <Section title="Nächste Schritte" id="aufgaben">
            <AddTaskForm projectId={project.id} />
            {open.length === 0 ? (
              <p className="mt-3 text-sm text-faint">Keine offenen Aufgaben. Lege oben die nächste konkrete Handlung fest.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {open.map((t, i) => (
                  <TaskItem key={t.id} task={t} isNext={i === 0} editable />
                ))}
              </ul>
            )}
            {done.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted">Erledigt ({done.length})</summary>
                <ul className="mt-2 space-y-2">
                  {done.map((t) => (
                    <TaskItem key={t.id} task={t} editable />
                  ))}
                </ul>
              </details>
            )}
          </Section>

          <Section
            title="Sessions"
            id="sessions"
            action={
              !archived && (
                <ButtonLink to={`/sessions/neu?projekt=${project.id}`} size="sm">
                  + Session planen
                </ButtonLink>
              )
            }
          >
            {sessions.length === 0 ? (
              <EmptyState title="Noch keine Sessions" text="Plane eine Session mit Ziel und Vorbereitungsliste." />
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} showProject={false} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Audio-Versionen"
            id="audio"
            action={
              <ButtonLink to={`/audio/neu?projekt=${project.id}`} size="sm">
                + Version verlinken
              </ButtonLink>
            }
          >
            {versions.length === 0 ? (
              <EmptyState title="Noch keine Versionen" text="Verlinke Demos, Edits oder Mixe, um Feedback zu sammeln." />
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li key={v.id} className="card relative flex items-center justify-between gap-3 p-3 hover:border-forest-500">
                    <div>
                      <Link to={`/audio/${v.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                        {v.name}
                      </Link>
                      <p className="text-sm text-muted">
                        {formatDate(v.date)} · {feedbackOf(data, v.id).length} Feedback
                      </p>
                    </div>
                    {v.isCurrent && <Tag>◉ Aktueller Arbeitsstand</Tag>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside>
          <Section title="Projekt">
            <dl className="card space-y-3 p-4 text-sm">
              {!archived && (
                <div>
                  <dt className="text-faint">
                    <label htmlFor="quick-status">Status</label>
                  </dt>
                  <dd>
                    <select
                      id="quick-status"
                      className="input mt-1"
                      value={project.status}
                      onChange={(e) =>
                        apply((d) => setProjectStatus(d, project.id, e.target.value as Exclude<ProjectStatus, 'archiviert'>), {
                          success: 'Status geändert.',
                          undoable: true,
                        })
                      }
                    >
                      {PROJECT_STATUSES.filter((s) => s !== 'archiviert').map((s) => (
                        <option key={s} value={s}>
                          {PROJECT_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
              )}
              <Meta label="Beteiligte" value={members.length ? members.map((m) => m.name).join(', ') : '—'} />
              <Meta label="Zieltermin" value={project.dueDate ? formatDate(project.dueDate) : '—'} />
              <Meta label="Kurzbeschreibung" value={project.description || '—'} />
              <Meta label="Gewünschtes Ergebnis" value={project.goal || '—'} />
              <Meta label="Angelegt" value={formatIso(project.createdAt)} />
              <Meta label="Geändert" value={formatIso(project.updatedAt)} />
            </dl>
          </Section>

          <Section title="Links & Quellen" id="links">
            {links.length > 0 && (
              <ul className="mb-3 space-y-2">
                {links.map((l) => (
                  <li key={l.id} className="card flex items-start justify-between gap-2 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs text-faint">{LINK_KIND_LABEL[l.kind]}</p>
                      <LinkTarget target={l.target} label={l.label} />
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-danger underline"
                      onClick={() => apply((d) => deleteResourceLink(d, l.id), { success: 'Link entfernt.', undoable: true })}
                    >
                      Entfernen<span className="sr-only">: {l.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <AddLinkForm projectId={project.id} />
          </Section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Projekt endgültig löschen?"
        confirmLabel="Endgültig löschen"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          if (apply((d) => deleteProject(d, project.id), { success: `„${project.title}“ gelöscht.`, undoable: true }))
            navigate('/projekte')
        }}
      >
        <p>
          Mit dem Projekt werden auch gelöscht: {deps.sessions} Sessions, {deps.tasks} Aufgaben, {deps.audioVersions}{' '}
          Audio-Versionen mit {deps.feedback} Feedback und {deps.resourceLinks} Links.
        </p>
        <p>Externe Dateien (Drive, Notion, Projektordner) sind nicht betroffen.</p>
        {!archived && <p>Tipp: Mit „Archivieren“ bleibt alles erhalten und das Projekt verschwindet trotzdem aus dem Alltag.</p>}
      </ConfirmDialog>
    </>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-faint">{label}</dt>
      <dd className="whitespace-pre-line text-text">{value}</dd>
    </div>
  )
}

function AddTaskForm({ projectId }: { projectId: string }) {
  const { apply } = useStore()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string>()
  return (
    <form
      noValidate
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) {
          setError('Bitte beschreibe die Aufgabe.')
          return
        }
        if (apply((d) => addTask(d, projectId, title).data, { success: 'Aufgabe hinzugefügt.' })) {
          setTitle('')
          setError(undefined)
        }
      }}
    >
      <Field label="Neue Aufgabe" error={error} className="flex-1">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Gitarren-Overdubs aufnehmen" />
      </Field>
      <Button type="submit" className="sm:mt-6">
        Hinzufügen
      </Button>
    </form>
  )
}

function AddLinkForm({ projectId }: { projectId: string }) {
  const { apply } = useStore()
  const formRef = useRef<HTMLFormElement>(null)
  const empty: ResourceLinkDraft = { kind: 'notion', label: '', target: '' }
  const [draft, setDraft] = useState(empty)
  const [errors, setErrors] = useState<Errors>({})
  const [open, setOpen] = useState(false)

  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        + Link oder Ordner hinzufügen
      </Button>
    )

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs = validateResourceLink(draft)
    setErrors(errs)
    if (hasErrors(errs)) return focusFirstError(formRef.current)
    if (apply((d) => addResourceLink(d, projectId, draft).data, { success: 'Link hinzugefügt.' })) {
      setDraft(empty)
      setOpen(false)
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="card space-y-3 p-4">
      <Field label="Art" required>
        <select className="input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ResourceLinkDraft['kind'] })}>
          {LINK_KINDS.map((k) => (
            <option key={k} value={k}>
              {LINK_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Bezeichnung" required error={errors.label}>
        <input className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      </Field>
      <Field
        label={draft.kind === 'ordner' ? 'Ordnerpfad' : 'Adresse'}
        required
        error={errors.target}
        hint={
          draft.kind === 'ordner'
            ? 'Der Pfad wird nur gespeichert und kann kopiert werden. Der Browser kann lokale Ordner nicht öffnen.'
            : 'Vollständige Adresse, beginnend mit https://'
        }
      >
        <input
          className="input"
          value={draft.target}
          onChange={(e) => setDraft({ ...draft, target: e.target.value })}
          placeholder={draft.kind === 'ordner' ? '~/Musik/Treenity/Projektname' : 'https://'}
          inputMode={draft.kind === 'ordner' ? 'text' : 'url'}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm">
          Speichern
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setOpen(false)
            setErrors({})
            setDraft(empty)
          }}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
