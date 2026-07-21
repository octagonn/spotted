-- Reactions open up: any emoji (like iMessage/Instagram), not a fixed set.
-- The double-tap like stays 🔥; selfie-only rows stay NULL.
alter table public.post_reactions drop constraint if exists post_reactions_reaction_check;
alter table public.post_reactions add constraint post_reactions_reaction_check
  check (reaction is null or (char_length(reaction) >= 1 and char_length(reaction) <= 16));
