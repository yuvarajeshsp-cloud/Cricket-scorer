-- Live scores for the cricket-score app. No logins:
--  * Anyone with a match link can read that match's score and get updates
--    (Realtime Postgres Changes on live_matches).
--  * Only the phone that started the match can change it. That phone keeps a
--    random secret; the database stores only its SHA-256 hash, in a table
--    nobody can read, and checks it inside publish_score().

create extension if not exists pgcrypto with schema extensions;

create table public.live_matches (
  id text primary key check (id ~ '^[a-z0-9]{6,24}$'),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.live_match_owners (
  match_id text primary key references public.live_matches (id) on delete cascade,
  secret_hash text not null
);

alter table public.live_matches enable row level security;
alter table public.live_match_owners enable row level security;

-- Read-only for everyone; writes only through publish_score().
create policy "Anyone can read live scores"
  on public.live_matches for select
  to anon, authenticated
  using (true);

revoke all on public.live_matches from anon, authenticated;
grant select on public.live_matches to anon, authenticated;
revoke all on public.live_match_owners from anon, authenticated;

create or replace function public.publish_score(p_id text, p_secret text, p_snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(p_secret, 'sha256'), 'hex');
  v_owner text;
begin
  if p_secret is null or length(p_secret) < 32 then
    raise exception 'invalid secret';
  end if;
  if octet_length(p_snapshot::text) > 20000 then
    raise exception 'snapshot too large';
  end if;

  select secret_hash into v_owner from public.live_match_owners where match_id = p_id;

  if v_owner is null then
    -- First publish claims the match code for this phone.
    insert into public.live_matches (id, snapshot) values (p_id, p_snapshot);
    insert into public.live_match_owners (match_id, secret_hash) values (p_id, v_hash);
  elsif v_owner = v_hash then
    update public.live_matches set snapshot = p_snapshot, updated_at = now() where id = p_id;
  else
    raise exception 'not the scorer for this match';
  end if;
end;
$$;

revoke all on function public.publish_score(text, text, jsonb) from public;
grant execute on function public.publish_score(text, text, jsonb) to anon, authenticated;

-- Viewers get each update the moment it is saved.
alter publication supabase_realtime add table public.live_matches;
