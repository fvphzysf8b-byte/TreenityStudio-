/** Wiederkehrende Listenelemente: Projektkarte, Session-Zeile, Aufgabe. */
import { useState } from 'react'
import { Link } from 'react-router'
import { BRAND_LABEL, PROJECT_TYPE_LABEL } from '../../domain/labels'
import { deleteTask, makeNextAction, renameTask, setPinned, setTaskDone } from '../../domain/operations'
import { membersOf, nextAction, personName, projectById } from '../../domain/selectors'
import type { Project, Session, Task } from '../../domain/types'
import { formatDate, formatDateTime, formatDuration } from '../../domain/util'
import { useStore } from '../../state/store'
import { ProjectStatusBadge, SessionStatusBadge, Tag } from './ui'

export function ProjectCard({ project, compact = false }: { project: Project; compact?: boolean }) {
  const { data, apply } = useStore()
  const next = nextAction(data, project.id)
  const members = membersOf(data, project.id)
  return (
    <article className="card relative flex flex-col gap-3 p-4 transition-colors hover:border-forest-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-text">
            <Link to={`/projekte/${project.id}`} className="after:absolute after:inset-0 hover:underline">
              {project.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-faint">
            {PROJECT_TYPE_LABEL[project.type]} · {BRAND_LABEL[project.brand]}
            {project.format ? ` · ${project.format}` : ''}
          </p>
        </div>
        {project.status !== 'archiviert' && (
        <button
          type="button"
          onClick={() =>
            apply((d) => setPinned(d, project.id, !project.pinned), {
              success: project.pinned ? 'Fokus gelöst.' : 'Als Fokusprojekt angeheftet.',
            })
          }
          aria-pressed={project.pinned}
          className={`relative z-10 min-h-9 shrink-0 rounded-lg border px-2 text-xs ${
            project.pinned ? 'border-gold-400 text-gold-300' : 'border-ink-600 text-muted hover:text-text'
          }`}
          title={project.pinned ? 'Fokus lösen' : 'Als Fokusprojekt anheften'}
        >
          <span aria-hidden="true">{project.pinned ? '★' : '☆'}</span>
          <span className="sr-only">{project.pinned ? `Fokus lösen: ${project.title}` : `Als Fokus anheften: ${project.title}`}</span>
          <span aria-hidden="true" className="ml-1">
            Fokus
          </span>
        </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={project.status} />
        {project.isExample && <Tag>Beispiel</Tag>}
        {project.dueDate && <Tag>Ziel: {formatDate(project.dueDate)}</Tag>}
      </div>
      {!compact && (
        <div className="rounded-lg bg-ink-850 px-3 py-2 text-sm">
          <span className="text-xs font-medium tracking-wide text-gold-300 uppercase">Nächste Handlung</span>
          <p className={next ? 'text-text' : 'text-faint italic'}>{next ? next.title : 'Noch keine offene Aufgabe festgelegt.'}</p>
        </div>
      )}
      {members.length > 0 && <p className="text-xs text-faint">Mit: {members.map((m) => m.name).join(', ')}</p>}
    </article>
  )
}

export function SessionRow({ session, showProject = true }: { session: Session; showProject?: boolean }) {
  const { data } = useStore()
  const project = projectById(data, session.projectId)
  const done = session.checklist.filter((c) => c.done).length
  return (
    <li className="card relative flex flex-col gap-1 p-3 transition-colors hover:border-forest-500 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-text">
          <Link to={`/sessions/${session.id}`} className="after:absolute after:inset-0 hover:underline">
            {session.title}
          </Link>
        </p>
        <p className="text-sm text-muted">
          {formatDateTime(session.startsAt)} · {formatDuration(session.durationMinutes)}
          {showProject && project ? ` · ${project.title}` : ''}
        </p>
        {session.status === 'geplant' && session.goal && (
          <p className="mt-0.5 text-sm text-faint">Ziel: Am Ende dieser Session haben wir {session.goal}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {session.status === 'geplant' && session.checklist.length > 0 && (
          <Tag>
            Vorbereitung {done}/{session.checklist.length}
          </Tag>
        )}
        {session.participantIds.length > 0 && (
          <Tag>{session.participantIds.map((id) => personName(data, id).split(' ')[0]).join(', ')}</Tag>
        )}
        <SessionStatusBadge status={session.status} />
      </div>
    </li>
  )
}

export function TaskItem({
  task,
  isNext = false,
  projectLabel,
  editable = false,
}: {
  task: Task
  isNext?: boolean
  projectLabel?: { id: string; title: string }
  editable?: boolean
}) {
  const { data, apply } = useStore()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const session = task.sessionId ? data.sessions.find((s) => s.id === task.sessionId) : undefined
  const id = `task-${task.id}`

  return (
    <li className={`flex items-start gap-3 rounded-lg px-3 py-2 ${isNext ? 'border border-gold-500/50 bg-forest-900/60' : 'bg-ink-850'}`}>
      <input
        id={id}
        type="checkbox"
        checked={task.done}
        onChange={(e) =>
          apply((d) => setTaskDone(d, task.id, e.target.checked), {
            success: e.target.checked ? 'Aufgabe erledigt.' : 'Aufgabe wieder offen.',
            undoable: true,
          })
        }
        className="mt-1 h-5 w-5 shrink-0 accent-gold-400"
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (apply((d) => renameTask(d, task.id, title), { success: 'Aufgabe geändert.' })) setEditing(false)
            }}
          >
            <label htmlFor={`${id}-edit`} className="sr-only">
              Aufgabe bearbeiten
            </label>
            <input id={`${id}-edit`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button type="submit" className="text-sm text-gold-300 underline">
                Speichern
              </button>
              <button
                type="button"
                className="text-sm text-muted underline"
                onClick={() => {
                  setTitle(task.title)
                  setEditing(false)
                }}
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : (
          <label htmlFor={id} className={`block cursor-pointer ${task.done ? 'text-faint line-through' : 'text-text'}`}>
            {isNext && !task.done && (
              <span className="mr-2 inline-block rounded bg-gold-400 px-1.5 text-xs font-semibold text-ink-950">Nächste Handlung</span>
            )}
            {task.title}
            {task.done && <span className="sr-only"> (erledigt)</span>}
          </label>
        )}
        <p className="text-xs text-faint">
          {projectLabel && (
            <Link to={`/projekte/${projectLabel.id}`} className="link">
              {projectLabel.title}
            </Link>
          )}
          {projectLabel && session && ' · '}
          {session && (
            <>
              aus Session{' '}
              <Link to={`/sessions/${session.id}`} className="link">
                {session.title}
              </Link>
            </>
          )}
        </p>
      </div>
      {editable && !editing && (
        <div className="flex shrink-0 flex-wrap justify-end gap-x-3 gap-y-1 text-xs">
          {!task.done && !isNext && (
            <button type="button" className="text-gold-300 underline" onClick={() => apply((d) => makeNextAction(d, task.id), { success: 'Als nächste Handlung gesetzt.' })}>
              Als Nächstes<span className="sr-only">: {task.title}</span>
            </button>
          )}
          <button type="button" className="text-muted underline" onClick={() => setEditing(true)}>
            Bearbeiten<span className="sr-only">: {task.title}</span>
          </button>
          <button
            type="button"
            className="text-danger underline"
            onClick={() => apply((d) => deleteTask(d, task.id), { success: 'Aufgabe gelöscht.', undoable: true })}
          >
            Löschen<span className="sr-only">: {task.title}</span>
          </button>
        </div>
      )}
    </li>
  )
}
