-- Groups: a set of people who play together. Members (signed-in accounts) see
-- every match played in the group, live or finished, plus every player in it
-- and their stats. Anyone in the group can start and score a group match.
-- People join through an invite link (invite_code) and can say which of the
-- group's players they are (group_players.user_id).

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  invite_code text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user on public.group_members (user_id);

-- The group's players: name and phone, entered by any member. user_id is set
-- when a member says "this is me", so their stats follow their account.
create table public.group_players (
  group_id uuid not null references public.groups (id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  name text not null check (length(trim(name)) between 1 and 60),
  phone text check (phone is null or length(phone) <= 20),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, id)
);
create unique index group_players_one_claim on public.group_players (group_id, user_id) where user_id is not null;

-- A shared copy of each match played in the group (same JSON the app keeps).
create table public.group_matches (
  group_id uuid not null references public.groups (id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (octet_length(data::text) <= 500000),
  updated_at timestamptz not null,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (group_id, id)
);

-- Membership checks used by the policies. Security definer so a policy on
-- group_members can ask about group_members without recursing.
create or replace function public.is_group_member(g uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members m where m.group_id = g and m.user_id = (select auth.uid()));
$$;

create or replace function public.is_group_admin(g uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members m where m.group_id = g and m.user_id = (select auth.uid()) and m.role = 'admin');
$$;

revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_group_admin(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_players enable row level security;
alter table public.group_matches enable row level security;

-- groups: members read; admins rename/delete. Created only through create_group().
create policy "Members see their groups" on public.groups for select to authenticated using (public.is_group_member(id));
create policy "Admins update their groups" on public.groups for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "Admins delete their groups" on public.groups for delete to authenticated using (public.is_group_admin(id));

-- group_members: members see who else is in; you can leave; admins can remove or promote.
-- Joining goes through join_group() (needs the invite code).
create policy "Members see members" on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy "Leave or admin removes" on public.group_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id));
create policy "Admins change roles" on public.group_members for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

-- group_players: any member reads and edits the group's players.
create policy "Members see players" on public.group_players for select to authenticated using (public.is_group_member(group_id));
create policy "Members add players" on public.group_players for insert to authenticated with check (public.is_group_member(group_id));
create policy "Members edit players" on public.group_players for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "Admins remove players" on public.group_players for delete to authenticated using (public.is_group_admin(group_id));

-- group_matches: any member reads and writes the group's matches; admins delete.
create policy "Members see matches" on public.group_matches for select to authenticated using (public.is_group_member(group_id));
create policy "Members add matches" on public.group_matches for insert to authenticated with check (public.is_group_member(group_id));
create policy "Members update matches" on public.group_matches for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "Members delete matches" on public.group_matches for delete to authenticated using (public.is_group_member(group_id));

revoke all on public.groups, public.group_members, public.group_players, public.group_matches from anon, authenticated;
-- Column grants: members edit a player's name/phone but never who it is linked to
-- (claim_group_player does that); admins change only a group's name and members' roles.
grant select, delete on public.groups to authenticated;
grant update (name) on public.groups to authenticated;
grant select, delete on public.group_members to authenticated;
grant update (role) on public.group_members to authenticated;
grant select, delete on public.group_players to authenticated;
grant insert (group_id, id, name, phone, created_at, updated_at) on public.group_players to authenticated;
grant update (name, phone, updated_at) on public.group_players to authenticated;
grant select, insert, update, delete on public.group_matches to authenticated;

-- Create a group; the creator becomes its admin.
create or replace function public.create_group(p_name text)
returns public.groups language plpgsql security definer set search_path = '' as $$
declare g public.groups;
begin
  if (select auth.uid()) is null then raise exception 'sign in first'; end if;
  insert into public.groups (name, created_by) values (trim(p_name), (select auth.uid())) returning * into g;
  insert into public.group_members (group_id, user_id, role) values (g.id, (select auth.uid()), 'admin');
  return g;
end;
$$;

-- Join with an invite code. Safe to call again (already a member is fine).
create or replace function public.join_group(p_code text)
returns public.groups language plpgsql security definer set search_path = '' as $$
declare g public.groups;
begin
  if (select auth.uid()) is null then raise exception 'sign in first'; end if;
  select * into g from public.groups where invite_code = lower(trim(p_code));
  if g.id is null then raise exception 'invite link is not valid'; end if;
  insert into public.group_members (group_id, user_id) values (g.id, (select auth.uid())) on conflict do nothing;
  return g;
end;
$$;

-- Group name for an invite code, so the join page can say what you're joining.
create or replace function public.group_for_invite(p_code text)
returns table (id uuid, name text) language sql stable security definer set search_path = '' as $$
  select g.id, g.name from public.groups g where g.invite_code = lower(trim(p_code));
$$;

-- "This player is me": link one of the group's players to your account.
create or replace function public.claim_group_player(p_group uuid, p_player text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_member(p_group) then raise exception 'not a member of this group'; end if;
  update public.group_players set user_id = null, updated_at = now() where group_id = p_group and user_id = (select auth.uid());
  update public.group_players set user_id = (select auth.uid()), updated_at = now()
    where group_id = p_group and id = p_player and user_id is null;
  if not found then raise exception 'that player is already linked to someone else'; end if;
end;
$$;

-- New invite code (old links stop working).
create or replace function public.reset_group_invite(p_group uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not public.is_group_admin(p_group) then raise exception 'only admins can reset the invite link'; end if;
  update public.groups set invite_code = encode(extensions.gen_random_bytes(9), 'hex') where id = p_group returning invite_code into c;
  return c;
end;
$$;

revoke all on function public.create_group(text), public.join_group(text), public.group_for_invite(text),
  public.claim_group_player(uuid, text), public.reset_group_invite(uuid) from public, anon;
grant execute on function public.create_group(text), public.join_group(text), public.group_for_invite(text),
  public.claim_group_player(uuid, text), public.reset_group_invite(uuid) to authenticated;

-- The join page shows the group's name before the person signs in.
grant execute on function public.group_for_invite(text) to anon;
