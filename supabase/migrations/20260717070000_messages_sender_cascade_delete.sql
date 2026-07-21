-- Account deletion was silently failing for any user who had sent a DM.
-- messages.sender_id referenced profiles(id) with ON DELETE NO ACTION, so
-- deleting the auth user (which cascades to profiles) hit a foreign-key
-- violation and the whole transaction aborted, leaving the account -- and its
-- email -- intact. That's why a deleted account's email still appeared taken
-- and the person couldn't sign up again. Every other profile-referencing FK
-- already cascades; bring messages in line so a deleted user's DMs go with
-- them and the email frees up for a fresh signup.
alter table public.messages
  drop constraint messages_sender_id_fkey,
  add constraint messages_sender_id_fkey
    foreign key (sender_id) references public.profiles(id) on delete cascade;
