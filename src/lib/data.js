import { supabase } from './supabase'

export async function getCourses() {
  const { data, error } = await supabase.from('courses').select('*').order('created_at')
  if (error) throw error
  return data
}

export async function getHoles(courseId) {
  const { data, error } = await supabase
    .from('holes')
    .select('*')
    .eq('course_id', courseId)
    .order('hole_number')
  if (error) throw error
  return data
}

export async function updateCourseName(courseId, name) {
  const { error } = await supabase.from('courses').update({ name }).eq('id', courseId)
  if (error) throw error
}

export async function updateHole(holeId, fields) {
  const { error } = await supabase.from('holes').update(fields).eq('id', holeId)
  if (error) throw error
}

export async function getPlayers() {
  const { data, error } = await supabase.from('players').select('*').order('created_at')
  if (error) throw error
  return data
}

export async function updatePlayer(playerId, fields) {
  const { error } = await supabase.from('players').update(fields).eq('id', playerId)
  if (error) throw error
}

export async function getTeams() {
  const { data, error } = await supabase.from('teams').select('*').order('created_at')
  if (error) throw error
  return data
}

export async function upsertTeam(team) {
  if (team.id) {
    const { error } = await supabase
      .from('teams')
      .update({ name: team.name, player_1_id: team.player_1_id, player_2_id: team.player_2_id })
      .eq('id', team.id)
    if (error) throw error
    return team.id
  }
  const { data, error } = await supabase
    .from('teams')
    .insert({ name: team.name, player_1_id: team.player_1_id, player_2_id: team.player_2_id })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function getCompetition(day) {
  const { data, error } = await supabase
    .from('competitions')
    .select('*, courses(*)')
    .eq('day', day)
    .single()
  if (error) throw error
  return data
}

export async function getScores(competitionId) {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('competition_id', competitionId)
  if (error) throw error
  return data
}

export async function upsertScore(row) {
  const { error } = await supabase
    .from('scores')
    .upsert(row, { onConflict: 'competition_id,entrant_id,hole_number' })
  if (error) throw error
}

export function subscribeToScores(competitionId, onChange) {
  const channel = supabase
    .channel(`scores-${competitionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'scores', filter: `competition_id=eq.${competitionId}` },
      onChange
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}
