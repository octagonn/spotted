-- Gym chain slug (one logo per chain, never per gym) + join-request approval
-- opened to roles with manage_members.
alter table public.gyms add column if not exists chain text;
create index if not exists gyms_chain_idx on public.gyms (chain) where chain is not null;

create or replace function public.gym_chain_for_name(p_name text)
returns text language sql immutable as $$
  select case
    when p_name ~* 'eos fitness|eōs' then 'eos'
    when p_name ~* '24 hour fitness' then '24hour'
    when p_name ~* 'equinox' then 'equinox'
    when p_name ~* 'la fitness' then 'lafitness'
    when p_name ~* 'esporta' then 'esporta'
    when p_name ~* 'planet fitness' then 'planet'
    when p_name ~* 'crunch' then 'crunch'
    when p_name ~* '\mf45\M' then 'f45'
    when p_name ~* 'anytime fitness' then 'anytime'
    when p_name ~* 'orangetheory' then 'orangetheory'
    when p_name ~* 'gold''s gym|golds gym' then 'golds'
    when p_name ~* 'life time|lifetime fitness|lifetime athletic' then 'lifetime'
    when p_name ~* '\mymca\M' then 'ymca'
    when p_name ~* 'snap fitness' then 'snap'
    when p_name ~* 'chuze' then 'chuze'
    when p_name ~* 'in-shape|in shape' then 'inshape'
    when p_name ~* 'fitness 19' then 'fitness19'
    when p_name ~* 'retro fitness' then 'retro'
    when p_name ~* 'blink fitness' then 'blink'
    when p_name ~* 'youfit' then 'youfit'
    when p_name ~* 'club pilates' then 'clubpilates'
    when p_name ~* 'barry''s' then 'barrys'
    when p_name ~* 'crossfit' then 'crossfit'
    when p_name ~* 'ufc gym' then 'ufc'
    when p_name ~* '\mvasa\M' then 'vasa'
    when p_name ~* 'city sports' then 'citysports'
    when p_name ~* 'edge fitness' then 'edge'
    when p_name ~* 'genesis health' then 'genesis'
    when p_name ~* 'onelife' then 'onelife'
    when p_name ~* 'xsport' then 'xsport'
    when p_name ~* 'fitness connection' then 'fitnessconnection'
    when p_name ~* 'workout anytime' then 'workoutanytime'
    when p_name ~* 'burn boot camp' then 'burnbootcamp'
    when p_name ~* 'pure barre' then 'purebarre'
    when p_name ~* 'soulcycle' then 'soulcycle'
    else null end;
$$;

update public.gyms set chain = public.gym_chain_for_name(name) where chain is distinct from public.gym_chain_for_name(name);

-- Keep it in sync for gyms added later.
create or replace function public.gyms_set_chain()
returns trigger language plpgsql as $$
begin
  if new.chain is null then new.chain := public.gym_chain_for_name(new.name); end if;
  return new;
end $$;
drop trigger if exists gyms_set_chain on public.gyms;
create trigger gyms_set_chain before insert or update of name on public.gyms
  for each row execute function public.gyms_set_chain();

-- Join requests: anyone with manage_members (not just the creator).
create or replace function public.respond_join_request(p_community_id uuid, p_user_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.community_can(p_community_id, auth.uid(), 'manage_members') then
    raise exception 'not_admin';
  end if;
  if p_accept then
    insert into community_members (community_id, user_id)
    values (p_community_id, p_user_id)
    on conflict do nothing;
  end if;
  delete from community_join_requests
  where community_id = p_community_id and user_id = p_user_id;
end;
$$;
