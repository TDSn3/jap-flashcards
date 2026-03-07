import { useState, useEffect, useRef } from 'react'
import {
  getSession,
  loadFromSupabase,
  onAuthStateChange,
  saveToSupabase,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeToUserData,
  supabase,
} from './supabase'

const DEFAULT_CARDS = [
  { id: 1, front: 'ねこ', back: 'Chat 🐱', active: true, tags: [] },
  { id: 2, front: 'いぬ', back: 'Chien 🐶', active: true, tags: [] },
  { id: 3, front: 'さかな', back: 'Poisson 🐟', active: true, tags: [] },
]

let nextId = 10
const DAY_MS = 24 * 60 * 60 * 1000

const JP = "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif"
const UI = "'Inter', 'Helvetica Neue', Arial, sans-serif"
const SIGNUP_ENABLED = import.meta.env.VITE_ENABLE_SIGNUP === 'true'
const TAG_COLOR_OPTIONS = [
  { id: 'neutral', label: 'Neutre', bg: '#f5f2ee', border: '#d6cfc4', text: '#5f574f' },
  { id: 'rose', label: 'Rose', bg: '#fde2e4', border: '#f9bec7', text: '#8a3d55' },
  { id: 'peach', label: 'Peche', bg: '#fde7d8', border: '#f7c9aa', text: '#8b5a3c' },
  { id: 'butter', label: 'Beurre', bg: '#fdf1c7', border: '#f3df92', text: '#786127' },
  { id: 'mint', label: 'Menthe', bg: '#ddf4e4', border: '#b7e7c5', text: '#2f6b4f' },
  { id: 'sky', label: 'Ciel', bg: '#ddeffd', border: '#b8daf8', text: '#365f8d' },
  { id: 'lavender', label: 'Lavande', bg: '#ece4fb', border: '#d5c6f7', text: '#5e4b8a' },
]
const DEFAULT_TAG_COLOR = TAG_COLOR_OPTIONS[0].id
const DEFAULT_DECK_NAME = 'Deck principal'
const createDefaultMemory = () => ({
  mastery: 1,
  repetitions: 0,
  lapses: 0,
  intervalDays: 0,
  easeFactor: 2.5,
  lastReviewedAt: null,
  nextReviewAt: null,
})
const normalizeTagName = (value) => value.trim()
const getTagColorOption = (colorId) => TAG_COLOR_OPTIONS.find(option => option.id === colorId) || TAG_COLOR_OPTIONS[0]
const normalizeTagEntry = (value, index = 0) => {
  if (typeof value === 'string') {
    const name = normalizeTagName(value)
    return name ? { name, color: TAG_COLOR_OPTIONS[index % TAG_COLOR_OPTIONS.length].id } : null
  }
  if (value && typeof value === 'object') {
    const name = normalizeTagName(value.name || '')
    if (!name) return null
    return { name, color: getTagColorOption(value.color).id }
  }
  return null
}
const dedupeTags = (values = []) => {
  const seen = new Set()
  return values.map(normalizeTagEntry).filter(tag => {
    if (!tag) return false
    const key = tag.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
const normalizeMemory = (memory = {}) => ({
  ...createDefaultMemory(),
  ...memory,
  mastery: Math.min(5, Math.max(1, Number(memory.mastery ?? 1))),
  repetitions: Math.max(0, Number(memory.repetitions ?? 0)),
  lapses: Math.max(0, Number(memory.lapses ?? 0)),
  intervalDays: Math.max(0, Number(memory.intervalDays ?? 0)),
  easeFactor: Math.min(3.2, Math.max(1.3, Number(memory.easeFactor ?? 2.5))),
  lastReviewedAt: memory.lastReviewedAt || null,
  nextReviewAt: memory.nextReviewAt || null,
})
const advanceMemory = (memory, rating) => {
  const base = normalizeMemory(memory)
  let repetitions = base.repetitions
  let lapses = base.lapses
  let intervalDays = base.intervalDays
  let easeFactor = base.easeFactor
  let mastery = base.mastery

  if (rating === 'again') {
    repetitions = 0
    lapses += 1
    intervalDays = 1
    easeFactor = Math.max(1.3, easeFactor - 0.2)
    mastery = Math.max(1, mastery - 1)
  } else if (rating === 'hard') {
    repetitions += 1
    intervalDays = repetitions <= 1 ? 1 : Math.max(2, Math.round((intervalDays || 1) * 1.2))
    easeFactor = Math.max(1.3, easeFactor - 0.05)
    mastery = Math.min(5, Math.max(2, mastery))
  } else if (rating === 'good') {
    repetitions += 1
    intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round((intervalDays || 1) * easeFactor)
    mastery = Math.min(5, mastery + 1)
  } else if (rating === 'easy') {
    repetitions += 1
    intervalDays = repetitions === 1 ? 2 : repetitions === 2 ? 5 : Math.round((intervalDays || 1) * (easeFactor + 0.15))
    easeFactor = Math.min(3.2, easeFactor + 0.1)
    mastery = Math.min(5, mastery + 1)
  }

  const now = new Date()
  return {
    mastery,
    repetitions,
    lapses,
    intervalDays,
    easeFactor,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
  }
}
const getMasteryVisual = (mastery) => {
  if (mastery <= 1) return { icon: '◔', label: 'Fragile' }
  if (mastery === 2) return { icon: '◑', label: 'Debut' }
  if (mastery === 3) return { icon: '◕', label: 'Moyen' }
  if (mastery === 4) return { icon: '⬤', label: 'Solide' }
  return { icon: '✦', label: 'Ancre' }
}
const normalizeCard = (card) => ({
  ...card,
  active: card.active ?? true,
  tags: dedupeTags((card.tags || []).map(tag => ({ name: tag, color: DEFAULT_TAG_COLOR }))).map(tag => tag.name),
  memory: normalizeMemory(card.memory),
  createdAt: card.createdAt || new Date().toISOString(),
})
const deriveTagsFromCards = (cards) => dedupeTags(cards.flatMap(card => card.tags || []))
const getTagMeta = (tags, tagName) => tags.find(tag => tag.name === tagName) || { name: tagName, color: DEFAULT_TAG_COLOR }
const getTagStyle = (tags, tagName) => {
  const meta = getTagMeta(tags, tagName)
  const color = getTagColorOption(meta.color)
  return { meta, color }
}
const createDeck = (id, name, cardIds = [], sortMode = 'created-desc') => ({
  id,
  name: normalizeTagName(name) || DEFAULT_DECK_NAME,
  cardIds: [...new Set(cardIds)],
  sortMode,
})
const normalizeDeck = (deck) => createDeck(deck.id, deck.name, deck.cardIds || [], deck.sortMode || 'created-desc')
const shuffleArray = (items) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
const toggleFilterValue = (values, value) => (
  values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value]
)

const btn = (extra = {}) => ({
  fontFamily: UI, fontSize: 13, fontWeight: 500,
  padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
  border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917',
  transition: 'opacity .15s', outline: 'none',
  ...extra,
})

// ── 3D Flip Card ──────────────────────────────────────────────────────────────
function FlipCard({ front, back, flipped, onClick, reversed }) {
  const faceA = reversed ? back : front
  const faceB = reversed ? front : back
  const sizeA = reversed ? 28 : 54
  const sizeB = reversed ? 54 : 28
  const fontA = reversed ? UI : JP
  const fontB = reversed ? JP : UI

  return (
    <div onClick={onClick} style={{ width: '100%', height: 240, perspective: 1000, cursor: 'pointer', userSelect: 'none' }}>
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.52s cubic-bezier(0.4, 0.2, 0.2, 1)',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          background: '#fff', borderRadius: 16, border: '1px solid #e2dbd0',
          boxShadow: '0 6px 32px rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          <div style={{ fontFamily: fontA, fontSize: sizeA, fontWeight: 600, color: '#1c1917', lineHeight: 1.2, textAlign: 'center' }}>{faceA}</div>
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: '#1c1917', borderRadius: 16, border: '1px solid #2e2a26',
          boxShadow: '0 6px 32px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          <div style={{ fontFamily: fontB, fontSize: sizeB, fontWeight: 600, color: '#faf8f5', lineHeight: 1.4, textAlign: 'center' }}>{faceB}</div>
        </div>
      </div>
    </div>
  )
}

// ── Switch JP/FR ──────────────────────────────────────────────────────────────
function DirSwitch({ reversed, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ece8e2', borderRadius: 50, padding: '5px 14px' }}>
      <span style={{ fontFamily: JP, fontSize: 13, fontWeight: 600, color: reversed ? '#a8a29e' : '#1c1917', transition: 'color .2s' }}>JP</span>
      <div onClick={onChange} style={{ width: 38, height: 21, borderRadius: 11, cursor: 'pointer', background: reversed ? '#1c1917' : '#d6cfc4', position: 'relative', transition: 'background .25s' }}>
        <div style={{ position: 'absolute', top: 2.5, left: reversed ? 19 : 2.5, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left .25s cubic-bezier(.4,.2,.2,1)' }} />
      </div>
      <span style={{ fontFamily: UI, fontSize: 13, fontWeight: 500, color: reversed ? '#1c1917' : '#a8a29e', transition: 'color .2s' }}>FR</span>
    </div>
  )
}

function ToggleSwitch({ checked, onChange, onLabel = 'On', offLabel = 'Off' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: UI, fontSize: 11, color: checked ? '#1c1917' : '#a8a29e', fontWeight: 500 }}>
        {checked ? onLabel : offLabel}
      </span>
      <div
        onClick={onChange}
        style={{
          width: 38,
          height: 21,
          borderRadius: 11,
          cursor: 'pointer',
          background: checked ? '#1c1917' : '#d6cfc4',
          position: 'relative',
          transition: 'background .25s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2.5,
            left: checked ? 19 : 2.5,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            transition: 'left .25s cubic-bezier(.4,.2,.2,1)',
          }}
        />
      </div>
    </div>
  )
}

function EmptyDeck() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#a8a29e' }}>
      <div style={{ fontSize: 38, marginBottom: 12 }}>🃏</div>
      <p style={{ fontFamily: UI, fontSize: 14 }}>Le deck est vide — activez des cartes dans "Gérer".</p>
    </div>
  )
}

function AuthScreen({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  authMessage,
  authError,
  authBusy,
  isConfigured,
  signupEnabled,
}) {
  const title = mode === 'signin' || !signupEnabled ? 'Connexion' : 'Créer un compte'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f2ee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 20, padding: 24, boxShadow: '0 18px 40px rgba(28,25,23,0.08)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <span style={{ fontFamily: JP, fontSize: 16, color: '#c9b99a', fontWeight: 600 }}>日本語</span>
          <h1 style={{ fontFamily: UI, fontSize: 24, color: '#1c1917', margin: 0 }}>{title}</h1>
          <p style={{ fontFamily: UI, fontSize: 13, color: '#78716c', lineHeight: 1.5 }}>
            L’accès à l’application est protégé par un compte Supabase. Sans connexion, personne ne peut entrer ni lire les données.
          </p>
        </div>

        {!isConfigured && (
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c', fontFamily: UI, fontSize: 13 }}>
            Variables Supabase manquantes. Configure `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans Vercel.
          </div>
        )}

        {signupEnabled && (
          <div style={{ display: 'flex', gap: 6, background: '#ece8e2', borderRadius: 12, padding: 4, marginBottom: 18 }}>
            {[
              { id: 'signin', label: 'Connexion' },
              { id: 'signup', label: 'Créer' },
            ].map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: mode === option.id ? '#fff' : 'transparent',
                  color: mode === option.id ? '#1c1917' : '#78716c',
                  fontFamily: UI,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="toi@example.com"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 15, outline: 'none' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 15, outline: 'none' }}
            />
          </label>

          {authMessage && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontFamily: UI, fontSize: 13 }}>
              {authMessage}
            </div>
          )}
          {authError && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c', fontFamily: UI, fontSize: 13 }}>
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authBusy || !isConfigured}
            style={btn({
              padding: '13px 16px',
              background: '#1c1917',
              color: '#faf8f5',
              border: 'none',
              opacity: authBusy || !isConfigured ? 0.6 : 1,
            })}
          >
            {authBusy ? 'Chargement…' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  )
}

function SchemaSetupScreen({ email, onSignOut }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f2ee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 20, padding: 24, boxShadow: '0 18px 40px rgba(28,25,23,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: UI, fontSize: 24, color: '#1c1917', margin: 0 }}>Supabase non migré</h1>
            <p style={{ fontFamily: UI, fontSize: 13, color: '#78716c', lineHeight: 1.5, marginTop: 8 }}>
              Connecté en tant que {email}, mais les tables sécurisées par utilisateur n’existent pas encore.
            </p>
          </div>
          <button onClick={onSignOut} style={btn({ background: '#f5f2ee', color: '#5f574f' })}>Se déconnecter</button>
        </div>
        <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 14, background: '#fffbea', border: '1px solid #fde68a', fontFamily: UI, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
          Exécute le SQL du fichier <code>supabase/schema.sql</code> dans l’éditeur SQL Supabase, puis recharge la page.
        </div>
        <div style={{ marginTop: 18, fontFamily: UI, fontSize: 13, color: '#5f574f', lineHeight: 1.7 }}>
          Le nouveau schéma crée `app_cards`, `app_decks`, `app_tags` et `app_meta` avec `user_id` + RLS. Les anciennes tables sont laissées intactes.
        </div>
      </div>
    </div>
  )
}

const createSnowballState = (deck = [], overrides = {}) => ({
  visibleIds: deck[0] ? [deck[0].id] : [],
  flipped: {},
  done: false,
  removedCards: [],
  orderKey: deck.map(card => card.id).join(','),
  ...overrides,
})

// ── Mode Classique ────────────────────────────────────────────────────────────
function ClassicMode({ deck, removeFromDeck, rateCard, onShuffle, onResetOrder, canResetOrder, reversed, setReversed, onChooseDeck }) {
  const [remainingIds, setRemainingIds] = useState(deck.map(card => card.id))
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sliding, setSliding] = useState(null)
  const [done, setDone] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [entering, setEntering] = useState(false)
  const [cardRenderKey, setCardRenderKey] = useState(0)
  const pointerStateRef = useRef({ id: null, startX: 0, moved: false })
  const cardShellRef = useRef(null)
  const enterAnimationFrameRef = useRef(null)
  const remainingDeck = remainingIds
    .map(id => deck.find(card => card.id === id))
    .filter(Boolean)

  const current = remainingDeck[idx % Math.max(remainingDeck.length, 1)]
  const swipeThreshold = 90

  const navigate = (swipeDir) => {
    if (sliding) return
    if (remainingDeck.length <= 1) return
    const exitDistance = Math.max((cardShellRef.current?.offsetWidth || 320) + 80, 360)
    setSliding(swipeDir)
    setFlipped(false)
    setDragX(swipeDir === 'left' ? -exitDistance : exitDistance)
    setTimeout(() => {
      const nextIdx = swipeDir === 'left'
        ? (idx + 1) % remainingDeck.length
        : (idx - 1 + remainingDeck.length) % remainingDeck.length
      setIdx(nextIdx)
      setSliding(null)
      setDragX(0)
      setEntering(true)
      setCardRenderKey(key => key + 1)
      if (enterAnimationFrameRef.current) cancelAnimationFrame(enterAnimationFrameRef.current)
      enterAnimationFrameRef.current = requestAnimationFrame(() => {
        enterAnimationFrameRef.current = requestAnimationFrame(() => {
          setEntering(false)
        })
      })
    }, 220)
  }

  const restartShuffled = () => {
    const shuffledIds = shuffleArray(deck.map(card => card.id))
    setRemainingIds(shuffledIds)
    setIdx(0)
    setFlipped(false)
    setSliding(null)
    setDragX(0)
    setDragging(false)
    setEntering(false)
    setCardRenderKey(key => key + 1)
    setDone(false)
    onShuffle()
  }

  const completeCard = (rating) => {
    if (!current) return
    rateCard(current.id, rating)
    setFlipped(false)
    setRemainingIds(currentIds => {
      const nextIds = currentIds.filter(id => id !== current.id)
      if (nextIds.length === 0) {
        setDone(true)
        setIdx(0)
        setDragX(0)
        setDragging(false)
        setEntering(false)
        setCardRenderKey(key => key + 1)
        return []
      }
      setIdx(currentIdx => Math.min(currentIdx, nextIds.length - 1))
      return nextIds
    })
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (sliding || remainingDeck.length <= 1) return
    pointerStateRef.current = { id: event.pointerId, startX: event.clientX, moved: false }
    setDragging(true)
    setDragX(0)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!dragging) return
    if (pointerStateRef.current.id !== event.pointerId) return
    const nextDragX = event.clientX - pointerStateRef.current.startX
    if (Math.abs(nextDragX) > 3) {
      pointerStateRef.current.moved = true
    }
    setDragX(nextDragX)
  }

  const finishDrag = (event) => {
    if (pointerStateRef.current.id !== event.pointerId) return
    const deltaX = event.clientX - pointerStateRef.current.startX
    pointerStateRef.current = { id: null, startX: 0, moved: false }
    setDragging(false)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (Math.abs(deltaX) < swipeThreshold) {
      setDragX(0)
      return
    }
    navigate(deltaX < 0 ? 'left' : 'right')
  }

  const handleCardClick = () => {
    if (dragging || pointerStateRef.current.moved || Math.abs(dragX) > 3) return
    setFlipped(f => !f)
  }

  if (!deck.length) return <EmptyDeck />
  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '56px 0' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
        <p style={{ fontFamily: UI, fontSize: 16, fontWeight: 600, color: '#1c1917', marginBottom: 6 }}>Deck terminé</p>
        <p style={{ fontFamily: UI, fontSize: 13, color: '#a8a29e', marginBottom: 28 }}>
          Tu as parcouru toutes les cartes de ce deck en mode classique.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <button onClick={restartShuffled} style={btn({ width: '100%', background: '#1c1917', color: '#faf8f5', border: 'none', padding: 14 })}>
            Reprendre à zéro en mélangeant
          </button>
          <button onClick={onChooseDeck} style={btn({ width: '100%', padding: 14, background: '#f5f2ee', color: '#5f574f' })}>
            Choisir un autre deck
          </button>
        </div>
      </div>
    )
  }

  const mastery = current?.memory?.mastery || 1
  const masteryVisual = getMasteryVisual(mastery)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, width: '100%' }}>
        <div style={{ justifySelf: 'start' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={restartShuffled} style={btn({ padding: '8px 12px', fontSize: 12 })}>
              Melanger
            </button>
            {canResetOrder && (
              <button onClick={() => { setFlipped(false); onResetOrder() }} title="Reinitialiser l'ordre" aria-label="Reinitialiser l'ordre" style={btn({ padding: '8px 12px', fontSize: 14, background: '#f5f2ee', color: '#5f574f' })}>
                ↺
              </button>
            )}
          </div>
        </div>
        <span style={{ fontFamily: UI, fontSize: 11, fontWeight: 500, color: '#a8a29e', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'center' }}>
          Restantes {remainingDeck.length} / {deck.length}
        </span>
        <div style={{ justifySelf: 'end' }}>
          <DirSwitch reversed={reversed} onChange={() => { setReversed(r => !r); setFlipped(false) }} />
        </div>
      </div>

      <div
        key={`${current?.id || 'empty'}-${cardRenderKey}`}
        ref={cardShellRef}
        style={{
          width: '100%',
          transform: dragging
            ? `translateX(${dragX}px) rotate(${dragX / 28}deg)`
            : entering
              ? 'translateY(24px) scale(0.985)'
              : `translateX(${dragX}px) rotate(${dragX / 28}deg)`,
          opacity: dragging
            ? Math.max(0.5, 1 - Math.abs(dragX) / 440)
            : entering
              ? 0
              : Math.max(0.5, 1 - Math.abs(dragX) / 440),
          transition: dragging ? 'none' : 'transform .22s ease, opacity .22s ease',
          touchAction: 'none',
          willChange: 'transform, opacity',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <FlipCard front={current.front} back={current.back} flipped={flipped} onClick={() => !sliding && handleCardClick()} reversed={reversed} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', fontFamily: UI, fontSize: 12, color: '#78716c' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ece8e2', borderRadius: 999, padding: '6px 10px' }}>
          <span style={{ fontSize: 13, color: '#1c1917' }}>{masteryVisual.icon}</span>
          <span>Maitrise {mastery}/5</span>
        </span>
        {current.memory?.nextReviewAt && (
          <span style={{ color: '#a8a29e' }}>
            Prochaine revision: {new Date(current.memory.nextReviewAt).toLocaleDateString('fr-FR')}
          </span>
        )}
      </div>

      {flipped && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, width: '100%' }}>
          <button onClick={() => completeCard('again')} style={btn({ padding: '12px 8px', fontSize: 12, borderColor: '#fecaca', background: '#fff5f5', color: '#b91c1c' })}>
            Encore
          </button>
          <button onClick={() => completeCard('hard')} style={btn({ padding: '12px 8px', fontSize: 12, borderColor: '#fde68a', background: '#fffbea', color: '#a16207' })}>
            Dur
          </button>
          <button onClick={() => completeCard('good')} style={btn({ padding: '12px 8px', fontSize: 12, borderColor: '#bfdbfe', background: '#eff6ff', color: '#1d4ed8' })}>
            Bien
          </button>
          <button onClick={() => completeCard('easy')} style={btn({ padding: '12px 8px', fontSize: 12, borderColor: '#bbf7d0', background: '#f0fdf4', color: '#15803d' })}>
            Facile
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        <button onClick={() => navigate('left')} disabled={remainingDeck.length <= 1} style={btn({ flex: 1, fontSize: 18, opacity: remainingDeck.length <= 1 ? 0.4 : 1 })}>←</button>
        <button onClick={() => {
          removeFromDeck(current.id)
          setRemainingIds(currentIds => {
            const nextIds = currentIds.filter(id => id !== current.id)
            if (nextIds.length === 0) {
              setDone(true)
              setIdx(0)
            } else {
              setIdx(currentIdx => Math.min(currentIdx, nextIds.length - 1))
            }
            return nextIds
          })
        }} style={btn({ flex: 3, borderColor: '#fca5a5', color: '#b91c1c', background: '#fff5f5' })}>
          Retirer du deck
        </button>
        <button onClick={() => navigate('right')} disabled={remainingDeck.length <= 1} style={btn({ flex: 1, fontSize: 18, opacity: remainingDeck.length <= 1 ? 0.4 : 1 })}>→</button>
      </div>
    </div>
  )
}

// ── Mode Accumulation ─────────────────────────────────────────────────────────
function SnowballMode({ deck, reversed, setReversed, onShuffleVisible, onResetOrder, canResetOrder, snowballState, setSnowballState }) {
  const visibleIds = snowballState?.visibleIds || []
  const flipped = snowballState?.flipped || {}
  const done = snowballState?.done || false
  const removedCards = snowballState?.removedCards || []

  const waveCards = visibleIds
    .map(id => deck.find(card => card.id === id))
    .filter(Boolean)
  const hiddenIds = deck
    .map(card => card.id)
    .filter(id => !visibleIds.includes(id) && !removedCards.includes(id))
  const restart = () => {
    setSnowballState(createSnowballState(deck))
  }
  const nextWave = () => {
    if (removedCards.length > 0) {
      const [cardId, ...rest] = removedCards
      setSnowballState(current => ({
        ...current,
        removedCards: rest,
        visibleIds: [...current.visibleIds, cardId],
        flipped: {},
      }))
      return
    }
    if (hiddenIds.length > 0) {
      setSnowballState(current => ({
        ...current,
        visibleIds: [...current.visibleIds, hiddenIds[0]],
        flipped: {},
      }))
      return
    }
    setSnowballState(current => ({ ...current, done: true }))
  }
  const removeCard = (cardId) => {
    setSnowballState(current => {
      const nextFlipped = { ...current.flipped }
      delete nextFlipped[cardId]
      return {
        ...current,
        done: false,
        flipped: nextFlipped,
        removedCards: [cardId, ...current.removedCards.filter(id => id !== cardId)],
        visibleIds: current.visibleIds.filter(id => id !== cardId),
      }
    })
  }

  if (!deck.length) return <EmptyDeck />

  if (done) return (
    <div style={{ textAlign: 'center', padding: '56px 0' }}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>🎉</div>
      <p style={{ fontFamily: UI, fontSize: 16, fontWeight: 600, color: '#1c1917', marginBottom: 6 }}>Bravo, série complète !</p>
      <p style={{ fontFamily: UI, fontSize: 13, color: '#a8a29e', marginBottom: 28 }}>Toutes les cartes passées en accumulation.</p>
      <button onClick={restart} style={btn({ background: '#1c1917', color: '#faf8f5', border: 'none' })}>Recommencer</button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <div style={{ justifySelf: 'start' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                const nextVisibleIds = onShuffleVisible(visibleIds, removedCards)
                if (!nextVisibleIds) return
                setSnowballState(current => ({
                  ...current,
                  visibleIds: nextVisibleIds,
                  done: false,
                }))
              }}
              style={btn({ padding: '8px 12px', fontSize: 12 })}
            >
              Melanger
            </button>
            {canResetOrder && (
              <button
                onClick={() => {
                  const nextVisibleIds = onResetOrder()
                  setSnowballState(createSnowballState(deck, {
                    visibleIds: nextVisibleIds.slice(0, Math.max(1, visibleIds.length)),
                  }))
                }}
                title="Reinitialiser l'ordre"
                aria-label="Reinitialiser l'ordre"
                style={btn({ padding: '8px 12px', fontSize: 14, background: '#f5f2ee', color: '#5f574f' })}
              >
                ↺
              </button>
            )}
          </div>
        </div>
        <span style={{ fontFamily: UI, fontSize: 11, fontWeight: 500, color: '#a8a29e', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'center' }}>
          Carte {waveCards.length} / {deck.length}
        </span>
        <div style={{ justifySelf: 'end' }}>
          <DirSwitch reversed={reversed} onChange={() => { setReversed(r => !r); setSnowballState(current => ({ ...current, flipped: {} })) }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {waveCards.map((card, i) => {
          const isFlipped = !!flipped[card.id]
          const faceA = reversed ? card.back : card.front
          const faceB = reversed ? card.front : card.back
          const fontA = reversed ? UI : JP
          const fontB = reversed ? JP : UI
          const sizeA = reversed ? 15 : 26
          const sizeB = reversed ? 26 : 15
          return (
            <div key={card.id} className="snowball-row" onClick={() => setSnowballState(current => ({ ...current, flipped: { ...current.flipped, [card.id]: !current.flipped[card.id] } }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: isFlipped ? '#1c1917' : '#fff',
                border: '1px solid', borderColor: isFlipped ? '#2e2a26' : '#e2dbd0',
                borderRadius: 12, padding: '14px 18px', minHeight: 76, userSelect: 'none', cursor: 'pointer',
                transition: 'background .22s, border-color .22s',
              }}>
              <span style={{ fontFamily: UI, fontSize: 11, fontWeight: 600, color: isFlipped ? '#5a534e' : '#c9c1b6', minWidth: 16 }}>{i + 1}</span>
              <div style={{
                flex: 1,
                fontFamily: isFlipped ? fontB : fontA,
                fontSize: isFlipped ? sizeB : sizeA,
                fontWeight: 600,
                color: isFlipped ? '#faf8f5' : '#1c1917',
              }}>
                {isFlipped ? faceB : faceA}
              </div>
              <button
                className="snowball-remove"
                onClick={(event) => {
                  event.stopPropagation()
                  removeCard(card.id)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: isFlipped ? '#6b6259' : '#c9c1b6',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                }}
                aria-label="Retirer cette carte"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <button onClick={nextWave} style={btn({ background: '#1c1917', color: '#faf8f5', border: 'none', padding: 14, width: '100%', marginTop: 4 })}>
        {removedCards.length > 0 ? 'Reajouter une carte retiree →' : hiddenIds.length > 0 ? `Ajouter la carte ${waveCards.length + 1} →` : 'Terminer ✓'}
      </button>
      <button onClick={restart} style={{ fontFamily: UI, fontSize: 12, color: '#c9c1b6', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
        Recommencer depuis le début
      </button>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
const TABS = ['Classique', 'Accumulation', 'Gérer', 'Ajouter', 'Tags']

export default function App() {
  const [cards, setCards] = useState(null)
  const [tags, setTags] = useState([])
  const [decks, setDecks] = useState([])
  const [selectedDeckId, setSelectedDeckId] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [deckOrder, setDeckOrder] = useState([])
  const [snowballStates, setSnowballStates] = useState({})
  const [reversed, setReversed] = useState(false)
  const [tab, setTab] = useState(0)
  const [manageSort, setManageSort] = useState('created-desc')
  const [manageTagFilter, setManageTagFilter] = useState([])
  const [manageStatusFilter, setManageStatusFilter] = useState([])
  const [manageMasteryFilter, setManageMasteryFilter] = useState([])
  const [manageDateFilter, setManageDateFilter] = useState([])
  const [manageFiltersOpen, setManageFiltersOpen] = useState(false)
  const [manageGroupInactive, setManageGroupInactive] = useState(false)
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')
  const [newDeckName, setNewDeckName] = useState('')
  const [newTag, setNewTag] = useState('')
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR)
  const [newCardTags, setNewCardTags] = useState([])
  const [tagPicker, setTagPicker] = useState(null)
  const [tagColorPicker, setTagColorPicker] = useState(null)
  const [editingTagName, setEditingTagName] = useState(null)
  const [editingTagValue, setEditingTagValue] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const saveTimer = useRef(null)
  const sessionRef = useRef(null)
  const realtimeRefreshTimer = useRef(null)
  const dataUpdateSourceRef = useRef('init')
  const localMutationAtRef = useRef(0)
  const saveInFlightRef = useRef(false)
  const refreshInFlightRef = useRef(false)
  const pendingRemoteRefreshRef = useRef(false)
  const skipNextSaveRef = useRef(false)
  const userId = session?.user?.id || null

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const applyRemoteData = (remoteData) => {
    dataUpdateSourceRef.current = 'remote'
    skipNextSaveRef.current = true
    const normalizedCards = remoteData.cards.map(normalizeCard)
    const fallbackDeck = createDeck(
      'deck-default',
      DEFAULT_DECK_NAME,
      normalizedCards.filter(card => card.active !== false).map(card => card.id)
    )
    const normalizedDecks = Array.isArray(remoteData.decks) && remoteData.decks.length > 0
      ? remoteData.decks.map(normalizeDeck)
      : [fallbackDeck]

    setCards(normalizedCards)
    setTags(Array.isArray(remoteData.tags) ? dedupeTags(remoteData.tags) : deriveTagsFromCards(normalizedCards))
    setDecks(normalizedDecks)
    setSelectedDeckId(
      normalizedDecks.some(deck => deck.id === remoteData.selectedDeckId)
        ? remoteData.selectedDeckId
        : normalizedDecks[0]?.id || null
    )
    nextId = Math.max(remoteData.nextId || 10, ...normalizedCards.map(card => card.id + 1), 10)
  }

  useEffect(() => {
    let isMounted = true

    const bootAuth = async () => {
      const result = await getSession()
      if (!isMounted) return
      setSession(result.session || null)
      setAuthReady(true)
    }

    bootAuth()

    const unsubscribe = onAuthStateChange((event, nextSession) => {
      if (!isMounted) return
      const previousUserId = sessionRef.current?.user?.id || null
      const nextUserId = nextSession?.user?.id || null
      setSession(nextSession || null)

      if (event === 'SIGNED_OUT') {
        setSchemaMissing(false)
        setSaveStatus('')
        setCards([])
        setTags([])
        setDecks([])
        setSelectedDeckId(null)
        return
      }

      if (previousUserId !== nextUserId) {
        setSchemaMissing(false)
        setSaveStatus('')
        setCards(nextSession ? null : [])
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  // Chargement initial
  useEffect(() => {
    if (!authReady) return
    if (!userId) {
      setCards([])
      setTags([])
      setDecks([])
      setSelectedDeckId(null)
      return
    }

    const load = async () => {
      setCards(null)
      setSchemaMissing(false)

      const remote = await loadFromSupabase(userId)
      if (remote.ok && remote.data) {
        applyRemoteData(remote.data)
        return
      }
      if (remote.reason === 'schema_missing') {
        setSchemaMissing(true)
        setCards([])
        setTags([])
        setDecks([])
        setSelectedDeckId(null)
        return
      }
      // Fallback fichier local (Electron)
      if (window.api) {
        const saved = await window.api.loadCards()
        if (saved?.cards) {
          const normalizedCards = saved.cards.map(normalizeCard)
          const fallbackDeck = createDeck(
            'deck-default',
            DEFAULT_DECK_NAME,
            normalizedCards.filter(card => card.active !== false).map(card => card.id)
          )
          const normalizedDecks = Array.isArray(saved.decks) && saved.decks.length > 0
            ? saved.decks.map(normalizeDeck)
            : [fallbackDeck]
          setCards(normalizedCards)
          setTags(Array.isArray(saved.tags) ? dedupeTags(saved.tags) : deriveTagsFromCards(normalizedCards))
          setDecks(normalizedDecks)
          setSelectedDeckId(
            normalizedDecks.some(deck => deck.id === saved.selectedDeckId)
              ? saved.selectedDeckId
              : normalizedDecks[0]?.id || null
          )
          nextId = Math.max(saved.nextId || 10, ...normalizedCards.map(card => card.id + 1), 10)
          return
        }
      }
      // Données par défaut
      setCards(DEFAULT_CARDS)
      setTags([])
      setDecks([createDeck('deck-default', DEFAULT_DECK_NAME, DEFAULT_CARDS.map(card => card.id))])
      setSelectedDeckId('deck-default')
    }
    load()
  }, [authReady, userId])

  useEffect(() => {
    if (!authReady) return
    if (dataUpdateSourceRef.current === 'remote') {
      dataUpdateSourceRef.current = 'idle'
      return
    }
    if (cards === null) return
    localMutationAtRef.current = Date.now()
    dataUpdateSourceRef.current = 'local'
  }, [authReady, cards, tags, decks, selectedDeckId])

  useEffect(() => {
    if (!userId || schemaMissing) return

    const refreshFromRealtime = async () => {
      if (refreshInFlightRef.current) return
      if (saveInFlightRef.current || Date.now() - localMutationAtRef.current < 1500) {
        pendingRemoteRefreshRef.current = true
        clearTimeout(realtimeRefreshTimer.current)
        realtimeRefreshTimer.current = setTimeout(() => {
          refreshFromRealtime()
        }, 900)
        return
      }

      refreshInFlightRef.current = true
      const remote = await loadFromSupabase(userId)
      refreshInFlightRef.current = false
      pendingRemoteRefreshRef.current = false
      if (remote.ok && remote.data) {
        applyRemoteData(remote.data)
        return
      }
      if (remote.reason === 'schema_missing') {
        setSchemaMissing(true)
      }
    }

    const unsubscribe = subscribeToUserData(userId, () => {
      pendingRemoteRefreshRef.current = true
      clearTimeout(realtimeRefreshTimer.current)
      realtimeRefreshTimer.current = setTimeout(() => {
        refreshFromRealtime()
      }, 250)
    })

    return () => {
      clearTimeout(realtimeRefreshTimer.current)
      unsubscribe()
    }
  }, [userId, schemaMissing])

  useEffect(() => {
    if (!cards || !selectedDeckId) return
    setDeckOrder(getSortedDeckIds())
  }, [cards, decks, selectedDeckId])

  useEffect(() => {
    const currentDeck = decks.find(deck => deck.id === selectedDeckId)
    setManageSort(currentDeck?.sortMode || 'created-desc')
  }, [decks, selectedDeckId])

  // Sauvegarde automatique
  useEffect(() => {
    if (!cards || !userId || schemaMissing) return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      saveInFlightRef.current = true
      const result = await saveToSupabase(userId, { cards, nextId, tags, decks, selectedDeckId })
      saveInFlightRef.current = false
      if (result.skipped) return
      if (result.reason === 'schema_missing') {
        setSchemaMissing(true)
        return
      }
      setSaveStatus(result.ok ? 'saved' : 'error')
      setTimeout(() => setSaveStatus(''), 2000)
      if (pendingRemoteRefreshRef.current) {
        clearTimeout(realtimeRefreshTimer.current)
        realtimeRefreshTimer.current = setTimeout(() => {
          if (!saveInFlightRef.current && Date.now() - localMutationAtRef.current >= 1200) {
            pendingRemoteRefreshRef.current = false
            refreshInFlightRef.current = false
            loadFromSupabase(userId).then(remote => {
              if (remote.ok && remote.data) applyRemoteData(remote.data)
            })
          }
        }, 1200)
      }
    }, 800)
  }, [cards, tags, decks, selectedDeckId, userId, schemaMissing])

  const allCards = cards || []
  const selectedDeck = decks.find(deck => deck.id === selectedDeckId) || null
  const getSortedDeckIds = () => {
    const deckSortMode = selectedDeck?.sortMode || 'created-desc'
    return (selectedDeck?.cardIds || [])
      .filter(id => allCards.some(card => card.id === id))
      .sort((a, b) => {
        const cardA = allCards.find(card => card.id === a)
        const cardB = allCards.find(card => card.id === b)
        if (deckSortMode === 'alpha') return (cardA?.front || '').localeCompare(cardB?.front || '', 'ja')
        if (deckSortMode === 'created-asc') return new Date(cardA?.createdAt || 0).getTime() - new Date(cardB?.createdAt || 0).getTime()
        if (deckSortMode === 'recent-review') return new Date(cardB?.memory?.lastReviewedAt || 0).getTime() - new Date(cardA?.memory?.lastReviewedAt || 0).getTime()
        if (deckSortMode === 'mastery') return (cardB?.memory?.mastery || 1) - (cardA?.memory?.mastery || 1)
        return new Date(cardB?.createdAt || 0).getTime() - new Date(cardA?.createdAt || 0).getTime()
      })
  }
  const activeDeck = allCards.filter(card => selectedDeck?.cardIds.includes(card.id))
  const deck = deckOrder
    .map(id => activeDeck.find(card => card.id === id))
    .filter(Boolean)
    .concat(activeDeck.filter(card => !deckOrder.includes(card.id)))
  const snowballState = selectedDeckId
    ? (snowballStates[selectedDeckId] || createSnowballState(deck))
    : createSnowballState(deck)
  const setSelectedDeckSnowballState = (updater) => {
    if (!selectedDeckId) return
    setSnowballStates(current => {
      const previousState = current[selectedDeckId] || createSnowballState(deck)
      const nextState = typeof updater === 'function' ? updater(previousState) : updater
      return {
        ...current,
        [selectedDeckId]: {
          ...previousState,
          ...nextState,
          orderKey: deck.map(card => card.id).join(','),
        },
      }
    })
  }
  useEffect(() => {
    if (!selectedDeckId) return
    const orderKey = deck.map(card => card.id).join(',')
    setSnowballStates(current => {
      const existingState = current[selectedDeckId]
      if (!existingState) {
        return { ...current, [selectedDeckId]: createSnowballState(deck) }
      }
      if (existingState.orderKey === orderKey) return current
      return { ...current, [selectedDeckId]: createSnowballState(deck) }
    })
  }, [selectedDeckId, deck])
  const deleteCard = (id) => {
    setCards(cs => cs.filter(c => c.id !== id))
    setDecks(current => current.map(deck => ({ ...deck, cardIds: deck.cardIds.filter(cardId => cardId !== id) })))
  }
  const toggleCardInSelectedDeck = (cardId) => setDecks(current => current.map(deck => {
    if (deck.id !== selectedDeckId) return deck
    const hasCard = deck.cardIds.includes(cardId)
    return { ...deck, cardIds: hasCard ? deck.cardIds.filter(id => id !== cardId) : [...deck.cardIds, cardId] }
  }))
  const addDeck = () => {
    const name = normalizeTagName(newDeckName)
    if (!name) return
    const id = `deck-${Date.now()}`
    const nextDeck = createDeck(id, name, [])
    setDecks(current => [...current, nextDeck])
    setSelectedDeckId(id)
    setNewDeckName('')
  }
  const deleteSelectedDeck = () => {
    if (!selectedDeckId || decks.length <= 1) return
    const remainingDecks = decks.filter(deck => deck.id !== selectedDeckId)
    setDecks(remainingDecks)
    setSelectedDeckId(remainingDecks[0]?.id || null)
  }
  const includeAllCardsInSelectedDeck = () => {
    if (!selectedDeckId) return
    setDecks(current => current.map(deck => (
      deck.id === selectedDeckId ? { ...deck, cardIds: allCards.map(card => card.id) } : deck
    )))
  }
  const excludeAllCardsFromSelectedDeck = () => {
    if (!selectedDeckId) return
    setDecks(current => current.map(deck => (
      deck.id === selectedDeckId ? { ...deck, cardIds: [] } : deck
    )))
  }
  const updateSelectedDeckSort = (sortMode) => {
    setManageSort(sortMode)
    setDecks(current => current.map(deck => (
      deck.id === selectedDeckId ? { ...deck, sortMode } : deck
    )))
  }
  const resetDeckOrder = () => {
    const sortedIds = getSortedDeckIds()
    setDeckOrder(sortedIds)
    return sortedIds
  }
  const clearManageFilters = () => {
    setManageTagFilter([])
    setManageStatusFilter([])
    setManageMasteryFilter([])
    setManageDateFilter([])
  }
  const allCardsIncludedInSelectedDeck = !!selectedDeck && allCards.length > 0 && selectedDeck.cardIds.length === allCards.length
  const compareManagedCards = (a, b) => {
    if (manageSort === 'alpha') return a.front.localeCompare(b.front, 'ja')
    if (manageSort === 'created-desc') {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    }
    if (manageSort === 'created-asc') {
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    }
    if (manageSort === 'recent-review') {
      return new Date(b.memory?.lastReviewedAt || 0).getTime() - new Date(a.memory?.lastReviewedAt || 0).getTime()
    }
    if (manageSort === 'mastery') return (b.memory?.mastery || 1) - (a.memory?.mastery || 1)
    return 0
  }
  const managedCards = [...allCards].filter(card => {
    const isActiveInDeck = !!selectedDeck?.cardIds.includes(card.id)
    if (manageTagFilter.length > 0 && !(card.tags || []).some(tag => manageTagFilter.includes(tag))) return false
    if (manageStatusFilter.length > 0 && !manageStatusFilter.includes(isActiveInDeck ? 'active' : 'inactive')) return false
    if (manageMasteryFilter.length > 0 && !manageMasteryFilter.includes(String(card.memory?.mastery || 1))) return false
    if (manageDateFilter.length > 0) {
      if (!card.createdAt) return false
      const createdAt = new Date(card.createdAt).getTime()
      const now = Date.now()
      const matchesDate = manageDateFilter.some(filter => {
        const thresholds = {
          today: 1,
          '7d': 7,
          '30d': 30,
        }
        const days = thresholds[filter]
        return !!days && now - createdAt <= days * DAY_MS
      })
      if (!matchesDate) return false
    }
    return true
  }).sort((a, b) => {
    if (manageGroupInactive) {
      const aActive = selectedDeck?.cardIds.includes(a.id) ? 0 : 1
      const bActive = selectedDeck?.cardIds.includes(b.id) ? 0 : 1
      if (aActive !== bActive) return aActive - bActive
    }
    return compareManagedCards(a, b)
  })
  const shuffleDeck = () => setDeckOrder(shuffleArray(deck.map(card => card.id)))
  const canResetDeckOrder = (() => {
    const sortedIds = getSortedDeckIds()
    if (sortedIds.length !== deckOrder.length) return true
    return sortedIds.some((id, index) => deckOrder[index] !== id)
  })()
  const shuffleDeckKeepingVisible = (currentVisibleIds, removedIds = []) => {
    const visibleSet = new Set(currentVisibleIds)
    const removedSet = new Set(removedIds)
    const hiddenIds = deck
      .map(card => card.id)
      .filter(id => !visibleSet.has(id) && !removedSet.has(id))

    let nextVisibleIds
    let nextHiddenIds

    if (currentVisibleIds.length === 1 && hiddenIds.length > 0) {
      const reshuffledPool = shuffleArray([...hiddenIds, currentVisibleIds[0]])
      nextVisibleIds = [reshuffledPool[0]]
      nextHiddenIds = reshuffledPool.slice(1)
    } else {
      nextVisibleIds = shuffleArray(currentVisibleIds)
      nextHiddenIds = shuffleArray(hiddenIds)
    }

    setDeckOrder([...nextVisibleIds, ...nextHiddenIds, ...removedIds])
    return nextVisibleIds
  }
  const rateCard = (id, rating) => setCards(cs => cs.map(card => (
    card.id === id
      ? { ...card, memory: advanceMemory(card.memory, rating) }
      : card
  )))
  const toggleCardTag = (id, tag) => setCards(cs => cs.map(card => {
    if (card.id !== id) return card
    const hasTag = (card.tags || []).includes(tag)
    return {
      ...card,
      tags: hasTag ? card.tags.filter(value => value !== tag) : [...(card.tags || []), tag],
    }
  }))
  const toggleNewCardTag = (tag) => setNewCardTags(current => current.includes(tag)
    ? current.filter(value => value !== tag)
    : [...current, tag])
  const addTag = () => {
    const tag = normalizeTagName(newTag)
    if (!tag) return
    if (tags.some(value => value.name.toLowerCase() === tag.toLowerCase())) return
    setTags(current => [...current, { name: tag, color: newTagColor }])
    setNewTag('')
    setNewTagColor(DEFAULT_TAG_COLOR)
  }
  const deleteTag = (tag) => {
    setTags(current => current.filter(value => value.name !== tag))
    setCards(current => current.map(card => ({ ...card, tags: (card.tags || []).filter(value => value !== tag) })))
    setNewCardTags(current => current.filter(value => value !== tag))
    setTagPicker(current => current === tag ? null : current)
    setTagColorPicker(current => current === tag ? null : current)
  }
  const updateTagColor = (tagName, colorId) => {
    setTags(current => current.map(tag => (
      tag.name === tagName ? { ...tag, color: colorId } : tag
    )))
    setTagColorPicker(null)
  }
  const startEditingTag = (tagName) => {
    setEditingTagName(tagName)
    setEditingTagValue(tagName)
    setTagColorPicker(null)
  }
  const saveTagName = (originalName) => {
    const nextName = normalizeTagName(editingTagValue)
    if (!nextName || nextName === originalName) {
      setEditingTagName(null)
      setEditingTagValue('')
      return
    }
    if (tags.some(tag => tag.name.toLowerCase() === nextName.toLowerCase() && tag.name !== originalName)) return
    setTags(current => current.map(tag => (
      tag.name === originalName ? { ...tag, name: nextName } : tag
    )))
    setCards(current => current.map(card => ({
      ...card,
      tags: (card.tags || []).map(tag => tag === originalName ? nextName : tag),
    })))
    setNewCardTags(current => current.map(tag => tag === originalName ? nextName : tag))
    setTagPicker(current => current === originalName ? nextName : current)
    setTagColorPicker(current => current === originalName ? nextName : current)
    setEditingTagName(null)
    setEditingTagValue('')
  }
  const addCard = () => {
    if (!newFront.trim() || !newBack.trim()) return
    const cardId = nextId++
    setCards(cs => [...cs, {
      id: cardId,
      front: newFront.trim(),
      back: newBack.trim(),
      active: true,
      tags: newCardTags,
      memory: createDefaultMemory(),
      createdAt: new Date().toISOString(),
    }])
    if (selectedDeckId) {
      setDecks(current => current.map(deck => (
        deck.id === selectedDeckId && !deck.cardIds.includes(cardId)
          ? { ...deck, cardIds: [...deck.cardIds, cardId] }
          : deck
      )))
    }
    setNewFront('')
    setNewBack('')
    setNewCardTags([])
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    const email = authEmail.trim()
    const password = authPassword

    if (!email || !password) {
      setAuthError('Email et mot de passe sont requis.')
      return
    }
    if (authMode === 'signup' && password.length < 8) {
      setAuthError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setAuthBusy(true)
    setAuthError('')
    setAuthMessage('')

    const result = authMode === 'signin'
      ? await signInWithPassword(email, password)
      : await signUpWithPassword(email, password)

    setAuthBusy(false)

    if (!result.ok) {
      setAuthError(result.error?.message || 'Impossible de terminer l’authentification.')
      return
    }

    if (authMode === 'signup') {
      setAuthPassword('')
      setAuthMessage(
        result.needsEmailConfirmation
          ? 'Compte créé. Vérifie ton email pour confirmer le compte puis reconnecte-toi.'
          : 'Compte créé. Tu es maintenant connecté.'
      )
      if (result.needsEmailConfirmation) setAuthMode('signin')
      return
    }

    setAuthPassword('')
  }

  const handleSignOut = async () => {
    await signOut()
    setAuthPassword('')
    setAuthMessage('')
    setAuthError('')
    setSchemaMissing(false)
  }

  if (!authReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: UI, color: '#a8a29e' }}>
      Chargement…
    </div>
  )

  if (!session) return (
    <AuthScreen
      mode={authMode}
      setMode={setAuthMode}
      email={authEmail}
      setEmail={setAuthEmail}
      password={authPassword}
      setPassword={setAuthPassword}
      onSubmit={handleAuthSubmit}
      authMessage={authMessage}
      authError={authError}
      authBusy={authBusy}
      isConfigured={Boolean(supabase)}
      signupEnabled={SIGNUP_ENABLED}
    />
  )

  if (schemaMissing) return (
    <SchemaSetupScreen
      email={session.user.email || 'compte inconnu'}
      onSignOut={handleSignOut}
    />
  )

  if (!cards) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: UI, color: '#a8a29e' }}>
      Chargement…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f2ee', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 80px' }}>
      <div className="window-drag-strip" />

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 500, marginBottom: 24, paddingTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: UI, fontSize: 22, fontWeight: 600, color: '#1c1917', letterSpacing: '-.4px', margin: 0 }}>Flashcards</h1>
            <p style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>
              {selectedDeck?.name || DEFAULT_DECK_NAME} · {deck.length} carte{deck.length !== 1 ? 's' : ''} dans le deck · {cards.length} au total
              {saveStatus === 'saved' && <span style={{ color: '#86efac', marginLeft: 10 }}>✓ sauvegardé</span>}
              {saveStatus === 'error' && <span style={{ color: '#fca5a5', marginLeft: 10 }}>⚠ erreur</span>}
            </p>
            <p style={{ fontFamily: UI, fontSize: 11, color: '#a8a29e', marginTop: 6 }}>
              {session.user.email}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <span style={{ fontFamily: JP, fontSize: 17, color: '#c9b99a', fontWeight: 600 }}>日本語</span>
            <button onClick={handleSignOut} style={btn({ padding: '8px 12px', fontSize: 12, background: '#f5f2ee', color: '#5f574f' })}>
              Déconnexion
            </button>
          </div>
        </div>
        <div style={{ height: 1, background: '#e2dbd0', marginTop: 16 }} />
      </div>

      {/* Tabs */}
      <div style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ display: 'flex', gap: 4, background: '#e8e3db', borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              flex: 1, padding: '9px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: UI, fontSize: 12, fontWeight: 500,
              background: tab === i ? '#fff' : 'transparent',
              color: tab === i ? '#1c1917' : '#a8a29e',
              boxShadow: tab === i ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all .2s', outline: 'none',
            }}>{t}</button>
          ))}
        </div>

        {tab === 0 && <ClassicMode key={`${selectedDeckId || 'no-deck'}:${deck.map(card => card.id).join(',')}`} deck={deck} removeFromDeck={toggleCardInSelectedDeck} rateCard={rateCard} onShuffle={shuffleDeck} onResetOrder={resetDeckOrder} canResetOrder={canResetDeckOrder} reversed={reversed} setReversed={setReversed} onChooseDeck={() => setTab(2)} />}
        {tab === 1 && <SnowballMode deck={deck} reversed={reversed} setReversed={setReversed} onShuffleVisible={shuffleDeckKeepingVisible} onResetOrder={resetDeckOrder} canResetOrder={canResetDeckOrder} snowballState={snowballState} setSnowballState={setSelectedDeckSnowballState} />}

        {/* GÉRER */}
        {tab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Decks</div>
                  <div style={{ fontFamily: UI, fontSize: 14, color: '#1c1917', marginTop: 4 }}>
                    {selectedDeck?.name || DEFAULT_DECK_NAME} · {selectedDeck?.cardIds.length || 0} carte(s)
                  </div>
                </div>
                <button
                  onClick={deleteSelectedDeck}
                  disabled={decks.length <= 1}
                  style={btn({
                    borderColor: decks.length > 1 ? '#fca5a5' : '#e8e2d9',
                    color: decks.length > 1 ? '#b91c1c' : '#a8a29e',
                    background: decks.length > 1 ? '#fff5f5' : '#f5f2ee',
                  })}
                >
                  Supprimer
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {decks.map(deckItem => (
                  <button
                    key={deckItem.id}
                    onClick={() => setSelectedDeckId(deckItem.id)}
                    style={btn({
                      padding: '8px 12px',
                      borderColor: selectedDeckId === deckItem.id ? '#1c1917' : '#d6cfc4',
                      background: selectedDeckId === deckItem.id ? '#1c1917' : '#fff',
                      color: selectedDeckId === deckItem.id ? '#faf8f5' : '#5f574f',
                    })}
                  >
                    {deckItem.name}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={newDeckName}
                  onChange={e => setNewDeckName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDeck()}
                  placeholder="Nouveau deck"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  onClick={addDeck}
                  disabled={!newDeckName.trim()}
                  style={btn({
                    background: newDeckName.trim() ? '#1c1917' : '#e8e2d9',
                    color: newDeckName.trim() ? '#faf8f5' : '#a8a29e',
                    border: 'none',
                  })}
                >
                  Creer
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {cards.length === 0
                ? <p style={{ fontFamily: UI, color: '#a8a29e', textAlign: 'center', padding: '32px 0' }}>Aucune carte.</p>
                : <p style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e' }}>{managedCards.length} flashcard(s) affichee(s) / {cards.length}</p>}
              {cards.length > 0 && (
                <button
                  onClick={allCardsIncludedInSelectedDeck ? excludeAllCardsFromSelectedDeck : includeAllCardsInSelectedDeck}
                  style={btn(
                    allCardsIncludedInSelectedDeck
                      ? { background: '#f5f2ee', color: '#5f574f' }
                      : { background: '#f5f2ee', color: '#5f574f' }
                  )}
                >
                  {allCardsIncludedInSelectedDeck ? 'Exclure tout' : 'Inclure tout'}
                </button>
              )}
            </div>
            {cards.length > 0 && (
              <div style={{ width: '100%' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Tri</span>
                  <select value={manageSort} onChange={e => updateSelectedDeckSort(e.target.value)} style={{ width: '100%', padding: '10px 38px 10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 13, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}>
                    <option value="created-desc">Ordre d'ajout recent</option>
                    <option value="alpha">Ordre alphabetique</option>
                    <option value="created-asc">Ordre d'ajout ancien</option>
                    <option value="recent-review">Revise le plus recemment</option>
                    <option value="mastery">Score de memorisation</option>
                  </select>
                </label>
              </div>
            )}
            {cards.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontFamily: UI, fontSize: 12, fontWeight: 600, color: '#1c1917' }}>Inactif en bas</span>
                  <span style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e' }}>Trie les actifs ensemble, puis les inactifs ensemble.</span>
                </div>
                <ToggleSwitch
                  checked={manageGroupInactive}
                  onChange={() => setManageGroupInactive(current => !current)}
                  onLabel="On"
                  offLabel="Off"
                />
              </div>
            )}
            {cards.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setManageFiltersOpen(open => !open)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: UI,
                    color: '#1c1917',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    Filtres
                  </span>
                  <span style={{ fontSize: 14, color: '#78716c', paddingRight: 2 }}>{manageFiltersOpen ? '▾' : '▸'}</span>
                </button>
                {manageFiltersOpen && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, padding: '0 14px 14px' }}>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={clearManageFilters} style={btn({ padding: '8px 12px', fontSize: 12, background: '#f5f2ee', color: '#5f574f' })}>
                        Clear filters
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Filtre tag</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {tags.map(tag => {
                          const active = manageTagFilter.includes(tag.name)
                          const color = getTagColorOption(tag.color)
                          return (
                            <button
                              key={tag.name}
                              type="button"
                              onClick={() => setManageTagFilter(current => toggleFilterValue(current, tag.name))}
                              style={btn({
                                padding: '6px 10px',
                                fontSize: 12,
                                borderColor: active ? color.text : color.border,
                                background: color.bg,
                                color: color.text,
                              })}
                            >
                              {tag.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Filtre etat</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                          { id: 'active', label: 'Actif' },
                          { id: 'inactive', label: 'Inactif' },
                        ].map(option => {
                          const active = manageStatusFilter.includes(option.id)
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setManageStatusFilter(current => toggleFilterValue(current, option.id))}
                              style={btn({
                                padding: '6px 10px',
                                fontSize: 12,
                                borderColor: active ? '#1c1917' : '#d6cfc4',
                                background: active ? '#1c1917' : '#fff',
                                color: active ? '#faf8f5' : '#5f574f',
                              })}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Filtre score</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {['1', '2', '3', '4', '5'].map(score => {
                          const active = manageMasteryFilter.includes(score)
                          return (
                            <button
                              key={score}
                              type="button"
                              onClick={() => setManageMasteryFilter(current => toggleFilterValue(current, score))}
                              style={btn({
                                padding: '6px 10px',
                                fontSize: 12,
                                borderColor: active ? '#1c1917' : '#d6cfc4',
                                background: active ? '#1c1917' : '#fff',
                                color: active ? '#faf8f5' : '#5f574f',
                              })}
                            >
                              {score} / 5
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Filtre date d'ajout</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                          { id: 'today', label: "Aujourd'hui" },
                          { id: '7d', label: '7 jours' },
                          { id: '30d', label: '30 jours' },
                        ].map(option => {
                          const active = manageDateFilter.includes(option.id)
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setManageDateFilter(current => toggleFilterValue(current, option.id))}
                              style={btn({
                                padding: '6px 10px',
                                fontSize: 12,
                                borderColor: active ? '#1c1917' : '#d6cfc4',
                                background: active ? '#1c1917' : '#fff',
                                color: active ? '#faf8f5' : '#5f574f',
                              })}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {managedCards.map(c => (
              <div key={c.id} style={{
                display: 'flex', flexDirection: 'column', gap: 12,
                background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12,
                padding: '13px 16px', opacity: selectedDeck?.cardIds.includes(c.id) ? 1 : 0.55, transition: 'opacity .2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: JP, fontSize: 20, fontWeight: 600, color: '#1c1917' }}>{c.front}</div>
                    <div style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>{c.back}</div>
                  </div>
                  <span style={{ fontFamily: UI, fontSize: 11, color: '#5f574f', background: '#ece8e2', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    {getMasteryVisual(c.memory?.mastery || 1).icon} {c.memory?.mastery || 1}/5
                  </span>
                  <ToggleSwitch
                    checked={!!selectedDeck?.cardIds.includes(c.id)}
                    onChange={() => toggleCardInSelectedDeck(c.id)}
                    onLabel="Dans deck"
                    offLabel="Hors deck"
                  />
                  <button onClick={() => deleteCard(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d6cfc4', fontSize: 18, padding: '0 4px' }}>×</button>
                </div>
                {(c.tags || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(c.tags || []).map(tag => {
                      const { color } = getTagStyle(tags, tag)
                      return (
                        <button
                          key={`${c.id}-${tag}`}
                          onClick={() => toggleCardTag(c.id, tag)}
                          style={btn({
                            padding: '5px 10px',
                            fontSize: 11,
                            borderColor: color.border,
                            background: color.bg,
                            color: color.text,
                            borderRadius: 999,
                          })}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            {cards.length > 0 && managedCards.length === 0 && (
              <p style={{ fontFamily: UI, color: '#a8a29e', textAlign: 'center', padding: '24px 0' }}>Aucune carte ne correspond aux filtres.</p>
            )}
          </div>
        )}

        {/* AJOUTER */}
        {tab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontFamily: UI, fontSize: 11, color: '#78716c', display: 'block', marginBottom: 8, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Recto — question
              </label>
              <input value={newFront} onChange={e => setNewFront(e.target.value)} placeholder="ex : ねこ"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: JP, fontSize: 28, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontFamily: UI, fontSize: 11, color: '#78716c', display: 'block', marginBottom: 8, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Verso — réponse
              </label>
              <input value={newBack} onChange={e => setNewBack(e.target.value)} placeholder="ex : Chat 🐱"
                onKeyDown={e => e.key === 'Enter' && addCard()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 17, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontFamily: UI, fontSize: 11, color: '#78716c', display: 'block', marginBottom: 8, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Tags
              </label>
              {tags.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map(tag => {
                    const selected = newCardTags.includes(tag.name)
                    const color = getTagColorOption(tag.color)
                    return (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => toggleNewCardTag(tag.name)}
                        style={btn({
                          padding: '8px 12px',
                          borderColor: selected ? color.text : color.border,
                          background: color.bg,
                          color: color.text,
                        })}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e' }}>Crée d’abord des tags dans l’onglet Tags.</p>
              )}
            </div>
            <div style={{ height: 1, background: '#e8e2d9' }} />
            <button onClick={addCard} disabled={!newFront.trim() || !newBack.trim()}
              style={btn({
                padding: 14, width: '100%', fontSize: 14,
                background: newFront.trim() && newBack.trim() ? '#1c1917' : '#e8e2d9',
                color: newFront.trim() && newBack.trim() ? '#faf8f5' : '#a8a29e',
                border: 'none',
              })}>
              Ajouter la carte
            </button>
          </div>
        )}

        {tab === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="ex : animaux"
                style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                onClick={addTag}
                disabled={!newTag.trim()}
                style={btn({
                  padding: '12px 14px',
                  background: newTag.trim() ? '#1c1917' : '#e8e2d9',
                  color: newTag.trim() ? '#faf8f5' : '#a8a29e',
                  border: 'none',
                })}
              >
                Ajouter
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TAG_COLOR_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setNewTagColor(option.id)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: `2px solid ${newTagColor === option.id ? option.text : option.border}`,
                    background: option.bg,
                    cursor: 'pointer',
                  }}
                  aria-label={option.label}
                  title={option.label}
                />
              ))}
            </div>

            {tags.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tags.map(tag => (
                  <div
                    key={tag.name}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      background: '#fff',
                      border: '1px solid #e8e2d9',
                      borderRadius: 12,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => setTagColorPicker(current => current === tag.name ? null : tag.name)}
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 999,
                              background: getTagColorOption(tag.color).bg,
                              border: `1px solid ${getTagColorOption(tag.color).border}`,
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'transform .15s ease, box-shadow .15s ease',
                              boxShadow: tagColorPicker === tag.name ? '0 0 0 3px rgba(0,0,0,0.06)' : 'none',
                            }}
                            aria-label={`Changer la couleur du tag ${tag.name}`}
                            title="Changer la couleur"
                            onMouseEnter={(event) => { event.currentTarget.style.transform = 'scale(1.08)' }}
                            onMouseLeave={(event) => { event.currentTarget.style.transform = 'scale(1)' }}
                          />
                          {tagColorPicker === tag.name && (
                            <div style={{
                              position: 'absolute',
                              top: 22,
                              left: 0,
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 6,
                              width: 116,
                              padding: 8,
                              borderRadius: 10,
                              background: '#fff',
                              border: '1px solid #e8e2d9',
                              boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
                              zIndex: 20,
                            }}>
                              {TAG_COLOR_OPTIONS.map(option => (
                                <button
                                  key={`${tag.name}-${option.id}`}
                                  type="button"
                                  onClick={() => updateTagColor(tag.name, option.id)}
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 999,
                                    border: `2px solid ${tag.color === option.id ? option.text : option.border}`,
                                    background: option.bg,
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                  aria-label={option.label}
                                  title={option.label}
                                />
                              ))}
                            </div>
                          )}
                          {editingTagName === tag.name ? (
                            <input
                              value={editingTagValue}
                              onChange={e => setEditingTagValue(e.target.value)}
                              onBlur={() => saveTagName(tag.name)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveTagName(tag.name)
                                if (e.key === 'Escape') {
                                  setEditingTagName(null)
                                  setEditingTagValue('')
                                }
                              }}
                              autoFocus
                              style={{
                                fontFamily: UI,
                                fontSize: 15,
                                fontWeight: 600,
                                color: '#1c1917',
                                border: '1px solid #d6cfc4',
                                borderRadius: 8,
                                padding: '4px 8px',
                                outline: 'none',
                                background: '#fff',
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditingTag(tag.name)}
                              style={{
                                fontFamily: UI,
                                fontSize: 15,
                                fontWeight: 600,
                                color: '#1c1917',
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                borderRadius: 6,
                                transition: 'background .15s ease, color .15s ease',
                              }}
                              onMouseEnter={(event) => { event.currentTarget.style.background = '#f5f2ee' }}
                              onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
                              title="Renommer le tag"
                            >
                              {tag.name}
                            </button>
                          )}
                        </div>
                        <div style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>
                          {(cards || []).filter(card => (card.tags || []).includes(tag.name)).length} carte(s)
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => setTagPicker(current => current === tag.name ? null : tag.name)}
                          style={btn({ borderColor: '#d6cfc4', color: '#5f574f', background: '#f5f2ee' })}
                        >
                          Ajouter
                        </button>
                        <button onClick={() => deleteTag(tag.name)} style={btn({ borderColor: '#fca5a5', color: '#b91c1c', background: '#fff5f5' })}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                    {tagPicker === tag.name && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #eee7de', paddingTop: 12 }}>
                        <div style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                          Ajouter ce tag aux flashcards
                        </div>
                        {(cards || []).length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {cards.map(card => {
                              const selected = (card.tags || []).includes(tag.name)
                              return (
                                <button
                                  key={`${tag.name}-${card.id}`}
                                  onClick={() => toggleCardTag(card.id, tag.name)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: `1px solid ${selected ? '#1c1917' : '#e8e2d9'}`,
                                    background: selected ? '#f5f2ee' : '#fff',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                                    <div style={{ fontFamily: JP, fontSize: 18, fontWeight: 600, color: '#1c1917' }}>{card.front}</div>
                                    <div style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>{card.back}</div>
                                  </div>
                                  <span style={{ fontFamily: UI, fontSize: 11, color: selected ? '#faf8f5' : getTagColorOption(tag.color).text, background: selected ? getTagColorOption(tag.color).text : getTagColorOption(tag.color).bg, padding: '4px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                                    {selected ? 'Ajoute' : 'Ajouter'}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <p style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e' }}>Aucune flashcard disponible.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: UI, color: '#a8a29e', textAlign: 'center', padding: '24px 0' }}>Aucun tag pour le moment.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
