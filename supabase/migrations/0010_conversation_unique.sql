-- 0010_conversation_unique.sql
-- Two clients opening the same chat concurrently could each create a
-- conversation row for the pair. Enforce one conversation per participant
-- pair regardless of ordering; the client already retries the lookup when
-- its insert conflicts.
create unique index if not exists idx_conversations_pair
  on public.conversations (least(participant_a, participant_b), greatest(participant_a, participant_b));
