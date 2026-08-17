import { getPlayers, getTeams } from './data'
import { teamHandicap } from './scoring'

// Normalizes Day 1 players and Day 2 teams into a common shape:
// { id, name, handicap, photoUrl, photoUrls }
export async function loadEntrants(day) {
  if (Number(day) === 1) {
    const players = await getPlayers()
    return players.map((p) => ({
      id: p.id,
      name: p.name || 'Player',
      handicap: Number(p.handicap_index),
      photoUrl: p.photo_url || null,
    }))
  }

  const [teams, players] = await Promise.all([getTeams(), getPlayers()])
  const byId = Object.fromEntries(players.map((p) => [p.id, p]))
  return teams.map((t) => {
    const a = byId[t.player_1_id]
    const b = byId[t.player_2_id]
    const names = [a?.name, b?.name].filter(Boolean).join('/')
    return {
      id: t.id,
      name: names || t.name || 'Team',
      handicap: a && b ? teamHandicap(a.handicap_index, b.handicap_index) : 0,
      // A team photo, once set, replaces the two individual player avatars.
      photoUrl: t.photo_url || null,
      photoUrls: t.photo_url ? null : [a?.photo_url || null, b?.photo_url || null],
      names: [a?.name, b?.name],
    }
  })
}
