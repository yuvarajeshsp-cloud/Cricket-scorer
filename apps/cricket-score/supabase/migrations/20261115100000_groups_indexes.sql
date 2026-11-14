-- Indexes for the groups tables' foreign keys (Supabase performance advisor).
create index if not exists group_matches_updated_by on public.group_matches (updated_by);
create index if not exists group_players_user on public.group_players (user_id);
create index if not exists groups_created_by on public.groups (created_by);
