-- Accepting a friend request no longer creates a DM conversation. Threads are
-- created on demand when someone opens the chat (useConversation), and the
-- inbox no longer lists empty "Tap to start conversation" rows.
drop trigger if exists friendships_ensure_conversation on public.friendships;
drop function if exists public.ensure_conversation_on_accept();
