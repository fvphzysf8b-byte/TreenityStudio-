/**
 * App-Zustand: hält die Daten, speichert jede Änderung und bietet „Rückgängig“.
 *
 * Zwei Betriebsarten:
 * - local: Speicherung nur im Browser (localStorage).
 * - cloud: Speicherung in Supabase; Änderungen anderer Teammitglieder kommen live herein.
 * Die Geschäftslogik ist in beiden Fällen identisch.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DomainError } from '../domain/operations'
import { initialData } from '../domain/seed'
import type { AppData } from '../domain/types'
import { emptyData } from '../domain/types'
import { CloudSync, type SyncStatus } from '../persistence/remote/cloud'
import { STORAGE_KEY, loadData, saveData } from '../persistence/storage'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
  undo?: AppData
}

interface ApplyOptions {
  success?: string
  undoable?: boolean
}

interface StoreValue {
  data: AppData
  apply: (fn: (d: AppData) => AppData, options?: ApplyOptions) => boolean
  toast: Toast | null
  showToast: (kind: Toast['kind'], message: string) => void
  dismissToast: () => void
  undo: () => void
  saveError: string | null
  loadIssue: string | null
  storageUnavailable: boolean
  startFresh: () => void
  mode: 'local' | 'cloud'
  syncStatus: SyncStatus
  userEmail: string | null
  signOut: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

function initialLocalState(): { data: AppData; loadIssue: string | null; unavailable: boolean; writeBlocked: boolean } {
  const result = loadData()
  switch (result.status) {
    case 'ok':
      return { data: result.data, loadIssue: null, unavailable: false, writeBlocked: false }
    case 'empty': {
      const data = initialData()
      saveData(data)
      return { data, loadIssue: null, unavailable: false, writeBlocked: false }
    }
    case 'corrupt':
      // Nicht überschreiben, bis die Person bewusst neu beginnt oder importiert.
      return { data: emptyData(), loadIssue: result.error, unavailable: false, writeBlocked: true }
    case 'unavailable':
      return { data: initialData(), loadIssue: null, unavailable: true, writeBlocked: false }
  }
}

export type StoreProviderProps =
  | { mode: 'local'; children: ReactNode }
  | { mode: 'cloud'; initial: AppData; userEmail: string; onSignOut: () => void; children: ReactNode }

export function StoreProvider(props: StoreProviderProps) {
  const { children } = props
  const [init] = useState(() =>
    props.mode === 'local'
      ? initialLocalState()
      : { data: props.initial, loadIssue: null, unavailable: false, writeBlocked: false },
  )
  const [data, setData] = useState<AppData>(init.data)
  const dataRef = useRef(init.data)
  const writeBlocked = useRef(init.writeBlocked)
  const [loadIssue, setLoadIssue] = useState(init.loadIssue)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [toast, setToast] = useState<Toast | null>(null)
  const toastId = useRef(0)
  const syncRef = useRef<CloudSync | null>(null)

  const showToast = useCallback((kind: Toast['kind'], message: string, undo?: AppData) => {
    toastId.current += 1
    setToast({ id: toastId.current, kind, message, undo })
  }, [])

  // Cloud-Synchronisation starten
  useEffect(() => {
    if (props.mode !== 'cloud') return
    const sync = new CloudSync(
      (remote) => {
        dataRef.current = remote
        setData(remote)
      },
      (status, error) => {
        setSyncStatus(status)
        if (status === 'error' && error) {
          setSaveError(error)
          showToast('error', `Änderung konnte nicht gespeichert werden: ${error} Der Stand wird neu geladen.`)
        } else if (status === 'synced') {
          setSaveError(null)
        }
      },
    )
    syncRef.current = sync
    sync.start()
    return () => {
      sync.stop()
      syncRef.current = null
    }
  }, [props.mode, showToast])

  // Warnen, wenn die Seite geschlossen wird, während noch gespeichert wird.
  useEffect(() => {
    if (syncStatus !== 'saving') return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [syncStatus])

  const commit = useCallback(
    (next: AppData) => {
      const before = dataRef.current
      dataRef.current = next
      setData(next)
      if (props.mode === 'cloud') {
        syncRef.current?.save(before, next)
        return
      }
      if (writeBlocked.current) return
      const r = saveData(next)
      setSaveError(r.ok ? null : r.error)
    },
    [props.mode],
  )

  const apply = useCallback(
    (fn: (d: AppData) => AppData, options: ApplyOptions = {}) => {
      const before = dataRef.current
      let next: AppData
      try {
        next = fn(before)
      } catch (e) {
        if (e instanceof DomainError || e instanceof Error) {
          showToast('error', e.message)
          return false
        }
        throw e
      }
      if (writeBlocked.current) {
        writeBlocked.current = false
        setLoadIssue(null)
      }
      commit(next)
      if (options.success) showToast('success', options.success, options.undoable ? before : undefined)
      return true
    },
    [commit, showToast],
  )

  const toastRef = useRef<Toast | null>(null)
  toastRef.current = toast

  const undo = useCallback(() => {
    const snapshot = toastRef.current?.undo
    if (!snapshot) return
    commit(snapshot)
    showToast('info', 'Aktion wurde rückgängig gemacht.')
  }, [commit, showToast])

  const startFresh = useCallback(() => {
    writeBlocked.current = false
    setLoadIssue(null)
    commit(initialData())
    showToast('info', 'Neuer, leerer Datenstand angelegt.')
  }, [commit, showToast])

  // Lokaler Modus: Änderungen aus einem anderen Tab übernehmen, statt sie zu überschreiben.
  useEffect(() => {
    if (props.mode !== 'local') return
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return
      const r = loadData()
      if (r.status === 'ok') {
        dataRef.current = r.data
        setData(r.data)
        showToast('info', 'Die Daten wurden in einem anderen Tab geändert und hier aktualisiert.')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [props.mode, showToast])

  const userEmail = props.mode === 'cloud' ? props.userEmail : null
  const signOut = props.mode === 'cloud' ? props.onSignOut : () => undefined

  const value = useMemo<StoreValue>(
    () => ({
      data,
      apply,
      toast,
      showToast: (k, m) => showToast(k, m),
      dismissToast: () => setToast(null),
      undo,
      saveError,
      loadIssue,
      storageUnavailable: init.unavailable,
      startFresh,
      mode: props.mode,
      syncStatus,
      userEmail,
      signOut,
    }),
    [data, apply, toast, showToast, undo, saveError, loadIssue, init.unavailable, startFresh, props.mode, syncStatus, userEmail, signOut],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore muss innerhalb von StoreProvider verwendet werden.')
  return ctx
}
