# Along — BYOP PowerPoint (2 slides)

Copy-paste source for the Engineering Exchange **Bring Your Own Project** deck.  
Layout: **¾ main + ¼ sidebar** on both slides.  
Audience: **reviewers** (self-explanatory; you may not present live).

Related: voiceover / YouTube / demo VO → [`pitch-narration-byop.md`](./pitch-narration-byop.md)  
Screen capture detail → [`screens/README.md`](./screens/README.md)

**Submission assets** (kept out of repo root):

| File | Path |
|------|------|
| Slides (PDF) | [`byop/Slides.pdf`](./byop/Slides.pdf) |
| Demo video | [`byop/Along-demo.mp4`](./byop/Along-demo.mp4) |
| Concept trailer | [`byop/Along-trailer.mp4`](./byop/Along-trailer.mp4) |

**Last reviewed:** 2026-11-05

---

## Slide strategy

| Slide | Job | Main (¾) | Sidebar (¼) |
|-------|-----|----------|-------------|
| **1** | What is Along + 3 live modes | Around / Drive / History phones + short intros | Built with (logo + role) |
| **2** | How it thinks + Plan + Sapient | Pipeline diagram **on top** + Plan (+ supporting) phones | Slingshot + engineering notes |

Slide 1 = product. Slide 2 = engineering + the mode Slide 1 skipped (**Plan**).

**Do not put the pipeline in the sidebar** — a ¼ column crushes a flow diagram. Keep the same phone rhythm as Slide 1 in the lower main; put the diagram in a full-width band above those phones.

---

## Slide 1 — “Missed road → Along” *(as built)*

**Header bar**

- Left: logo + `Along: the guide that rides with you.`
- Center: `A to B shouldn’t mean forgetting everything in between.`
- Right: `Watch trailer` → YouTube (concept / pitch cut)

**Main**

- Line under header: `Personalized spoken stops along A→B. Maps navigates. Along narrates.`
- Three phones + one short paragraph each (optional readers):

**Around** — “What’s near me?” one-tap story  

> When you’re walking or stopped, one tap answers “what’s interesting near me?” Along finds nearby places, picks one worth your time, and speaks a short story — with optional extras listed quietly if you want more.

**Drive** — “Coming up” teaser before you pass it  

> On the move, Along looks ahead on your heading — not behind you. You get a Coming up teaser in time to decide, then the full spoken story before you’ve already passed. That’s the stop normal navigation never pitches.

**History** — thumbs-up/down taste that personalizes the next trip  

> Every narration lands here. Thumbs up or down feed a taste model, so the next trip skews toward what you actually like — not a generic tourist list.

- Footer: `Not navigation. An ambient audio companion for driving & walking.`

**Sidebar — “Built with:”** (logo + one-line role)

| Item | Role line |
|------|-----------|
| React Native | Mobile app |
| Gemini | writes spoken scripts |
| Sapient Slingshot | orchestrates Around narration |
| Clef | helps pick which place |
| Wikipedia / Wikidata / OSM | discover places |
| Open-Meteo | weather caveats |
| Google Places / Maps | map + hours |

**Screenshot checklist (Slide 1)**

| Shot | Capture |
|------|---------|
| Around | Map + Around me + story card |
| Drive | **Coming up** card (title / ETA / Skip) — not “looking for places…” |
| History | List + 👍/👎 |

---

## Slide 2 — recommended layout

### Why this layout (vs “3 phones + diagram in sidebar”)

- Reviewers already saw Around / Drive / History on Slide 1 — don’t repeat the same trio.
- The **pipeline is the Slide 2 hero**; it needs horizontal space → **main band**, not sidebar.
- **Plan** belongs here: browse / inspire / A→B cache, feeds taste, does **not** narrate.
- Sidebar = **Slingshot + engineering callouts** (Sapient product proof for Q7/Q8).

### Wireframe

```
┌──────────────────────────────────────────────┬────────────────────┐
│ Header (same pattern as Slide 1)             │                    │
├──────────────────────────────────────────────┤  SIDEBAR           │
│ Title + one-line subtitle                    │  Sapient Slingshot │
│                                              │  + engineering     │
│ [==== PIPELINE DIAGRAM (full main width) ====]│  notes             │
│                                              │                    │
│  [Plan phone]  [Drive story]  [Around mood]  │                    │
│   + paragraph   + paragraph    + paragraph   │                    │
│                                              │                    │
│ Footer: Plan ≠ Drive ≠ Around (one line)     │                    │
└──────────────────────────────────────────────┴────────────────────┘
```

If three phones feel tight under the diagram, drop the third phone and keep **Plan + Drive full-story** only; diagram still stays in main.

---

## Slide 2 — copy-paste content

**Header bar**

- Left: logo + `Along: how it decides what to say`
- Center: `Real pipeline. Real Slingshot step. Real app.`
- Right: optional `Watch demo` if you host the screen-recording separately (else omit)

**Main — title / subtitle**

- Title: `From GPS → story → voice`
- Subtitle: `Live product path — with Sapient Slingshot as an orchestrated narration option for Around`

### Pipeline diagram (main, top band)

Draw five boxes left → right (arrows between):

```
Location / heading
  → Discover POIs
       (Wikipedia + OSM + Wikidata)
  → Rank / decide
       (taste + optional Clef)
  → Write script
       Gemini  |  OR Slingshot*
  → Speak
       (on-device TTS)
```

Footnote under the diagram (small):  
`*Around can run via Sapient Slingshot: weather → pick → details → narration → package. Drive stays on the local path (latency).`

Optional visual: highlight the **Write script** box with a split — left “Local · Gemini”, right “Slingshot · workflow”.

### Three columns (same rhythm as Slide 1)

**Plan** — browse before you move  

> At home or on hotel Wi‑Fi: suggest a timed loop, or prefetch places along A→B. Plan is browsing and caching — it feeds taste with 👍/👎, but it does not speak stories. Drive still decides what’s ahead from live heading; Plan is optional fuel, not a forced stop list.

**Drive** — teaser → full story  

> After Coming up, Along can deliver the full narration while you’re still approaching. Same discovery → rank → script → TTS path as Around, keyed to motion and heading so the story arrives before the missed-road moment.

**Around** — mood + spoken now  

> Session mood (History / Nature / Surprise) steers what “interesting” means right now. This is also the path that can call **Slingshot** instead of the local Gemini-only write step — same app UI, orchestrated backend.

*(If only two phones: keep **Plan** + **Drive**; fold the Around/Slingshot sentence into the sidebar.)*

**Footer (one line)**  
`Plan ≠ commitment to drive · Drive ≠ Plan queue · Around ≠ Drive`

### Sidebar — “Engineering notes” / Slingshot

Lead with a short Slingshot block (accent / Sapient branding):

**Sapient Slingshot**  
Orchestrates the Around narration chain as a real workflow inside the product — not a slideware demo.  
`weather → pick → details → narration → package`

Then bullets:

- **Gemini** — spoken script (guide tone, not a wiki dump)
- **Clef** — optional: decide *which* POI from a shortlist
- **Taste** — 👍/👎 from History, More nearby, and Plan
- **Guardrails** — weather caveats, opening hours when known, per-trip LLM budget
- **Dual track** — `NARRATION_BACKEND=local|slingshot`; Drive always local

---

## Screenshot checklist (Slide 2)

| Shot | Screen | Capture this | Why |
|------|--------|--------------|-----|
| F | **Plan** | Loop result **or** A→B list on map + 👍/👎 | New mode vs Slide 1 |
| D | **Drive** | Full story card after Coming up (or Coming up + story composite) | Completes Drive loop |
| E | **Around** | Mood radios visible + story (or More nearby) | Session taste + Slingshot-capable surface |

**Capture tips:** Plan needs a completed Suggest a loop or corridor prefetch. Same phone frame size as Slide 1. Don’t show Google branding in screenshots beyond the Maps SDK map tiles you already use in-app.

---

## What to avoid

- Repeating the exact Around / Drive / History trio on Slide 2
- Putting the full pipeline in the ¼ sidebar
- Long narration text under phones (one short paragraph max — same as Slide 1)
- Making both sidebars logo grids — Slide 1 = stack inventory; Slide 2 = Slingshot + how

---

## Freshness notes

| Topic | Status |
|-------|--------|
| Slide 1 = Around / Drive / History + labeled stack | As built 2026-11-05 |
| Plan on Slide 2, not Slide 1 | Intentional |
| Slingshot = Around path; Drive local | Current |
| Plan = browse/cache, no Gemini narration on Plan itself | Current |
| Pipeline diagram in main | Recommended |
