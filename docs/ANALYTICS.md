# Spotted analytics — what is collected and where to read it

Reference for the internal metrics tool. Two data tiers:

| Tier | Who | Source | Retention |
|---|---|---|---|
| **Activity ledger** | every signed-in user | `user_activity`, `user_activity_days` (touched on every app foreground via `touch_user_activity()`) | indefinite |
| **Event stream** | everyone by default outside the EEA/UK/CH, opt-in there (`analytics_preferences.product_analytics_enabled`; see Consent model below) | `analytics_events` | 90 days raw; daily aggregates kept forever in `analytics.*` |

Product-feature tables that are NOT consent-gated (they're features, not analytics): `post_views`, `profile_views`, `story_views`, `user_activity.last_login_at` (mirror of `auth.users.last_sign_in_at`).

Everything analytics-related is **backend-only**: the `analytics` schema is not exposed through the API, `user_activity*` has RLS with no policies, and clients can only insert (never read) `analytics_events`. Query with the service role.

## Where to start (internal tool)

| Question | Read |
|---|---|
| DAU / new users / posts / workouts / messages per day (all users) | `analytics.daily_summary` |
| Sessions per day, avg + median session length, screens per session (consented) | `analytics.daily_summary` |
| Retention curve by signup week (all users) | `analytics.weekly_retention` (`users / cohort_size` per `week_n`) |
| Which screens people use and how long they stay | `analytics.daily_screens` (dwell), `analytics.screens_daily` (live 90d) |
| Feature usage over time | `analytics.daily_events` (forever) / `analytics.events_daily` (live 90d) |
| Post funnel: open → camera → capture → publish | `analytics.daily_post_funnel` |
| Per-user engagement table | `analytics.user_overview` |
| Individual sessions (drill-down) | `analytics.sessions`, then `analytics_events where session_id = …` |

`analytics.rollup_day(date)` populates the durable tables; cron `analytics-daily-rollup` runs it at 04:00 UTC for yesterday, ahead of the 04:17 raw-event purge. Re-run it for any day to rebuild.

## Event stream columns

`analytics_events(user_id, event_name, properties jsonb, occurred_at, session_id, app_version, platform, os_version)`.

- `session_id` — new on app launch and after >30 min in background. `app_open` marks the start (`cold=true` for the first session of a launch); `session_end` carries `duration_sec / screens / events / reason`.
- Client batches events (4 s or 20 events) and flushes on background and sign-out.
- Properties are **allowlisted per event** in `lib/analytics.ts`; anything else is dropped before send. No free text, no ids, no device model.

## Event taxonomy

| Event | Properties | Fires when |
|---|---|---|
| `app_open` | platform, cold | session starts |
| `app_background` | session_sec | app leaves foreground |
| `app_foreground` | away_sec | app returns within 30 min |
| `session_end` | duration_sec, screens, events, reason | background timeout, sign-out, consent off |
| `screen_view` | screen, previous_screen, dwell_ms | route change (dwell = time on previous screen) |
| `client_error` | scope, code | any `logger.warn/error` (code only) |
| `profile_created` | — | signup creates a profile |
| `onboarding_stage` | stage (permissions / home-gym / complete) | onboarding advances |
| `sign_out` | — | |
| `push_permission` | status, prompted | OS push prompt answered |
| `notification_opened` | type | push tapped |
| `contacts_synced` | matches, invitable | contact matching ran |
| `feed_refreshed` | tab | pull-to-refresh |
| `lock_cta_tapped` | action (post / workout) | feed lock overlay buttons |
| `post_reacted` | selfie | reaction sent |
| `post_shared` | kind | shared into a DM |
| `post_deleted` | — | |
| `content_reported` | content_type, reason | |
| `camera_open` | mode | |
| `dual_mode_started` | mode | |
| `photo_captured` / `photo_saved` | mode, dual | |
| `music_selected` | has_preview | song attached |
| `draft_saved` | mode | |
| `gym_geofence_blocked` | — | tried to post outside a gym |
| `daily_post_published` | dual, photo_count, is_video, has_music, has_workout, tagged_count, location_kind | |
| `daily_post_queued_offline` | dual | |
| `story_published` / `story_viewed` / `story_reposted` | dual / — / — | |
| `workout_started` | source (fresh / routine / repeat / edit) | |
| `workout_completed` | duration_bucket, exercises, sets, prs, source, edited | |
| `workout_discarded` | sets_logged | |
| `routine_saved` | exercises | |
| `rest_day_marked` | rest (true = logged, false = cancelled) | |
| `people_search` | query_length, results | debounced search ran |
| `friend_request_sent` / `friend_request_responded` | — / accepted | |
| `suggestion_dismissed` | — | |
| `taunt_sent` | — | |
| `message_sent` | reply | |
| `message_reacted` | set | |
| `message_forwarded` | — | |
| `setting_changed` | key, value | privacy settings screen |
| `map_open`, `paywall_viewed`, `purchase_*` | — / source / product | reserved |

Adding an event: add the name to `AnalyticsEventName` **and** its allowed keys to `ALLOWED_PROPERTIES` in `lib/analytics.ts`, then call `trackAnalyticsEvent(...)` after the action succeeds.

## Consent model (since 2026-08-25)

| Region (device locale) | Default | Prompt | `analytics_preferences.basis` |
|---|---|---|---|
| Everywhere else | **on** | none (disclosed in Privacy Policy, opt-out in Settings -> Privacy) | `default`, or `consent`/`declined` once the toggle is used |
| EEA / UK / Switzerland | off | opt-in sheet on first launch (`AnalyticsConsentHost`) | `consent` / `declined`; a `default` row is treated as "not yet asked" |

- New signups get a default-on row from the `profiles_default_analytics` trigger.
- Collection is client-initiated (`setAnalyticsSession`), so a regulated user with a `default` row sends nothing until they consent. RLS (row must be enabled) is the backstop.
- The activity ledger (`user_activity*`) and view tables are product features, not analytics, and run for everyone.
- Third-party sharing is a separate, future, explicit opt-in (`sale_sharing_opt_out` stays true; the policy promises we ask first).
- Disclosure lives in the public policy repo (`octagonn/spottedtermsandprivacy`, effective 2026-08-25) and in-app (`components/LegalModal.tsx`). If collection ever expands beyond app opens / sessions / screens+dwell / feature actions / app+OS version / platform, update BOTH, bump `ANALYTICS_CONSENT_VERSION` (regulated regions re-prompt) and `LEGAL_VERSION`, and notify users (system_notice).

## App Store privacy label (answers)

Data collected, linked to the user, purpose "Analytics" and "App Functionality": Product Interaction, Other Usage Data, Crash/Diagnostic data (client_error codes), User ID. Not used for tracking. Coarse/precise location is NOT collected for analytics (only foreground check-ins, already declared).
