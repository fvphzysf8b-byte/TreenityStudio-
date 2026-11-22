import { useEffect, useRef, useState } from 'react'
import { isLikelyPlayableAudio, isWebUrl } from '../../domain/util'
import { useStore } from '../../state/store'

/** Öffnet Web-Adressen extern. Lokale Pfade werden nur angezeigt und können kopiert werden. */
export function LinkTarget({ target, label }: { target: string; label?: string }) {
  const { showToast } = useStore()
  if (isWebUrl(target)) {
    return (
      <a href={target} target="_blank" rel="noopener noreferrer" className="link break-all">
        {label || target}
        <span aria-hidden="true"> ↗</span>
        <span className="sr-only"> (öffnet in neuem Tab)</span>
      </a>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {label && <span>{label}</span>}
      <code className="rounded bg-ink-800 px-1.5 py-0.5 text-xs break-all text-muted">{target}</code>
      <button
        type="button"
        className="rounded px-1.5 text-xs text-gold-300 underline underline-offset-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(target)
            showToast('success', 'Pfad kopiert. Öffne ihn im Finder bzw. Explorer.')
          } catch {
            showToast('error', 'Kopieren nicht möglich. Bitte den Pfad manuell markieren.')
          }
        }}
      >
        Pfad kopieren
      </button>
    </span>
  )
}

/**
 * Spielt direkte Audio-URLs ab. Andere Links (z. B. Drive-Freigaben) werden als externe Quelle angeboten.
 * Bei Wiedergabefehlern erscheint eine verständliche Meldung samt Link.
 */
export function AudioSource({
  url,
  onReady,
}: {
  url: string
  onReady?: (el: HTMLAudioElement | null) => void
}) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLAudioElement>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const playable = isLikelyPlayableAudio(url)

  // Bei neuer URL Fehlerzustand zurücksetzen.
  const [lastUrl, setLastUrl] = useState(url)
  if (lastUrl !== url) {
    setLastUrl(url)
    setFailed(false)
  }

  // Elternkomponente über verfügbaren Player informieren (für Zeitsprünge im Feedback).
  useEffect(() => {
    onReadyRef.current?.(failed ? null : ref.current)
  }, [failed, url, playable])

  if (!isWebUrl(url)) {
    return <p className="text-sm text-danger">⚠ Der gespeicherte Audio-Link ist keine gültige Web-Adresse.</p>
  }

  if (!playable || failed) {
    return (
      <div className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm">
        <p className="text-muted">
          {failed
            ? '⚠ Die Datei konnte im Browser nicht abgespielt werden – vielleicht ist der Link nicht öffentlich, abgelaufen oder kein direkter Datei-Link.'
            : 'Dieser Link ist keine direkte Audiodatei (z. B. eine Drive-Freigabe) und wird extern geöffnet.'}
        </p>
        <p className="mt-2">
          <LinkTarget target={url} label="Audio extern öffnen" />
        </p>
      </div>
    )
  }

  return (
    <div>
      <audio
        ref={ref}
        controls
        preload="metadata"
        src={url}
        className="w-full"
        onError={() => setFailed(true)}
      >
        Dein Browser unterstützt keine Audiowiedergabe.
      </audio>
      <p className="mt-1 text-xs text-faint">
        <LinkTarget target={url} label="Datei extern öffnen" />
      </p>
    </div>
  )
}
