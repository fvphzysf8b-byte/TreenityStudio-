import type { BrandArea, LinkKind, ProjectStatus, ProjectType, SessionStatus } from './types'

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  musik: 'Musik / Track',
  podcast: 'Podcast / Talk',
  set: 'DJ- / Live-Set',
  soundscape: 'Soundscape / Field Recording',
}

export const BRAND_LABEL: Record<BrandArea, string> = {
  studio: 'TreenityStudio',
  records: 'TreenityRecords',
  radio: 'TreenityRadio',
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  idee: 'Idee',
  vorbereitung: 'Vorbereitung',
  aufnahme: 'Aufnahme',
  bearbeitung: 'Bearbeitung',
  bereit: 'Bereit',
  veroeffentlicht: 'Veröffentlicht',
  archiviert: 'Archiviert',
}

/** Symbol zusätzlich zur Farbe, damit Status nie nur über Farbe vermittelt wird. */
export const PROJECT_STATUS_SYMBOL: Record<ProjectStatus, string> = {
  idee: '○',
  vorbereitung: '◔',
  aufnahme: '●',
  bearbeitung: '◑',
  bereit: '◕',
  veroeffentlicht: '✓',
  archiviert: '▢',
}

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  geplant: 'Geplant',
  abgeschlossen: 'Abgeschlossen',
  abgesagt: 'Abgesagt',
}

export const SESSION_STATUS_SYMBOL: Record<SessionStatus, string> = {
  geplant: '◷',
  abgeschlossen: '✓',
  abgesagt: '✕',
}

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  notion: 'Notion',
  drive: 'Google Drive',
  ordner: 'Projektordner (lokal)',
  referenz: 'Referenz',
  sonstiges: 'Sonstiges',
}

export const KNOWN_FORMATS = ['TreenitySignal']
