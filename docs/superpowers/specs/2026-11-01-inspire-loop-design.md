# Design: Plan Inspire loop + Around “5 more”

**Status:** Approved for implementation  
**Date:** 2026-11-01  
**App:** Along (road-trip-audio-guide)

## Summary

Add inspiration to **Plan** as a loop builder (time budget + walk/drive) that produces 2–4 stops and **prefetches** them into the existing route cache. Add a smaller **Around** control that lists five more nearby suggestions without auto-playing TTS for all of them.

## Goals

- Answer “where should I go?” with a concrete mini-itinerary, not a single Around tap.
- Reuse `rankCandidates` with `mode: 'browse'`, session mood, and preference profile.
- Feed **Drive** the same way today’s A→B Plan does (one active `PrefetchBatch`).
- Keep Around’s spoken “what’s around” primary; “5 more” is a secondary list.

## Non-goals

- In-app turn-by-turn
- Multiple saved loops / inspire history
- Contextual taste learning
- Drive v2 proactive “coming up in 2 min” queueing

## UX

### Plan tab (two sections)

1. **Inspire (top)**  
   - Optional origin (empty = current GPS), same as corridor Plan  
   - Walk / Drive radios  
   - Budget slider **20 min – 5 h**  
   - CTA: Suggest a loop  
   - Result: map + ordered stops, then automatic prefetch into the shared route cache  

2. **A → B corridor (existing, below)**  
   - Unchanged origin / destination / places-to-keep / prefetch  

One active route cache app-wide: a new Inspire run **replaces** the previous batch (same as running a new A→B prefetch).

### Around tab

- Secondary button below the main walk flow / last story: **5 more nearby**  
- Shows up to 5 cards (title, distance, open in Maps)  
- Skips recently narrated / currently shown place  
- No auto TTS for the whole list  

## Algorithm

### Budget → search parameters

- Effective speed: walk ≈ 4.5 km/h, drive ≈ 35 km/h (urban mixed).  
- Tour length ≈ speed × budget.  
- Search radius ≈ clamp(0.35 × tour length), with mode mins/maxes (walk ~0.8–8 km, drive ~3–80 km).  
- Stop count: 2 for short budgets, 3 medium, 4 for long (cap 4).

### Stop selection

1. Resolve origin to coordinates.  
2. Discover POIs within search radius.  
3. Classify + `rankCandidates` with session mood, prefs, `mode: 'browse'`, `timeBudgetMin` logged on exposures when narrated later.  
4. Pick 2–4 stops with a **minimum separation** so they are not clustered.  
5. Order with greedy nearest-neighbor from origin; conceptually return toward start (loop).  
6. Prefetch/cache POIs around those stops (and optional midpoints) into `PrefetchBatch` (`origin` = start label, `destination` = loop label).  
7. Update `prefetchCount` / status message like today’s Plan.

### Around “5 more”

1. Current location + walking radius (or slightly larger).  
2. Discover → preference rank, limit 5.  
3. Exclude narrated-in-cooldown and the last focal POI.  
4. Render list only.

## Data

- Extend or tag `PrefetchBatch` lightly if needed (`kind: 'corridor' | 'loop'`) without breaking Drive.  
- Exposure context already allows `mode: 'browse'` and `timeBudgetMin`.

## Errors

- GPS / origin failure → clear message, no partial loop.  
- Too few POIs → fewer stops or “not enough places nearby”.  
- Network / directions failure → reuse Plan network failure copy.  

## Tests

- Budget/mode → radius and stop count.  
- Nearest-neighbor ordering.  
- Mood/prefs influence inspire picks when candidates exist.  
- Around “5 more” excludes narrated ids.

## Implementation order

1. Pure helpers: radius, stop count, spatial pick, NN order (+ unit tests).  
2. `runInspireLoop` service + store batch.  
3. Plan Inspire UI + i18n.  
4. Around “5 more” UI + ranking helper.  
5. Wire status/prefetchCount; smoke on device/emulator.
