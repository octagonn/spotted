# PROMPT — Higgsfield trophy medallion art for Spotted (110-credit budget)

Copy everything below the line into a Claude session that has the Higgsfield MCP connected.

---

You are generating a small, consistent set of trophy medallion artworks for **Spotted**, a live iOS gym-social app at `C:\Develop\Github\spotted`. The app's trophy case has 4 rarity tiers with a code-driven glow system already built; your job is ONLY the raster artwork that replaces the current flat line-icons. You are on a **free trial with exactly ~110 Higgsfield credits and no ability to buy more** — treat credits like production money.

## Hard budget rules (non-negotiable)

1. **Before anything else** call `balance` to confirm the real credit count, and `models_explore(action: "list", type: "image", unlim: true)` to see whether the trial includes unlimited generations on any image model. **I explicitly authorize `use_unlim: true`** — if a listed unlim model can do this job, use the unlimited allowance for every generation and preserve the credits.
2. Preflight EVERY paid call with `get_cost: true` (on `generate_image` and `upscale_image`) before submitting it. Never assume a price.
3. Keep a running ledger. After each phase, report: credits at phase start → spent → remaining. **Stop-loss: if remaining credits ever drop to 25 or below, stop generating, deliver what exists, and report.**
4. Max ONE retry per asset. If a second attempt also fails the acceptance criteria, keep the best attempt and move on — do not chase perfection.
5. Never call `show_plans_and_credits`, `confirm_billing_purchase`, or anything billing-related. If a tool returns a `recovery_tool` that is billing/upgrade-related, STOP and report instead of calling it.
6. No videos, no 3D, no upscales unless explicitly justified below. Images only.

## Model selection

Call `models_explore(action: "recommend", query: "stylized game rarity badge emblem icon, single centered object, dark background, text-free, image reference supported", type: "image")` and pick:
- a model that **accepts a reference image** (needed for tier consistency — check `medias[].roles`), preferring one covered by the unlim allowance, else the cheapest adequate one (`nano_banana_pro` is the catalog default for crisp graphic work; verify with get_cost).
- 1:1 aspect ratio support.

## What to generate

**Style target** (this is the app's identity — do not drift): premium, restrained, Apple-meets-Clash-Royale. Single centered medallion, matte near-black backdrop (#0A0A0A), dramatic rim light, subtle bloom, NO text, NO watermark, no busy background, generous margins (object fills ~65% of frame), symmetrical, mobile-game rarity-badge quality.

**Phase 1 — style lock (2 generations max).** Generate 2 candidate GOLD master medallions with this prompt (vary only the second one slightly if the first is off):

> "Award medallion for a premium fitness app: a circular laurel-wreathed crest with a bold dumbbell emblem at center, polished 24k gold metal with warm amber highlights (#E8B44C), subtle inner glow, dramatic rim lighting on a matte black background, rendered like a AAA mobile game rarity badge, single centered object, symmetrical, no text, no watermark, clean silhouette, generous margins"

Pick the better one (call it MASTER). Show me both and ask me to confirm the pick before Phase 2 — this is the one checkpoint where you wait for me.

**Phase 2 — the tier set (3 generations).** Using MASTER's `job_id` as a reference image ("keep the exact same medallion design and composition, change only the material"), generate:
- **Bronze**: "aged bronze and copper metal, muted warm patina, dimmer lighting (#C47A3B tones)"
- **Silver**: "brushed platinum-silver metal, cool white specular highlights (#C0C6CE tones)"
- **Diamond**: "translucent ice-blue crystal and frosted glass, prismatic refractions, icy glow (#9BE7FF and #7EA9FF tones)"

Use `generate_image_batch` for these 3 in parallel, poll with `jobs_wait`, display with ONE `show_generation_by_ids`.

**Phase 3 — standalone badge (1 generation).** Same reference technique: a smaller, simpler variant — "a compact circular emblem version of the same design, plain gold, for one-off event badges."

**Phase 4 — cutouts (up to 5 jobs).** Run `remove_background(media_type: "image")` on each final so the app gets transparent PNGs (the trophy disc sits on #131315, not black — baked backgrounds are unusable). Preflight cost; if background removal is priced per job and would break the stop-loss, deliver the black-background versions and say so.

**Phase 5 — optional, only if ≥45 credits remain:** one 1:1 "unlock celebration backdrop": "soft radial burst of warm golden light rays on pure black, subtle particles, no object, no text" (used behind the unlock modal). Skip entirely if budget is tight — the app already draws rays in code.

**Do NOT generate** per-trophy-family icons (23+ families — budget-impossible and consistency-impossible). The tier medallion + code-tinted Lucide glyph handles families.

## Acceptance criteria per image

Reject (and use your one retry) only if: text/watermark appears, the object is off-center or clipped, the design drifts from MASTER, or the material reads as the wrong tier color. Minor imperfection is fine — these render at 46–96pt in the app.

## Delivery

1. Download every final (transparent versions preferred) into `C:\Develop\Github\spotted\assets\images\trophies\` as `medal-bronze.png`, `medal-silver.png`, `medal-gold.png`, `medal-diamond.png`, `badge-standalone.png` (+ `unlock-rays.png` if made).
2. Write `assets/images/trophies/manifest.json`: file → tier → source job_id → credits spent.
3. Final report: the ledger table (every call, its cost, running balance), which model + whether unlim was used, and a one-paragraph note on how `components/trophies/TrophyCard.tsx` (`TrophyIconDisc`) should swap the Lucide icon for these images for EARNED trophies only — locked trophies keep the dim line-icon silhouette (that contrast is the design).

Do not modify any app source code in this session. Assets + manifest + report only.
