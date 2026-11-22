import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPerson, deletePerson, updatePerson } from '../../domain/operations'
import { addExamples, hasExamples, removeExamples } from '../../domain/seed'
import type { AppData, Person } from '../../domain/types'
import { formatIso } from '../../domain/util'
import { validatePerson } from '../../domain/validation'
import { supabase } from '../../persistence/remote/client'
import { STORAGE_KEY, readCorruptBackup } from '../../persistence/storage'
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
  const { data, apply, loadIssue, mode, userEmail, signOut } = useStore()
  const examples = hasExamples(data)
  const corrupt = loadIssue ? readCorruptBackup() : null

  return (
    <>
      <PageHeader title="Daten & Personen" intro="Beteiligte verwalten, Backups erstellen und wiederherstellen." />

      <div className="grid gap-x-8 lg:grid-cols-2">
        <div>
          {mode === 'cloud' ? (
            <>
              <Section title="Wo liegen die Daten?">
                <div className="card space-y-2 p-4 text-sm text-muted">
                  <p>
                    Die Daten liegen in der <strong className="text-text">gemeinsamen Treenity-Datenbank</strong> (Supabase, EU).
                    Alle freigeschalteten Teammitglieder sehen denselben Stand – auf jedem Gerät. Änderungen der anderen
                    erscheinen automatisch.
                  </p>
                  <p>Ein Backup als Datei schadet trotzdem nicht, z. B. vor größeren Aufräumaktionen.</p>
                  <p className="pt-1">
                    Angemeldet als <strong className="text-text">{userEmail}</strong>.{' '}
                    <button type="button" className="link" onClick={signOut}>
                      Abmelden
                    </button>
                  </p>
                </div>
              </Section>
              <LocalDataTransfer />
            </>
          ) : (
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
              </div>
            </Section>
          )}

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
          {mode === 'cloud' && <TeamSection />}
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
  const { data, apply, showToast, mode: storeMode } = useStore()
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
                    {storeMode === 'cloud' ? 'Alle Daten in der gemeinsamen Datenbank werden ersetzt – für das ganze Team.' : 'Alle aktuellen Daten in diesem Browser werden durch den Inhalt der Datei ersetzt.'}
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
          {data.projects.length} Projekte, {data.sessions.length} Sessions und alle weiteren Einträge {storeMode === 'cloud' ? 'in der gemeinsamen Datenbank (für alle im Team)' : 'in diesem Browser'} werden durch die
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

/** Cloud-Modus: Team-Liste – wer sich anmelden darf. */
function TeamSection() {
  const { userEmail, showToast } = useStore()
  const [emails, setEmails] = useState<string[] | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [toRemove, setToRemove] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase().from('team_members').select('email').order('email')
    if (error) showToast('error', `Team-Liste konnte nicht geladen werden: ${error.message}`)
    else setEmails(data.map((r) => r.email as string))
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return setError('Bitte gib eine gültige E-Mail-Adresse ein.')
    if (emails?.includes(addr)) return setError('Diese Adresse steht schon auf der Liste.')
    setError(undefined)
    const { error } = await supabase().from('team_members').insert({ email: addr })
    if (error) return setError(`Konnte nicht hinzugefügt werden: ${error.message}`)
    setEmail('')
    showToast('success', `${addr} kann sich jetzt anmelden.`)
    void load()
  }

  async function remove(addr: string) {
    const { error } = await supabase().from('team_members').delete().eq('email', addr)
    if (error) showToast('error', `Konnte nicht entfernt werden: ${error.message}`)
    else showToast('success', `${addr} wurde von der Team-Liste entfernt.`)
    void load()
  }

  return (
    <Section title="Team-Zugang">
      <p className="mb-3 text-sm text-faint">
        Nur diese E-Mail-Adressen können sich anmelden. Alle Freigeschalteten sehen und bearbeiten alle Projekte.
      </p>
      {emails === null ? (
        <p className="text-sm text-faint">Wird geladen …</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {emails.map((addr) => (
            <li key={addr} className="card flex items-center justify-between gap-3 p-3 text-sm">
              <span className="break-all">
                {addr}
                {addr === userEmail?.toLowerCase() && <span className="text-faint"> (du)</span>}
              </span>
              {addr !== userEmail?.toLowerCase() && (
                <button type="button" className="shrink-0 text-danger underline" onClick={() => setToRemove(addr)}>
                  Entfernen<span className="sr-only">: {addr}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form noValidate onSubmit={add} className="card space-y-3 p-4">
        <Field label="E-Mail freischalten" required error={error}>
          <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" size="sm">
          + Freischalten
        </Button>
      </form>
      <ConfirmDialog
        open={toRemove !== null}
        title="Zugang entfernen?"
        confirmLabel="Zugang entfernen"
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          const addr = toRemove
          setToRemove(null)
          if (addr) void remove(addr)
        }}
      >
        <p>{toRemove} kann danach keine Daten mehr sehen oder ändern. Projekte und Feedback bleiben erhalten.</p>
      </ConfirmDialog>
    </Section>
  )
}

/** Cloud-Modus: Daten, die vorher nur in diesem Browser lagen, in die gemeinsame Datenbank übernehmen. */
function LocalDataTransfer() {
  const { data, apply, showToast } = useStore()
  const [local] = useState(() => {
    try {
      const text = localStorage.getItem(STORAGE_KEY)
      if (!text) return null
      const r = parseEnvelope(text)
      return r.ok && r.data.projects.length > 0 ? r.data : null
    } catch {
      return null
    }
  })
  const [done, setDone] = useState(() => localStorage.getItem(`${STORAGE_KEY}:uebernommen`) === '1')
  if (!local || done) return null

  function transfer() {
    let report
    try {
      report = mergeData(data, local!)
    } catch (e) {
      showToast('error', (e as Error).message)
      return
    }
    const merged = report.data
    if (
      apply(() => merged, {
        undoable: true,
        success: `${report.added} Einträge aus diesem Browser übernommen${report.skipped ? `, ${report.skipped} bereits vorhanden` : ''}.`,
      })
    ) {
      localStorage.setItem(`${STORAGE_KEY}:uebernommen`, '1')
      setDone(true)
    }
  }

  return (
    <Section title="Lokale Daten übernehmen">
      <div className="card space-y-3 border-gold-500/50 p-4 text-sm text-muted">
        <p>
          In diesem Browser liegen noch <strong className="text-text">{local.projects.length} Projekte</strong> aus der Zeit vor
          der Datenbank. Sollen sie in die gemeinsame Datenbank übernommen werden? Bereits vorhandene Einträge werden nicht
          überschrieben; Personen mit gleichem Namen werden zusammengeführt.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={transfer}>
            Übernehmen
          </Button>
          <Button
            onClick={() => {
              localStorage.setItem(`${STORAGE_KEY}:uebernommen`, '1')
              setDone(true)
            }}
          >
            Nicht übernehmen
          </Button>
        </div>
      </div>
    </Section>
  )
}
