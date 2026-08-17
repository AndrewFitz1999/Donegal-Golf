import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar.jsx'
import { EntrantAvatar } from '../components/Avatar.jsx'
import { getCompetition, getHoles, getScores, upsertScore, subscribeToScores } from '../lib/data'
import { loadEntrants } from '../lib/entrants'
import { stablefordPoints } from '../lib/scoring'

export default function DayScorer() {
  const { day } = useParams()
  const navigate = useNavigate()
  const [competition, setCompetition] = useState(null)
  const [holes, setHoles] = useState([])
  const [entrants, setEntrants] = useState([])
  const [scores, setScores] = useState([])
  const [status, setStatus] = useState('loading')
  const [hole, setHole] = useState(() => Number(sessionStorage.getItem(`scorer-hole-${day}`)) || 1)

  const load = useCallback(async () => {
    try {
      const comp = await getCompetition(day)
      const [h, e, s] = await Promise.all([getHoles(comp.course_id), loadEntrants(day), getScores(comp.id)])
      h.sort((a, b) => a.hole_number - b.hole_number)
      setCompetition(comp)
      setHoles(h)
      setEntrants(e)
      setScores(s)
      setStatus('ready')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }, [day])

  useEffect(() => {
    setStatus('loading')
    load()
  }, [load])

  useEffect(() => {
    if (!competition) return
    const unsubscribe = subscribeToScores(competition.id, (payload) => {
      if (payload.eventType === 'DELETE') return
      const row = payload.new
      if (!row) return
      // Match on entrant_id+hole_number, not id: an optimistic row written
      // locally has no id yet, so matching by id would miss it and append a
      // duplicate instead of reconciling with the server's version.
      setScores((prev) => {
        const idx = prev.findIndex((s) => s.entrant_id === row.entrant_id && s.hole_number === row.hole_number)
        if (idx === -1) return [...prev, row]
        const next = [...prev]
        next[idx] = row
        return next
      })
    })
    return unsubscribe
  }, [competition])

  useEffect(() => {
    sessionStorage.setItem(`scorer-hole-${day}`, String(hole))
  }, [day, hole])

  const scoresRef = useRef(scores)
  scoresRef.current = scores

  // Rapid taps each fired their own upsertScore before; those requests can
  // land out of order, and the realtime echo of an earlier (now-stale) one
  // arriving after a later tap would overwrite the newer value — exactly
  // the "jumps around when tapped quickly" symptom. Debouncing per cell so
  // only the final value after a burst of taps hits the network fixes it,
  // while local state (and thus the visible number) still updates instantly
  // on every tap.
  const pendingWrites = useRef({})
  const writeTimers = useRef({})

  function flushWrite(key) {
    const payload = pendingWrites.current[key]
    if (!payload) return
    delete pendingWrites.current[key]
    clearTimeout(writeTimers.current[key])
    delete writeTimers.current[key]
    upsertScore(payload).catch((err) => console.error(err))
  }

  function flushAllWrites() {
    Object.keys(pendingWrites.current).forEach(flushWrite)
  }

  useEffect(() => {
    return () => flushAllWrites()
  }, [])

  const currentHole = holes.find((h) => h.hole_number === hole)

  const scoresByEntrantHole = useMemo(() => {
    const map = {}
    for (const s of scores) {
      map[`${s.entrant_id}-${s.hole_number}`] = s
    }
    return map
  }, [scores])

  const filledHoles = useMemo(() => {
    const filled = new Set()
    for (const h of holes) {
      const allFilled = entrants.length > 0 && entrants.every((e) => scoresByEntrantHole[`${e.id}-${h.hole_number}`]?.gross_strokes != null)
      if (allFilled) filled.add(h.hole_number)
    }
    return filled
  }, [holes, entrants, scoresByEntrantHole])

  const allFilledCurrentHole = filledHoles.has(hole)

  function setGross(entrant, delta) {
    if (!currentHole) return

    // Read from the ref, not the scoresByEntrantHole/state closure: two taps
    // in quick succession can both fire before React re-renders, and a
    // closure would have both read the same stale "existing" value and
    // computed the same next score instead of incrementing twice.
    const current = scoresRef.current
    const idx = current.findIndex((s) => s.entrant_id === entrant.id && s.hole_number === hole)
    const existing = idx !== -1 ? current[idx] : null
    const startValue = currentHole.par
    const nextValue = existing?.gross_strokes == null ? startValue : Math.min(15, Math.max(1, existing.gross_strokes + delta))

    const points = stablefordPoints(nextValue, currentHole.par, currentHole.stroke_index, entrant.handicap)

    const optimisticRow = {
      id: existing?.id,
      competition_id: competition.id,
      entrant_id: entrant.id,
      hole_number: hole,
      gross_strokes: nextValue,
      stableford_points: points,
    }

    const nextScores = idx === -1 ? [...current, optimisticRow] : current.map((s, i) => (i === idx ? { ...s, ...optimisticRow } : s))
    scoresRef.current = nextScores
    setScores(nextScores)

    const key = `${entrant.id}-${hole}`
    pendingWrites.current[key] = {
      competition_id: competition.id,
      entrant_id: entrant.id,
      hole_number: hole,
      gross_strokes: nextValue,
      stableford_points: points,
    }
    clearTimeout(writeTimers.current[key])
    writeTimers.current[key] = setTimeout(() => flushWrite(key), 400)
  }

  function confirmAndAdvance() {
    if (!allFilledCurrentHole) return
    flushAllWrites()
    if (hole >= 18) {
      navigate(`/day/${day}`)
    } else {
      setHole((h) => Math.min(18, h + 1))
    }
  }

  if (status === 'loading') {
    return (
      <div className="app-shell">
        <TopBar title={`Day ${day} Scoring`} backTo={`/day/${day}`} />
        <div className="state-message">Loading scorecard…</div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="app-shell">
        <TopBar title={`Day ${day} Scoring`} backTo={`/day/${day}`} />
        <div className="state-message">
          Couldn't load the scorecard. Check your connection.
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-secondary" onClick={load}>
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TopBar title={`Day ${day} Scoring`} subtitle={competition?.courses?.name} backTo={`/day/${day}`} />

      <div className="page-content">
        <div className="hole-nav">
          <button className="hole-nav-btn" onClick={() => setHole((h) => Math.max(1, h - 1))} disabled={hole <= 1} aria-label="Previous hole">
            ‹
          </button>
          <div className="hole-card">
            <div>
              <div className="hole-card-label">Hole</div>
              <div className="hole-card-num">{hole}</div>
            </div>
            <div className="hole-card-stats">
              <div>
                <div className="hole-card-label">Par</div>
                <div className="hole-card-stat-val">{currentHole?.par ?? '–'}</div>
              </div>
              <div>
                <div className="hole-card-label">S.I.</div>
                <div className="hole-card-stat-val">{currentHole?.stroke_index ?? '–'}</div>
              </div>
            </div>
          </div>
          <button className="hole-nav-btn" onClick={() => setHole((h) => Math.min(18, h + 1))} disabled={hole >= 18} aria-label="Next hole">
            ›
          </button>
        </div>

        <div className="hole-picker">
          {holes.map((h) => (
            <button
              key={h.hole_number}
              className={`hole-picker-btn${h.hole_number === hole ? ' is-active' : ''}${filledHoles.has(h.hole_number) ? ' is-filled' : ''}`}
              onClick={() => setHole(h.hole_number)}
            >
              {h.hole_number}
            </button>
          ))}
        </div>

        <div className="entrant-rows">
          {entrants.map((entrant) => {
            const row = scoresByEntrantHole[`${entrant.id}-${hole}`]
            const value = row?.gross_strokes ?? null
            const points = row?.stableford_points

            return (
              <div className="entrant-row" key={entrant.id}>
                <EntrantAvatar entrant={entrant} size={44} />
                <div className="entrant-info">
                  <div className="entrant-name">{entrant.name}</div>
                  <div className="entrant-points">
                    {value == null ? `Hcp ${entrant.handicap}` : `${points} pt${points === 1 ? '' : 's'} this hole`}
                  </div>
                </div>
                <div className="stepper">
                  <button className="stepper-btn" onClick={() => setGross(entrant, -1)} aria-label={`Decrease ${entrant.name} score`}>
                    −
                  </button>
                  <div className={`stepper-value${value == null ? ' is-empty' : ''}`}>{value ?? 'Tap +'}</div>
                  <button className="stepper-btn" onClick={() => setGross(entrant, 1)} aria-label={`Increase ${entrant.name} score`}>
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {!allFilledCurrentHole && <div className="confirm-hint">Enter a score for everyone to continue</div>}
      </div>

      <div className="action-bar">
        <div className="action-bar-inner">
          <button className="btn btn-primary" disabled={!allFilledCurrentHole} onClick={confirmAndAdvance}>
            {hole >= 18 ? 'Confirm scores & finish' : 'Confirm scores & next hole'}
          </button>
        </div>
      </div>
    </div>
  )
}
