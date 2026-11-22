/**
 * Cloud-Modus: Anmeldung prüfen, Team-Zugehörigkeit prüfen, Daten laden – dann die App anzeigen.
 */
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { AppData } from '../domain/types'
import { supabase } from '../persistence/remote/client'
import { loadRemote } from '../persistence/remote/cloud'
import { StoreProvider } from '../state/store'
import { Logo } from './brand/Logo'
import { Field } from './components/form'
import { Button } from './components/ui'

type Phase =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | { kind: 'loading'; session: Session }
  | { kind: 'noAccess'; session: Session }
  | { kind: 'error'; session: Session; message: string }
  | { kind: 'ready'; session: Session; data: AppData }

export function CloudRoot({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' })

  const loadFor = useCallback(async (session: Session) => {
    setPhase({ kind: 'loading', session })
    try {
      const email = session.user.email?.toLowerCase() ?? ''
      const { data: member, error } = await supabase().from('team_members').select('email').eq('email', email).maybeSingle()
      if (error) throw new Error(error.message)
      if (!member) {
        setPhase({ kind: 'noAccess', session })
        return
      }
      const data = await loadRemote()
      setPhase({ kind: 'ready', session, data })
    } catch (e) {
      setPhase({ kind: 'error', session, message: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    let currentUser: string | null = null
    const { data: sub } = supabase().auth.onAuthStateChange((event, session) => {
      // Anmeldecode aus der Adresszeile entfernen, Hash-Route beibehalten.
      if (event === 'SIGNED_IN' && window.location.search.includes('code=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      }
      const userId = session?.user.id ?? null
      if (userId === currentUser && event !== 'INITIAL_SESSION') return // z. B. Token-Erneuerung
      currentUser = userId
      if (!session) setPhase({ kind: 'signedOut' })
      // Außerhalb des Callbacks laden (Empfehlung von supabase-js, um Deadlocks zu vermeiden).
      else setTimeout(() => void loadFor(session), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadFor])

  const signOut = useCallback(() => {
    void supabase().auth.signOut()
  }, [])

  switch (phase.kind) {
    case 'checking':
    case 'loading':
      return <Splash>{phase.kind === 'loading' ? 'Studio-Daten werden geladen …' : 'Einen Moment …'}</Splash>
    case 'signedOut':
      return <LoginView />
    case 'noAccess':
      return (
        <Splash>
          <p className="font-semibold text-text">Kein Zugang</p>
          <p className="mt-2">
            {phase.session.user.email} steht nicht auf der Team-Liste. Bitte Eugen, dich freizuschalten.
          </p>
          <Button className="mt-4" onClick={signOut}>
            Abmelden
          </Button>
        </Splash>
      )
    case 'error':
      return (
        <Splash>
          <p className="font-semibold text-danger">Daten konnten nicht geladen werden.</p>
          <p className="mt-2">{phase.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="primary" onClick={() => void loadFor(phase.session)}>
              Erneut versuchen
            </Button>
            <Button onClick={signOut}>Abmelden</Button>
          </div>
        </Splash>
      )
    case 'ready':
      return (
        <StoreProvider mode="cloud" initial={phase.data} userEmail={phase.session.user.email ?? ''} onSignOut={signOut}>
          {children}
        </StoreProvider>
      )
  }
}

function Splash({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div className="max-w-md text-muted" role="status" aria-live="polite">
        {children}
      </div>
    </div>
  )
}

function LoginView() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein.')
      return
    }
    setBusy(true)
    setError(undefined)
    const { error } = await supabase().auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin + window.location.pathname, shouldCreateUser: true },
    })
    setBusy(false)
    if (error) {
      setError(
        /database error|nicht freigeschaltet|signups not allowed/i.test(error.message)
          ? 'Diese E-Mail-Adresse ist für TreenityStudio nicht freigeschaltet.'
          : /rate limit|seconds/i.test(error.message)
            ? 'Zu viele Anfragen. Bitte warte kurz und versuche es dann erneut.'
            : `Anmeldung nicht möglich: ${error.message}`,
      )
      return
    }
    setSentTo(addr)
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!sentTo) return
    if (!/^\d{6,10}$/.test(code.trim())) {
      setError('Der Code besteht aus Ziffern, z. B. 123456.')
      return
    }
    setBusy(true)
    setError(undefined)
    const { error } = await supabase().auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError('Der Code ist ungültig oder abgelaufen. Fordere ggf. einen neuen Link an.')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6">
          {!sentTo ? (
            <form noValidate onSubmit={sendLink} className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Anmelden</h1>
                <p className="mt-1 text-sm text-muted">Du bekommst einen Anmeldelink per E-Mail. Kein Passwort nötig.</p>
              </div>
              <Field label="E-Mail-Adresse" required error={error}>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={busy}>
                {busy ? 'Wird gesendet …' : 'Anmeldelink senden'}
              </Button>
            </form>
          ) : (
            <form noValidate onSubmit={verify} className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Schau in dein Postfach</h1>
                <p className="mt-1 text-sm text-muted">
                  Wir haben einen Anmeldelink an <strong className="text-text">{sentTo}</strong> geschickt. Öffne ihn auf
                  diesem Gerät.
                </p>
              </div>
              <p className="text-sm text-muted">
                Steht in der E-Mail ein Zahlencode? Dann kannst du ihn hier eingeben – praktisch, wenn der Link in einem anderen
                Browser aufgeht.
              </p>
              <Field label="Code aus der E-Mail" error={error}>
                <input
                  className="input font-mono tracking-widest"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={busy}>
                Mit Code anmelden
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted underline"
                onClick={() => {
                  setSentTo(null)
                  setCode('')
                  setError(undefined)
                }}
              >
                Andere E-Mail verwenden / neuen Link anfordern
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-faint">Nur für freigeschaltete Mitglieder des Treenity-Teams.</p>
      </div>
    </div>
  )
}
