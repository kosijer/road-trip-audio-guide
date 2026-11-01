# Design: Drive v2 — proactive “coming up” queue

**Status:** Approved for implementation  
**Date:** 2026-11-01  
**App:** Along (road-trip-audio-guide)

## Summary

Replace Drive’s “every N minutes / new cell → immediate full narration” with a **single-slot queue**: short spoken teaser for a place ahead on your heading, a brief silence hold (Skip cancels), then full narration if the user does not skip. Selection uses a **narrow forward cone first**, then a **wider detour cone**. Drive does **not** depend on Plan’s prefetch batch.

## Product framing (tab roles)

| Tab | Moment | Job |
|---|---|---|
| **Plan** | At home / ahead of time | Browse what you *could* see A→B or as a loop; feed taste via like/dislike. Not a promise you will drive it now. |
| **Drive** | In the car after Start Trip | Periodic heading-based detour suggestions; you need not stop at every one. |
| **Around** | Here and now | What’s near me right now (plaza, unknown city). |

**Hours / closed venues:** keep filtering on **Around** and **Drive**. Plan may keep current behavior for now (cleanup later is out of scope). Plan is not “this moment,” so Sunday-evening closed logic is less meaningful there — noted only; no Plan change in this feature.

**Around “More nearby”:** conceptually a follow-up after “Around me.” Today the button is always available; gating it is a **small UX follow-up**, not part of this Drive v2 implementation.

## Goals

- Announce interesting places **ahead on the user’s heading** with ETA/distance in the teaser text.
- Teaser → hold (silence = continue) → full story; Skip aborts before full.
- Two-tier spatial search: narrow corridor, then wider detour.
- Reuse preference ranking (`rankCandidates`), mood, hours/weather policies already used on Drive.
- Keep Plan and Drive decoupled (no Plan batch required for the queue).

## Non-goals

- Binding Drive queue to Plan / Inspire itinerary stops
- Voice commands (“skip”, “tell me more”)
- Android Auto
- Contextual (daypart/weather) taste learning
- Changing Plan hours policy
- Gating Around “More nearby” (document only; separate small fix)
- In-app turn-by-turn / injected Google Maps routes

## Decisions (from brainstorm)

1. **Selection model:** heading-based ambient / detour POIs (not Plan stops).
2. **Playback:** short teaser, then full narration only if not skipped.
3. **Confirm:** silence after teaser = continue; Skip button cancels.
4. **Geometry:** narrow cone first; if empty, wider detour cone.
5. **Timing:** announce when a place enters the lookahead corridor; ETA appears in teaser copy (not a separate early+late double announce).
6. **Architecture:** dedicated Drive queue state machine (not a thin patch on the old interval→narrate path).

## State machine

At most **one** active slot while `tripActive && moving`:

```
idle → selecting → teaser → hold → full → cooldown → idle
                 ↘ skipped ↗
```

| Phase | Behavior |
|---|---|
| `idle` | Waiting for next select (after cooldown / empty search). |
| `selecting` | Bearing from recent GPS samples → discover → narrow cone → else wide cone → rank → pick one. |
| `teaser` | Template TTS (no LLM): name + rough ETA/distance + side (left/right/ahead). Drive UI shows Coming up + Skip. |
| `hold` | ~8–12 s silence. Skip → `skipped`. No Skip → `full`. |
| `full` | Existing Gemini + TTS narration pipeline; 👍/👎 as today. |
| `skipped` | Exposure outcome `skipped`; short cooldown on that POI; back toward `idle`. |
| `cooldown` | POI marked narrated / cooldown; enforce minimum gap before next `selecting`. |

**End Trip / Stop TTS:** cancel hold timer, reset queue to `idle`.

**Concurrent ticks:** if a slot is already in `teaser|hold|full`, ignore new select attempts.

## Algorithm

### Heading

- Derive bearing from the last few motion samples (same buffer `tripEngine` already keeps for speed).
- If bearing is unreliable (stationary, insufficient samples, GPS jump) → do not select; stay idle until reliable.

### Cones (config constants)

Exact numbers tunable in config; starting defaults:

- **Narrow:** half-angle ~25°, lookahead ~3–5 min equivalent distance (or ~3–5 km at speed).
- **Wide detour:** half-angle ~60°, lookahead ~8–12 min / larger max distance.
- Discard POIs behind the vehicle (outside forward cone).

### Candidate pipeline

1. Discover POIs near current position (live + local cache as today’s driving discovery — **do not require** `PrefetchBatch`).
2. Filter narrated-in-cooldown / already suggested this trip.
3. Apply narrow cone; if none, apply wide cone.
4. Hours + weather policies (same as current Drive).
5. Classify + `rankCandidates` with session mood and preference profile, `mode: 'driving'`.
6. Take top 1 → enter `teaser`.

### Teaser copy

- Local template in UI language (EN/SR), **no Gemini call**.
- Include: title, approximate ETA or km, side if computable.
- Example: “Coming up in about 3 minutes on your right: Knossos.”

### Hold → full

- Default hold **10 s** (`DRIVE_TEASER_HOLD_MS`, configurable).
- After hold: run existing full narration path for that POI (Gemini, LLM cap, local fallback).
- Skip during teaser or hold: stop TTS, mark `skipped`, no full generation for that slot.

## Components & data

### New / extended modules

- `src/services/headingCorridor.ts` — bearing, cone filter, ETA helper (pure + unit-tested).
- `src/services/driveQueue.ts` — state machine, hold timer, skip, coordinates with narration/TTS.
- `src/services/tripEngine.ts` — `drivingTick` calls `driveQueue.onTick(sample)` instead of interval/cell → immediate `maybeNarrate`. Keep `maybeNarrate` for Around / Next.
- `src/screens/DriveScreen.tsx` — Coming up card (title, ETA/km, side, Skip); after full, existing `PlaceStoryCard`.
- `TripStatus` — e.g. `drivePhase`, `upcomingPoi` `{ id, title, lat, lon, etaMin?, distanceM?, side? }`, `teaserText` for UI.
- `config` / `.env` — `DRIVE_TEASER_HOLD_MS`, cone half-angles, lookahead distances.

### Unchanged

- Plan UI and `PrefetchBatch` semantics (planning + taste only for this feature’s purposes).
- Preference store / learning APIs.
- Around primary “Around me” flow (aside from the noted follow-up for More nearby).

### Exposures

- Creating a teaser opens (or attaches to) an exposure with `mode: 'driving'` and viability as today’s driving rules.
- Skip → outcome `skipped`.
- Full story → existing liked / not_interested / ignored / visited handling.
- Narration quality stars remain separate from taste.

## Errors

| Case | Behavior |
|---|---|
| No reliable heading | No select; silent retry next tick. |
| No candidates in either cone | Stay idle; no toast spam. |
| Discovery network failure | Log; try cache; else idle. |
| TTS fails on teaser | Keep Coming up UI + Skip; after hold still attempt full; if full fails, short cooldown on that id to avoid loops. |
| LLM cap hit | Teaser still allowed; full uses local fallback. |
| Offline | Teaser from cached POIs if any; full via local fallback / skip LLM as today. |

## Tests

- Cone geometry: ahead-narrow accepted; off-side only in wide; behind rejected.
- Narrow-empty → wide fallback.
- ETA helper from distance + speed.
- State transitions: teaser → hold → full; Skip in hold → skipped; End Trip resets.
- Selecting ignored while slot busy.
- Ranking still prefers higher preference scores when multiple cone candidates exist.

## Implementation order

1. `headingCorridor` helpers + unit tests.  
2. `driveQueue` state machine + unit tests (timer mocked).  
3. Wire `drivingTick` + `TripStatus` fields; retire interval/cell immediate-full as the primary Drive path.  
4. DriveScreen Coming up UI + Skip + i18n.  
5. Exposure outcome on skip; smoke on device (motion + fake location presets).

## Follow-ups (explicitly later)

- Gate Around “More nearby” until after at least one “Around me” this session.  
- Soften or remove hours filtering on Plan browse.  
- Voice skip / tell-me-more.  
- Optional: use Plan corridor only as *extra* candidate pool without making Drive depend on it.
