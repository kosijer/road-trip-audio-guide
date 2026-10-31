# Feature Spec: Personal Preferences & Adaptive Ranking

**Status:** Draft v1
**Parent document:** `road-trip-audio-guide-PRD.md` (this spec extends it; where they conflict, this spec wins for everything related to POI ranking and personalization)
**Audience:** AI coding agent (Cursor) implementing the feature with minimal supervision.

---

## 1. Summary

The app learns which *kinds* of places the user enjoys (castles, nature, WW2 sites, etc.) from their feedback, and uses that to gently re-rank POI suggestions. The learning must be **cautious, uncertainty-aware, and context-aware**: it must never conclude too early, never treat missing data as dislike, and never hide a whole category from the user.

The app is used **daily** (every drive, and whenever the user wants ideas where to go), not only on holidays. All design decisions below assume months of accumulating data, slow drift in taste, and a finite local pool of places that gets exhausted.

## 2. Problem Statement and Failure Modes to Avoid

A naive "average rating per category" approach produces wrong conclusions. The implementation MUST specifically avoid these failure modes:

| # | Failure mode | Example | Required behavior |
|---|---|---|---|
| F1 | Premature conclusions from few data points | 3 liked castles → app stops suggesting nature | Preference influence is bounded and scaled by amount of evidence; unexplored categories keep high uncertainty and keep getting surfaced |
| F2 | Absence of data treated as dislike | User rarely uses the app on Friday nights → "dislikes nightlife" | Only learn from *exposures* (places actually suggested). No exposure = no update. App usage patterns are never a taste signal |
| F3 | Context confounding | Rainy winter → hikes ignored → "dislikes hiking" | Only learn from **viable** exposures (place was actually a sensible suggestion in that context). Non-viable exposures never update stats |
| F4 | One rating conflates taste with quality | A castle got 2/5 because the narration was dull → "dislikes castles" | Taste signal and narration-quality signal are separate (Section 6) |
| F5 | Filter bubble | System only shows what it already knows the user likes | Exploration slot + diversity rule + uncertainty-driven sampling (Section 8) |
| F6 | Stale taste | Interests change over months | Time decay toward prior (Section 7.3) |

## 3. Goals / Non-Goals

**Goals (this spec)**
- Categorize every POI into a fixed taxonomy (cheaply, once per POI).
- Capture per-exposure feedback with context and viability.
- Maintain per-category preference statistics with explicit uncertainty.
- Apply preferences as a *bounded soft multiplier* in ranking, with diversity and exploration guarantees.
- Support explicit user overrides (mute category, session mood) that beat learned preferences.
- Show a transparent, editable profile screen.
- Use Gemini sparingly and optimally (Section 10).

**Non-Goals (explicitly out of scope)**
- Contextual (per-daypart / per-weather) taste learning — log the context now, learn from it in a later version.
- Collaborative filtering, server-side sync, multi-user support.
- Training or fine-tuning any model.
- The "I have no inspiration, where should I go?" browse flow itself (separate spec) — but this feature's ranking function must be reusable by it.

## 4. Existing State — Inspect Before Building

The user has **already implemented** (a) rating of suggested places and (b) storage of the full history of suggested places. **Before writing any code, inspect the existing implementation** (storage layer, schema, types, UI) and:
- Extend/migrate the existing tables and types rather than creating parallel ones.
- Reuse the project's existing persistence mechanism. If there is none for relational data, use SQLite.
- Write a one-time migration for legacy data (Section 11).
- Report in the changelog what was reused vs. newly created.

## 5. Taxonomy

Fixed enum, defined in one config file (`preferences.config.ts`). Multi-label: each POI gets 1–3 categories, with one `primary_category`.

| Category id | Description |
|---|---|
| `ancient_history` | Antiquity, archaeological sites, ruins |
| `medieval_castles` | Castles, fortresses, medieval towns |
| `ww2_military` | WW2 sites, battlefields, fortifications, war memorials |
| `religious_sites` | Churches, monasteries, mosques, shrines |
| `nature_viewpoints` | Viewpoints, gorges, lakes, parks, hiking areas |
| `beaches_coast` | Beaches, coves, harbours |
| `museums_galleries` | Museums and galleries |
| `famous_people` | Birthplaces, houses, memorials of notable people |
| `architecture` | Notable buildings/bridges where the structure itself is the point |
| `local_culture_food` | Markets, traditional villages, food/drink, crafts |
| `modern_landmarks` | Post-1900 landmarks, industrial heritage, engineering |
| `nightlife_social` | Bars, venues, evening scenes (only viable in the evening/night) |
| `other` | Fallback — never learned from (see 7.4) |

Also store `era` per POI (enum: `prehistoric`, `antiquity`, `medieval`, `early_modern`, `19th_century`, `20th_century`, `contemporary`, `unknown`) — logged for future use, not used in V1 ranking.

## 6. Feedback Model

### 6.1 Outcomes (per exposure)

An **exposure** = a POI was actually presented to the user (narrated aloud, or shown as a suggestion). Each exposure ends in exactly one outcome:

| Outcome | How captured | Meaning |
|---|---|---|
| `liked` | 👍 "More like this" button | Positive taste signal for the POI's categories |
| `not_interested` | 👎 "Not my thing" button | Explicit negative taste signal — the only strong negative |
| `skipped` | User skips narration | Very weak negative |
| `visited` | Location dwell near the POI (≥ 5 min within 150 m, if available) | Strong implicit positive |
| `ignored` | No interaction | **No signal at all** |

### 6.2 Narration quality is a separate signal

Keep an optional separate **1–5 narration quality rating**. It is stored on the exposure but **never** feeds category statistics. It exists only to improve prompts later. UI copy must make the two controls unambiguous:
- 👍/👎 buttons = "do I like this *kind* of place"
- stars (optional, secondary) = "was this *narration* good"

## 7. Preference Learning

### 7.1 Representation

Per category, keep a Beta distribution as two counters plus bookkeeping:

```ts
interface CategoryStats {
  category: CategoryId;
  alpha: number;          // positive evidence + prior
  beta: number;           // negative evidence + prior
  lastUpdated: number;    // epoch ms, used for decay
}
```

Prior for every category: `alpha = 2, beta = 2` (neutral mean 0.5, wide uncertainty).
Optional seed: `ancient_history`, `medieval_castles`, `ww2_military` may start at `alpha = 3, beta = 2` (user stated a preference for history over market towns). Configurable in one place.

### 7.2 Update rule

Applied **only if** `exposure.viable === true` (see Section 9) **and** the exposure's categories do not include only `other`. For each category in the POI's `categories` (primary category gets full weight, secondary categories get half weight):

| Outcome | Update |
|---|---|
| `liked` | `alpha += 1.0 * w` |
| `visited` | `alpha += 1.5 * w` |
| `not_interested` | `beta += 1.0 * w` |
| `skipped` | `beta += 0.2 * w` |
| `ignored` | no update |

### 7.3 Time decay

Evidence decays toward the prior with a half-life of **75 days** (config constant). Applied lazily on read:

```ts
function decayed(stats: CategoryStats, now: number): { alpha: number; beta: number } {
  const days = (now - stats.lastUpdated) / 86_400_000;
  const f = Math.pow(0.5, days / HALF_LIFE_DAYS);
  return {
    alpha: PRIOR_ALPHA + (stats.alpha - PRIOR_ALPHA) * f,
    beta:  PRIOR_BETA  + (stats.beta  - PRIOR_BETA)  * f,
  };
}
```

When writing an update, first apply decay, then add the new evidence, then set `lastUpdated = now`.

### 7.4 Minimum evidence

```ts
evidence = alpha + beta - (PRIOR_ALPHA + PRIOR_BETA);   // effective number of observations
confidence = Math.min(1, evidence / MIN_EVIDENCE);      // MIN_EVIDENCE = 5
```

A category with little evidence has its influence shrunk toward neutral (Section 8.2). `other` never gets statistics.

## 8. Ranking

### 8.1 Pipeline

```
candidates (from POI Discovery Service)
  → 1. viability filter + context snapshot            (Section 9)
  → 2. base_interest score                            (existing heuristic / LLM selection from the parent PRD)
  → 3. apply user overrides                           (mute = exclude; mood = boost)
  → 4. apply preference multiplier                    (Section 8.2)
  → 5. diversity + exploration re-rank                (Section 8.3)
  → selected POI(s) → Narration Engine
```

This pipeline must be a **pure, reusable function** (`rankCandidates(candidates, context, profile, sessionState)`) with no UI or network dependencies, so the future "browse for inspiration" flow can call it.

### 8.2 Preference multiplier (Thompson sampling, bounded)

```ts
function preferenceMultiplier(cat: CategoryId, now: number): number {
  const { alpha, beta } = decayed(statsFor(cat), now);
  const theta = sampleBeta(alpha, beta);                     // random draw from the posterior
  const confidence = Math.min(1, (alpha + beta - PRIOR_SUM) / MIN_EVIDENCE);
  const thetaEff = 0.5 + (theta - 0.5) * confidence;         // shrink toward neutral when evidence is thin
  return 0.7 + 0.6 * thetaEff;                               // hard-bounded to [0.7, 1.3]
}
```

For a POI with multiple categories, use the weighted average of its categories' multipliers (primary 2/3, secondary share 1/3).

`final_score = base_interest * preferenceMultiplier * moodBoost`

**Hard guarantees (must be unit-tested):**
- The learned multiplier is always within `[0.7, 1.3]`. A candidate with `base_interest` more than 1.3× higher than another always outranks it, regardless of preferences.
- Preferences never remove a candidate. Only an explicit user mute does.

### 8.3 Diversity and exploration

Applied after scoring, over the sequence of selections within a session/trip:
- **Diversity rule:** never select more than 2 consecutive items with the same `primary_category`, if any viable alternative exists.
- **Exploration slot:** every 5th selection, instead of the top-scored item, pick the viable candidate whose primary category has the **highest posterior variance** (least known), subject to `base_interest` being above a minimum quality floor (`EXPLORATION_MIN_BASE = 0.5 × median base_interest of the candidate set`).
- **Novelty/cooldown:** never re-suggest a POI that was exposed within the last `POI_COOLDOWN_DAYS = 30` days (configurable). If the local pool is exhausted, widen the search radius in steps (×1.5, up to a configured maximum) before returning nothing.

## 9. Context and Viability

### 9.1 Context snapshot (logged with every exposure)

```ts
interface ExposureContext {
  daypart: 'morning' | 'afternoon' | 'evening' | 'night';
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  weatherOk: boolean | null;     // null = unknown
  mode: 'driving' | 'walking' | 'browse';
  timeBudgetMin: number | null;
}
```

Logged now so a future version can learn contextual taste. **V1 learns global per-category taste only.**

### 9.2 Viability

An exposure is `viable = true` only if **all** of the following hold (unknown data counts as viable, never as blocking):
- Open at the relevant time, if opening hours are known (parent PRD 7.5).
- Not blocked by weather if outdoor-only (parent PRD 7.6): no precipitation now/next hour, and daylight if the POI is outdoor-only.
- Within the radius / time budget for the current mode.
- Context-appropriate: `nightlife_social` is viable only in `evening`/`night`.

Store `viable` and `blockedReason` on every exposure. **Non-viable exposures are logged but never update category statistics.**

## 10. Gemini Usage (optimal, not maximal)

Use the cheapest suitable Gemini model (Flash-Lite tier or equivalent) behind the existing provider-agnostic LLM adapter. Gemini is used in exactly three places; **ranking itself never calls an LLM**.

### 10.1 Categorization — deterministic first, LLM as fallback
1. Map Wikidata `P31` (instance of) and OSM tags (`historic=*`, `tourism=*`, `amenity=place_of_worship`, `natural=*`, …) to taxonomy ids via a static mapping table in code (`categoryMapping.ts`). Cover the common cases; extend over time.
2. Only POIs the mapping cannot classify go to Gemini.
3. **Piggyback on the narration call:** the narration request returns JSON containing both the narration and the categories, so categorization costs no extra call.
4. For POIs classified during pre-fetch (no narration yet), batch up to 20 POIs per classification call.
5. Cache by Wikidata QID (fall back to a stable POI id). Never classify the same POI twice.

Use structured output with a response schema so categories cannot fall outside the enum:

```json
{
  "type": "object",
  "properties": {
    "narration": { "type": "string" },
    "categories": {
      "type": "array", "minItems": 1, "maxItems": 3,
      "items": { "type": "string", "enum": ["ancient_history", "medieval_castles", "ww2_military", "religious_sites", "nature_viewpoints", "beaches_coast", "museums_galleries", "famous_people", "architecture", "local_culture_food", "modern_landmarks", "nightlife_social", "other"] }
    },
    "primary_category": { "type": "string" },
    "era": { "type": "string", "enum": ["prehistoric", "antiquity", "medieval", "early_modern", "19th_century", "20th_century", "contemporary", "unknown"] }
  },
  "required": ["narration", "categories", "primary_category", "era"]
}
```

Validate the response in code: if `primary_category` is not in `categories`, fix it to `categories[0]`.

### 10.2 Taste profile summary
- Trigger: every 25 new viable exposures with outcomes, or at the end of a trip/session, at most once per 24 h.
- Input: compact per-category stats (mean, evidence count) plus the last ~30 exposures (category, outcome). No raw narrations.
- Output: 2–3 sentences, stored in `profile_summary`.
- The prompt must state that the profile is **tentative**: use hedged language ("seems to enjoy…, still exploring…").

### 10.3 Narration prompt
Inject the latest profile summary into the narration prompt as soft guidance for emphasis and tone only. It must never cause the narration to omit the POI's actual notable facts.

## 11. Data Model

Adapt to the existing schema (Section 4). Target shape:

```sql
-- one row per distinct POI
poi_classification(
  poi_id TEXT PRIMARY KEY,          -- Wikidata QID, else stable hash of source + id
  categories TEXT NOT NULL,         -- JSON array of taxonomy ids
  primary_category TEXT NOT NULL,
  era TEXT NOT NULL DEFAULT 'unknown',
  source TEXT NOT NULL,             -- 'mapping' | 'llm'
  classified_at INTEGER NOT NULL
);

-- one row per time a POI was presented
exposures(
  id TEXT PRIMARY KEY,
  poi_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  suggested_at INTEGER NOT NULL,
  context TEXT NOT NULL,            -- JSON ExposureContext
  viable INTEGER NOT NULL,          -- 0/1
  blocked_reason TEXT,
  outcome TEXT NOT NULL DEFAULT 'ignored',
  outcome_at INTEGER,
  dwell_seconds INTEGER,
  narration_quality INTEGER,        -- 1..5, optional, never used for category stats
  stats_applied INTEGER NOT NULL DEFAULT 0   -- idempotency: outcome applied to stats?
);

category_stats(
  category TEXT PRIMARY KEY,
  alpha REAL NOT NULL,
  beta REAL NOT NULL,
  last_updated INTEGER NOT NULL
);

user_overrides(
  category TEXT PRIMARY KEY,
  state TEXT NOT NULL               -- 'muted'
);

profile_summary(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  based_on_exposures INTEGER NOT NULL
);
```

**Idempotency:** an outcome updates `category_stats` at most once per exposure (`stats_applied`). Changing an outcome later (e.g. 👍 → 👎) must reverse the earlier delta before applying the new one.

**Legacy migration (one-time):** for existing rated history, map ratings to outcomes: 4–5 → `liked`, 3 → `ignored`, 1–2 → `skipped` (deliberately **not** `not_interested`, because the old rating was ambiguous between taste and quality). Mark migrated exposures `viable = true` only if context was reconstructable, otherwise `viable = 0` so they don't pollute stats. Classify legacy POIs lazily (via mapping first, LLM only when they next surface).

## 12. Explicit User Controls (override learning)

1. **Mute category:** from the profile screen. Muted categories are excluded from ranking. This is the **only** hard filter in the system. Muting is reversible and shown clearly.
2. **Session mood chip** (shown on the main screen): `History` / `Nature` / `Surprise me` / none. A mood applies a `moodBoost = 1.5` to matching categories for the current session only. It **does not** update `category_stats` (choosing a mood is not a like). "Surprise me" forces the exploration behavior (highest-uncertainty category preferred, quality floor still applies).
3. **Reset profile:** clears `category_stats` and `profile_summary` (with confirmation). Does not delete exposure history.

## 13. UI Requirements

- **Feedback controls** on the narration/suggestion UI: 👍 "More like this", 👎 "Not my thing", plus an optional secondary star rating for narration quality. Large touch targets, usable at a glance.
- **Profile screen** ("What I've learned"): per category show mean preference, evidence count, and a clear "still learning" indicator for low-confidence categories; mute toggle; the latest profile summary text; reset button.
- **Debug view** (behind a dev flag): for the last N selections show candidate scores, multipliers, whether a diversity/exploration rule fired, and why a candidate was excluded.

## 14. Configuration (all in `preferences.config.ts`, no env vars needed)

```ts
export const PREF = {
  PRIOR_ALPHA: 2, PRIOR_BETA: 2,
  HALF_LIFE_DAYS: 75,
  MIN_EVIDENCE: 5,
  MULT_MIN: 0.7, MULT_MAX: 1.3,
  WEIGHT_LIKED: 1.0, WEIGHT_VISITED: 1.5, WEIGHT_NOT_INTERESTED: 1.0, WEIGHT_SKIPPED: 0.2,
  SECONDARY_CATEGORY_WEIGHT: 0.5,
  MAX_CONSECUTIVE_SAME_CATEGORY: 2,
  EXPLORATION_EVERY_N: 5,
  MOOD_BOOST: 1.5,
  POI_COOLDOWN_DAYS: 30,
  PROFILE_SUMMARY_EVERY_N_EXPOSURES: 25,
};
```

## 15. Acceptance Criteria (unit tests required)

Implement these as automated tests for the pure ranking/learning code (seed the random generator for determinism where needed).

1. **No premature lock-in (F1):** start from priors, apply 3 `liked` on `medieval_castles` only. With a pool of 10 castle and 10 nature POIs of equal `base_interest`, a simulated 20-pick session contains **at least 6 nature picks**.
2. **Bounded influence:** for any stats state, the learned multiplier is within `[0.7, 1.3]`; a candidate with ≥1.3× higher `base_interest` always outranks a lower one.
3. **Absence ≠ dislike (F2):** with zero exposures for `nightlife_social`, its stats are exactly the prior regardless of how many other exposures occurred or how long the app went unused (decay of a prior-state category is a no-op).
4. **Non-viable exposures ignored (F3):** a `not_interested`/`skipped` outcome on an exposure with `viable = false` leaves `category_stats` unchanged.
5. **Ignored is neutral:** `ignored` outcomes never change stats; `skipped` adds exactly `0.2` to `beta` of the primary category.
6. **Decay:** a category with `alpha = 8, beta = 2` and no updates for 75 days has evidence reduced by half (alpha ≈ 5, beta = 2).
7. **Idempotency:** applying the same outcome twice does not double-count; changing 👍 to 👎 reverses the earlier delta.
8. **Mute:** a muted category never appears in ranked output; unmuting restores it with its previous stats.
9. **Mood:** a mood boost changes the ordering for the session but leaves `category_stats` untouched.
10. **Diversity rule:** no sequence of more than 2 consecutive same-primary-category picks when alternatives exist.
11. **Exploration slot:** every 5th pick is from the highest-variance viable category and respects the quality floor.
12. **Categorization cache:** the same POI is classified at most once; the LLM is not called when the mapping table classifies the POI.
13. **Schema safety:** an LLM response with a category outside the enum is rejected/repaired and never stored.
14. **Rating separation (F4):** narration quality rating changes never affect `category_stats`.
15. **Legacy migration:** legacy ratings of 1–2 become `skipped` (not `not_interested`), 3 becomes `ignored`, 4–5 become `liked`.

## 16. Implementation Plan for the Agent

Follow the Git & Changelog workflow from the parent PRD (section 7.9): commit after each phase with a conventional message, add an entry to `CHANGELOG.md` under `[Unreleased]`, push to `main`.

1. Inspect existing rating/history implementation; write down in the changelog what exists and what will be extended.
2. Add `preferences.config.ts`, taxonomy enum, and types.
3. Add/migrate DB schema (Section 11) plus the legacy migration.
4. Implement `categoryMapping.ts` (Wikidata P31 / OSM → taxonomy) and the classification service with cache (Section 10.1).
5. Extend the narration call to return the structured JSON (narration + categories + era) with schema validation.
6. Implement the learning module: update rule, decay, idempotency (Sections 7, 11).
7. Implement the pure `rankCandidates` pipeline: viability, multiplier, overrides, diversity, exploration, cooldown (Sections 8, 9, 12).
8. Wire ranking into the driving-mode loop and walking-mode button flow from the parent PRD.
9. Implement feedback UI (👍/👎/stars), mood chip, profile screen, debug view (Section 13).
10. Implement the profile summary job and inject it into the narration prompt (Section 10.2–10.3).
11. Write the automated tests from Section 15 and make them pass.
12. Final pass: update README (how preferences work), CHANGELOG, push to `main`.

## 17. Open Questions for the Future (do not implement now)

- Contextual taste (daypart/season/weather) using the logged context, learned as small corrections that start from the global estimate and only deviate with strong evidence.
- The "browse for inspiration" flow reusing `rankCandidates` with `mode = 'browse'` and an explicit time budget.
- Era-based preferences using the stored `era` field.
- Optional on-device backup/export of the profile.
