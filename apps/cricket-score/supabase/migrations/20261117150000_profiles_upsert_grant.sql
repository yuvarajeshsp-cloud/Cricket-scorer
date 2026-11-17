-- Saving uses insert ... on conflict (id) do update, which also sets id (to the same value).
-- The update policy's check (id = auth.uid()) still stops anyone moving a row to another person.
grant update (id) on public.profiles to authenticated;
