import { Fragment, useEffect, useState } from 'react'
import TopBar from '../components/TopBar.jsx'
import Avatar from '../components/Avatar.jsx'
import {
  getCourses,
  getHoles,
  updateCourseName,
  updateHole,
  getPlayers,
  updatePlayer,
  uploadPlayerPhoto,
  getTeams,
  upsertTeam,
} from '../lib/data'
import { resizeImageFile } from '../lib/image'

const TABS = ['Courses', 'Players', 'Teams']

export default function Setup() {
  const [tab, setTab] = useState('Courses')
  const [toast, setToast] = useState(null)

  function flash(msg) {
    setToast(msg)
    clearTimeout(flash._t)
    flash._t = setTimeout(() => setToast(null), 1400)
  }

  return (
    <div className="app-shell">
      <TopBar title="Setup" subtitle="Courses, players & teams" />

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab-btn${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="section">
        {tab === 'Courses' && <CoursesTab onSave={() => flash('Saved')} />}
        {tab === 'Players' && <PlayersTab onSave={() => flash('Saved')} />}
        {tab === 'Teams' && <TeamsTab onSave={() => flash('Saved')} />}
      </div>

      {toast && <div className="save-toast">{toast}</div>}
    </div>
  )
}

function CoursesTab({ onSave }) {
  const [courses, setCourses] = useState([])
  const [activeCourseId, setActiveCourseId] = useState(null)
  const [holes, setHoles] = useState([])
  const [name, setName] = useState('')
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    getCourses()
      .then((c) => {
        setCourses(c)
        setActiveCourseId(c[0]?.id ?? null)
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    if (!activeCourseId) return
    const course = courses.find((c) => c.id === activeCourseId)
    setName(course?.name || '')
    getHoles(activeCourseId).then((h) => setHoles(h.sort((a, b) => a.hole_number - b.hole_number)))
  }, [activeCourseId, courses])

  async function saveName() {
    await updateCourseName(activeCourseId, name)
    setCourses((prev) => prev.map((c) => (c.id === activeCourseId ? { ...c, name } : c)))
    onSave()
  }

  async function saveHole(holeId, field, value) {
    const num = Math.max(1, Number(value) || 1)
    setHoles((prev) => prev.map((h) => (h.id === holeId ? { ...h, [field]: num } : h)))
    await updateHole(holeId, { [field]: num })
    onSave()
  }

  if (status === 'loading') return <div className="state-message">Loading courses…</div>
  if (status === 'error') return <div className="state-message">Couldn't load courses. Check your connection.</div>

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 18 }}>
        {courses.map((c, i) => (
          <button
            key={c.id}
            className={`tab-btn${activeCourseId === c.id ? ' is-active' : ''}`}
            onClick={() => setActiveCourseId(c.id)}
          >
            Day {i + 1}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="field">
          <label>Course name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} placeholder="e.g. Rosapenna" />
        </div>

        <div className="holes-grid">
          <div className="holes-grid-head">Hole</div>
          <div className="holes-grid-head">Par</div>
          <div className="holes-grid-head">Stroke Index</div>
          {holes.map((h) => (
            <Fragment key={h.id}>
              <div className="holes-grid-num">{h.hole_number}</div>
              <input
                type="number"
                inputMode="numeric"
                value={h.par}
                onChange={(e) => setHoles((prev) => prev.map((x) => (x.id === h.id ? { ...x, par: e.target.value } : x)))}
                onBlur={(e) => saveHole(h.id, 'par', e.target.value)}
              />
              <input
                type="number"
                inputMode="numeric"
                value={h.stroke_index}
                onChange={(e) => setHoles((prev) => prev.map((x) => (x.id === h.id ? { ...x, stroke_index: e.target.value } : x)))}
                onBlur={(e) => saveHole(h.id, 'stroke_index', e.target.value)}
              />
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlayersTab({ onSave }) {
  const [players, setPlayers] = useState([])
  const [status, setStatus] = useState('loading')
  const [uploadingId, setUploadingId] = useState(null)

  useEffect(() => {
    getPlayers()
      .then((p) => {
        setPlayers(p)
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        setStatus('error')
      })
  }, [])

  async function saveField(id, field, value) {
    const payload = field === 'handicap_index' ? { handicap_index: Number(value) || 0 } : { name: value }
    await updatePlayer(id, payload)
    onSave()
  }

  async function handlePhotoChange(id, file) {
    if (!file) return
    setUploadingId(id)
    try {
      const resized = await resizeImageFile(file)
      const photoUrl = await uploadPlayerPhoto(id, resized)
      setPlayers((prev) => prev.map((x) => (x.id === id ? { ...x, photo_url: photoUrl } : x)))
      onSave()
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingId(null)
    }
  }

  if (status === 'loading') return <div className="state-message">Loading players…</div>
  if (status === 'error') return <div className="state-message">Couldn't load players. Check your connection.</div>

  return (
    <div className="card">
      {players.map((p) => (
        <div className="player-row" key={p.id}>
          <div className="photo-picker">
            <label className="photo-picker-btn">
              <Avatar src={p.photo_url} name={p.name} size={52} />
              <span className="photo-picker-badge">{uploadingId === p.id ? '…' : '+'}</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingId === p.id}
                onChange={(e) => handlePhotoChange(p.id, e.target.files?.[0])}
              />
            </label>
          </div>
          <div className="field player-row-name">
            <label>Name</label>
            <input
              value={p.name}
              onChange={(e) => setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
              onBlur={(e) => saveField(p.id, 'name', e.target.value)}
            />
          </div>
          <div className="field player-row-hcp">
            <label>Handicap</label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={p.handicap_index}
              onChange={(e) => setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, handicap_index: e.target.value } : x)))}
              onBlur={(e) => saveField(p.id, 'handicap_index', e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function TeamsTab({ onSave }) {
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    Promise.all([getPlayers(), getTeams()])
      .then(([p, t]) => {
        setPlayers(p)
        const slots = [0, 1].map(
          (i) => t[i] || { name: `Team ${i === 0 ? 'A' : 'B'}`, player_1_id: '', player_2_id: '' }
        )
        setTeams(slots)
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        setStatus('error')
      })
  }, [])

  async function saveTeam(index, field, value) {
    const updated = teams.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    setTeams(updated)
    const id = await upsertTeam(updated[index])
    if (!updated[index].id) {
      setTeams((prev) => prev.map((t, i) => (i === index ? { ...t, id } : t)))
    }
    onSave()
  }

  if (status === 'loading') return <div className="state-message">Loading teams…</div>
  if (status === 'error') return <div className="state-message">Couldn't load teams. Check your connection.</div>

  const playerName = (id) => players.find((p) => p.id === id)?.name || ''

  return (
    <div>
      {teams.map((team, i) => {
        const usedByOtherTeam = i === 0 ? [teams[1]?.player_1_id, teams[1]?.player_2_id] : [teams[0]?.player_1_id, teams[0]?.player_2_id]

        return (
          <div className="card" style={{ marginBottom: 16 }} key={i}>
            <div className="field">
              <label>Team name</label>
              <input
                value={team.name}
                onChange={(e) => setTeams((prev) => prev.map((t, idx) => (idx === i ? { ...t, name: e.target.value } : t)))}
                onBlur={(e) => saveTeam(i, 'name', e.target.value)}
              />
            </div>
            <div className="team-picker">
              <div className="field">
                <label>Player 1</label>
                <select value={team.player_1_id} onChange={(e) => saveTeam(i, 'player_1_id', e.target.value)}>
                  <option value="">Select…</option>
                  {players
                    .filter((p) => p.id === team.player_1_id || (!usedByOtherTeam.includes(p.id) && p.id !== team.player_2_id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label>Player 2</label>
                <select value={team.player_2_id} onChange={(e) => saveTeam(i, 'player_2_id', e.target.value)}>
                  <option value="">Select…</option>
                  {players
                    .filter((p) => p.id === team.player_2_id || (!usedByOtherTeam.includes(p.id) && p.id !== team.player_1_id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            {team.player_1_id && team.player_2_id && (
              <div className="entrant-points" style={{ marginTop: 10 }}>
                {playerName(team.player_1_id)} & {playerName(team.player_2_id)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
