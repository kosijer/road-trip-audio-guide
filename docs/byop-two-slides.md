# Along — BYOP PowerPoint (2 slides)

Copy-paste source for the Engineering Exchange **Bring Your Own Project** deck.  
Layout: **¾ main + ¼ sidebar** on both slides.

Related: voiceover / YouTube / demo VO → [`pitch-narration-byop.md`](./pitch-narration-byop.md)  
Screen capture detail → [`screens/README.md`](./screens/README.md)

**Last reviewed:** 2026-11-04 (aligned with current app: Around / Drive / Plan / History, Slingshot on Around, Drive sim gated to active trips, open POI sources = Wikipedia + OSM + Wikidata).

---

## Slide strategy

| Slide | Job | Main (¾) | Sidebar (¼) |
|-------|-----|----------|-------------|
| **1** | Problem → product → modes | Idea + 3 screenshots (Around / Drive / History) | Stack overview |
| **2** | How it thinks + Sapient angle | Pipeline flow + 1–2 hero shots | Deep tech + Slingshot callout |

Judges skim slides after the video — Slide 1 sells *what*, Slide 2 sells *how / why Sapient*.

---

## Slide 1 — “Missed road → Along”

**Title:** `Along — the guide that rides with you`  
**Subtitle:** `Personalized spoken stops along A→B. Maps navigates. Along narrates.`

**Main (¾) — three phone frames:**

1. **Around** — “What’s near me?” one-tap story  
2. **Drive** — “Coming up” teaser before you pass it  
3. **History** — 👍/👎 taste that personalizes the next trip  

**Caption under the trio:**  
`Not navigation. An ambient audio companion for driving & walking.`

**Sidebar (¼) — “Built with”:**

- React Native (Android)
- Google Gemini
- Sapient Slingshot
- Cloudflare Clef (optional)
- Wikipedia / OpenStreetMap / Wikidata
- Google Places + Maps SDK
- Open-Meteo (weather)
- On-device TTS
- Preference learning (👍/👎)

**Screenshot checklist:**

| Shot | Screen | Capture this | Why |
|------|--------|--------------|-----|
| A | **Around** | Map + “Around me” + story card | Instant “what is it” |
| B | **Drive** | Active trip + **Coming up** (title, ETA, Skip) | Differentiator vs maps |
| C | **History** | Past item + 👍/👎 | Personalization proof |

**Capture tips:** Settings → debug location (London / Notting Hill / Belgrade); enable simulate motion only for the Drive shot (Start Trip); crop status-bar noise; same phone frame size on all three.

**Headline options (pick one):**

- `Hear what you’re missing — while you can still turn`
- `A to B shouldn’t mean forgetting everything in between`

---

## Slide 2 — “How Along decides what to say”

**Title:** `From GPS → story → voice`  
**Subtitle:** `Live product pipeline — with Slingshot as an orchestrated narration path`

**Main (¾) — horizontal flow:**

```
Location / heading
  → Discover POIs (Wikipedia + OSM + Wikidata)
  → Rank / decide (taste + optional Clef)
  → Write script (Gemini)  OR  Slingshot workflow*
  → Speak (on-device TTS)
```

\*Footnote:  
`*Around can run via Sapient Slingshot: weather → pick → details → narration → package`

**Extra phone shots:**

| Shot | Screen | Capture this | Why |
|------|--------|--------------|-----|
| D | **Drive** | Coming up → full story (hero) | Completes the Drive loop |
| E | **Around** (optional) | Mood radios + result | “Taste now”, not only History |

If only one extra shot: pick **D**.

**Sidebar (¼) — “Engineering notes”:**

- **Slingshot:** workflow orchestration for Around narration (demo track)
- **Clef:** optional decide *which* POI to narrate
- **Gemini:** spoken script, not a wiki dump
- **Taste:** preference ranking from 👍/👎 (History + More nearby / Plan)
- **Drive ≠ Plan:** heading + live discovery; Plan is optional fuel
- **Guardrails:** weather caveats, hours when available, trip LLM budget

Highlight **Slingshot** (accent / “Publicis Sapient”) so Q7/Q8 is obvious.

**Headline options:**

- `AI that picks, writes, and speaks — in time to detour`
- `Real pipeline. Real Slingshot step. Real app.`

---

## Layout sketch

```
┌────────────────────────────────┬────────────┐
│  Title + one-line pitch        │  SIDEBAR   │
│                                │  tech list │
│  [screens / flow]              │  (¼ width) │
│                                │            │
│  short captions only           │            │
└────────────────────────────────┴────────────┘
```

Keep body copy to **headlines + labels**. Video carries emotion; slides carry clarity.

---

## What to avoid

- Don’t put **Plan** as a fourth phone on Slide 1 (crowds the story; Plan is secondary for judges)
- Don’t dump full narration text on slides
- Don’t make both sidebars identical — Slide 1 = stack inventory, Slide 2 = how / Sapient

---

## Freshness notes (vs earlier chat draft)

Still accurate overall. Small updates applied here:

| Topic | Status |
|-------|--------|
| Modes Around / Drive / History | Current |
| Slingshot = Around path | Current |
| POI sources named (Wiki / OSM / Wikidata) | Clarified (was “open knowledge sources” in VO only) |
| Clef optional | Clarified |
| Drive simulate motion | Tip: only during active Drive trip |
| Debug pins | London / Notting Hill / Belgrade / Westminster |
| Plan | Still omit from Slide 1 phones (correct) |
| Weather | Open-Meteo still right; header weather icon exists but optional on slides |
