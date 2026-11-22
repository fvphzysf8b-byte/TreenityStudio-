import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { createAudioVersion, updateAudioVersion, type AudioVersionDraft } from '../../domain/operations'
import { isLikelyPlayableAudio, isWebUrl, todayLocal } from '../../domain/util'
import { hasErrors, validateAudioVersion, type Errors } from '../../domain/validation'
import { useStore } from '../../state/store'
import { Field, FormActions, focusFirstError } from '../components/form'
import { Button, ButtonLink, EmptyState, PageHeader } from '../components/ui'
import { NotFound } from './NotFound'

export function AudioFormView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data, apply } = useStore()
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const existing = id ? data.audioVersions.find((v) => v.id === id) : undefined

  const [draft, setDraft] = useState<AudioVersionDraft>(() => {
    if (existing) {
      const { projectId, name, date, url, changes, isCurrent } = existing
      return { projectId, name, date, url, changes, isCurrent }
    }
    const pid = params.get('projekt') ?? ''
    return {
      projectId: data.projects.some((p) => p.id === pid) ? pid : '',
      name: '',
      date: todayLocal(),
      url: '',
      changes: '',
      isCurrent: true,
    }
  })
  const [errors, setErrors] = useState<Errors>({})

  if (id && !existing) return <NotFound what="Audio-Version" />
  if (data.projects.length === 0) {
    return (
      <>
        <PageHeader title="Version verlinken" />
        <EmptyState
          title="Zuerst ein Projekt anlegen"
          text="Audio-Versionen gehören immer zu einem Projekt."
          action={
            <ButtonLink to="/projekte/neu" variant="primary">
              + Projekt anlegen
            </ButtonLink>
          }
        />
      </>
    )
  }

  const existingCurrent = data.audioVersions.find((v) => v.projectId === draft.projectId && v.isCurrent && v.id !== existing?.id)
  const existingCount = data.audioVersions.filter((v) => v.projectId === draft.projectId).length

  function update<K extends keyof AudioVersionDraft>(key: K, value: AudioVersionDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs = validateAudioVersion(draft)
    setErrors(errs)
    if (hasErrors(errs)) return focusFirstError(formRef.current)
    if (existing) {
      if (apply((d) => updateAudioVersion(d, existing.id, draft), { success: 'Version gespeichert.' })) navigate(`/audio/${existing.id}`)
    } else {
      let vid = ''
      const ok = apply(
        (d) => {
          const r = createAudioVersion(d, draft)
          vid = r.id
          return r.data
        },
        { success: 'Version verlinkt.' },
      )
      if (ok) navigate(`/audio/${vid}`, { replace: true })
    }
  }

  const urlState = draft.url.trim()
    ? isLikelyPlayableAudio(draft.url)
      ? '✓ Sieht nach einer direkten Audiodatei aus – sie bekommt einen Player.'
      : isWebUrl(draft.url)
        ? 'ℹ Kein direkter Datei-Link (z. B. Drive-Freigabe) – wird als externer Link geöffnet.'
        : undefined
    : 'Direkte Links auf .mp3/.wav/.m4a o. Ä. bekommen einen Player. Freigabelinks (Drive) werden extern geöffnet.'

  return (
    <>
      <PageHeader title={existing ? 'Version bearbeiten' : 'Audio-Version verlinken'} intro="Die Datei bleibt, wo sie ist – hier wird nur der Link gespeichert." />
      <form ref={formRef} noValidate onSubmit={submit} className="card max-w-3xl space-y-5 p-4 sm:p-6">
        <Field label="Projekt" required error={errors.projectId}>
          <select className="input" value={draft.projectId} onChange={(e) => update('projectId', e.target.value)}>
            <option value="">Bitte wählen …</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.status === 'archiviert' ? ' (archiviert)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Versionsname"
            required
            error={errors.name}
            hint={!existing && draft.projectId ? `Vorschlag: Mix ${String(existingCount + 1).padStart(2, '0')}` : 'z. B. Demo 01, Vocal Edit 02, Mix 03'}
          >
            <input className="input" value={draft.name} onChange={(e) => update('name', e.target.value)} />
          </Field>
          <Field label="Datum" required error={errors.date}>
            <input type="date" className="input" value={draft.date} onChange={(e) => update('date', e.target.value)} />
          </Field>
        </div>
        <Field label="Audio-Link" required error={errors.url} hint={errors.url ? undefined : urlState}>
          <input className="input" inputMode="url" placeholder="https://" value={draft.url} onChange={(e) => update('url', e.target.value)} />
        </Field>
        <Field label="Was hat sich geändert?">
          <textarea className="input min-h-20" value={draft.changes} onChange={(e) => update('changes', e.target.value)} />
        </Field>
        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-gold-400" checked={draft.isCurrent} onChange={(e) => update('isCurrent', e.target.checked)} />
            <span>Als aktuellen Arbeitsstand markieren</span>
          </label>
          {draft.isCurrent && existingCurrent && (
            <p className="mt-1 text-sm text-faint">„{existingCurrent.name}“ verliert dann diese Markierung – pro Projekt gibt es nur einen aktuellen Stand.</p>
          )}
        </div>
        <FormActions>
          <ButtonLink to={existing ? `/audio/${existing.id}` : '/audio'}>Abbrechen</ButtonLink>
          <Button type="submit" variant="primary">
            {existing ? 'Änderungen speichern' : 'Version speichern'}
          </Button>
        </FormActions>
      </form>
    </>
  )
}
