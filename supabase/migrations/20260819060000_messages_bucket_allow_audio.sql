-- Voice notes in DMs and group chats never worked.
--
-- The `messages` bucket's allowed_mime_types list contained only image and
-- video types, so Storage rejected every recording at upload and the user got
-- "Couldn't send the voice message". The client compounded it by declaring
-- "audio/m4a", which is not a real MIME type (an .m4a file is MPEG-4 audio,
-- audio/mp4) — the allow-list is matched on the exact string, so even after
-- adding audio support the client value had to be corrected too
-- (see hooks/queries/useMessages.ts MEDIA_CFG).
--
-- x-m4a / m4a / aac / mpeg are included because different platforms label the
-- same container differently, and a mislabelled recording should not silently
-- fail to send.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp',
  'video/mp4','video/quicktime',
  'audio/mp4','audio/x-m4a','audio/m4a','audio/aac','audio/mpeg'
]
where id = 'messages';
