-- Viewers now get the full scorecard with every update (both innings, every
-- over), so allow larger snapshots: a full 20-over match is about 15-25 KB.
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
  if octet_length(p_snapshot::text) > 65536 then
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
