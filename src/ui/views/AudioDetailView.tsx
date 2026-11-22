import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { addFeedback, deleteAudioVersion, deleteFeedback, setCurrentVersion } from '../../domain/operations'
import { feedbackOf, membersOf, personName, projectById } from '../../domain/selectors'
import type { AudioVersion, ID } from '../../domain/types'
import { formatDate, formatIso, formatTimestamp, parseTimestamp } from '../../domain/util'
import { validateTimestamp } from '../../domain/validation'
import { useStore } from '../../state/store'
import { Field, focusFirstError } from '../components/form'
import { AudioSource } from '../components/links'
import { Button, ButtonLink, ConfirmDialog, Section, Tag } from '../components/ui'
import { NotFound } from './NotFound'

export function AudioDetailView() {
  const { id = '' } = useParams()
  const { data, apply } = useStore()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const version = data.audioVersions.find((v) => v.id === id)
  if (!version) return <NotFound what="Audio-Version" />

  const project = projectById(data, version.projectId)
  const feedback = feedbackOf(data, version.id)

  function seek(sec: number) {
    const a = audioRef.current
    if (!a) return
    a.currentTime = sec
    void a.play().catch(() => undefined)
    a.focus()
  }

  return (
    <>
      <nav aria-label="Brotkrumen" className="mb-3 flex flex-wrap gap-x-2 text-sm">
        <Link to="/audio" className="link">
          ← Audio
        </Link>
        {project && (
          <>
            <span className="text-faint" aria-hidden="true">
              ·
            </span>
            <Link to={`/projekte/${project.id}#audio`} className="link">
              {project.title}
            </Link>
          </>
        )}
      </nav>

      <header className="mb-6">
        {version.isCurrent && <Tag>◉ Aktueller Arbeitsstand</Tag>}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{version.name}</h1>
        <p className="mt-1 text-muted">{formatDate(version.date)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!version.isCurrent && (
            <Button onClick={() => apply((d) => setCurrentVersion(d, version.id), { success: 'Als aktueller Arbeitsstand markiert.', undoable: true })}>
              ◉ Als aktuellen Stand markieren
            </Button>
          )}
          <ButtonLink to={`/audio/${version.id}/bearbeiten`}>Bearbeiten</ButtonLink>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Löschen
          </Button>
        </div>
      </header>

      <div className="grid gap-x-8 lg:grid-cols-[3fr_2fr]">
        <div>
          <Section title="Anhören">
            <div className="card p-4">
              <AudioSource
                url={version.url}
                onReady={(el) => {
                  audioRef.current = el
                  setPlayerReady(Boolean(el))
                }}
              />
            </div>
          </Section>
          {version.changes && (
            <Section title="Änderungen">
              <p className="card p-4 whitespace-pre-line">{version.changes}</p>
            </Section>
          )}
        </div>

        <div>
          <Section title={`Feedback (${feedback.length})`}>
            <FeedbackForm version={version} getCurrentTime={() => audioRef.current?.currentTime ?? null} canUsePlayer={playerReady} />
            {feedback.length === 0 ? (
              <p className="mt-3 text-sm text-faint">Noch kein Feedback. Mit Zeitbezug (mm:ss) wird es leichter umsetzbar.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {feedback.map((f) => (
                  <li key={f.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm">
                        {f.timestampSec !== null &&
                          (playerReady ? (
                            <button
                              type="button"
                              onClick={() => seek(f.timestampSec!)}
                              className="mr-2 rounded bg-forest-800 px-1.5 font-mono text-xs text-gold-300 underline-offset-2 hover:underline"
                              aria-label={`Zu ${formatTimestamp(f.timestampSec)} springen`}
                            >
                              ▶ {formatTimestamp(f.timestampSec)}
                            </button>
                          ) : (
                            <span className="mr-2 rounded bg-forest-800 px-1.5 font-mono text-xs text-gold-300">{formatTimestamp(f.timestampSec)}</span>
                          ))}
                        <span className="font-medium">{personName(data, f.authorId)}</span>
                      </p>
                      <button
                        type="button"
                        className="text-xs text-danger underline"
                        onClick={() => apply((d) => deleteFeedback(d, f.id), { success: 'Feedback gelöscht.', undoable: true })}
                      >
                        Löschen<span className="sr-only"> (Feedback von {personName(data, f.authorId)})</span>
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-line">{f.comment}</p>
                    <p className="mt-1 text-xs text-faint">{formatIso(f.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            {project && (
              <p className="mt-3 text-xs text-faint">
                Daraus folgt eine Aufgabe?{' '}
                <Link to={`/projekte/${project.id}#aufgaben`} className="link">
                  Im Projekt als nächsten Schritt festhalten
                </Link>
              </p>
            )}
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Audio-Version löschen?"
        confirmLabel="Version löschen"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          if (apply((d) => deleteAudioVersion(d, version.id), { success: 'Version gelöscht.', undoable: true }))
            navigate(project ? `/projekte/${project.id}` : '/audio')
        }}
      >
        <p>Der Link und {feedback.length} Feedback-Einträge werden gelöscht. Die Audiodatei selbst bleibt unberührt.</p>
      </ConfirmDialog>
    </>
  )
}

function FeedbackForm({
  version,
  getCurrentTime,
  canUsePlayer,
}: {
  version: AudioVersion
  getCurrentTime: () => number | null
  canUsePlayer: boolean
}) {
  const { data, apply } = useStore()
  const formRef = useRef<HTMLFormElement>(null)
  const members = membersOf(data, version.projectId)
  const [authorId, setAuthorId] = useState<ID>(() => members[0]?.id ?? data.people[0]?.id ?? '')
  const [comment, setComment] = useState('')
  const [ts, setTs] = useState('')
  const [errors, setErrors] = useState<{ comment?: string; ts?: string; author?: string }>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs = {
      comment: comment.trim() ? undefined : 'Bitte schreibe einen Kommentar.',
      ts: validateTimestamp(ts),
      author: authorId ? undefined : 'Bitte wähle, wer das Feedback gibt.',
    }
    setErrors(errs)
    if (errs.comment || errs.ts || errs.author) return focusFirstError(formRef.current)
    const ok = apply(
      (d) => addFeedback(d, { audioVersionId: version.id, authorId, comment, timestampSec: ts.trim() ? parseTimestamp(ts) : null }).data,
      { success: 'Feedback gespeichert.' },
    )
    if (ok) {
      setComment('')
      setTs('')
    }
  }

  if (data.people.length === 0) {
    return (
      <p className="text-sm text-faint">
        Lege zuerst unter{' '}
        <Link to="/daten" className="link">
          Daten & Personen
        </Link>{' '}
        eine Person an.
      </p>
    )
  }

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="card space-y-3 p-4">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Von" required error={errors.author}>
          <select className="input" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
            <option value="">Bitte wählen …</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Zeit (mm:ss)" error={errors.ts}>
          <input className="input w-28 font-mono" inputMode="numeric" placeholder="01:24" value={ts} onChange={(e) => setTs(e.target.value)} />
        </Field>
      </div>
      {canUsePlayer && (
        <button
          type="button"
          className="text-xs text-gold-300 underline"
          onClick={() => {
            const t = getCurrentTime()
            if (t !== null) setTs(formatTimestamp(t))
          }}
        >
          Aktuelle Player-Position übernehmen
        </button>
      )}
      <Field label="Kommentar" required error={errors.comment}>
        <textarea className="input min-h-20" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" size="sm">
        Feedback speichern
      </Button>
    </form>
  )
}
