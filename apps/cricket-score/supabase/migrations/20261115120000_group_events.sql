-- 1. Group history is kept: deleting a match on your phone no longer removes the
--    group's copy, and only group admins can delete a group match.
drop policy if exists "Members delete matches" on public.group_matches;
create policy "Admins delete matches" on public.group_matches for delete to authenticated using (public.is_group_admin(group_id));

-- 2. Alerts: "match started" / "match finished" events for a group. Members'
--    apps get them in real time (Realtime) and show a banner.
create table public.group_events (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  match_id text not null check (length(match_id) between 1 and 100),
  kind text not null check (kind in ('started', 'finished')),
  title text not null check (length(title) between 1 and 140),
  detail text check (detail is null or length(detail) <= 240),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, match_id, kind)
);
create index group_events_recent on public.group_events (group_id, created_at desc);
create index group_events_created_by on public.group_events (created_by);

alter table public.group_events enable row level security;
create policy "Members see group events" on public.group_events for select to authenticated using (public.is_group_member(group_id));
create policy "Members post group events" on public.group_events for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = (select auth.uid()));

revoke all on public.group_events from anon, authenticated;
grant select on public.group_events to authenticated;
grant insert (group_id, match_id, kind, title, detail) on public.group_events to authenticated;

alter publication supabase_realtime add table public.group_events;
