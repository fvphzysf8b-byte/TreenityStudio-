import { ButtonLink, EmptyState } from '../components/ui'

export function NotFound({ what }: { what?: string }) {
  return (
    <EmptyState
      title={what ? `${what} nicht gefunden` : 'Seite nicht gefunden'}
      text={
        what
          ? `Dieser Eintrag existiert nicht (mehr). Vielleicht wurde er gelöscht.`
          : 'Diese Adresse gibt es in der App nicht.'
      }
      action={<ButtonLink to="/">Zur Übersicht</ButtonLink>}
    />
  )
}
