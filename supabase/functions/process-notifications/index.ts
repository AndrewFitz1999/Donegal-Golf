// Deployed to Supabase as the `process-notifications` edge function and
// polled every 30s by a pg_cron job (see the "schedule_notification_processor"
// migration) — there's no client-side timer because iOS suspends JS timers
// once the screen locks, so the "30 seconds after the last edit" delay has
// to be enforced server-side by comparing against scores.updated_at instead.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const HOLD_MS = 30_000 // wait this long after the last score change before notifying, in case of a correction

// Public by design (sent to every browser during subscribe) — matches VITE_VAPID_PUBLIC_KEY.
const VAPID_PUBLIC_KEY = 'BHNOqrL8_-9dz7sOgsfj0oBEsG10RtQbBNNPKhURmIvXVtxeLdN1XXNvDphvucKfuy-UUCvzv93muqcGG2yVjgg'

function strokesReceived(playingHandicap: number, strokeIndex: number): number {
  let strokes = 0
  let threshold = strokeIndex
  while (playingHandicap >= threshold) {
    strokes += 1
    threshold += 18
  }
  return strokes
}

function stablefordPoints(gross: number, par: number, strokeIndex: number, handicap: number): number {
  if (gross == null || gross <= 0) return 0
  const received = strokesReceived(handicap, strokeIndex)
  const net = gross - received
  const diff = net - par
  if (diff <= -3) return 5
  if (diff === -2) return 4
  if (diff === -1) return 3
  if (diff === 0) return 2
  if (diff === 1) return 1
  return 0
}

function teamHandicap(a: number, b: number): number {
  return (Number(a) + Number(b)) / 2
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: vapidPrivateKey, error: vapidErr } = await supabase.rpc('get_vapid_private_key')
  if (vapidErr || !vapidPrivateKey) {
    console.error('missing vapid private key', vapidErr)
    return new Response(JSON.stringify({ error: 'vapid key unavailable' }), { status: 500 })
  }
  webpush.setVapidDetails('mailto:noreply@donegal-golf.app', VAPID_PUBLIC_KEY, vapidPrivateKey)

  const [{ data: competitions }, { data: players }, { data: teams }, { data: subscriptions }] = await Promise.all([
    supabase.from('competitions').select('*, courses(*)'),
    supabase.from('players').select('*'),
    supabase.from('teams').select('*'),
    supabase.from('push_subscriptions').select('*'),
  ])

  if (!competitions?.length || !subscriptions?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'nothing to do' }))
  }

  const playersById = Object.fromEntries((players ?? []).map((p) => [p.id, p]))
  const events: { title: string; body: string }[] = []

  for (const comp of competitions) {
    const { data: holes } = await supabase.from('holes').select('*').eq('course_id', comp.course_id).order('hole_number')
    const { data: scores } = await supabase.from('scores').select('*').eq('competition_id', comp.id)
    if (!holes?.length) continue

    const entrants =
      comp.day === 1
        ? (players ?? []).map((p) => ({ id: p.id, name: p.name || 'Player', handicap: Number(p.handicap_index) }))
        : (teams ?? []).map((t) => {
            const a = playersById[t.player_1_id]
            const b = playersById[t.player_2_id]
            const names = [a?.name, b?.name].filter(Boolean).join('/')
            return {
              id: t.id,
              name: names || t.name || 'Team',
              handicap: a && b ? teamHandicap(a.handicap_index, b.handicap_index) : 0,
            }
          })
    if (!entrants.length) continue

    // deno-lint-ignore no-explicit-any
    const scoresByEntrantHole = new Map<string, any>()
    for (const s of scores ?? []) scoresByEntrantHole.set(`${s.entrant_id}-${s.hole_number}`, s)

    const { data: alreadyLogged } = await supabase
      .from('notification_log')
      .select('type, hole_number')
      .eq('competition_id', comp.id)
    const loggedHoles = new Set((alreadyLogged ?? []).filter((n) => n.type === 'hole').map((n) => n.hole_number))
    const winnerLogged = (alreadyLogged ?? []).some((n) => n.type === 'winner')

    // Per-hole notifications
    for (const hole of holes) {
      if (loggedHoles.has(hole.hole_number)) continue
      const rows = entrants.map((e) => scoresByEntrantHole.get(`${e.id}-${hole.hole_number}`))
      if (rows.some((r) => r?.gross_strokes == null)) continue

      const lastUpdate = Math.max(...rows.map((r) => new Date(r!.updated_at).getTime()))
      if (Date.now() - lastUpdate < HOLD_MS) continue

      const breakdown = entrants
        .map((e, i) => {
          const pts = stablefordPoints(rows[i]!.gross_strokes, hole.par, hole.stroke_index, e.handicap)
          return `${e.name} ${pts}pt${pts === 1 ? '' : 's'}`
        })
        .join(', ')

      events.push({
        title: `Day ${comp.day} · Hole ${hole.hole_number}`,
        body: `Par ${hole.par} — ${breakdown}`,
      })

      await supabase.from('notification_log').insert({ type: 'hole', competition_id: comp.id, hole_number: hole.hole_number })
    }

    // Round-complete / winner notification
    if (!winnerLogged) {
      const allComplete = entrants.every((e) => holes.every((h) => scoresByEntrantHole.get(`${e.id}-${h.hole_number}`)?.gross_strokes != null))
      if (allComplete) {
        const lastUpdate = Math.max(...(scores ?? []).map((s) => new Date(s.updated_at).getTime()))
        if (Date.now() - lastUpdate >= HOLD_MS) {
          const totals = entrants.map((e) => {
            let points = 0
            for (const h of holes) {
              const row = scoresByEntrantHole.get(`${e.id}-${h.hole_number}`)
              if (row?.gross_strokes != null) points += stablefordPoints(row.gross_strokes, h.par, h.stroke_index, e.handicap)
            }
            return { name: e.name, points }
          })
          const top = Math.max(...totals.map((t) => t.points))
          const winners = totals.filter((t) => t.points === top)
          const prize = comp.prize_money ? (comp.day === 2 ? `€${comp.prize_money}pp` : `€${comp.prize_money}`) : null
          const winnerNames = winners.map((w) => w.name).join(' & ')

          events.push({
            title: `Day ${comp.day} winner${winners.length > 1 ? 's' : ''}! 🏆`,
            body: `${winnerNames} — ${top} pts${prize ? ` (${prize})` : ''}`,
          })

          await supabase.from('notification_log').insert({ type: 'winner', competition_id: comp.id, hole_number: null })
        }
      }
    }
  }

  if (!events.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }))
  }

  let sent = 0
  for (const sub of subscriptions) {
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }
    for (const event of events) {
      try {
        await webpush.sendNotification(pushSub, JSON.stringify(event))
        sent += 1
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('push failed', sub.id, err)
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, events: events.length }))
})
