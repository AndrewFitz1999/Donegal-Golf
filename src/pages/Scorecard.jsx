import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import TopBar from '../components/TopBar.jsx'
import { EntrantAvatar } from '../components/Avatar.jsx'
import { getCompetition, getHoles, getScores, subscribeToScores } from '../lib/data'
import { loadEntrants } from '../lib/entrants'
import { stablefordPoints } from '../lib/scoring'

export default function Scorecard() {
  const { day, entrantId } = useParams()
  const [competition, setCompetition] = useState(null)
  const [entrant, setEntrant] = useState(null)
  const [holeRows, setHoleRows] = useState([])
  const [status, setStatus] = useState('loading')

  const load = useCallback(async () => {
    try {
      const comp = await getCompetition(day)
      const [holes, entrants, scores] = await Promise.all([
        getHoles(comp.course_id),
        loadEntrants(day),
        getScores(comp.id),
      ])
      const found = entrants.find((e) => e.id === entrantId)
      const scoresByHole = Object.fromEntries(scores.filter((s) => s.entrant_id === entrantId).map((s) => [s.hole_number, s]))

      holes.sort((a, b) => a.hole_number - b.hole_number)
      const rows = holes.map((h) => {
        const s = scoresByHole[h.hole_number]
        const gross = s?.gross_strokes ?? null
        const points = gross != null && found ? stablefordPoints(gross, h.par, h.stroke_index, found.handicap) : null
        return { hole: h.hole_number, par: h.par, strokeIndex: h.stroke_index, gross, points }
      })

      setCompetition(comp)
      setEntrant(found || null)
      setHoleRows(rows)
      setStatus('ready')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }, [day, entrantId])

  useEffect(() => {
    setStatus('loading')
    load()
  }, [load])

  useEffect(() => {
    if (!competition) return
    const unsubscribe = subscribeToScores(competition.id, () => load())
    return unsubscribe
  }, [competition, load])

  if (status === 'loading') {
    return (
      <div className="app-shell">
        <TopBar title="Scorecard" backTo={`/day/${day}`} />
        <div className="state-message">Loading scorecard…</div>
      </div>
    )
  }

  if (status === 'error' || !entrant) {
    return (
      <div className="app-shell">
        <TopBar title="Scorecard" backTo={`/day/${day}`} />
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

  const totalPoints = holeRows.reduce((sum, r) => sum + (r.points || 0), 0)
  const thru = holeRows.filter((r) => r.gross != null).length
  const front = holeRows.slice(0, 9)
  const back = holeRows.slice(9, 18)

  return (
    <div className="app-shell">
      <TopBar title="Scorecard" subtitle={competition?.courses?.name} backTo={`/day/${day}`} />

      <div className="page-content">
        <div className="scorecard-summary">
          <EntrantAvatar entrant={entrant} size={56} />
          <div className="scorecard-summary-info">
            <div className="scorecard-summary-name">{entrant.name}</div>
            <div className="scorecard-summary-meta">
              Hcp {entrant.handicap} · {thru === 0 ? 'Not started' : thru === 18 ? 'Final' : `Thru ${thru}`}
            </div>
          </div>
          <div className="leaderboard-points">
            {totalPoints}
            <span className="leaderboard-points-unit">pts</span>
          </div>
        </div>

        <ScorecardNine title="Front nine" rows={front} />
        <ScorecardNine title="Back nine" rows={back} />
      </div>
    </div>
  )
}

function ScorecardNine({ title, rows }) {
  const totalPar = rows.reduce((sum, r) => sum + r.par, 0)
  const totalGross = rows.reduce((sum, r) => sum + (r.gross || 0), 0)
  const totalPoints = rows.reduce((sum, r) => sum + (r.points || 0), 0)
  const anyGross = rows.some((r) => r.gross != null)

  return (
    <div className="section">
      <div className="section-title">{title}</div>
      <div className="card scorecard-card">
        <div className="scorecard-grid scorecard-grid-head">
          <div>Hole</div>
          <div>Par</div>
          <div>Score</div>
          <div>Pts</div>
        </div>
        {rows.map((r) => (
          <div className="scorecard-grid" key={r.hole}>
            <div className="scorecard-hole-num">{r.hole}</div>
            <div>{r.par}</div>
            <div>
              {r.gross != null ? <span className={`score-badge ${scoreClass(r.gross, r.par)}`}>{r.gross}</span> : '–'}
            </div>
            <div className="scorecard-pts">{r.points ?? '–'}</div>
          </div>
        ))}
        <div className="scorecard-grid scorecard-grid-total">
          <div>Total</div>
          <div>{totalPar}</div>
          <div>{anyGross ? totalGross : '–'}</div>
          <div className="scorecard-pts">{totalPoints}</div>
        </div>
      </div>
    </div>
  )
}

// birdie or better = red circle, par = neutral, bogey = blue square, double bogey or worse = black square
function scoreClass(gross, par) {
  const diff = gross - par
  if (diff <= -1) return 'score-birdie'
  if (diff === 1) return 'score-bogey'
  if (diff >= 2) return 'score-double'
  return ''
}
