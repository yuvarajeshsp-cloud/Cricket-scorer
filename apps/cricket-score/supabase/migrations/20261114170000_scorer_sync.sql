-- Signed-in scorers keep their matches and players online, so they appear on
-- every phone they sign in on. One row per match / player; each row belongs
-- to one user and nobody else can read or change it (RLS).
-- `data` is the app's own JSON for that record; `updated_at` is set by the
-- phone that last changed it (newest wins when two phones disagree);
-- `deleted` keeps a tombstone so a delete reaches the scorer's other phones.

create table public.scorer_matches (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  primary key (user_id, id),
  check (deleted or data is not null),
  check (octet_length(coalesce(data::text, '')) <= 500000)
);

create table public.scorer_players (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  primary key (user_id, id),
  check (deleted or data is not null),
  check (octet_length(coalesce(data::text, '')) <= 20000)
);

alter table public.scorer_matches enable row level security;
alter table public.scorer_players enable row level security;

create policy "Scorers manage their own matches" on public.scorer_matches
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Scorers manage their own players" on public.scorer_players
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.scorer_matches from anon;
revoke all on public.scorer_players from anon;
grant select, insert, update, delete on public.scorer_matches to authenticated;
grant select, insert, update, delete on public.scorer_players to authenticated;
