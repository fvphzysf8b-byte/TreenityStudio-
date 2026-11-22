import { useRef, useState, type FormEvent } from 'react'
import { createPerson, deletePerson, updatePerson } from '../../domain/operations'
import { addExamples, hasExamples, removeExamples } from '../../domain/seed'
import type { AppData, Person } from '../../domain/types'
import { formatIso } from '../../domain/util'
import { validatePerson } from '../../domain/validation'
import { readCorruptBackup } from '../../persistence/storage'
import { countRecords, exportFileName, mergeData, parseEnvelope, serializeExport } from '../../persistence/transfer'
import { useStore } from '../../state/store'
import { Field } from '../components/form'
import { Button, ConfirmDialog, PageHeader, Section } from '../components/ui'

function download(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function DataView() {
  const { data, apply, loadIssue } = useStore()
  const examples = hasExamples(data)
  const corrupt = loadIssue ? readCorruptBackup() : null

  return (
    <>
      <PageHeader title="Daten & Personen" intro="Beteiligte verwalten, Backups erstellen und wiederherstellen." />

      <div className="grid gap-x-8 lg:grid-cols-2">
        <div>
          <Section title="Wo liegen die Daten?">
            <div className="card space-y-2 p-4 text-sm text-muted">
              <p>
                Alle Daten werden <strong className="text-text">nur in diesem Browser auf diesem Gerät</strong> gespeichert
                (localStorage). Es gibt keine Synchronisation zwischen Geräten oder Personen.
              </p>
              <p>
                Browserdaten können verloren gehen (z. B. beim Löschen von Website-Daten). Exportiere deshalb regelmäßig ein
                Backup und lege es z. B. in Drive ab.
              </p>
              <p>Für gemeinsame Nutzung braucht es später Anmeldung, eine gemeinsame Datenbank und Zugriffsrechte.</p>
            </div>
          </Section>

          <Section title="Backup exportieren">
            <div className="card space-y-3 p-4">
              <p className="text-sm text-muted">
                Speichert alle Projekte, Sessions, Aufgaben, Versionen, Feedback, Links und Personen als JSON-Datei.
              </p>
              <Button variant="primary" onClick={() => download(serializeExport(data), exportFileName())}>
                ↓ Backup herunterladen
              </Button>
              {corrupt && (
                <Button onClick={() => download(corrupt, 'treenitystudio-unlesbarer-stand.json')}>
                  ↓ Unlesbaren Stand sichern
                </Button>
              )}
            </div>
          </Section>

          <ImportSection />
        </div>

        <div>
          <PeopleSection />

          <Section title="Beispieldaten">
            <div className="card space-y-3 p-4 text-sm text-muted">
              <p>
                Beispielprojekte sind mit „Beispiel“ gekennzeichnet und enthalten keine echten Termine oder Projektstände.
                Sie lassen sich jederzeit vollständig entfernen.
              </p>
              {examples ? (
                <Button
                  variant="danger"
                  onClick={() => apply(removeExamples, { success: 'Beispieldaten entfernt.', undoable: true })}
                >
                  Beispieldaten entfernen
                </Button>
              ) : (
                <Button onClick={() => apply(addExamples, { success: 'Beispieldaten geladen.', undoable: true })}>
                  Beispieldaten laden
                </Button>
              )}
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}

type Pending = { incoming: AppData; exportedAt: string | null; fileName: string }

function ImportSection() {
  const { data, apply, showToast } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [mode, setMode] = useState<'ergaenzen' | 'ersetzen'>('ergaenzen')
  const [backupFirst, setBackupFirst] = useState(true)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const isEmpty = data.projects.length === 0

  async function onFile(file: File | undefined) {
    setError(null)
    setPending(null)
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setError('Die Datei ist zu groß (über 20 MB). Ein TreenityStudio-Backup ist normalerweise deutlich kleiner.')
      return
    }
    const text = await file.text()
    const r = parseEnvelope(text)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setPending({ incoming: r.data, exportedAt: r.exportedAt, fileName: file.name })
    setMode(isEmpty ? 'ersetzen' : 'ergaenzen')
  }

  function reset() {
    setPending(null)
    setConfirmReplace(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function doReplace() {
    if (!pending) return
    if (backupFirst && !isEmpty) download(serializeExport(data), exportFileName().replace('backup', 'vor-import'))
    if (apply(() => pending.incoming, { success: 'Import abgeschlossen – Daten wurden ersetzt.', undoable: true })) reset()
  }

  function doMerge() {
    if (!pending) return
    let report
    try {
      report = mergeData(data, pending.incoming)
    } catch (e) {
      showToast('error', (e as Error).message)
      return
    }
    const merged = report.data
    const ok = apply(() => merged, {
      undoable: true,
      success: `Import abgeschlossen: ${report.added} Einträge ergänzt${report.skipped ? `, ${report.skipped} bereits vorhandene übersprungen` : ''}.`,
    })
    if (ok) reset()
  }

  return (
    <Section title="Backup importieren">
      <div className="card space-y-4 p-4">
        <div>
          <label htmlFor="import-file" className="mb-1 block text-sm font-medium">
            Backup-Datei (.json) auswählen
          </label>
          <input
            ref={inputRef}
            id="import-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => onFile(e.target.files?.[0])}
            aria-describedby={error ? 'import-error' : 'import-hint'}
            className="block w-full text-sm text-muted file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-ink-600 file:bg-ink-850 file:px-4 file:text-text"
          />
          <p id="import-hint" className="mt-1 text-xs text-faint">
            Die Datei wird zuerst geprüft. Es wird nichts übernommen, bevor du bestätigst.
          </p>
          {error && (
            <p id="import-error" role="alert" className="mt-2 text-sm text-danger">
              ⚠ {error}
            </p>
          )}
        </div>

        {pending && (
          <div className="space-y-4 rounded-lg border border-forest-500/60 bg-forest-900/40 p-4">
            <div>
              <p className="font-medium">✓ Datei ist gültig: {pending.fileName}</p>
              {pending.exportedAt && <p className="text-xs text-faint">Exportiert am {formatIso(pending.exportedAt)}</p>}
            </div>
            <table className="w-full text-sm">
              <caption className="sr-only">Vergleich der Datenmengen</caption>
              <thead>
                <tr className="text-left text-faint">
                  <th scope="col" className="font-normal">
                    Bereich
                  </th>
                  <th scope="col" className="text-right font-normal">
                    In der Datei
                  </th>
                  <th scope="col" className="text-right font-normal">
                    Aktuell vorhanden
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(countRecords(pending.incoming)).map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row" className="py-0.5 text-left font-normal">
                      {k}
                    </th>
                    <td className="text-right">{v}</td>
                    <td className="text-right text-muted">{countRecords(data)[k as keyof ReturnType<typeof countRecords>]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Wie soll importiert werden?</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-600 p-3 has-[:checked]:border-gold-400">
                <input type="radio" name="import-mode" className="mt-1 accent-gold-400" checked={mode === 'ergaenzen'} onChange={() => setMode('ergaenzen')} />
                <span>
                  <span className="font-medium">Ergänzen</span>
                  <span className="block text-sm text-muted">
                    Neue Einträge werden hinzugefügt. Vorhandene Einträge bleiben unverändert; gleiche Einträge werden übersprungen.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-600 p-3 has-[:checked]:border-gold-400">
                <input type="radio" name="import-mode" className="mt-1 accent-gold-400" checked={mode === 'ersetzen'} onChange={() => setMode('ersetzen')} />
                <span>
                  <span className="font-medium">Ersetzen</span>
                  <span className="block text-sm text-muted">
                    Alle aktuellen Daten in diesem Browser werden durch den Inhalt der Datei ersetzt.
                  </span>
                </span>
              </label>
            </fieldset>

            {mode === 'ersetzen' && !isEmpty && (
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-gold-400" checked={backupFirst} onChange={(e) => setBackupFirst(e.target.checked)} />
                Vorher den aktuellen Stand als Backup herunterladen (empfohlen)
              </label>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button onClick={reset}>Abbrechen</Button>
              {mode === 'ergaenzen' ? (
                <Button variant="primary" onClick={doMerge}>
                  Daten ergänzen
                </Button>
              ) : (
                <Button variant={isEmpty ? 'primary' : 'danger'} onClick={() => (isEmpty ? doReplace() : setConfirmReplace(true))}>
                  Daten ersetzen
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmReplace}
        title="Alle aktuellen Daten ersetzen?"
        confirmLabel="Ja, ersetzen"
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => {
          setConfirmReplace(false)
          doReplace()
        }}
      >
        <p>
          {data.projects.length} Projekte, {data.sessions.length} Sessions und alle weiteren Einträge in diesem Browser werden durch die
          Datei ersetzt.
        </p>
        <p>{backupFirst ? 'Vorher wird ein Backup des aktuellen Stands heruntergeladen.' : 'Es wird kein Backup des aktuellen Stands erstellt.'}</p>
      </ConfirmDialog>
    </Section>
  )
}

function PeopleSection() {
  const { data, apply } = useStore()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState<string>()
  const [toDelete, setToDelete] = useState<Person | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs = validatePerson({ name, role })
    setError(errs.name)
    if (errs.name) return
    if (apply((d) => createPerson(d, { name, role }).data, { success: `${name.trim()} hinzugefügt.` })) {
      setName('')
      setRole('')
    }
  }

  const usage = (id: string) => ({
    projects: data.projectMembers.filter((m) => m.personId === id).length,
    sessions: data.sessions.filter((s) => s.participantIds.includes(id)).length,
    feedback: data.feedback.filter((f) => f.authorId === id).length,
  })

  return (
    <Section title="Beteiligte">
      <p className="mb-3 text-sm text-faint">
        Personen sind hier nur Einträge zur Zuordnung – keine Benutzerkonten und keine Zugriffskontrolle.
      </p>
      <ul className="mb-4 space-y-2">
        {data.people.map((p) => (
          <PersonRow key={p.id} person={p} onDelete={() => setToDelete(p)} />
        ))}
      </ul>
      <form noValidate onSubmit={submit} className="card space-y-3 p-4">
        <Field label="Name" required error={error}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Rolle">
          <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="z. B. Gesang, Gitarre" />
        </Field>
        <Button type="submit" size="sm">
          + Person hinzufügen
        </Button>
      </form>
      <ConfirmDialog
        open={toDelete !== null}
        title={`${toDelete?.name ?? ''} entfernen?`}
        confirmLabel="Person entfernen"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const p = toDelete
          setToDelete(null)
          if (p) apply((d) => deletePerson(d, p.id), { success: `${p.name} entfernt.`, undoable: true })
        }}
      >
        {toDelete && (
          <>
            <p>
              Die Person wird aus {usage(toDelete.id).projects} Projekten und {usage(toDelete.id).sessions} Sessions entfernt.
            </p>
            {usage(toDelete.id).feedback > 0 && (
              <p>Ihr Feedback ({usage(toDelete.id).feedback}) bleibt erhalten und wird als „Gelöschte Person“ angezeigt.</p>
            )}
          </>
        )}
      </ConfirmDialog>
    </Section>
  )
}

function PersonRow({ person, onDelete }: { person: Person; onDelete: () => void }) {
  const { apply } = useStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(person.name)
  const [role, setRole] = useState(person.role)
  const [error, setError] = useState<string>()

  if (editing) {
    return (
      <li className="card p-3">
        <form
          noValidate
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            const errs = validatePerson({ name, role })
            setError(errs.name)
            if (errs.name) return
            if (apply((d) => updatePerson(d, person.id, { name, role }), { success: 'Person gespeichert.' })) setEditing(false)
          }}
        >
          <Field label="Name" required error={error}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Rolle">
            <input className="input" value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="primary">
              Speichern
            </Button>
            <Button size="sm" onClick={() => setEditing(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      </li>
    )
  }
  return (
    <li className="card flex items-center justify-between gap-3 p-3">
      <div>
        <p className="font-medium">{person.name}</p>
        {person.role && <p className="text-sm text-faint">{person.role}</p>}
      </div>
      <div className="flex gap-3 text-sm">
        <button type="button" className="text-muted underline" onClick={() => setEditing(true)}>
          Bearbeiten<span className="sr-only">: {person.name}</span>
        </button>
        <button type="button" className="text-danger underline" onClick={onDelete}>
          Entfernen<span className="sr-only">: {person.name}</span>
        </button>
      </div>
    </li>
  )
}
