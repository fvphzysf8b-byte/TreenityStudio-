import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PROJECT_STATUS_LABEL } from '../../domain/labels'
import {
  addTask,
  completeSession,
  deleteSession,
  setSessionStatus,
  toggleChecklistItem,
  type SessionCompletion,
} from '../../domain/operations'
import { personName, projectById, sortTasks } from '../../domain/selectors'
import { PROJECT_STATUSES, type LabeledLink, type ProjectStatus, type Session } from '../../domain/types'
import { formatDateTime, formatDuration, formatIso, newId, nowLocalDateTime } from '../../domain/util'
import { validateRecordingUrl } from '../../domain/validation'
import { useStore } from '../../state/store'
import { Field, focusFirstError } from '../components/form'
import { TaskItem } from '../components/items'
import { LinkTarget } from '../components/links'
import { Button, ButtonLink, ConfirmDialog, Section, SessionStatusBadge } from '../components/ui'
import { NotFound } from './NotFound'

export function SessionDetailView() {
  const { id = '' } = useParams()
  const { data, apply } = useStore()
  const navigate = useNavigate()
  const [completing, setCompleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const session = data.sessions.find((s) => s.id === id)
  if (!session) return <NotFound what="Session" />

  const project = projectById(data, session.projectId)
  const sessionTasks = sortTasks(data.tasks.filter((t) => t.sessionId === session.id))
  const checked = session.checklist.filter((c) => c.done).length
  const isPast = session.startsAt < nowLocalDateTime()

  return (
    <>
      <nav aria-label="Brotkrumen" className="mb-3 flex flex-wrap gap-x-2 text-sm">
        <Link to="/sessions" className="link">
          ← Sessions
        </Link>
        {project && (
          <>
            <span className="text-faint" aria-hidden="true">
              ·
            </span>
            <Link to={`/projekte/${project.id}`} className="link">
              {project.title}
            </Link>
          </>
        )}
      </nav>

      <header className="mb-6">
        <SessionStatusBadge status={session.status} />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{session.title}</h1>
        <p className="mt-1 text-muted">
          {formatDateTime(session.startsAt)} · {formatDuration(session.durationMinutes)}
        </p>
        <p className="text-sm text-faint">
          Beteiligte: {session.participantIds.length ? session.participantIds.map((pid) => personName(data, pid)).join(', ') : '—'}
        </p>
        {!completing && (
          <div className="mt-4 flex flex-wrap gap-2">
            {session.status === 'geplant' && (
              <Button variant="primary" onClick={() => setCompleting(true)}>
                ✓ Session abschließen
              </Button>
            )}
            {session.status === 'abgeschlossen' && <Button onClick={() => setCompleting(true)}>Ergebnis bearbeiten</Button>}
            <ButtonLink to={`/sessions/${session.id}/bearbeiten`}>Planung bearbeiten</ButtonLink>
            {session.status === 'geplant' ? (
              <Button
                onClick={() =>
                  apply((d) => setSessionStatus(d, session.id, 'abgesagt'), { success: 'Session abgesagt.', undoable: true })
                }
              >
                Absagen
              </Button>
            ) : (
              <Button onClick={() => apply((d) => setSessionStatus(d, session.id, 'geplant'), { success: 'Session wieder als geplant markiert.', undoable: true })}>
                Wieder auf „geplant“ setzen
              </Button>
            )}
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Löschen
            </Button>
          </div>
        )}
        {session.status === 'geplant' && isPast && !completing && (
          <p className="mt-3 rounded-lg border border-gold-500/50 bg-forest-900/60 p-3 text-sm">
            Diese Session liegt in der Vergangenheit. Halte jetzt Ergebnis und nächste Schritte fest, solange alles frisch ist.
          </p>
        )}
      </header>

      {completing && <CompletionForm session={session} onDone={() => setCompleting(false)} />}

      <div className="grid gap-x-8 lg:grid-cols-2">
        <div>
          <Section title="Ziel">
            <p className="card border-gold-500/40 p-4 text-lg">
              <span className="text-muted">Am Ende dieser Session haben wir </span>
              {session.goal || '…'}
            </p>
          </Section>

          {session.status === 'abgeschlossen' && !completing && (
            <Section title="Ergebnis">
              <div className="card space-y-4 p-4">
                <p className="whitespace-pre-line">{session.result}</p>
                {session.notes && (
                  <div>
                    <h3 className="text-sm text-faint">Notizen & Entscheidungen</h3>
                    <p className="whitespace-pre-line">{session.notes}</p>
                  </div>
                )}
                {session.recordingLinks.length > 0 && (
                  <div>
                    <h3 className="text-sm text-faint">Aufnahmen</h3>
                    <ul className="space-y-1">
                      {session.recordingLinks.map((l) => (
                        <li key={l.id}>
                          <LinkTarget target={l.url} label={l.label || undefined} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {session.completedAt && <p className="text-xs text-faint">Abgeschlossen am {formatIso(session.completedAt)}</p>}
              </div>
            </Section>
          )}

          <Section title="Nächste Schritte aus dieser Session">
            <SessionTaskForm session={session} />
            {sessionTasks.length === 0 ? (
              <p className="mt-2 text-sm text-faint">Noch keine Aufgaben mit dieser Session verknüpft.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sessionTasks.map((t) => (
                  <TaskItem key={t.id} task={t} editable />
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-faint">Diese Aufgaben erscheinen auch im Projekt – es gibt nur eine Aufgabenliste.</p>
          </Section>
        </div>

        <div>
          <Section title={`Vorbereitung${session.checklist.length ? ` (${checked}/${session.checklist.length})` : ''}`}>
            {session.checklist.length === 0 ? (
              <p className="text-sm text-faint">
                Keine Checkliste.{' '}
                <Link to={`/sessions/${session.id}/bearbeiten`} className="link">
                  Punkte ergänzen
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {session.checklist.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-lg bg-ink-850 px-3 py-2">
                    <input
                      id={`chk-${item.id}`}
                      type="checkbox"
                      className="mt-1 h-5 w-5 accent-gold-400"
                      checked={item.done}
                      onChange={() => apply((d) => toggleChecklistItem(d, session.id, item.id))}
                    />
                    <label htmlFor={`chk-${item.id}`} className={`cursor-pointer ${item.done ? 'text-faint line-through' : ''}`}>
                      {item.text}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Setup-Notizen">
            <p className="card p-4 text-sm whitespace-pre-line text-muted">{session.setupNotes || '—'}</p>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Session löschen?"
        confirmLabel="Session löschen"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          if (apply((d) => deleteSession(d, session.id), { success: 'Session gelöscht.', undoable: true }))
            navigate(project ? `/projekte/${project.id}` : '/sessions')
        }}
      >
        <p>Ziel, Notizen und Ergebnis dieser Session werden gelöscht.</p>
        {sessionTasks.length > 0 && (
          <p>{sessionTasks.length} verknüpfte Aufgaben bleiben im Projekt erhalten (ohne Session-Bezug).</p>
        )}
      </ConfirmDialog>
    </>
  )
}

function SessionTaskForm({ session }: { session: Session }) {
  const { apply } = useStore()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string>()
  return (
    <form
      noValidate
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return setError('Bitte beschreibe die Aufgabe.')
        if (apply((d) => addTask(d, session.projectId, title, session.id).data, { success: 'Aufgabe hinzugefügt.' })) {
          setTitle('')
          setError(undefined)
        }
      }}
    >
      <Field label="Neue Aufgabe" error={error} className="flex-1">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Button type="submit" className="sm:mt-6">
        Hinzufügen
      </Button>
    </form>
  )
}

type EditableStatus = Exclude<ProjectStatus, 'archiviert'>

function CompletionForm({ session, onDone }: { session: Session; onDone: () => void }) {
  const { data, apply } = useStore()
  const formRef = useRef<HTMLFormElement>(null)
  const project = projectById(data, session.projectId)
  const isEdit = session.status === 'abgeschlossen'
  const [result, setResult] = useState(session.result)
  const [notes, setNotes] = useState(session.notes)
  const [links, setLinks] = useState<LabeledLink[]>(session.recordingLinks)
  const [steps, setSteps] = useState<string[]>(isEdit ? [] : [''])
  const [projectStatus, setProjectStatus] = useState<EditableStatus | ''>('')
  const [errors, setErrors] = useState<{ result?: string; links: Record<string, string | undefined> }>({ links: {} })

  function submit(e: FormEvent) {
    e.preventDefault()
    const linkErrors: Record<string, string | undefined> = {}
    for (const l of links) linkErrors[l.id] = validateRecordingUrl(l.url)
    const next = { result: result.trim() ? undefined : 'Bitte halte fest, was in der Session entstanden ist.', links: linkErrors }
    setErrors(next)
    if (next.result || Object.values(linkErrors).some(Boolean)) return focusFirstError(formRef.current)
    const input: SessionCompletion = {
      result,
      notes,
      recordingLinks: links,
      nextSteps: steps,
      projectStatus: projectStatus || null,
    }
    if (apply((d) => completeSession(d, session.id, input), { success: isEdit ? 'Ergebnis gespeichert.' : 'Session abgeschlossen.', undoable: !isEdit })) onDone()
  }

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="card mb-8 space-y-5 border-gold-500/50 p-4 sm:p-6" aria-labelledby="complete-title">
      <h2 id="complete-title" className="text-lg font-semibold">
        {isEdit ? 'Ergebnis bearbeiten' : 'Session abschließen'}
      </h2>
      <p className="-mt-3 text-sm text-muted">
        Ziel war: Am Ende dieser Session haben wir {session.goal || '…'}
      </p>
      <Field label="Ergebnis" required error={errors.result} hint="Was ist entstanden? Wurde das Ziel erreicht?">
        <textarea className="input min-h-24" value={result} onChange={(e) => setResult(e.target.value)} />
      </Field>
      <Field label="Notizen & Entscheidungen">
        <textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">
          Links zu Aufnahmen <span className="font-normal text-faint">(optional)</span>
        </legend>
        <p className="mb-2 text-xs text-faint">Web-Adressen zu Drive, Dropbox o. Ä. Lokale Pfade bitte als Projekt-Link speichern.</p>
        <ul className="space-y-3">
          {links.map((l, i) => (
            <li key={l.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <Field label={`Bezeichnung ${i + 1}`}>
                <input className="input" value={l.label} onChange={(e) => setLinks((ls) => ls.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} />
              </Field>
              <Field label={`Adresse ${i + 1}`} error={errors.links[l.id]}>
                <input
                  className="input"
                  inputMode="url"
                  placeholder="https://"
                  value={l.url}
                  onChange={(e) => setLinks((ls) => ls.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))}
                />
              </Field>
              <Button size="sm" variant="ghost" className="sm:mt-6" onClick={() => setLinks((ls) => ls.filter((x) => x.id !== l.id))}>
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
        <Button size="sm" className="mt-2" onClick={() => setLinks((ls) => [...ls, { id: newId(), label: '', url: '' }])}>
          + Aufnahme-Link
        </Button>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">
          Nächste Schritte <span className="font-normal text-faint">(optional)</span>
        </legend>
        <p className="mb-2 text-xs text-faint">
          Jeder Schritt wird eine Aufgabe im Projekt. {isEdit ? 'Bestehende Aufgaben findest du unten.' : 'Der erste offene Schritt wird zur nächsten Handlung, falls es noch keine gibt.'}
        </p>
        <ul className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <label htmlFor={`step-${i}`} className="sr-only">
                Nächster Schritt {i + 1}
              </label>
              <input
                id={`step-${i}`}
                className="input"
                value={s}
                placeholder="z. B. Vocal-Comping Refrain"
                onChange={(e) => setSteps((st) => st.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button size="sm" variant="ghost" aria-label={`Schritt ${i + 1} entfernen`} onClick={() => setSteps((st) => st.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
        <Button size="sm" className="mt-2" onClick={() => setSteps((st) => [...st, ''])}>
          + Schritt
        </Button>
      </fieldset>

      {project && project.status !== 'archiviert' && (
        <Field label="Projektstatus anpassen" hint={`Aktuell: ${PROJECT_STATUS_LABEL[project.status]}`}>
          <select className="input" value={projectStatus} onChange={(e) => setProjectStatus(e.target.value as EditableStatus | '')}>
            <option value="">Unverändert lassen</option>
            {PROJECT_STATUSES.filter((s): s is EditableStatus => s !== 'archiviert').map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onDone}>Abbrechen</Button>
        <Button type="submit" variant="primary">
          {isEdit ? 'Speichern' : 'Session abschließen'}
        </Button>
      </div>
    </form>
  )
}
