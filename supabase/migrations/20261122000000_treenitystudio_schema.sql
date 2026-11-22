-- TreenityStudio App: Datenbankschema mit Zugriffsrechten (Row Level Security).
-- Zugriffsmodell: gemeinsamer Studio-Bereich. Wer auf der Team-Liste steht, darf alles lesen und bearbeiten.
-- Wer nicht auf der Liste steht, kann sich nicht registrieren und sieht keine Daten.

-- ───────────── Team-Liste & Hilfsfunktionen ─────────────

create table public.team_members (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);

create schema if not exists private;

-- Prüft, ob die angemeldete Person auf der Team-Liste steht.
create or replace function private.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members t
    where t.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_team_member() to authenticated;

-- Registrierung nur für freigegebene E-Mail-Adressen.
create or replace function private.only_team_signups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or not exists (
    select 1 from public.team_members t where t.email = lower(new.email)
  ) then
    raise exception 'Diese E-Mail-Adresse ist für TreenityStudio nicht freigeschaltet.';
  end if;
  return new;
end;
$$;

create trigger treenity_only_team_signups
  before insert on auth.users
  for each row execute function private.only_team_signups();

-- ───────────── Fachliche Tabellen ─────────────

create table public.people (
  id uuid primary key,
  name text not null check (length(trim(name)) > 0),
  role text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.projects (
  id uuid primary key,
  title text not null check (length(trim(title)) > 0),
  type text not null check (type in ('musik', 'podcast', 'set', 'soundscape')),
  brand text not null check (brand in ('studio', 'records', 'radio')),
  release_area text check (release_area in ('records', 'radio')),
  format text not null default '',
  description text not null default '',
  goal text not null default '',
  status text not null check (status in ('idee', 'vorbereitung', 'aufnahme', 'bearbeitung', 'bereit', 'veroeffentlicht', 'archiviert')),
  status_before_archive text check (status_before_archive in ('idee', 'vorbereitung', 'aufnahme', 'bearbeitung', 'bereit', 'veroeffentlicht', 'archiviert')),
  due_date date,
  pinned boolean not null default false,
  is_example boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.project_members (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (project_id, person_id)
);

create table public.sessions (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  -- Lokale Startzeit ohne Zeitzone, Format YYYY-MM-DDTHH:mm
  starts_at text not null check (starts_at ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  duration_minutes integer not null check (duration_minutes > 0),
  participant_ids uuid[] not null default '{}',
  goal text not null default '',
  checklist jsonb not null default '[]',
  setup_notes text not null default '',
  notes text not null default '',
  result text not null default '',
  recording_links jsonb not null default '[]',
  status text not null check (status in ('geplant', 'abgeschlossen', 'abgesagt')),
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.tasks (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  done boolean not null default false,
  done_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.audio_versions (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  date date not null,
  url text not null,
  changes text not null default '',
  is_current boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.feedback (
  id uuid primary key,
  audio_version_id uuid not null references public.audio_versions (id) on delete cascade,
  author_id uuid references public.people (id) on delete set null,
  comment text not null check (length(trim(comment)) > 0),
  timestamp_sec integer check (timestamp_sec >= 0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.resource_links (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('notion', 'drive', 'ordner', 'referenz', 'sonstiges')),
  label text not null default '',
  target text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- Indizes für Fremdschlüssel
create index on public.project_members (project_id);
create index on public.project_members (person_id);
create index on public.sessions (project_id);
create index on public.tasks (project_id);
create index on public.tasks (session_id);
create index on public.audio_versions (project_id);
create index on public.feedback (audio_version_id);
create index on public.feedback (author_id);
create index on public.resource_links (project_id);

-- ───────────── Row Level Security ─────────────

do $$
declare
  t text;
begin
  foreach t in array array['people', 'projects', 'project_members', 'sessions', 'tasks', 'audio_versions', 'feedback', 'resource_links']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Team darf lesen" on public.%I for select to authenticated using ((select private.is_team_member()))', t);
    execute format(
      'create policy "Team darf anlegen" on public.%I for insert to authenticated with check ((select private.is_team_member()))', t);
    execute format(
      'create policy "Team darf ändern" on public.%I for update to authenticated using ((select private.is_team_member())) with check ((select private.is_team_member()))', t);
    execute format(
      'create policy "Team darf löschen" on public.%I for delete to authenticated using ((select private.is_team_member()))', t);
  end loop;
end $$;

alter table public.team_members enable row level security;
create policy "Team sieht Team-Liste" on public.team_members
  for select to authenticated using ((select private.is_team_member()));
create policy "Team lädt ein" on public.team_members
  for insert to authenticated with check ((select private.is_team_member()));
create policy "Team entfernt" on public.team_members
  for delete to authenticated using ((select private.is_team_member()));

-- Anonyme Nutzer bekommen keinerlei Zugriff.
revoke all on all tables in schema public from anon;

-- ───────────── Live-Aktualisierung ─────────────

alter publication supabase_realtime add table
  public.people, public.projects, public.project_members, public.sessions,
  public.tasks, public.audio_versions, public.feedback, public.resource_links;

-- ───────────── Startdaten: Beteiligte laut Projektauftrag ─────────────

insert into public.people (id, name, role, created_at, updated_at) values
  (gen_random_uuid(), 'Eugen (U-Geen)', 'Tontechnik, Produktion, kreative Leitung', now(), now()),
  (gen_random_uuid(), 'Christian', 'Musikentwicklung & Aufnahmen', now(), now()),
  (gen_random_uuid(), 'Alex', 'Musik- & Live-Projekte', now(), now());
