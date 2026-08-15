# Donegal Golf Weekend

A mobile-first scoring app for a 4-player golf weekend: two days, two courses, two
separate Stableford competitions. No login — just share the links.

## Stack

- React + Vite
- Supabase (Postgres + Realtime)
- Deploy target: Vercel

## Project structure

```
src/
  lib/
    supabase.js    Supabase client
    data.js        All Supabase queries (courses, holes, players, teams, scores)
    entrants.js    Normalizes Day 1 players / Day 2 teams into one shape
    scoring.js      Stableford points + strokes-received logic (pure functions)
  pages/
    Landing.jsx     Day 1 / Day 2 switcher
    Setup.jsx       Courses, players, teams (one-time setup)
    DayLeaderboard.jsx  Live leaderboard, per day
    DayScorer.jsx   Hole-by-hole score entry, per day
  components/
    TopBar.jsx
  hooks/
    usePullToRefresh.js
```

Day 1 and Day 2 are fully separate routes/pages/leaderboards. Setup (courses,
players, handicaps, Day 2 teams) is shared and entered once.

## Routes

- `/` — landing, pick a day
- `/setup` — edit courses (18 holes each), players & handicaps, Day 2 teams
- `/day/1` — Day 1 leaderboard (singles Stableford)
- `/day/1/score` — Day 1 scorer
- `/day/2` — Day 2 leaderboard (scramble Stableford)
- `/day/2/score` — Day 2 scorer

## Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Supabase

A Supabase project has already been provisioned for this app (`donegal-golf`,
region `eu-west-1`) with the schema in place: `courses`, `holes`, `players`,
`teams`, `competitions`, `scores`. Row Level Security is enabled with fully
open policies (read/write) on every table — there's no auth, so this only
depends on the links not being shared beyond the group. `scores` is added to
the `supabase_realtime` publication so the leaderboard updates live.

Two courses and one competition per day were seeded automatically; rename the
courses and fill in real players/handicaps/holes from the **Setup** page
before the weekend.

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from there).
2. Import the repo in Vercel.
3. Set environment variables in the Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Framework preset: Vite. Build command `npm run build`, output directory `dist`.
5. Deploy, then share the root link — everyone lands on the Day 1 / Day 2 picker.

## Scoring rules

- **Day 1 (singles):** each player's `handicap_index` is used directly as
  their playing handicap. Strokes received on a hole = 1 if handicap ≥ the
  hole's stroke index, +1 more if handicap ≥ stroke index + 18, and so on.
- **Day 2 (scramble):** each team's playing handicap is the average of its
  two players' `handicap_index`, applied the same way to the team's single
  gross score per hole.
- **Points:** net score vs par — albatross or better = 5, eagle = 4, birdie = 3,
  par = 2, bogey = 1, double bogey or worse = 0.

## Notes

- Score entry writes optimistically to the UI, then to Supabase; the
  leaderboard subscribes to `scores` changes over Supabase Realtime and
  recomputes on every insert/update, with pull-to-refresh as a fallback.
- Built for this one specific weekend — no historical tracking or multi-event
  support by design.
