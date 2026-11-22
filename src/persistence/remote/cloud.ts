/**
 * Laden, Speichern und Live-Aktualisierung über Supabase.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { AppData } from '../../domain/types'
import { SCHEMA_VERSION } from '../../domain/types'
import { appDataSchema } from '../schema'
import { supabase } from './client'
import { diffData, isEmpty, type ChangeSet } from './diff'
import { COLLECTIONS, fromRow, toRow } from './mapping'

const PAGE = 1000

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase()
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(describeError(error))
    rows.push(...(data as Record<string, unknown>[]))
    if (!data || data.length < PAGE) return rows
  }
}

/** Lädt den kompletten Datenstand des Teams und prüft ihn. */
export async function loadRemote(): Promise<AppData> {
  const results = await Promise.all(COLLECTIONS.map((c) => fetchAll(c.table)))
  const raw: Record<string, unknown> = { schemaVersion: SCHEMA_VERSION }
  COLLECTIONS.forEach((c, i) => (raw[c.key] = results[i].map(fromRow)))
  const parsed = appDataSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(`Die Daten in der Datenbank sind unvollständig (${issue?.path.join(' › ')}).`)
  }
  return parsed.data
}

/** Schreibt eine Änderungsmenge: erst Löschungen (abhängige zuerst), dann Neuanlagen/Änderungen. */
export async function pushChanges(changes: ChangeSet): Promise<void> {
  if (isEmpty(changes)) return
  for (const { key, table } of [...COLLECTIONS].reverse()) {
    const ids = changes.deletes[key]
    if (!ids?.length) continue
    const { error } = await supabase().from(table).delete().in('id', ids)
    if (error) throw new Error(describeError(error))
  }
  for (const { key, table } of COLLECTIONS) {
    const rows = changes.upserts[key]
    if (!rows?.length) continue
    const { error } = await supabase().from(table).upsert(rows.map(toRow))
    if (error) throw new Error(describeError(error))
  }
}

export function describeError(error: { message?: string; code?: string }): string {
  if (error.code === '42501' || /row-level security/i.test(error.message ?? ''))
    return 'Keine Berechtigung. Ist deine E-Mail-Adresse auf der Team-Liste?'
  if (/fetch|network/i.test(error.message ?? '')) return 'Keine Verbindung zum Server.'
  return error.message ?? 'Unbekannter Fehler beim Speichern.'
}

export type SyncStatus = 'synced' | 'saving' | 'error' | 'offline'

/**
 * Speichert Änderungen nacheinander (Warteschlange) und hält den Stand aktuell,
 * wenn andere Teammitglieder etwas ändern.
 */
export class CloudSync {
  private queue: Promise<void> = Promise.resolve()
  private pending = 0
  private localVersion = 0
  private channel: RealtimeChannel | null = null
  private reloadTimer: ReturnType<typeof setTimeout> | null = null
  private onVisible = () => {
    if (document.visibilityState === 'visible') this.scheduleReload(0)
  }
  private onOnline = () => this.scheduleReload(0)

  private onRemoteData: (data: AppData) => void
  private onStatus: (status: SyncStatus, error?: string) => void

  constructor(onRemoteData: (data: AppData) => void, onStatus: (status: SyncStatus, error?: string) => void) {
    this.onRemoteData = onRemoteData
    this.onStatus = onStatus
  }

  /** Neue lokale Änderung speichern. */
  save(before: AppData, after: AppData) {
    const changes = diffData(before, after)
    if (isEmpty(changes)) return
    this.localVersion++
    this.pending++
    this.onStatus('saving')
    this.queue = this.queue
      .then(() => pushChanges(changes))
      .then(() => {
        this.pending--
        if (this.pending === 0) this.onStatus('synced')
      })
      .catch((e: Error) => {
        this.pending--
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        this.onStatus(offline ? 'offline' : 'error', e.message)
        // Server-Stand neu laden, damit Anzeige und Datenbank wieder übereinstimmen.
        this.scheduleReload(1500)
      })
  }

  start() {
    this.channel = supabase().channel('treenitystudio-changes')
    for (const { table } of COLLECTIONS) {
      this.channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.scheduleReload(600))
    }
    this.channel.subscribe()
    document.addEventListener('visibilitychange', this.onVisible)
    window.addEventListener('online', this.onOnline)
  }

  stop() {
    if (this.channel) void supabase().removeChannel(this.channel)
    document.removeEventListener('visibilitychange', this.onVisible)
    window.removeEventListener('online', this.onOnline)
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
  }

  scheduleReload(delay: number) {
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
    this.reloadTimer = setTimeout(() => void this.reload(), delay)
  }

  private async reload() {
    // Erst laden, wenn alle eigenen Änderungen gespeichert sind.
    await this.queue
    const versionAtStart = this.localVersion
    try {
      const data = await loadRemote()
      // Während des Ladens kam eine neue lokale Änderung dazu → später erneut laden.
      if (versionAtStart !== this.localVersion || this.pending > 0) {
        this.scheduleReload(600)
        return
      }
      this.onRemoteData(data)
      this.onStatus('synced')
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      this.onStatus(offline ? 'offline' : 'error', (e as Error).message)
    }
  }
}
