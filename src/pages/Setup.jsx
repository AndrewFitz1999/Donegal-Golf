import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar.jsx'
import Avatar from '../components/Avatar.jsx'
import PhotoCropModal from '../components/PhotoCropModal.jsx'
import {
  getCourses,
  getHoles,
  updateCourseName,
  updateHole,
  uploadCoursePhoto,
  getCompetitions,
  updateCompetitionPrize,
  getPlayers,
  updatePlayer,
  uploadPlayerPhoto,
  getTeams,
  upsertTeam,
  uploadTeamPhoto,
  getEventSettings,
  updateEventSettings,
  uploadEventHeroPhoto,
  clearAllScores,
  savePushSubscription,
  deletePushSubscription,
} from '../lib/data'
import { resizeImageFile } from '../lib/image'
import { pushSupported, isIOS, isStandalone, getPushSubscription, subscribeToPush, unsubscribeFromPush } from '../lib/push'

const TABS = ['Trip', 'Courses', 'Players', 'Teams']
// Banner photos (trip hero, course background) are wide and short — crop to
// a consistent aspect so the pan/zoom preview matches how they actually render.
const BANNER_ASPECT = 3

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
        {tab === 'Trip' && <TripTab onSave={() => flash('Saved')} />}
        {tab === 'Courses' && <CoursesTab onSave={() => flash('Saved')} />}
        {tab === 'Players' && <PlayersTab onSave={() => flash('Saved')} />}
        {tab === 'Teams' && <TeamsTab onSave={() => flash('Saved')} />}
      </div>

      {toast && <div className="save-toast">{toast}</div>}
    </div>
  )
}

function TripTab({ onSave }) {
  const [event, setEvent] = useState(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [status, setStatus] = useState('loading')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [cropFile, setCropFile] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [notifState, setNotifState] = useState('checking') // checking | off | on | needs-install | unsupported
  const [notifBusy, setNotifBusy] = useState(false)

  useEffect(() => {
    getEventSettings()
      .then((e) => {
        setEvent(e)
        setTitle(e.title || '')
        setSubtitle(e.subtitle || '')
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    if (!pushSupported()) {
      setNotifState(isIOS() && !isStandalone() ? 'needs-install' : 'unsupported')
      return
    }
    getPushSubscription()
      .then((sub) => setNotifState(sub ? 'on' : 'off'))
      .catch(() => setNotifState('off'))
  }, [])

  async function handleEnableNotifications() {
    setNotifBusy(true)
    try {
      const subscription = await subscribeToPush()
      await savePushSubscription(subscription)
      setNotifState('on')
    } catch (err) {
      console.error(err)
      alert('Could not enable notifications. Check that this device allows notifications for this app.')
    } finally {
      setNotifBusy(false)
    }
  }

  async function handleDisableNotifications() {
    setNotifBusy(true)
    try {
      const subscription = await getPushSubscription()
      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await unsubscribeFromPush(subscription)
      }
      setNotifState('off')
    } catch (err) {
      console.error(err)
    } finally {
      setNotifBusy(false)
    }
  }

  async function saveField(field, value) {
    await updateEventSettings(event.id, { [field]: value })
    setEvent((prev) => ({ ...prev, [field]: value }))
    onSave()
  }

  async function handleCropConfirm(blob) {
    setCropFile(null)
    if (!event) return
    setUploadingPhoto(true)
    try {
      const photoUrl = await uploadEventHeroPhoto(event.id, blob)
      setEvent((prev) => ({ ...prev, hero_photo_url: photoUrl }))
      onSave()
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleClearScores() {
    if (!window.confirm('Clear every score entered for both days? This cannot be undone.')) return
    setClearing(true)
    try {
      await clearAllScores()
      onSave()
    } catch (err) {
      console.error(err)
    } finally {
      setClearing(false)
    }
  }

  if (status === 'loading') return <div className="state-message">Loading trip settings…</div>
  if (status === 'error') return <div className="state-message">Couldn't load trip settings. Check your connection.</div>

  return (
    <div>
      <div className="card">
        <div className="field">
          <label>Trip title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={(e) => saveField('title', e.target.value)} />
        </div>
        <div className="field">
          <label>Dates</label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} onBlur={(e) => saveField('subtitle', e.target.value)} />
        </div>
        <div className="field">
          <label>Hero photo</label>
          <label className="course-photo-picker">
            {event?.hero_photo_url && (
              <>
                <img src={event.hero_photo_url} alt="" />
                <div className="course-photo-scrim" />
              </>
            )}
            <span className={`course-photo-label${event?.hero_photo_url ? ' has-photo' : ''}`}>
              {uploadingPhoto ? 'Uploading…' : event?.hero_photo_url ? 'Change photo' : 'Add a hero photo'}
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={uploadingPhoto}
              onChange={(e) => {
                setCropFile(e.target.files?.[0] || null)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={!event?.hero_hidden}
            onChange={(e) => saveField('hero_hidden', !e.target.checked)}
          />
          Show hero photo on the dashboard (title/dates stay either way)
        </label>
      </div>

      {cropFile && <PhotoCropModal file={cropFile} aspect={BANNER_ASPECT} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} />}

      <div className="section">
        <div className="section-title">Scoring</div>
        <div className="card scoring-links">
          <Link to="/day/1/score" className="btn btn-secondary">
            Enter Day 1 Scores
          </Link>
          <Link to="/day/2/score" className="btn btn-secondary">
            Enter Day 2 Scores
          </Link>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Notifications</div>
        <div className="card">
          {notifState === 'checking' && <p style={{ fontSize: 13.5, color: 'var(--ink-500)', margin: 0 }}>Checking…</p>}

          {notifState === 'unsupported' && (
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', margin: 0 }}>
              Notifications aren't supported in this browser.
            </p>
          )}

          {notifState === 'needs-install' && (
            <p style={{ fontSize: 13.5, color: 'var(--ink-500)', margin: 0 }}>
              On iPhone, notifications only work once this is added to your Home Screen. Tap Share →
              "Add to Home Screen", then open it from there and come back to this page.
            </p>
          )}

          {(notifState === 'on' || notifState === 'off') && (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--ink-500)', margin: '0 0 14px' }}>
                Get a notification ~30 seconds after each hole's scores are entered, and one when a
                day's winner is decided.
              </p>
              <button
                className="btn btn-secondary"
                onClick={notifState === 'on' ? handleDisableNotifications : handleEnableNotifications}
                disabled={notifBusy}
              >
                {notifBusy ? 'Working…' : notifState === 'on' ? 'Notifications on · Turn off' : 'Enable notifications'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Danger zone</div>
        <div className="card">
          <p style={{ fontSize: 13.5, color: 'var(--ink-500)', margin: '0 0 14px' }}>
            Wipes every score entered for both days. Courses, players, teams and handicaps are untouched.
          </p>
          <button className="btn btn-danger" onClick={handleClearScores} disabled={clearing}>
            {clearing ? 'Clearing…' : 'Clear all scores'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CoursesTab({ onSave }) {
  const [courses, setCourses] = useState([])
  const [competitions, setCompetitions] = useState([])
  const [activeCourseId, setActiveCourseId] = useState(null)
  const [holes, setHoles] = useState([])
  const [name, setName] = useState('')
  const [prizeMoney, setPrizeMoney] = useState('')
  const [status, setStatus] = useState('loading')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [cropFile, setCropFile] = useState(null)

  useEffect(() => {
    Promise.all([getCourses(), getCompetitions()])
      .then(([c, comps]) => {
        setCourses(c)
        setCompetitions(comps)
        setActiveCourseId(c[0]?.id ?? null)
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        setStatus('error')
      })
  }, [])

  const activeIndex = courses.findIndex((c) => c.id === activeCourseId)
  const activeCompetition = competitions.find((c) => c.day === activeIndex + 1)

  useEffect(() => {
    if (!activeCourseId) return
    const course = courses.find((c) => c.id === activeCourseId)
    setName(course?.name || '')
    getHoles(activeCourseId).then((h) => setHoles(h.sort((a, b) => a.hole_number - b.hole_number)))
  }, [activeCourseId, courses])

  useEffect(() => {
    setPrizeMoney(activeCompetition?.prize_money ?? '')
  }, [activeCompetition?.id, activeCompetition?.prize_money])

  async function saveName() {
    await updateCourseName(activeCourseId, name)
    setCourses((prev) => prev.map((c) => (c.id === activeCourseId ? { ...c, name } : c)))
    onSave()
  }

  async function savePrizeMoney() {
    if (!activeCompetition) return
    const amount = prizeMoney === '' ? null : Number(prizeMoney)
    await updateCompetitionPrize(activeCompetition.id, amount)
    setCompetitions((prev) => prev.map((c) => (c.id === activeCompetition.id ? { ...c, prize_money: amount } : c)))
    onSave()
  }

  async function saveHole(holeId, field, value) {
    const num = Math.max(1, Number(value) || 1)
    setHoles((prev) => prev.map((h) => (h.id === holeId ? { ...h, [field]: num } : h)))
    await updateHole(holeId, { [field]: num })
    onSave()
  }

  async function handleCropConfirm(blob) {
    setCropFile(null)
    if (!activeCourseId) return
    setUploadingPhoto(true)
    try {
      const photoUrl = await uploadCoursePhoto(activeCourseId, blob)
      setCourses((prev) => prev.map((c) => (c.id === activeCourseId ? { ...c, photo_url: photoUrl } : c)))
      onSave()
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  if (status === 'loading') return <div className="state-message">Loading courses…</div>
  if (status === 'error') return <div className="state-message">Couldn't load courses. Check your connection.</div>

  const activeCourse = courses.find((c) => c.id === activeCourseId)

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

        <div className="field">
          <label>Prize money (€)</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={prizeMoney}
            onChange={(e) => setPrizeMoney(e.target.value)}
            onBlur={savePrizeMoney}
            placeholder="e.g. 100"
          />
          {activeIndex === 1 && (
            <div className="entrant-points" style={{ marginTop: -2 }}>
              Shown as €{prizeMoney || '0'}pp on the Day 2 card
            </div>
          )}
        </div>

        <div className="field">
          <label>Background photo</label>
          <label className="course-photo-picker">
            {activeCourse?.photo_url && (
              <>
                <img src={activeCourse.photo_url} alt="" />
                <div className="course-photo-scrim" />
              </>
            )}
            <span className={`course-photo-label${activeCourse?.photo_url ? ' has-photo' : ''}`}>
              {uploadingPhoto ? 'Uploading…' : activeCourse?.photo_url ? 'Change photo' : 'Add a photo of the course'}
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={uploadingPhoto}
              onChange={(e) => {
                setCropFile(e.target.files?.[0] || null)
                e.target.value = ''
              }}
            />
          </label>
        </div>

        {cropFile && <PhotoCropModal file={cropFile} aspect={BANNER_ASPECT} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} />}

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
  const [uploadingIndex, setUploadingIndex] = useState(null)

  useEffect(() => {
    Promise.all([getPlayers(), getTeams()])
      .then(([p, t]) => {
        setPlayers(p)
        const slots = [0, 1].map((i) => t[i] || { name: '', player_1_id: '', player_2_id: '' })
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

  async function handlePhotoChange(index, teamId, file) {
    if (!file || !teamId) return
    setUploadingIndex(index)
    try {
      const resized = await resizeImageFile(file)
      const photoUrl = await uploadTeamPhoto(teamId, resized)
      setTeams((prev) => prev.map((t, i) => (i === index ? { ...t, photo_url: photoUrl } : t)))
      onSave()
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingIndex(null)
    }
  }

  if (status === 'loading') return <div className="state-message">Loading teams…</div>
  if (status === 'error') return <div className="state-message">Couldn't load teams. Check your connection.</div>

  const playerName = (id) => players.find((p) => p.id === id)?.name || ''

  return (
    <div>
      {teams.map((team, i) => {
        const usedByOtherTeam = i === 0 ? [teams[1]?.player_1_id, teams[1]?.player_2_id] : [teams[0]?.player_1_id, teams[0]?.player_2_id]
        const displayName = team.player_1_id && team.player_2_id ? `${playerName(team.player_1_id)}/${playerName(team.player_2_id)}` : `Team ${i === 0 ? 'A' : 'B'}`

        return (
          <div className="card" style={{ marginBottom: 16 }} key={i}>
            <div className="photo-picker" style={{ marginBottom: 16 }}>
              <label className={`photo-picker-btn${team.id ? '' : ' is-disabled'}`}>
                <Avatar src={team.photo_url} name={displayName} size={52} />
                <span className="photo-picker-badge">{uploadingIndex === i ? '…' : '+'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={!team.id || uploadingIndex === i}
                  onChange={(e) => handlePhotoChange(i, team.id, e.target.files?.[0])}
                />
              </label>
              <div>
                <div className="team-name-preview">{displayName}</div>
                {!team.id && <div className="entrant-points">Pick both players, then add a team photo</div>}
              </div>
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
          </div>
        )
      })}
    </div>
  )
}
