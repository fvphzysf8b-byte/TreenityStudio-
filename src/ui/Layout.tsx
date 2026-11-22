import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useStore } from '../state/store'
import { Logo } from './brand/Logo'
import { Button } from './components/ui'

const NAV = [
  { to: '/', label: 'Übersicht', icon: '◈', end: true },
  { to: '/projekte', label: 'Projekte', icon: '❋', end: false },
  { to: '/sessions', label: 'Sessions', icon: '◷', end: false },
  { to: '/audio', label: 'Audio', icon: '∿', end: false },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive ? 'bg-forest-800 text-text' : 'text-muted hover:bg-ink-800 hover:text-text'
  }`
}

export function Layout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  // Bei Seitenwechsel nach oben scrollen und Fokus für Screenreader auf den Inhalt setzen.
  useEffect(() => {
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      <a
        href="#inhalt"
        className="sr-only z-50 rounded bg-gold-400 px-3 py-2 text-ink-950 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Zum Inhalt springen
      </a>
      <header className="sticky top-0 z-30 border-b border-ink-700/80 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" aria-label="TreenityStudio – zur Übersicht" className="rounded">
            <Logo />
          </Link>
          <nav aria-label="Hauptnavigation" className="hidden sm:block">
            <ul className="flex gap-1">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.end} className={navClass}>
                    <span aria-hidden="true" className="text-gold-400">
                      {n.icon}
                    </span>
                    {n.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/daten" className={navClass}>
                  Daten & Personen
                </NavLink>
              </li>
            </ul>
          </nav>
          <NavLink to="/daten" className={(s) => `${navClass(s)} sm:hidden`}>
            Daten
          </NavLink>
        </div>
      </header>

      <StatusBanners />

      <main id="inhalt" ref={mainRef} tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none sm:py-8">
        <Outlet />
      </main>

      {/* Mobile Navigation */}
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                    isActive ? 'text-gold-300' : 'text-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className="text-lg leading-none">
                      {n.icon}
                    </span>
                    <span className={isActive ? 'font-semibold underline underline-offset-4' : ''}>{n.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <ToastHost />
    </div>
  )
}

function StatusBanners() {
  const { saveError, loadIssue, storageUnavailable, startFresh } = useStore()
  if (!saveError && !loadIssue && !storageUnavailable) return null
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4" role="alert">
      {loadIssue && (
        <div className="rounded-lg border border-danger/60 bg-danger-bg p-4 text-sm">
          <p className="font-semibold text-danger">Gespeicherte Daten konnten nicht gelesen werden.</p>
          <p className="mt-1 text-text">
            {loadIssue} Der unlesbare Stand wurde unverändert im Browser gesichert und wird nicht überschrieben, bis du
            neu beginnst oder ein Backup importierst.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/daten" className="link">
              Backup importieren
            </Link>
            <Button size="sm" variant="danger" onClick={startFresh}>
              Neu beginnen
            </Button>
          </div>
        </div>
      )}
      {storageUnavailable && (
        <p className="rounded-lg border border-danger/60 bg-danger-bg p-3 text-sm text-text">
          ⚠ Dieser Browser erlaubt keine dauerhafte Speicherung (z. B. privater Modus). Änderungen gehen beim Schließen
          verloren – exportiere ein Backup unter „Daten“.
        </p>
      )}
      {saveError && !storageUnavailable && (
        <p className="rounded-lg border border-danger/60 bg-danger-bg p-3 text-sm text-text">⚠ {saveError}</p>
      )}
    </div>
  )
}

function ToastHost() {
  const { toast, dismissToast, undo } = useStore()
  useEffect(() => {
    if (!toast) return
    const ms = toast.undo ? 10000 : toast.kind === 'error' ? 8000 : 4000
    const t = setTimeout(dismissToast, ms)
    return () => clearTimeout(t)
  }, [toast, dismissToast])

  return (
    <div
      aria-live={toast?.kind === 'error' ? 'assertive' : 'polite'}
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 sm:bottom-6"
    >
      {toast && (
        <div
          key={toast.id}
          className={`pointer-events-auto flex max-w-lg items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${
            toast.kind === 'error' ? 'border-danger/60 bg-danger-bg' : 'border-forest-500/60 bg-forest-900'
          }`}
        >
          <span aria-hidden="true">{toast.kind === 'error' ? '⚠' : toast.kind === 'success' ? '✓' : 'ℹ'}</span>
          <span className="text-text">{toast.message}</span>
          {toast.undo && (
            <button type="button" onClick={undo} className="font-semibold text-gold-300 underline underline-offset-2">
              Rückgängig
            </button>
          )}
          <button type="button" onClick={dismissToast} className="ml-1 text-muted hover:text-text" aria-label="Meldung schließen">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
