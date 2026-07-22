# Beta feedback — layout & bug checklist (Workstream 4a)

Running list of beta-reported layout/visual bugs. Add items as feedback lands;
check them off with the commit that fixed them.

## Fixed
- [x] Tagged posts routed to the wrong destination → now open the owner's day group (`431fb07`, day-group context in pre-beta rework)
- [x] Old posts didn't show the whole day → day viewer at `/daily/[date]` (pre-beta rework 1a)
- [x] Story pager flashed the previous story on swipe (`431fb07`)
- [x] Keyboard covered the story reply input (`431fb07`)
- [x] Keyboard scrolled the daily-post caption off screen (`3da0236`)
- [x] Workout modals couldn't be dragged down to dismiss (`3da0236`)
- [x] Yellow "posted" dot on camera tab button removed (`3da0236`)
- [x] Message filter chips removed (`431fb07`)
- [x] Communities tab clutter: create-card and invite-code button folded into section headers (`771f7a8`)
- [x] Community detail repeated the community name twice (`771f7a8`)

- [x] Colin saw HIS photo on someone else's daily post + the post missing from their profile: recycled expo-image kept the previous card's photo when a signed URL failed to load, and failed signing dropped posts from profile grids. Fixed: recyclingKey on post media, batched createSignedUrls with retry, no raw-path fallbacks, unsigned posts keep a placeholder tile.

## Open
- [ ] (add new beta feedback here)
