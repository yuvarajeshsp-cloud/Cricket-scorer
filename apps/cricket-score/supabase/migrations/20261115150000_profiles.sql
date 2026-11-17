-- Each signed-in person's own details: name and phone (asked once on first
-- sign-in, editable on their profile page), plus email from the sign-in.
-- Everyone edits only their own. People who share a group can see each other's
-- name and phone (the same as group players' phone numbers).

create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  phone text not null check (length(phone) between 6 and 20),
  email text,
  updated_at timestamptz not null default now()
);
create index profiles_phone on public.profiles (phone);

-- True when the signed-in person and `other` are in at least one group together.
create or replace function public.shares_group(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members a join public.group_members b on a.group_id = b.group_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;
revoke all on function public.shares_group(uuid) from public, anon;
grant execute on function public.shares_group(uuid) to authenticated;

alter table public.profiles enable row level security;
create policy "See own profile and group-mates" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group(id));
create policy "Create own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "Edit own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, phone, email, updated_at) on public.profiles to authenticated;
grant update (name, phone, email, updated_at) on public.profiles to authenticated;
