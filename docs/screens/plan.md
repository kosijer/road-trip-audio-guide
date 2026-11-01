# Plan

**Tab:** Plan  
**Code:** `src/screens/PlanScreen.tsx` → `runInspireLoop` / `runPrefetch` (corridor)  
**Moment:** At home / café / hotel Wi‑Fi — **before** you necessarily move.

## Purpose

**Planning and browsing**, not “I am driving this second.”

1. **Loop (Inspire)** — “I have N minutes, walk or drive — suggest a loop.”  
2. **A → B** — prefetch interesting places along a corridor for later / offline.

You can like/dislike places here to feed the taste profile without starting a trip.

## Mental model

- Plan answers: *what could I see?*  
- Drive answers: *what’s coming up on my heading right now?*  
- A Plan cache **may** help Drive discovery later, but Drive does **not** treat Plan as a forced stop list.  
- New Plan run **replaces** the single shared `PrefetchBatch`.  
- Walking inspire loops are marked so they don’t become the car Drive stack.

Hours filtering on Plan browse is less meaningful than on Around/Drive (you’re not going *this minute*); product note: keep/change later — Around/Drive still enforce closed venues when it matters live.

## What the user sees

### Loop tab

- Optional origin (empty = current GPS)  
- Walk / Drive  
- Time budget slider (20 min – 5 h)  
- **Suggest a loop**  
- Map + ordered stops; then automatic nearby cache prefetch  

### A → B tab

- Origin / destination  
- How many places to keep (5 / 12 / 25 / 50)  
- Prefetch progress  
- Map + accordion of kept places + 👍/👎  

## Flow — Inspire loop

```
Suggest a loop
  → resolve origin
  → search radius from mode × budget
  → discover POIs (Wiki/OSM/…)
  → classify + rankCandidates (prefs + mood, browse)
  → pick 2–4 spatially separated stops
  → order nearest-neighbor (loop-ish)
  → prefetch/cache around stops → PrefetchBatch kind=loop
```

**No Gemini narration** on Plan itself — only discovery + ranking + cache.

### Budget → geometry (summary)

- Walk ~4.5 km/h, drive ~35 km/h (planning speed)  
- Radius and stop count grow with budget (cap 4 stops)

## Flow — A → B corridor

```
Enter A and B
  → Google Directions polyline
  → sample along route
  → Wikipedia(+Wikidata) per sample (prefetch path skips flaky Overpass)
  → rank / keep top N places
  → PrefetchBatch kind=corridor
```

## Example — Loop, 90 minutes, Walk, mood History, Belgrade

**User intent:** Sunday afternoon stroll; curious about history; not leaving yet.

**Inputs**

- Origin: empty → GPS / debug Belgrade  
- Mode: Walk  
- Budget: 90 min  
- Mood: History  

**Rough math**

- Tour length ≈ 4.5 km/h × 1.5 h ≈ 6.8 km  
- Search radius on the order of a few km  
- Stop count: mid budget → often **3** stops  

**Illustrative ranked stops**

| Order | Place | Category bias |
|-------|--------|----------------|
| 1 | Kalemegdan Fortress | medieval / military |
| 2 | Cathedral of Saint Sava (approach) | religious / landmark |
| 3 | Skadarlija | local culture (if still in pool after history bias) |

**What is stored**

`PrefetchBatch`:

- `kind: 'loop'`, `mode: 'walking'`, `budgetMin: 90`  
- `stops`: ordered 2–4  
- `pois`: broader cached set around those stops  

**UI**

- Map pins for stops  
- Accordion: title, distance-ish metadata, 👍/👎  
- Status: loop ready, N stops (+ cache count)

**Taste**

User 👍 Kalemegdan, 👎 a generic shop that slipped in → updates Beta category stats for later Drive / More nearby / future loops.

## Example — A → B, London → Westminster, keep 12

**APIs**

1. **Directions API** — route geometry  
2. **Wikipedia GeoSearch** (+ Wikidata) along samples  
3. Local rank → keep 12  

**Illustrative kept set (subset)**

1. Trafalgar Square  
2. Admiralty Arch  
3. Churchill War Rooms  
4. Westminster Abbey  
5. Big Ben / Elizabeth Tower  
… up to 12  

User browses on Wi‑Fi, likes Abbey + War Rooms. Later in the car, Drive may *optionally* see those cached POIs if they fall in the heading cone — still not a forced itinerary.

## What Plan does *not* do

- No turn-by-turn  
- No automatic Start Trip  
- No coming-up teasers  
- No Gemini story while planning (stories happen on Around / Drive)

## Slide checklist

- [ ] Plan = homework / inspiration  
- [ ] Loop vs A→B two columns  
- [ ] Belgrade 90‑min walk example with 3 stops  
- [ ] PrefetchBatch shared but Drive remains heading-based  
