-- DM epic foundation (spec items 2, 6, 8-13, 15-19, 23).
-- Group-ready WITHOUT rebuilding conversations: a membership table carries
-- per-user thread state; participant_a/b stay for existing 1:1 flows. Adding
-- groups later = insert >2 participant rows (a/b become nullable then).

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  muted boolean not null default false,
  folder_id uuid,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
insert into public.conversation_participants (conversation_id, user_id)
select id, participant_a from public.conversations
on conflict do nothing;
insert into public.conversation_participants (conversation_id, user_id)
select id, participant_b from public.conversations
on conflict do nothing;

alter table public.conversation_participants enable row level security;
create policy "conv_participants_select" on public.conversation_participants
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.participant_a or auth.uid() = c.participant_b)
    )
  );
create policy "conv_participants_update_own" on public.conversation_participants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.message_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.message_folders enable row level security;
create policy "message_folders_all_own" on public.message_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.conversation_participants
  add constraint conversation_participants_folder_fkey
  foreign key (folder_id) references public.message_folders(id) on delete set null;

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists kind text not null default 'text',
  add column if not exists shared_kind text,
  add column if not exists shared_id uuid;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reactions enable row level security;
create policy "message_reactions_select" on public.message_reactions
  for select using (
    exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (auth.uid() = c.participant_a or auth.uid() = c.participant_b)
    )
  );
create policy "message_reactions_insert_own" on public.message_reactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (auth.uid() = c.participant_a or auth.uid() = c.participant_b)
    )
  );
create policy "message_reactions_delete_own" on public.message_reactions
  for delete using (auth.uid() = user_id);

create table if not exists public.message_hides (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_hides enable row level security;
create policy "message_hides_all_own" on public.message_hides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
create policy "user_blocks_all_own" on public.user_blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

alter table public.conversations
  add column if not exists status text not null default 'active'
    check (status in ('active', 'request')),
  add column if not exists requester_id uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists show_activity boolean not null default true,
  add column if not exists dm_preview_enabled boolean not null default true;

create or replace function public.conversations_gatekeeper()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from user_blocks
    where (blocker_id = new.participant_a and blocked_id = new.participant_b)
       or (blocker_id = new.participant_b and blocked_id = new.participant_a)
  ) then
    raise exception 'blocked';
  end if;
  if not public.are_friends(new.participant_a, new.participant_b) then
    new.status := 'request';
    new.requester_id := coalesce(auth.uid(), new.participant_a);
  end if;
  return new;
end $$;
drop trigger if exists conversations_gatekeeper on public.conversations;
create trigger conversations_gatekeeper
  before insert on public.conversations
  for each row execute function public.conversations_gatekeeper();

create or replace function public.conversations_add_participants()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into conversation_participants (conversation_id, user_id)
  values (new.id, new.participant_a), (new.id, new.participant_b)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists conversations_add_participants on public.conversations;
create trigger conversations_add_participants
  after insert on public.conversations
  for each row execute function public.conversations_add_participants();

create or replace function public.messages_gatekeeper()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  conv conversations%rowtype;
  other uuid;
begin
  select * into conv from conversations where id = new.conversation_id;
  if conv.id is null then
    raise exception 'no_conversation';
  end if;
  other := case when new.sender_id = conv.participant_a then conv.participant_b else conv.participant_a end;
  if exists (
    select 1 from user_blocks
    where (blocker_id = new.sender_id and blocked_id = other)
       or (blocker_id = other and blocked_id = new.sender_id)
  ) then
    raise exception 'blocked';
  end if;
  if conv.status = 'request' then
    if new.sender_id = conv.requester_id then
      if exists (
        select 1 from messages
        where conversation_id = conv.id and sender_id = new.sender_id and deleted_at is null
      ) then
        raise exception 'request_pending';
      end if;
      if new.media_url is not null then
        raise exception 'request_text_only';
      end if;
    else
      update conversations set status = 'active' where id = conv.id;
    end if;
  elsif not public.are_friends(new.sender_id, other) then
    update conversations set status = 'request', requester_id = new.sender_id where id = conv.id;
  end if;
  return new;
end $$;
drop trigger if exists messages_gatekeeper on public.messages;
create trigger messages_gatekeeper
  before insert on public.messages
  for each row execute function public.messages_gatekeeper();

create or replace function public.messages_update_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    if auth.uid() is distinct from old.sender_id then
      raise exception 'unsend_not_sender';
    end if;
    if old.sent_at < now() - interval '15 minutes' then
      raise exception 'unsend_window_expired';
    end if;
  end if;
  if new.content is distinct from old.content
     or new.media_url is distinct from old.media_url
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id then
    raise exception 'message_immutable';
  end if;
  return new;
end $$;
drop trigger if exists messages_update_guard on public.messages;
create trigger messages_update_guard
  before update on public.messages
  for each row execute function public.messages_update_guard();

create or replace function public.respond_message_request(p_conversation_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare conv conversations%rowtype;
begin
  select * into conv from conversations where id = p_conversation_id;
  if conv.id is null or conv.status <> 'request' then
    raise exception 'not_a_request';
  end if;
  if auth.uid() = conv.requester_id
     or (auth.uid() <> conv.participant_a and auth.uid() <> conv.participant_b) then
    raise exception 'not_recipient';
  end if;
  if p_accept then
    update conversations set status = 'active' where id = p_conversation_id;
  else
    delete from conversations where id = p_conversation_id;
  end if;
end $$;
