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

export async function uploadCoursePhoto(courseId, blob) {
  const path = `courses/${courseId}-${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const { error } = await supabase.from('courses').update({ photo_url: data.publicUrl }).eq('id', courseId)
  if (error) throw error
  return data.publicUrl
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

export async function uploadPlayerPhoto(playerId, blob) {
  const path = `players/${playerId}-${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  await updatePlayer(playerId, { photo_url: data.publicUrl })
  return data.publicUrl
}

export async function getTeams() {
  const { data, error } = await supabase.from('teams').select('*').order('created_at')
  if (error) throw error
  return data
}

export async function uploadTeamPhoto(teamId, blob) {
  const path = `teams/${teamId}-${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const { error } = await supabase.from('teams').update({ photo_url: data.publicUrl }).eq('id', teamId)
  if (error) throw error
  return data.publicUrl
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

export async function getCompetitions() {
  const { data, error } = await supabase.from('competitions').select('*').order('day')
  if (error) throw error
  return data
}

export async function updateCompetitionPrize(competitionId, prizeMoney) {
  const { error } = await supabase.from('competitions').update({ prize_money: prizeMoney }).eq('id', competitionId)
  if (error) throw error
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

export async function clearAllScores() {
  const { error } = await supabase.from('scores').delete().not('id', 'is', null)
  if (error) throw error
}

export async function getEventSettings() {
  const { data, error } = await supabase.from('event_settings').select('*').limit(1).single()
  if (error) throw error
  return data
}

export async function updateEventSettings(id, fields) {
  const { error } = await supabase.from('event_settings').update(fields).eq('id', id)
  if (error) throw error
}

export async function uploadEventHeroPhoto(eventId, blob) {
  const path = `event/${eventId}-${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const { error } = await supabase.from('event_settings').update({ hero_photo_url: data.publicUrl }).eq('id', eventId)
  if (error) throw error
  return data.publicUrl
}

export async function savePushSubscription(subscription) {
  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: 'endpoint' }
  )
  if (error) throw error
}

export async function deletePushSubscription(endpoint) {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
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
