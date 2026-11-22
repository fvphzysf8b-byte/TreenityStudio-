/** Formularvalidierung mit verständlichen deutschen Fehlermeldungen. */
import type { AudioVersionDraft, PersonDraft, ProjectDraft, ResourceLinkDraft, SessionDraft } from './operations'
import { isValidLocalDate, isValidLocalDateTime, isWebUrl, parseTimestamp } from './util'

export type Errors<K extends string = string> = Partial<Record<K, string>>

export function hasErrors(e: Errors): boolean {
  return Object.values(e).some(Boolean)
}

export function validateProject(d: ProjectDraft): Errors<'title' | 'dueDate' | 'releaseArea'> {
  const e: Errors<'title' | 'dueDate' | 'releaseArea'> = {}
  if (!d.title.trim()) e.title = 'Bitte gib dem Projekt einen Titel.'
  else if (d.title.trim().length > 120) e.title = 'Der Titel darf höchstens 120 Zeichen lang sein.'
  if (d.dueDate && !isValidLocalDate(d.dueDate)) e.dueDate = 'Bitte wähle ein gültiges Datum.'
  if (d.status === 'veroeffentlicht' && !d.releaseArea)
    e.releaseArea = 'Für veröffentlichte Projekte bitte einen Veröffentlichungsbereich wählen.'
  return e
}

export function validateSession(d: SessionDraft): Errors<'projectId' | 'title' | 'startsAt' | 'durationMinutes' | 'goal'> {
  const e: Errors<'projectId' | 'title' | 'startsAt' | 'durationMinutes' | 'goal'> = {}
  if (!d.projectId) e.projectId = 'Bitte wähle das Projekt, zu dem die Session gehört.'
  if (!d.title.trim()) e.title = 'Bitte gib der Session einen Titel.'
  if (!d.startsAt) e.startsAt = 'Bitte wähle Datum und Uhrzeit.'
  else if (!isValidLocalDateTime(d.startsAt)) e.startsAt = 'Bitte gib Datum und Uhrzeit vollständig an.'
  if (!Number.isFinite(d.durationMinutes) || d.durationMinutes < 5 || d.durationMinutes > 24 * 60)
    e.durationMinutes = 'Die Dauer muss zwischen 5 Minuten und 24 Stunden liegen.'
  if (!d.goal.trim()) e.goal = 'Bitte vervollständige den Satz – was soll am Ende erreicht sein?'
  return e
}

export function validateAudioVersion(d: AudioVersionDraft): Errors<'projectId' | 'name' | 'date' | 'url'> {
  const e: Errors<'projectId' | 'name' | 'date' | 'url'> = {}
  if (!d.projectId) e.projectId = 'Bitte wähle ein Projekt.'
  if (!d.name.trim()) e.name = 'Bitte gib einen Versionsnamen an, z. B. „Mix 03“.'
  if (!isValidLocalDate(d.date)) e.date = 'Bitte wähle ein gültiges Datum.'
  if (!d.url.trim()) e.url = 'Bitte füge den Link zur Audiodatei ein.'
  else if (!isWebUrl(d.url)) e.url = 'Das ist keine gültige Web-Adresse. Sie muss mit https:// beginnen.'
  return e
}

export function validateTimestamp(value: string): string | undefined {
  if (!value.trim()) return undefined
  return parseTimestamp(value) === null ? 'Zeitbezug bitte im Format mm:ss angeben, z. B. 01:24.' : undefined
}

export function validateResourceLink(d: ResourceLinkDraft): Errors<'label' | 'target'> {
  const e: Errors<'label' | 'target'> = {}
  if (!d.label.trim()) e.label = 'Bitte gib eine Bezeichnung an.'
  if (!d.target.trim()) e.target = d.kind === 'ordner' ? 'Bitte gib den Ordnerpfad an.' : 'Bitte gib die Adresse an.'
  else if (d.kind !== 'ordner' && !isWebUrl(d.target))
    e.target = 'Das ist keine gültige Web-Adresse (https://…). Für lokale Pfade wähle „Projektordner (lokal)“.'
  return e
}

export function validatePerson(d: PersonDraft): Errors<'name'> {
  return d.name.trim() ? {} : { name: 'Bitte gib einen Namen an.' }
}

export function validateRecordingUrl(url: string): string | undefined {
  if (!url.trim()) return undefined
  return isWebUrl(url) ? undefined : 'Keine gültige Web-Adresse (https://…).'
}
