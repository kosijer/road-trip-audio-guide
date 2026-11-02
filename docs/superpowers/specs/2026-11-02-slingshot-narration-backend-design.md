# Design: Slingshot narration backend switch (v1)

**Status:** Implemented (v1)  
**Date:** 2026-11-02  
**App:** Along (road-trip-audio-guide)

## Summary

Add a config-driven backend switch so Around / `narrateNext` (walking) can run either the existing **local** pipeline or a **Slingshot** workflow that returns a packaged narration JSON. Drive and long-term product development stay on the local path. Slingshot is a presentation / demo track that can be toggled off without removing local code.

## Goals

- Demo Along + Sapient Slingshot at work by end of week.
- Keep day-to-day / post-demo development independent of Slingshot (`local` default).
- One clear env switch: `NARRATION_BACKEND=local|slingshot`.
- Reuse the existing Road Guide v1 workflow contract (`Package Result` stdout).

## Non-goals (v1)

- Drive mode via Slingshot (latency ~15–20s is too slow for “coming up”).
- Inspire / Plan via Slingshot.
- Silent fallback to local when Slingshot fails (demo should fail visibly; optional later).
- MCP tools, multi-mode Switch/If-Else inside one mega-workflow.
- Replacing on-device TTS, GPS, or trip UI.

## Dual-track intent

| Track | Backend | Purpose |
|---|---|---|
| Presentation | `slingshot` | Show workflow orchestration (weather → pick → details → narration → package) |
| Product | `local` | Continue Along development without Studio / credits / PAT dependency |

After the presentation, default remains `local`; Slingshot code can stay behind the flag.

## Config

```env
NARRATION_BACKEND=local
SLINGSHOT_PAT=
SLINGSHOT_BASE_URL=https://sapientaiproducts.com/save/api/v1
SLINGSHOT_TASK_ID=996918d7-c866-41da-98a9-fcb8808d72e0
SLINGSHOT_WORKFLOW_ID=293b6e2e-5dd6-470a-99ba-6e3c8f1bfc29
```

- Wire through `src/types/env.d.ts` and `src/config.ts` (same pattern as `CLEF_ENABLED` / `LLM_PROVIDER`).
- `NARRATION_BACKEND` normalized to lowercase; anything other than `slingshot` → `local`.
- Missing PAT / IDs while `slingshot` is selected → clear error message, no run.

## Runtime behavior

### When `local`

Unchanged: discover → rank (/Clef) → weather extras → `generateNarration` → TTS / history.

### When `slingshot`

Only for **walking** Around path (`narrateNext` / `narrateOnce` with `mode === 'walking'`).

1. Resolve real GPS (same weather-location preference as today when debug POI pin is on).
2. POST `/tasks/{taskId}/runs` with overrides:
   - `workflow`: `SLINGSHOT_WORKFLOW_ID`
   - `variables`: `latitude`, `longitude`, `language`, `mood`, `mode=walk`, `radiusMeters` (from `walkingPoiRadiusM` or override)
3. Poll GET `/tasks/{taskId}/runs/{runId}` until `completed` / `failed` / timeout.
4. Read `exec_metadata.allOutputs[*]["Package Result"].data.stdout`, `JSON.parse`.
5. Speak `narration.script`; record history from `place` + excerpt.
6. Mark narrated id as `wiki:{pageid}` (stable with Wikipedia source).

Driving / Drive queue / `narrateFixedPoi` always stay local regardless of flag.

## Architecture

```text
config.narrationBackend
        │
        ├─ local ──► existing tripEngine path
        │
        └─ slingshot + walking
                └── slingshotClient.runRoadGuide(input)
                        → PackageResult
                        → deliverSlingshotNarration (TTS + history)
```

Suggested files:

- `src/services/slingshot/client.ts` — auth, start run, poll, extract Package Result
- `src/services/slingshot/types.ts` — input / Package Result types
- Thin branch at start of walking `narrateOnce` (or small helper) — avoid rewriting Drive

## Package Result contract (already verified)

```json
{
  "ok": true,
  "input": { "latitude": 0, "longitude": 0, "language": "en", "mood": "curious", "mode": "walk", "radiusMeters": 2000 },
  "weather": { "summary": "...", "rainRisk": "none|low|medium|high", "rainingNow": false, "suggestions": [], "caution": null },
  "place": { "pageid": 0, "title": "...", "lat": 0, "lon": 0, "distMeters": 0, "why": "...", "fitsWeather": true },
  "narration": { "script": "...", "wordCount": 0, "placeTitle": "...", "language": "en" }
}
```

App v1 requires `ok === true` and non-empty `narration.script`.

## Error / UX

- Show status message while polling (“Asking guide…” / existing busy pattern).
- On timeout / failed run / missing Package Result: user-visible failure string; do not auto-fallback to local in v1.
- Count toward `MAX_LLM_CALLS_PER_TRIP` or a separate Slingshot counter? **v1:** increment the same LLM call counter once per successful Slingshot narration (keeps one trip budget knob).

## Security

- PAT only in `.env` / `@env` (never commit).
- Rotate any PAT that was pasted into chat before the demo.
- Do not log full PAT or full run payloads in production logs.

## Test plan

- `NARRATION_BACKEND=local` → Around unchanged.
- `=slingshot` with valid env → Around returns script and speaks; history row created.
- `=slingshot` with bad PAT → visible error, no crash.
- Drive with `=slingshot` → still local Drive path.
- Unit-test Package Result parser with fixture stdout JSON.

## Follow-ups (after presentation)

- Optional `SLINGSHOT_FALLBACK_LOCAL=true`
- Workflow Switch on `mode` for future Drive/Plan demos
- Language-specific Wikipedia host (`sr.wikipedia.org`)
- Drop or archive Slingshot path if unused
