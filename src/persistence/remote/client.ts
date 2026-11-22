/**
 * Supabase-Verbindung. Ohne Konfiguration läuft die App im lokalen Modus (nur Browser-Speicher).
 * Die Werte sind öffentlich (Publishable Key); der Schutz der Daten erfolgt über
 * Anmeldung und Row Level Security in der Datenbank.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const cloudConfigured = Boolean(url && key)

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!cloudConfigured) throw new Error('Supabase ist nicht konfiguriert.')
  if (!client) {
    client = createClient(url!, key!, {
      auth: {
        // PKCE: der Anmeldelink liefert ?code=… statt #token – verträgt sich mit dem Hash-Routing.
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'treenitystudio:auth',
      },
    })
  }
  return client
}
