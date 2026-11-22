/**
 * App-Zustand: hält die Daten, speichert jede Änderung im Browser
 * und bietet „Rückgängig“ für verändernde bzw. löschende Aktionen.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DomainError } from '../domain/operations'
import { initialData } from '../domain/seed'
import type { AppData } from '../domain/types'
import { emptyData } from '../domain/types'
import { STORAGE_KEY, loadData, saveData } from '../persistence/storage'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
  undo?: AppData
}

interface ApplyOptions {
  /** Erfolgsmeldung. */
  success?: string
  /** Bei gesetztem Wert wird „Rückgängig“ angeboten. */
  undoable?: boolean
}

interface StoreValue {
  data: AppData
  /** Führt eine Änderung aus. Gibt false zurück, wenn sie fachlich abgelehnt wurde. */
  apply: (fn: (d: AppData) => AppData, options?: ApplyOptions) => boolean
  toast: Toast | null
  showToast: (kind: Toast['kind'], message: string) => void
  dismissToast: () => void
  undo: () => void
  saveError: string | null
  loadIssue: string | null
  storageUnavailable: boolean
  startFresh: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

function initialState(): { data: AppData; loadIssue: string | null; unavailable: boolean; writeBlocked: boolean } {
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [init] = useState(initialState)
  const [data, setData] = useState<AppData>(init.data)
  const dataRef = useRef(init.data)
  const writeBlocked = useRef(init.writeBlocked)
  const [loadIssue, setLoadIssue] = useState(init.loadIssue)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastId = useRef(0)

  const commit = useCallback((next: AppData) => {
    dataRef.current = next
    setData(next)
    if (writeBlocked.current) return
    const r = saveData(next)
    setSaveError(r.ok ? null : r.error)
  }, [])

  const showToast = useCallback((kind: Toast['kind'], message: string, undo?: AppData) => {
    toastId.current += 1
    setToast({ id: toastId.current, kind, message, undo })
  }, [])

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
        // Erste bewusste Änderung nach einem Ladefehler – ab jetzt wird gespeichert.
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

  // Änderungen aus einem anderen Tab übernehmen, statt sie zu überschreiben.
  useEffect(() => {
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
  }, [showToast])

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
    }),
    [data, apply, toast, showToast, undo, saveError, loadIssue, init.unavailable, startFresh],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore muss innerhalb von StoreProvider verwendet werden.')
  return ctx
}
