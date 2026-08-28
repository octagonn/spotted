-- Push copy rewrite: the title carries the hook (number / name / consequence),
-- the body adds urgency or social proof, and repeat notifications rotate so
-- "Haven't seen you at the gym today." (sent 365x) stops reading as noise.
-- Both functions now emit a `title` in the payload; send-push prefers it.
-- (Applied live via MCP on 2026-08-25; see daily_nudge_sweep and
-- notify_gym_arrival in the dashboard for the canonical bodies.)

-- Superseded the same day by 20260826010000_softer_nudge_copy_more_variants.sql
-- (friendlier tone, six rotating variants per state). Kept for history.
