/**
 * Wortmarke „Treenity Studio“.
 * Ein echtes Logo kann später hier eingesetzt werden, z. B.:
 *   <img src={logoUrl} alt="Treenity" className="h-7" />
 * (Datei unter src/ui/brand/ ablegen und importieren.)
 */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="7" className="fill-forest-800" />
        <path
          d="M16 26V12M16 17l-5-4M16 15l5-4M7 20h3l2-3 2 5 2-8 2 6 2-3 2 3h3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gold-400"
        />
      </svg>
      <span className="text-[1.05rem] leading-none tracking-[0.18em] uppercase">
        <span className="font-semibold text-text">Treenity</span>
        <span className="font-light text-gold-300">Studio</span>
      </span>
    </span>
  )
}
