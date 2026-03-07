import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const TABLES = {
  cards: 'app_cards',
  decks: 'app_decks',
  tags: 'app_tags',
  meta: 'app_meta',
}

const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!isSupabaseConfigured) {
  console.warn('Supabase env vars are missing. Remote sync is disabled.')
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

const getPrimaryError = (...responses) => responses.find(response => response?.error)?.error || null

const isSchemaMissingError = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('could not find the table') ||
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('column') && message.includes('user_id')
  )
}

export async function getSession() {
  if (!supabase) return { ok: false, reason: 'not_configured', session: null }
  const { data, error } = await supabase.auth.getSession()
  if (error) return { ok: false, reason: 'error', error, session: null }
  return { ok: true, session: data.session }
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session))
  return () => data.subscription.unsubscribe()
}

export async function signInWithPassword(email, password) {
  if (!supabase) return { ok: false, reason: 'not_configured' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { ok: false, reason: 'error', error } : { ok: true }
}

export async function signUpWithPassword(email, password) {
  if (!supabase) return { ok: false, reason: 'not_configured' }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) return { ok: false, reason: 'error', error }
  return {
    ok: true,
    needsEmailConfirmation: !data.session,
  }
}

export async function signOut() {
  if (!supabase) return { ok: false, reason: 'not_configured' }
  const { error } = await supabase.auth.signOut()
  return error ? { ok: false, reason: 'error', error } : { ok: true }
}

export async function loadFromSupabase(userId) {
  if (!supabase || !userId) return { ok: false, reason: 'not_ready' }

  try {
    const [cardsRes, decksRes, tagsRes, metaRes] = await Promise.all([
      supabase.from(TABLES.cards).select('*').eq('user_id', userId),
      supabase.from(TABLES.decks).select('*').eq('user_id', userId),
      supabase.from(TABLES.tags).select('*').eq('user_id', userId),
      supabase.from(TABLES.meta).select('*').eq('user_id', userId),
    ])

    const error = getPrimaryError(cardsRes, decksRes, tagsRes, metaRes)
    if (error) {
      if (isSchemaMissingError(error)) return { ok: false, reason: 'schema_missing', error }
      console.error('Supabase load error', error)
      return { ok: false, reason: 'error', error }
    }

    const meta = Object.fromEntries((metaRes.data || []).map(row => [row.key, row.value]))

    return {
      ok: true,
      data: {
        cards: (cardsRes.data || []).map(row => ({
          id: row.id,
          front: row.front,
          back: row.back,
          active: row.active,
          tags: row.tags || [],
          memory: row.memory || {},
          createdAt: row.created_at,
        })),
        decks: (decksRes.data || []).map(row => ({
          id: row.id,
          name: row.name,
          cardIds: row.card_ids || [],
          sortMode: row.sort_mode || 'created-desc',
        })),
        tags: (tagsRes.data || []).map(row => ({
          name: row.name,
          color: row.color || 'neutral',
        })),
        nextId: Number(meta.nextId) || 10,
        selectedDeckId: meta.selectedDeckId || null,
      },
    }
  } catch (error) {
    console.error('Supabase load exception', error)
    return { ok: false, reason: 'error', error }
  }
}

export async function saveToSupabase(userId, { cards, decks, tags, nextId, selectedDeckId }) {
  if (!supabase || !userId) return { ok: false, skipped: true, reason: 'not_ready' }

  try {
    const cardsRows = cards.map(card => ({
      user_id: userId,
      id: card.id,
      front: card.front,
      back: card.back,
      active: card.active,
      tags: card.tags || [],
      memory: card.memory || {},
      created_at: card.createdAt,
    }))

    const decksRows = decks.map(deck => ({
      user_id: userId,
      id: deck.id,
      name: deck.name,
      card_ids: deck.cardIds || [],
      sort_mode: deck.sortMode || 'created-desc',
    }))

    const tagsRows = tags.map(tag => ({
      user_id: userId,
      name: tag.name,
      color: tag.color || 'neutral',
    }))

    const metaRows = [
      { user_id: userId, key: 'nextId', value: String(nextId) },
      { user_id: userId, key: 'selectedDeckId', value: selectedDeckId || '' },
    ]

    const [cardsRes, decksRes, tagsRes, metaRes] = await Promise.all([
      supabase.from(TABLES.cards).upsert(cardsRows, { onConflict: 'user_id,id' }),
      supabase.from(TABLES.decks).upsert(decksRows, { onConflict: 'user_id,id' }),
      supabase.from(TABLES.tags).upsert(tagsRows, { onConflict: 'user_id,name' }),
      supabase.from(TABLES.meta).upsert(metaRows, { onConflict: 'user_id,key' }),
    ])

    const error = getPrimaryError(cardsRes, decksRes, tagsRes, metaRes)
    if (error) {
      if (isSchemaMissingError(error)) return { ok: false, reason: 'schema_missing', error }
      console.error('Supabase save error', error)
      return { ok: false, reason: 'error', error }
    }

    const cardIds = cards.map(card => card.id)
    const deckIds = decks.map(deck => JSON.stringify(deck.id)).join(',')
    const tagNames = tags.map(tag => JSON.stringify(tag.name)).join(',')

    const [deleteCardsRes, deleteDecksRes, deleteTagsRes] = await Promise.all([
      cardIds.length > 0
        ? supabase.from(TABLES.cards).delete().eq('user_id', userId).not('id', 'in', `(${cardIds.join(',')})`)
        : supabase.from(TABLES.cards).delete().eq('user_id', userId),
      decks.length > 0
        ? supabase.from(TABLES.decks).delete().eq('user_id', userId).not('id', 'in', `(${deckIds})`)
        : supabase.from(TABLES.decks).delete().eq('user_id', userId),
      tags.length > 0
        ? supabase.from(TABLES.tags).delete().eq('user_id', userId).not('name', 'in', `(${tagNames})`)
        : supabase.from(TABLES.tags).delete().eq('user_id', userId),
    ])

    const deleteError = getPrimaryError(deleteCardsRes, deleteDecksRes, deleteTagsRes)
    if (deleteError) {
      if (isSchemaMissingError(deleteError)) return { ok: false, reason: 'schema_missing', error: deleteError }
      console.error('Supabase delete error', deleteError)
      return { ok: false, reason: 'error', error: deleteError }
    }

    return { ok: true }
  } catch (error) {
    console.error('Supabase save exception', error)
    return { ok: false, reason: 'error', error }
  }
}

export function subscribeToUserData(userId, onChange) {
  if (!supabase || !userId) return () => {}

  const channel = supabase
    .channel(`flashcards-user-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: TABLES.cards,
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: TABLES.decks,
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: TABLES.tags,
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: TABLES.meta,
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
