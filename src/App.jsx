import { useState, useEffect, useRef, useCallback } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import {
  DAY_MS,
  advanceMemory,
  createDefaultMemory,
  getMasteryVisual,
  getNextReviewSummary,
  isCardDueToday,
  normalizeMemory,
} from './reviewUtils'
import { createSnowballState, reconcileSnowballState, reorderVisibleCards, shuffleSnowballGroups } from './snowballUtils'

const DEFAULT_CARDS = [
  { id: 1, front: 'ねこ', back: 'Chat 🐱', active: true, tags: [] },
  { id: 2, front: 'いぬ', back: 'Chien 🐶', active: true, tags: [] },
  { id: 3, front: 'さかな', back: 'Poisson 🐟', active: true, tags: [] },
]

let nextId = 10

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
const DISPLAY_SETTINGS_KEY = 'flashcards-display-settings'
const DISPLAY_MODE_OPTIONS = [
  { id: 'primary', label: 'Ligne principale' },
  { id: 'both', label: 'Les deux' },
  { id: 'secondary', label: 'Seconde ligne' },
  { id: 'secondary-first', label: 'Seconde puis principale' },
]
const DEFAULT_DISPLAY_SETTINGS = { frontMode: 'primary', backMode: 'primary', showMasteryBadge: false }
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
const normalizeCard = (card) => ({
  ...card,
  frontNote: (card.frontNote || '').trim(),
  backNote: (card.backNote || '').trim(),
  active: card.active ?? true,
  tags: dedupeTags((card.tags || []).map(tag => ({ name: tag, color: DEFAULT_TAG_COLOR }))).map(tag => tag.name),
  memory: normalizeMemory(card.memory),
  createdAt: card.createdAt || new Date().toISOString(),
})
const loadDisplaySettings = () => {
  if (typeof window === 'undefined') return DEFAULT_DISPLAY_SETTINGS
  try {
    const raw = window.localStorage.getItem(DISPLAY_SETTINGS_KEY)
    if (!raw) return DEFAULT_DISPLAY_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      frontMode: DISPLAY_MODE_OPTIONS.some(option => option.id === parsed.frontMode) ? parsed.frontMode : 'primary',
      backMode: DISPLAY_MODE_OPTIONS.some(option => option.id === parsed.backMode) ? parsed.backMode : 'primary',
      showMasteryBadge: parsed.showMasteryBadge === true,
    }
  } catch {
    return DEFAULT_DISPLAY_SETTINGS
  }
}
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
function FaceText({ primary, secondary, mode, primaryFont, primarySize, secondaryFont, secondarySize, primaryColor, secondaryColor, align = 'center' }) {
  const trimmedPrimary = (primary || '').trim()
  const trimmedSecondary = (secondary || '').trim()
  const showSecondaryOnly = mode === 'secondary' && trimmedSecondary
  const showSecondaryFirst = mode === 'secondary-first' && trimmedSecondary
  const mainText = showSecondaryOnly || showSecondaryFirst ? trimmedSecondary : trimmedPrimary
  const subText = mode === 'both'
    ? trimmedSecondary
    : showSecondaryFirst
      ? trimmedPrimary
      : ''
  const mainFont = primaryFont
  const mainSize = primarySize
  const mainColor = primaryColor

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: subText ? 10 : 0, alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align }}>
      <div style={{ fontFamily: mainFont, fontSize: mainSize, fontWeight: 600, color: mainColor, lineHeight: 1.2 }}>{mainText}</div>
      {subText && (
        <div style={{ fontFamily: secondaryFont || primaryFont, fontSize: secondarySize || primarySize * 0.5, fontWeight: 500, color: secondaryColor || primaryColor, lineHeight: 1.35, opacity: 0.72 }}>
          {subText}
        </div>
      )}
    </div>
  )
}

function getFaceTextMetrics(primary, secondary, mode, primarySize, secondarySize) {
  const trimmedPrimary = (primary || '').trim()
  const trimmedSecondary = (secondary || '').trim()
  const showSecondaryOnly = mode === 'secondary' && trimmedSecondary
  const showSecondaryFirst = mode === 'secondary-first' && trimmedSecondary
  const mainText = showSecondaryOnly || showSecondaryFirst ? trimmedSecondary : trimmedPrimary
  const subText = mode === 'both'
    ? trimmedSecondary
    : showSecondaryFirst
      ? trimmedPrimary
      : ''

  const mainHeight = mainText ? primarySize * 1.2 : 0
  const subHeight = subText ? 10 + (secondarySize || primarySize * 0.5) * 1.35 : 0

  return mainHeight + subHeight
}

function FlipCard({ front, frontNote, back, backNote, flipped, onClick, reversed, displaySettings = DEFAULT_DISPLAY_SETTINGS, masteryVisual = null, mastery = null }) {
  const faceA = reversed ? back : front
  const faceANote = reversed ? backNote : frontNote
  const faceB = reversed ? front : back
  const faceBNote = reversed ? frontNote : backNote
  const sizeA = reversed ? 28 : 54
  const sizeB = reversed ? 54 : 28
  const fontA = reversed ? UI : JP
  const fontB = reversed ? JP : UI
  const modeA = reversed ? displaySettings.backMode : displaySettings.frontMode
  const modeB = reversed ? displaySettings.frontMode : displaySettings.backMode

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
          <FaceText
            primary={faceA}
            secondary={faceANote}
            mode={modeA}
            primaryFont={fontA}
            primarySize={sizeA}
            secondaryFont={fontA}
            secondarySize={Math.max(16, Math.round(sizeA * 0.48))}
            primaryColor="#1c1917"
            secondaryColor="#78716c"
          />
          {displaySettings.showMasteryBadge && masteryVisual && mastery !== null && (
            <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ece8e2', borderRadius: 999, padding: '6px 10px', fontFamily: UI, fontSize: 12, color: '#5f574f' }}>
              <span style={{ fontSize: 13, color: '#1c1917' }}>{masteryVisual.icon}</span>
              <span>{mastery}/5</span>
            </div>
          )}
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: '#1c1917', borderRadius: 16, border: '1px solid #2e2a26',
          boxShadow: '0 6px 32px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          <FaceText
            primary={faceB}
            secondary={faceBNote}
            mode={modeB}
            primaryFont={fontB}
            primarySize={sizeB}
            secondaryFont={fontB}
            secondarySize={Math.max(16, Math.round(sizeB * 0.5))}
            primaryColor="#faf8f5"
            secondaryColor="#d6cfc4"
          />
          {displaySettings.showMasteryBadge && masteryVisual && mastery !== null && (
            <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '6px 10px', fontFamily: UI, fontSize: 12, color: '#d6cfc4' }}>
              <span style={{ fontSize: 13, color: '#faf8f5' }}>{masteryVisual.icon}</span>
              <span>{mastery}/5</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Switch JP/FR ──────────────────────────────────────────────────────────────
function DirSwitch({ reversed, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ece8e2', borderRadius: 50, padding: '5px 14px' }}>
      <span style={{ fontFamily: UI, fontSize: 13, fontWeight: 600, color: reversed ? '#a8a29e' : '#1c1917', transition: 'color .2s' }}>Recto</span>
      <div onClick={onChange} style={{ width: 38, height: 21, borderRadius: 11, cursor: 'pointer', background: reversed ? '#1c1917' : '#d6cfc4', position: 'relative', transition: 'background .25s' }}>
        <div style={{ position: 'absolute', top: 2.5, left: reversed ? 19 : 2.5, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left .25s cubic-bezier(.4,.2,.2,1)' }} />
      </div>
      <span style={{ fontFamily: UI, fontSize: 13, fontWeight: 500, color: reversed ? '#1c1917' : '#a8a29e', transition: 'color .2s' }}>Verso</span>
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

function SnowballRowContent({
  card,
  isFlipped,
  reversed,
  displaySettings = DEFAULT_DISPLAY_SETTINGS,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  rowOffsetX = 0,
  dragHandleProps = {},
  isDragging = false,
  interactionLocked = false,
}) {
  const faceA = reversed ? card.back : card.front
  const faceANote = reversed ? card.backNote : card.frontNote
  const faceB = reversed ? card.front : card.back
  const faceBNote = reversed ? card.frontNote : card.backNote
  const fontA = reversed ? UI : JP
  const fontB = reversed ? JP : UI
  const sizeA = reversed ? 15 : 26
  const sizeB = reversed ? 26 : 15
  const modeA = reversed ? displaySettings.backMode : displaySettings.frontMode
  const modeB = reversed ? displaySettings.frontMode : displaySettings.backMode
  const baseHandleColor = isFlipped ? '#6b6259' : '#c9c1b6'
  const secondarySizeA = isFlipped ? 12 : 14
  const secondarySizeB = isFlipped ? 14 : 12
  const faceAHeight = getFaceTextMetrics(faceA, faceANote, modeA, sizeA, 14)
  const faceBHeight = getFaceTextMetrics(faceB, faceBNote, modeB, sizeB, 12)
  const sharedMinHeight = Math.max(76, Math.ceil(Math.max(faceAHeight, faceBHeight) + 28))
  const {
    onPointerDown: handleDragPointerDown,
    onClick: handleDragClick,
    ...restDragHandleProps
  } = dragHandleProps

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        background: rowOffsetX < 0 ? '#fff5f5' : rowOffsetX > 0 ? '#f0fdf4' : '#f5f2ee',
        color: rowOffsetX < 0 ? '#b91c1c' : rowOffsetX > 0 ? '#15803d' : '#a8a29e',
        fontFamily: UI,
        fontSize: 12,
        fontWeight: 600,
        opacity: !isDragging && Math.abs(rowOffsetX) > 0 ? 1 : 0,
        transition: 'opacity .12s ease',
      }}>
        <span>Masquer en bas</span>
        <span>Masquer en haut</span>
      </div>
      <div
        className="snowball-row"
        onPointerDown={interactionLocked ? undefined : onPointerDown}
        onPointerMove={interactionLocked ? undefined : onPointerMove}
        onPointerUp={interactionLocked ? undefined : onPointerUp}
        onPointerCancel={interactionLocked ? undefined : onPointerUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: isFlipped ? '#1c1917' : '#fff',
          border: '1px solid',
          borderColor: isFlipped ? '#2e2a26' : '#e2dbd0',
          borderRadius: 12,
          padding: '14px 18px',
          minHeight: sharedMinHeight,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: interactionLocked ? 'default' : 'pointer',
          transition: rowOffsetX === 0 ? 'background .22s, border-color .22s, transform .18s ease' : 'none',
          transform: `translateX(${rowOffsetX}px)`,
          touchAction: 'pan-y',
          opacity: isDragging ? 0 : 1,
          boxShadow: 'none',
        }}
      >
        <div style={{ flex: 1, userSelect: 'none', WebkitUserSelect: 'none' }}>
          <FaceText
            primary={isFlipped ? faceB : faceA}
            secondary={isFlipped ? faceBNote : faceANote}
            mode={isFlipped ? modeB : modeA}
            primaryFont={isFlipped ? fontB : fontA}
            primarySize={isFlipped ? sizeB : sizeA}
            secondaryFont={isFlipped ? fontB : fontA}
            secondarySize={isFlipped ? secondarySizeB : secondarySizeA}
            primaryColor={isFlipped ? '#faf8f5' : '#1c1917'}
            secondaryColor={isFlipped ? '#c9c1b6' : '#8a8178'}
            align="left"
          />
        </div>
        <button
          type="button"
          {...restDragHandleProps}
          onPointerDown={(event) => {
            event.stopPropagation()
            handleDragPointerDown?.(event)
          }}
          onClick={(event) => {
            event.stopPropagation()
            handleDragClick?.(event)
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.color = isFlipped ? '#8b8176' : '#8f857b'
            event.currentTarget.style.background = isFlipped ? 'rgba(255,255,255,0.06)' : '#f5f2ee'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = baseHandleColor
            event.currentTarget.style.background = 'transparent'
          }}
          aria-label="Deplacer cette carte"
          style={{
            alignSelf: 'stretch',
            background: 'transparent',
            border: 'none',
            cursor: 'grab',
            color: baseHandleColor,
            fontSize: 18,
            lineHeight: 1,
            padding: '0 18px',
            margin: '-14px -18px -14px 18px',
            borderRadius: '0 12px 12px 0',
            touchAction: 'none',
            transition: 'color .15s ease, background .15s ease',
          }}
        >
          ⋮⋮
        </button>
      </div>
    </div>
  )
}

function SortableSnowballRow({ cardId, children, hidePlaceholder = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cardId })

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{
          height: hidePlaceholder ? 0 : 76,
          borderRadius: 12,
          background: hidePlaceholder ? 'transparent' : '#e7e5e4',
          border: hidePlaceholder ? 'none' : '1px dashed #b0a79c',
          transform: CSS.Transform.toString(transform),
          transition,
          overflow: 'hidden',
        }}
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children({
        isDragging: false,
        dragHandleProps: {
          ...attributes,
          ...listeners,
        },
      })}
    </div>
  )
}

function SnowballTrash({ active }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'snowball-trash' })

  if (!active) return null

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 64,
        borderRadius: 14,
        border: isOver ? '2px solid #f87171' : '2px dashed #fca5a5',
        background: isOver ? '#fee2e2' : '#fff5f5',
        color: isOver ? '#dc2626' : '#b91c1c',
        fontFamily: UI,
        fontSize: isOver ? 14 : 13,
        fontWeight: 600,
        transform: isOver ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.18s ease, background 0.15s ease, border 0.15s ease, font-size 0.15s ease, color 0.15s ease',
      }}
    >
      🗑️ Sortir de la session
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

// ── Mode Classique ────────────────────────────────────────────────────────────
export function ClassicMode({ deck, removeFromDeck, rateCard, onShuffle, onResetOrder, canResetOrder, reversed, setReversed, onChooseDeck, intelligentMode = false, nextReviewSummary = null, displaySettings = DEFAULT_DISPLAY_SETTINGS }) {
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
  const formatReviewDate = (value) => new Date(value).toLocaleDateString('fr-FR')

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

  const animateLoopAction = (direction, action) => {
    if (!current || sliding) return
    const exitDistance = Math.max((cardShellRef.current?.offsetWidth || 320) + 80, 360)
    setSliding(direction)
    setFlipped(false)
    setDragX(direction === 'left' ? -exitDistance : exitDistance)
    setTimeout(() => {
      action()
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

  const removeCurrentFromLoop = (options = {}) => {
    if (!current) return
    const { rating = null } = options
    if (rating) rateCard(current.id, rating)
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

  const retryCurrentInLoop = (options = {}) => {
    if (!current) return
    const { rating = null } = options
    if (rating) rateCard(current.id, rating)
    setFlipped(false)
    setRemainingIds(currentIds => {
      if (currentIds.length <= 1) {
        setCardRenderKey(key => key + 1)
        return currentIds
      }
      const nextIds = currentIds.filter(id => id !== current.id)
      nextIds.push(current.id)
      setIdx(currentIdx => Math.min(currentIdx, nextIds.length - 1))
      return nextIds
    })
  }

  const completeCard = (rating) => {
    if (intelligentMode && rating === 'again') {
      retryCurrentInLoop({ rating })
      return
    }
    removeCurrentFromLoop({ rating })
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (sliding) return
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
    const moved = pointerStateRef.current.moved
    const deltaX = event.clientX - pointerStateRef.current.startX
    pointerStateRef.current = { id: null, startX: 0, moved: false }
    setDragging(false)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (Math.abs(deltaX) < swipeThreshold) {
      setDragX(0)
      if (!moved && Math.abs(deltaX) <= 3) {
        setFlipped(current => !current)
      }
      return
    }
    if (intelligentMode) {
      setDragX(0)
      return
    }
    if (deltaX < 0) {
      animateLoopAction('left', retryCurrentInLoop)
      return
    }
    animateLoopAction('right', () => removeCurrentFromLoop())
  }

  if (!deck.length) return <EmptyDeck />
  if (done) {
    if (intelligentMode) {
      return (
        <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 16, padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>✓</div>
          <div style={{ fontFamily: UI, fontSize: 16, fontWeight: 600, color: '#1c1917' }}>Rien à réviser aujourd’hui</div>
          <div style={{ fontFamily: UI, fontSize: 13, color: '#a8a29e', marginTop: 6 }}>
            Ce mode montre uniquement les cartes dues aujourd’hui selon la répétition espacée.
          </div>
          {nextReviewSummary && (
            <div style={{ marginTop: 18, background: '#f8f6f2', border: '1px solid #ece8e2', borderRadius: 12, padding: '12px 14px', textAlign: 'left' }}>
              <div style={{ fontFamily: UI, fontSize: 11, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Prochaine revision
              </div>
              <div style={{ fontFamily: UI, fontSize: 15, color: '#1c1917', marginTop: 6 }}>
                {nextReviewSummary.dateLabel}
              </div>
              <div style={{ fontFamily: UI, fontSize: 12, color: '#78716c', marginTop: 4 }}>
                {nextReviewSummary.count} carte{nextReviewSummary.count !== 1 ? 's' : ''} a reviser
              </div>
            </div>
          )}
        </div>
      )
    }
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
  const predictedReviews = intelligentMode && current ? ['again', 'hard', 'good', 'easy'].map(rating => {
    const nextMemory = advanceMemory(current.memory, rating)
    const targetDay = new Date(nextMemory.nextReviewAt)
    const dueCount = deck.filter(card => {
      if (card.id === current.id) return isCardDueToday({ ...card, memory: nextMemory }, targetDay)
      return isCardDueToday(card, targetDay)
    }).length
    return {
      rating,
      dateLabel: formatReviewDate(nextMemory.nextReviewAt),
      dueCount,
    }
  }) : []

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
        <FlipCard
          front={current.front}
          frontNote={current.frontNote}
          back={current.back}
          backNote={current.backNote}
          flipped={flipped}
          reversed={reversed}
          displaySettings={displaySettings}
          masteryVisual={masteryVisual}
          mastery={mastery}
        />
      </div>

      {flipped && intelligentMode && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, width: '100%' }}>
          {predictedReviews.map(option => (
            <button key={option.rating} onClick={() => completeCard(option.rating)} style={btn({
              padding: '10px 8px',
              fontSize: 12,
              borderColor: option.rating === 'again' ? '#fecaca' : option.rating === 'hard' ? '#fde68a' : option.rating === 'good' ? '#bfdbfe' : '#bbf7d0',
              background: option.rating === 'again' ? '#fff5f5' : option.rating === 'hard' ? '#fffbea' : option.rating === 'good' ? '#eff6ff' : '#f0fdf4',
              color: option.rating === 'again' ? '#b91c1c' : option.rating === 'hard' ? '#a16207' : option.rating === 'good' ? '#1d4ed8' : '#15803d',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            })}>
              <span>{option.rating === 'again' ? 'Encore' : option.rating === 'hard' ? 'Dur' : option.rating === 'good' ? 'Bien' : 'Facile'}</span>
            </button>
          ))}
        </div>
      )}

      {!intelligentMode && (
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button onClick={() => animateLoopAction('left', retryCurrentInLoop)} style={btn({ flex: 1, borderColor: '#fecaca', background: '#fff5f5', color: '#b91c1c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}>
            ↻ Reessayer
          </button>
          <button onClick={() => {
            removeFromDeck(current.id)
            removeCurrentFromLoop()
          }} style={btn({ flex: 2.2, background: '#f5f2ee', color: '#5f574f', borderColor: '#d6cfc4' })}>
            Retirer du deck
          </button>
          <button onClick={() => animateLoopAction('right', () => removeCurrentFromLoop())} style={btn({ flex: 1, borderColor: '#bbf7d0', background: '#f0fdf4', color: '#15803d', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}>
            ✓ Valider
          </button>
        </div>
      )}

      {intelligentMode && (
        <button onClick={() => {
          removeFromDeck(current.id)
          removeCurrentFromLoop()
        }} style={btn({ width: '100%', background: '#f5f2ee', color: '#5f574f', borderColor: '#d6cfc4' })}>
          Retirer du deck
        </button>
      )}
    </div>
  )
}

// ── Mode Accumulation ─────────────────────────────────────────────────────────
function SnowballMode({ deck, reversed, setReversed, onShuffleVisible, onResetOrder, canResetOrder, snowballState, setSnowballState, onPlaceInvisibleCard, onReorderVisibleCards, displaySettings = DEFAULT_DISPLAY_SETTINGS }) {
  const visibleIds = snowballState?.visibleIds || []
  const flipped = snowballState?.flipped || {}
  const done = snowballState?.done || false
  const removedCards = snowballState?.removedCards || []
  const sessionExcludedIds = snowballState?.sessionExcludedIds || []
  const [swipeState, setSwipeState] = useState({ id: null, offsetX: 0 })
  const [activeDragId, setActiveDragId] = useState(null)
  const [isOverTrash, setIsOverTrash] = useState(false)
  const rowPointerRef = useRef({ id: null, cardId: null, startX: 0, startY: 0, moved: false, swiping: false })
  const magnetLockedRef = useRef(false)
  const swipeThreshold = 78
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const MAGNET_RANGE = 40
  const ESCAPE_RANGE = 30

  const magneticCollisionDetection = useCallback((args) => {
    const { droppableContainers, droppableRects, pointerCoordinates } = args
    if (!pointerCoordinates) return closestCenter(args)

    const trashContainer = droppableContainers.find(c => c.id === 'snowball-trash')
    const trashRect = trashContainer ? droppableRects.get(trashContainer.id) : null

    if (trashRect) {
      const dx = Math.max(0, trashRect.left - pointerCoordinates.x, pointerCoordinates.x - (trashRect.left + trashRect.width))
      const dy = Math.max(0, trashRect.top - pointerCoordinates.y, pointerCoordinates.y - (trashRect.top + trashRect.height))
      const distance = Math.sqrt(dx * dx + dy * dy)
      const range = magnetLockedRef.current ? MAGNET_RANGE + ESCAPE_RANGE : MAGNET_RANGE

      if (distance <= range) {
        magnetLockedRef.current = true
        return [{ id: 'snowball-trash' }]
      }
    }

    magnetLockedRef.current = false
    return closestCenter({
      ...args,
      droppableContainers: droppableContainers.filter(c => c.id !== 'snowball-trash'),
    })
  }, [])

  const waveCards = visibleIds
    .map(id => deck.find(card => card.id === id))
    .filter(Boolean)
  const invisibleIds = deck
    .map(card => card.id)
    .filter(id => !visibleIds.includes(id) && !sessionExcludedIds.includes(id))
  const hiddenIds = invisibleIds
  const sessionCardTotal = Math.max(0, deck.length - sessionExcludedIds.length)
  const interactionLocked = activeDragId !== null
  const restart = () => {
    setSnowballState(createSnowballState(deck))
  }
  const nextWave = () => {
    if (invisibleIds.length > 0) {
      setSnowballState(current => ({
        ...current,
        removedCards: current.removedCards.filter(id => id !== invisibleIds[0]),
        visibleIds: [...current.visibleIds, invisibleIds[0]],
        flipped: {},
      }))
      return
    }
    setSnowballState(current => ({ ...current, done: true }))
  }
  const hideCard = (cardId, position) => {
    onPlaceInvisibleCard(cardId, position, visibleIds)
    setSnowballState(current => {
      const nextFlipped = { ...current.flipped }
      delete nextFlipped[cardId]
      return {
        ...current,
        done: false,
        flipped: nextFlipped,
        removedCards: position === 'top'
          ? [cardId, ...current.removedCards.filter(id => id !== cardId)]
          : [...current.removedCards.filter(id => id !== cardId), cardId],
        visibleIds: current.visibleIds.filter(id => id !== cardId),
      }
    })
  }
  const handleRowPointerDown = (cardId, event) => {
    if (interactionLocked) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    rowPointerRef.current = { id: event.pointerId, cardId, startX: event.clientX, startY: event.clientY, moved: false, swiping: false }
    setSwipeState({ id: cardId, offsetX: 0 })
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const handleRowPointerMove = (cardId, event) => {
    if (interactionLocked) return
    if (rowPointerRef.current.id !== event.pointerId || rowPointerRef.current.cardId !== cardId) return
    const offsetX = event.clientX - rowPointerRef.current.startX
    const offsetY = event.clientY - rowPointerRef.current.startY
    const absX = Math.abs(offsetX)
    const absY = Math.abs(offsetY)
    if (!rowPointerRef.current.swiping) {
      if (absY > 8 && absY > absX) {
        rowPointerRef.current.moved = true
        setSwipeState({ id: cardId, offsetX: 0 })
        return
      }
      if (absX < 14 || absX <= absY * 1.15) {
        if (absX > 4 || absY > 4) rowPointerRef.current.moved = true
        setSwipeState({ id: cardId, offsetX: 0 })
        return
      }
      rowPointerRef.current.swiping = true
    }
    rowPointerRef.current.moved = true
    setSwipeState({ id: cardId, offsetX: Math.max(-120, Math.min(120, offsetX)) })
  }
  const handleRowPointerUp = (cardId, event) => {
    if (interactionLocked) return
    if (rowPointerRef.current.id !== event.pointerId || rowPointerRef.current.cardId !== cardId) return
    const offsetX = event.clientX - rowPointerRef.current.startX
    const offsetY = event.clientY - rowPointerRef.current.startY
    const moved = rowPointerRef.current.moved
    const swiping = rowPointerRef.current.swiping
    rowPointerRef.current = { id: null, cardId: null, startX: 0, startY: 0, moved: false, swiping: false }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (swiping && offsetX <= -swipeThreshold) {
      setSwipeState({ id: null, offsetX: 0 })
      hideCard(cardId, 'top')
      return
    }
    if (swiping && offsetX >= swipeThreshold) {
      setSwipeState({ id: null, offsetX: 0 })
      hideCard(cardId, 'bottom')
      return
    }
    setSwipeState({ id: null, offsetX: 0 })
    if (!moved && Math.abs(offsetX) <= 3 && Math.abs(offsetY) <= 3) {
      setSnowballState(current => ({ ...current, flipped: { ...current.flipped, [cardId]: !current.flipped[cardId] } }))
    }
  }
  const handleVisibleDrop = (draggedCardId, targetId) => {
    if (!draggedCardId || draggedCardId === targetId) return
    const nextVisibleIds = onReorderVisibleCards(draggedCardId, targetId, visibleIds)
    setSnowballState(current => ({ ...current, visibleIds: nextVisibleIds }))
  }
  const handleTrashDrop = () => {
    if (!activeDragId) return
    setSnowballState(current => {
      const nextFlipped = { ...current.flipped }
      delete nextFlipped[activeDragId]
      const nextVisibleIds = current.visibleIds.filter(id => id !== activeDragId)
      const nextRemovedCards = current.removedCards.filter(id => id !== activeDragId)
      const nextSessionExcludedIds = [...(current.sessionExcludedIds || []).filter(id => id !== activeDragId), activeDragId]
      const nextInvisibleCount = deck.filter(card => !nextVisibleIds.includes(card.id) && !nextSessionExcludedIds.includes(card.id)).length
      return {
        ...current,
        done: nextVisibleIds.length === 0 && nextInvisibleCount === 0,
        flipped: nextFlipped,
        visibleIds: nextVisibleIds,
        removedCards: nextRemovedCards,
        sessionExcludedIds: nextSessionExcludedIds,
      }
    })
  }
  const activeDragCard = activeDragId ? waveCards.find(card => card.id === activeDragId) : null
  const handleDragStart = ({ active }) => {
    rowPointerRef.current = { id: null, cardId: null, startX: 0, startY: 0, moved: false, swiping: false }
    setSwipeState({ id: null, offsetX: 0 })
    setActiveDragId(active.id)
    setIsOverTrash(false)
    magnetLockedRef.current = false
  }
  const handleDragOver = ({ over }) => {
    setIsOverTrash(over?.id === 'snowball-trash')
  }
  const handleDragEnd = ({ active, over }) => {
    rowPointerRef.current = { id: null, cardId: null, startX: 0, startY: 0, moved: false, swiping: false }
    setSwipeState({ id: null, offsetX: 0 })
    setIsOverTrash(false)
    magnetLockedRef.current = false
    if (over?.id === 'snowball-trash') {
      handleTrashDrop()
      setActiveDragId(null)
      return
    }
    if (over?.id && over.id !== active.id) {
      handleVisibleDrop(active.id, over.id)
    }
    setActiveDragId(null)
  }
  const handleDragCancel = () => {
    rowPointerRef.current = { id: null, cardId: null, startX: 0, startY: 0, moved: false, swiping: false }
    setSwipeState({ id: null, offsetX: 0 })
    setIsOverTrash(false)
    magnetLockedRef.current = false
    setActiveDragId(null)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
          <div style={{ justifySelf: 'start' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const shuffledState = onShuffleVisible(visibleIds, invisibleIds)
                  if (!shuffledState) return
                  setSnowballState(current => ({
                    ...current,
                    visibleIds: shuffledState.visibleIds,
                    removedCards: [],
                    done: false,
                    flipped: Object.fromEntries(
                      Object.entries(current.flipped || {}).filter(([id]) => shuffledState.visibleIds.includes(Number(id)))
                    ),
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
            Carte {waveCards.length} / {sessionCardTotal}
          </span>
          <div style={{ justifySelf: 'end' }}>
            <DirSwitch reversed={reversed} onChange={() => { setReversed(r => !r); setSnowballState(current => ({ ...current, flipped: {} })) }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '8px 8px 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: UI, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
            <span style={{ fontSize: 15 }}>←</span>
            <span>Masquer en haut</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontFamily: UI, fontSize: 12, color: '#15803d', fontWeight: 600 }}>
            <span>Masquer en bas</span>
            <span style={{ fontSize: 15 }}>→</span>
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={magneticCollisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={waveCards.map(card => card.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {waveCards.map((card) => {
              const isFlipped = !!flipped[card.id]
              const rowOffsetX = swipeState.id === card.id ? swipeState.offsetX : 0
              return (
                <SortableSnowballRow key={card.id} cardId={card.id} hidePlaceholder={isOverTrash}>
                  {({ isDragging, dragHandleProps }) => (
                    <SnowballRowContent
                      card={card}
                      isFlipped={isFlipped}
                      reversed={reversed}
                      displaySettings={displaySettings}
                      rowOffsetX={rowOffsetX}
                      isDragging={isDragging}
                      interactionLocked={interactionLocked}
                      dragHandleProps={dragHandleProps}
                      onPointerDown={(event) => handleRowPointerDown(card.id, event)}
                      onPointerMove={(event) => handleRowPointerMove(card.id, event)}
                      onPointerUp={(event) => handleRowPointerUp(card.id, event)}
                    />
                  )}
                </SortableSnowballRow>
              )
            })}
          </div>
        </SortableContext>
        <SnowballTrash active={!!activeDragId} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0 8px' }}>
          <button onClick={nextWave} style={btn({ background: '#1c1917', color: '#faf8f5', border: 'none', padding: 14, width: '100%' })}>
            {hiddenIds.length > 0 ? `Ajouter la carte ${waveCards.length + 1} →` : 'Terminer ✓'}
          </button>
          <button
            onClick={restart}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = '#efe9df'
              event.currentTarget.style.color = '#8a8178'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent'
              event.currentTarget.style.color = '#b7aea3'
            }}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
              fontFamily: UI,
              fontSize: 12,
              color: '#b7aea3',
              transition: 'background .18s ease, color .18s ease',
            }}
          >
            Recommencer depuis le début
          </button>
        </div>

        <DragOverlay>
          {activeDragCard ? (
            <div style={{ width: 'min(100vw - 40px, 500px)', boxShadow: '0 16px 34px rgba(28,25,23,0.18)', borderRadius: 12, transform: isOverTrash ? 'scale(0.88)' : 'scale(1)', opacity: isOverTrash ? 0.72 : 1, transition: 'transform 0.18s ease, opacity 0.18s ease' }}>
              <SnowballRowContent
                card={activeDragCard}
                isFlipped={!!flipped[activeDragCard.id]}
                reversed={reversed}
                displaySettings={displaySettings}
                rowOffsetX={0}
                isDragging={false}
                interactionLocked
                dragHandleProps={{}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
const TABS = ['Révision', 'Gérer', 'Tags']
const BULK_UNDO_MS = 5000

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
  const [displaySettings, setDisplaySettings] = useState(loadDisplaySettings)
  const [tab, setTab] = useState(0)
  const [reviewMode, setReviewMode] = useState('classic')
  const [smartReviewStarted, setSmartReviewStarted] = useState(false)
  const [manageSort, setManageSort] = useState('created-desc')
  const [manageTagFilter, setManageTagFilter] = useState([])
  const [manageStatusFilter, setManageStatusFilter] = useState([])
  const [manageMasteryFilter, setManageMasteryFilter] = useState([])
  const [manageDateFilter, setManageDateFilter] = useState([])
  const [manageFiltersOpen, setManageFiltersOpen] = useState(false)
  const [manageGroupInactive, setManageGroupInactive] = useState(false)
  const [newFront, setNewFront] = useState('')
  const [newFrontNote, setNewFrontNote] = useState('')
  const [newBack, setNewBack] = useState('')
  const [newBackNote, setNewBackNote] = useState('')
  const [newDeckName, setNewDeckName] = useState('')
  const [newTag, setNewTag] = useState('')
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR)
  const [newCardTags, setNewCardTags] = useState([])
  const [tagPicker, setTagPicker] = useState(null)
  const [tagColorPicker, setTagColorPicker] = useState(null)
  const [editingTagName, setEditingTagName] = useState(null)
  const [editingTagValue, setEditingTagValue] = useState('')
  const [manageEditingCardId, setManageEditingCardId] = useState(null)
  const [manageDraft, setManageDraft] = useState({ front: '', frontNote: '', back: '', backNote: '', tags: [] })
  const [manageTagMenuCardId, setManageTagMenuCardId] = useState(null)
  const [manageNewTagValue, setManageNewTagValue] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [showAddCardPanel, setShowAddCardPanel] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bulkUndo, setBulkUndo] = useState(null)
  const [bulkUndoNow, setBulkUndoNow] = useState(Date.now())
  const saveTimer = useRef(null)
  const bulkUndoTimer = useRef(null)
  const bulkUndoFadeTimer = useRef(null)
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

  useEffect(() => () => {
    if (bulkUndoTimer.current) clearTimeout(bulkUndoTimer.current)
    if (bulkUndoFadeTimer.current) clearInterval(bulkUndoFadeTimer.current)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(displaySettings))
  }, [displaySettings])

  useEffect(() => {
    setSmartReviewStarted(false)
  }, [selectedDeckId, reviewMode])

  useEffect(() => {
    if (!bulkUndo) {
      if (bulkUndoFadeTimer.current) {
        clearInterval(bulkUndoFadeTimer.current)
        bulkUndoFadeTimer.current = null
      }
      return
    }
    setBulkUndoNow(Date.now())
    bulkUndoFadeTimer.current = setInterval(() => {
      setBulkUndoNow(Date.now())
    }, 100)
    return () => {
      if (bulkUndoFadeTimer.current) {
        clearInterval(bulkUndoFadeTimer.current)
        bulkUndoFadeTimer.current = null
      }
    }
  }, [bulkUndo])

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
  const smartDeck = deck.filter(card => isCardDueToday(card))
  const smartNextReviewSummary = getNextReviewSummary(deck)
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
    setSnowballStates(current => {
      const existingState = current[selectedDeckId]
      const nextState = reconcileSnowballState(deck, existingState)
      if (existingState && JSON.stringify(existingState) === JSON.stringify(nextState)) return current
      return { ...current, [selectedDeckId]: nextState }
    })
  }, [selectedDeckId, deck])
  const deleteCard = (id) => {
    setCards(cs => cs.filter(c => c.id !== id))
    setDecks(current => current.map(deck => ({ ...deck, cardIds: deck.cardIds.filter(cardId => cardId !== id) })))
    if (manageEditingCardId === id) {
      setManageEditingCardId(null)
      setManageDraft({ front: '', frontNote: '', back: '', backNote: '', tags: [] })
      setManageTagMenuCardId(null)
      setManageNewTagValue('')
    }
  }
  const openManageCardEditor = (card) => {
    const isClosing = manageEditingCardId === card.id
    setManageEditingCardId(isClosing ? null : card.id)
    setManageDraft(isClosing ? { front: '', frontNote: '', back: '', backNote: '', tags: [] } : { front: card.front, frontNote: card.frontNote || '', back: card.back, backNote: card.backNote || '', tags: [...(card.tags || [])] })
    setManageTagMenuCardId(null)
    setManageNewTagValue('')
  }
  const updateManagedCard = (id, updates) => setCards(cs => cs.map(card => (
    card.id === id ? { ...card, ...updates } : card
  )))
  const saveManagedCard = (id) => {
    const front = manageDraft.front.trim()
    const back = manageDraft.back.trim()
    if (!front || !back) return
    updateManagedCard(id, {
      front,
      frontNote: manageDraft.frontNote.trim(),
      back,
      backNote: manageDraft.backNote.trim(),
      tags: dedupeTags(manageDraft.tags).map(tag => tag.name),
    })
    setManageEditingCardId(null)
    setManageDraft({ front: '', frontNote: '', back: '', backNote: '', tags: [] })
    setManageTagMenuCardId(null)
    setManageNewTagValue('')
  }
  const cancelManagedCardEdit = () => {
    setManageEditingCardId(null)
    setManageDraft({ front: '', frontNote: '', back: '', backNote: '', tags: [] })
    setManageTagMenuCardId(null)
    setManageNewTagValue('')
  }
  const removeDraftTag = (tag) => setManageDraft(current => ({
    ...current,
    tags: current.tags.filter(value => value !== tag),
  }))
  const addDraftTag = (tag) => {
    const normalized = normalizeTagName(tag)
    if (!normalized) return
    setManageDraft(current => (
      current.tags.includes(normalized)
        ? current
        : { ...current, tags: [...current.tags, normalized] }
    ))
  }
  const createAndAddDraftTag = () => {
    const nextTag = normalizeTagName(manageNewTagValue)
    if (!nextTag) return
    if (!tags.some(tag => tag.name.toLowerCase() === nextTag.toLowerCase())) {
      setTags(current => [...current, { name: nextTag, color: DEFAULT_TAG_COLOR }])
    }
    addDraftTag(nextTag)
    setManageNewTagValue('')
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
  const armBulkUndo = (previousCardIds, actionLabel) => {
    if (!selectedDeckId) return
    if (bulkUndoTimer.current) clearTimeout(bulkUndoTimer.current)
    setBulkUndo({
      deckId: selectedDeckId,
      previousCardIds,
      actionLabel,
      expiresAt: Date.now() + BULK_UNDO_MS,
    })
    bulkUndoTimer.current = setTimeout(() => {
      setBulkUndo(null)
      bulkUndoTimer.current = null
    }, BULK_UNDO_MS)
  }
  const includeAllCardsInSelectedDeck = () => {
    if (!selectedDeckId) return
    const targetCardIds = hasActiveManageFilters ? managedCards.map(card => card.id) : allCards.map(card => card.id)
    const previousCardIds = selectedDeck?.cardIds || []
    armBulkUndo(previousCardIds, bulkActionLabel)
    setDecks(current => current.map(deck => (
      deck.id === selectedDeckId
        ? { ...deck, cardIds: [...new Set([...deck.cardIds, ...targetCardIds])] }
        : deck
    )))
  }
  const excludeAllCardsFromSelectedDeck = () => {
    if (!selectedDeckId) return
    const targetCardIds = new Set((hasActiveManageFilters ? managedCards : allCards).map(card => card.id))
    const previousCardIds = selectedDeck?.cardIds || []
    armBulkUndo(previousCardIds, bulkActionLabel)
    setDecks(current => current.map(deck => (
      deck.id === selectedDeckId
        ? { ...deck, cardIds: deck.cardIds.filter(cardId => !targetCardIds.has(cardId)) }
        : deck
    )))
  }
  const undoBulkDeckAction = () => {
    if (!bulkUndo?.deckId) return
    if (bulkUndoTimer.current) {
      clearTimeout(bulkUndoTimer.current)
      bulkUndoTimer.current = null
    }
    setDecks(current => current.map(deck => (
      deck.id === bulkUndo.deckId
        ? { ...deck, cardIds: bulkUndo.previousCardIds }
        : deck
    )))
    setBulkUndo(null)
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
  const hasActiveManageFilters = manageTagFilter.length > 0 || manageStatusFilter.length > 0 || manageMasteryFilter.length > 0 || manageDateFilter.length > 0
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
  const bulkTargetCards = hasActiveManageFilters ? managedCards : allCards
  const allCardsIncludedInSelectedDeck = !!selectedDeck && bulkTargetCards.length > 0 && bulkTargetCards.every(card => selectedDeck.cardIds.includes(card.id))
  const bulkActionLabel = hasActiveManageFilters
    ? (allCardsIncludedInSelectedDeck ? 'Exclure les visibles' : 'Inclure les visibles')
    : (allCardsIncludedInSelectedDeck ? 'Exclure tout' : 'Inclure tout')
  const showBulkUndo = bulkUndo && bulkUndo.deckId === selectedDeckId
  const bulkUndoOpacity = showBulkUndo
    ? Math.max(0, Math.min(1, (bulkUndo.expiresAt - bulkUndoNow) / BULK_UNDO_MS))
    : 0
  const shuffleDeck = () => setDeckOrder(shuffleArray(deck.map(card => card.id)))
  const canResetDeckOrder = (() => {
    const sortedIds = getSortedDeckIds()
    if (sortedIds.length !== deckOrder.length) return true
    return sortedIds.some((id, index) => deckOrder[index] !== id)
  })()
  const shuffleDeckKeepingVisible = (currentVisibleIds, currentInvisibleIds = []) => {
    const shuffled = shuffleSnowballGroups(deck.map(card => card.id), currentVisibleIds, currentInvisibleIds, shuffleArray)
    setDeckOrder(shuffled.deckOrder)
    return shuffled
  }
  const placeSnowballCardInInvisible = (cardId, position, currentVisibleIds) => {
    const nextVisibleIds = currentVisibleIds.filter(id => id !== cardId)
    const nextInvisibleIds = deck
      .map(card => card.id)
      .filter(id => !currentVisibleIds.includes(id) && id !== cardId)

    const nextDeckOrder = position === 'top'
      ? [...nextVisibleIds, cardId, ...nextInvisibleIds]
      : [...nextVisibleIds, ...nextInvisibleIds, cardId]

    setDeckOrder(nextDeckOrder)
    return nextDeckOrder
  }
  const reorderSnowballVisibleCards = (draggedId, targetId, currentVisibleIds) => {
    const nextVisibleIds = reorderVisibleCards(currentVisibleIds, draggedId, targetId)
    if (nextVisibleIds === currentVisibleIds) return currentVisibleIds
    const invisibleIds = deck
      .map(card => card.id)
      .filter(id => !currentVisibleIds.includes(id))
    setDeckOrder([...nextVisibleIds, ...invisibleIds])
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
      frontNote: newFrontNote.trim(),
      back: newBack.trim(),
      backNote: newBackNote.trim(),
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
    setNewFrontNote('')
    setNewBack('')
    setNewBackNote('')
    setNewCardTags([])
    setShowAddCardPanel(false)
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
    setSettingsOpen(false)
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
    <div style={{ minHeight: '100dvh', background: '#f5f2ee', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px calc(112px + env(safe-area-inset-bottom))' }}>
      <div className="window-drag-strip" />

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 500, marginBottom: 18, paddingTop: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
              <button
                onClick={() => setSettingsOpen(current => !current)}
                aria-label="Ouvrir les réglages"
                style={btn({ padding: '8px 12px', fontSize: 12, background: '#f5f2ee', color: '#5f574f' })}
              >
                Settings
              </button>
              {saveStatus === 'saved' && <span style={{ fontFamily: UI, fontSize: 12, color: '#86efac' }}>✓ sauvegardé</span>}
              {saveStatus === 'error' && <span style={{ fontFamily: UI, fontSize: 12, color: '#fca5a5' }}>⚠ erreur</span>}
              {settingsOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: 260, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, boxShadow: '0 12px 30px rgba(28,25,23,0.12)', padding: 8, zIndex: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 10px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Affichage recto</span>
                      <select
                        value={displaySettings.frontMode}
                        onChange={event => setDisplaySettings(current => ({ ...current, frontMode: event.target.value }))}
                        style={{ width: '100%', padding: '9px 34px 9px 10px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 13, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 17px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                      >
                        {DISPLAY_MODE_OPTIONS.map(option => (
                          <option key={`front-${option.id}`} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Affichage verso</span>
                      <select
                        value={displaySettings.backMode}
                        onChange={event => setDisplaySettings(current => ({ ...current, backMode: event.target.value }))}
                        style={{ width: '100%', padding: '9px 34px 9px 10px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 13, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 17px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                      >
                        {DISPLAY_MODE_OPTIONS.map(option => (
                          <option key={`back-${option.id}`} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Score sur la carte</span>
                      <ToggleSwitch
                        checked={displaySettings.showMasteryBadge}
                        onChange={() => setDisplaySettings(current => ({ ...current, showMasteryBadge: !current.showMasteryBadge }))}
                        onLabel="On"
                        offLabel="Off"
                      />
                    </label>
                  </div>
                  <div style={{ height: 1, background: '#ece8e2', margin: '0 8px 8px' }} />
                  <button
                    onClick={handleSignOut}
                    style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: UI, fontSize: 13, color: '#5f574f' }}
                  >
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
              <button
                onClick={() => {
                  setShowAddCardPanel(current => !current)
                  setSettingsOpen(false)
                }}
                style={btn({ padding: '8px 12px', fontSize: 12, background: '#1c1917', color: '#faf8f5', border: 'none' })}
              >
                Ajouter une carte
              </button>
            </div>
          </div>
          <div>
            <select
              value={selectedDeckId || ''}
              onChange={event => setSelectedDeckId(event.target.value)}
              style={{ width: '100%', padding: '12px 38px 12px 12px', borderRadius: 12, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 14, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
            >
              {decks.map(deckItem => (
                <option key={deckItem.id} value={deckItem.id}>{deckItem.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ height: 1, background: '#e2dbd0', marginTop: 16 }} />
      </div>

      {showAddCardPanel && (
        <div style={{ width: '100%', maxWidth: 500, marginBottom: 20, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 18, padding: '18px 16px', boxShadow: '0 14px 34px rgba(28,25,23,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: UI, fontSize: 15, fontWeight: 600, color: '#1c1917' }}>Ajouter une carte</div>
              <div style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>
                La nouvelle carte sera ajoutée au deck sélectionné.
              </div>
            </div>
            <button onClick={() => setShowAddCardPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', fontSize: 18, padding: '0 4px' }}>
              ×
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontFamily: UI, fontSize: 11, color: '#78716c', display: 'block', marginBottom: 8, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Recto
              </label>
              <input value={newFront} onChange={e => setNewFront(e.target.value)} placeholder="ex : ねこ"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: JP, fontSize: 28, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              <input value={newFrontNote} onChange={e => setNewFrontNote(e.target.value)} placeholder="Ligne 2 optionnelle"
                style={{ width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#78716c', fontFamily: JP, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontFamily: UI, fontSize: 11, color: '#78716c', display: 'block', marginBottom: 8, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Verso
              </label>
              <input value={newBack} onChange={e => setNewBack(e.target.value)} placeholder="ex : Chat 🐱"
                onKeyDown={e => e.key === 'Enter' && addCard()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 17, outline: 'none', boxSizing: 'border-box' }} />
              <input value={newBackNote} onChange={e => setNewBackNote(e.target.value)} placeholder="Ligne 2 optionnelle"
                style={{ width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#78716c', fontFamily: UI, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
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
        </div>
      )}

      {/* Content */}
      <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column' }}>

        {tab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 4, background: '#e8e3db', borderRadius: 12, padding: 4 }}>
              {[
                { id: 'classic', label: 'Classique' },
                { id: 'snowball', label: 'Accumulation' },
                { id: 'smart', label: 'Intelligent' },
              ].map(option => (
                <button
                  key={option.id}
                  onClick={() => setReviewMode(option.id)}
                  style={{
                    flex: 1,
                    padding: '9px 4px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: UI,
                    fontSize: 12,
                    fontWeight: 600,
                    background: reviewMode === option.id ? '#fff' : 'transparent',
                    color: reviewMode === option.id ? '#1c1917' : '#8a8178',
                    boxShadow: reviewMode === option.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all .2s',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {reviewMode === 'classic' && (
              <ClassicMode key={`${selectedDeckId || 'no-deck'}:${deck.map(card => card.id).join(',')}`} deck={deck} removeFromDeck={toggleCardInSelectedDeck} rateCard={rateCard} onShuffle={shuffleDeck} onResetOrder={resetDeckOrder} canResetOrder={canResetDeckOrder} reversed={reversed} setReversed={setReversed} onChooseDeck={() => setTab(1)} displaySettings={displaySettings} />
            )}
            {reviewMode === 'snowball' && (
              <SnowballMode deck={deck} reversed={reversed} setReversed={setReversed} onShuffleVisible={shuffleDeckKeepingVisible} onResetOrder={resetDeckOrder} canResetOrder={canResetDeckOrder} snowballState={snowballState} setSnowballState={setSelectedDeckSnowballState} onPlaceInvisibleCard={placeSnowballCardInInvisible} onReorderVisibleCards={reorderSnowballVisibleCards} displaySettings={displaySettings} />
            )}
            {reviewMode === 'smart' && (
              smartDeck.length > 0 ? (
                !smartReviewStarted ? (
                  <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 16, padding: '24px 20px', textAlign: 'center' }}>
                    <div style={{ fontFamily: UI, fontSize: 12, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Révision intelligente</div>
                    <div style={{ fontFamily: UI, fontSize: 18, color: '#1c1917', fontWeight: 600, marginTop: 8 }}>
                      {smartDeck.length} carte{smartDeck.length !== 1 ? 's' : ''} à revoir aujourd’hui
                    </div>
                    <button
                      onClick={() => setSmartReviewStarted(true)}
                      style={btn({ marginTop: 18, width: '100%', padding: 14, background: '#1c1917', color: '#faf8f5', border: 'none' })}
                    >
                      Commencer
                    </button>
                  </div>
                ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <ClassicMode key={`smart:${selectedDeckId || 'no-deck'}:${smartDeck.map(card => card.id).join(',')}`} deck={smartDeck} removeFromDeck={toggleCardInSelectedDeck} rateCard={rateCard} onShuffle={() => {}} onResetOrder={() => smartDeck.map(card => card.id)} canResetOrder={false} reversed={reversed} setReversed={setReversed} onChooseDeck={() => setTab(1)} intelligentMode nextReviewSummary={smartNextReviewSummary} displaySettings={displaySettings} />
                </div>
                )
              ) : (
                <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 16, padding: '28px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 34, marginBottom: 12 }}>✓</div>
                  <div style={{ fontFamily: UI, fontSize: 16, fontWeight: 600, color: '#1c1917' }}>Rien à réviser aujourd’hui</div>
                  <div style={{ fontFamily: UI, fontSize: 13, color: '#a8a29e', marginTop: 6 }}>
                    Ce mode montre uniquement les cartes dues aujourd’hui selon la répétition espacée.
                  </div>
                  {smartNextReviewSummary && (
                    <div style={{ marginTop: 18, background: '#f8f6f2', border: '1px solid #ece8e2', borderRadius: 12, padding: '12px 14px', textAlign: 'left' }}>
                      <div style={{ fontFamily: UI, fontSize: 11, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        Prochaine revision
                      </div>
                      <div style={{ fontFamily: UI, fontSize: 15, color: '#1c1917', marginTop: 6 }}>
                        {smartNextReviewSummary.dateLabel}
                      </div>
                      <div style={{ fontFamily: UI, fontSize: 12, color: '#78716c', marginTop: 4 }}>
                        {smartNextReviewSummary.count} carte{smartNextReviewSummary.count !== 1 ? 's' : ''} a reviser
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* GÉRER */}
        {tab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 6 }}>Deck</div>
                  <select
                    value={selectedDeckId || ''}
                    onChange={event => setSelectedDeckId(event.target.value)}
                    style={{ width: '100%', padding: '10px 38px 10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 14, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                  >
                    {decks.map(deckItem => (
                      <option key={deckItem.id} value={deckItem.id}>{deckItem.name}</option>
                    ))}
                  </select>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {showBulkUndo && (
                    <button
                      onClick={undoBulkDeckAction}
                      title={`Annuler ${bulkUndo.actionLabel.toLowerCase()}`}
                      aria-label={`Annuler ${bulkUndo.actionLabel.toLowerCase()}`}
                      style={btn({
                        padding: '8px 12px',
                        background: '#fff',
                        color: '#5f574f',
                        borderColor: '#d6cfc4',
                        opacity: bulkUndoOpacity,
                        transition: 'opacity .1s linear',
                      })}
                    >
                      ↩ Revenir
                    </button>
                  )}
                  <button
                    onClick={allCardsIncludedInSelectedDeck ? excludeAllCardsFromSelectedDeck : includeAllCardsInSelectedDeck}
                    style={btn(
                      allCardsIncludedInSelectedDeck
                        ? { background: '#f5f2ee', color: '#5f574f' }
                        : { background: '#f5f2ee', color: '#5f574f' }
                    )}
                  >
                    {bulkActionLabel}
                  </button>
                </div>
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
              <div key={c.id} onClick={() => openManageCardEditor(c)} style={{
                display: 'flex', flexDirection: 'column', gap: 12,
                background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12,
                padding: '13px 16px', opacity: selectedDeck?.cardIds.includes(c.id) ? 1 : 0.55, transition: 'opacity .2s',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: JP, fontSize: 20, fontWeight: 600, color: '#1c1917' }}>{c.front}</div>
                    {c.frontNote && <div style={{ fontFamily: JP, fontSize: 14, color: '#a8a29e', marginTop: 3 }}>{c.frontNote}</div>}
                    <div style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>{c.back}</div>
                    {c.backNote && <div style={{ fontFamily: UI, fontSize: 12, color: '#c9c1b6', marginTop: 3 }}>{c.backNote}</div>}
                  </div>
                  <div onClick={event => event.stopPropagation()}>
                    <ToggleSwitch
                      checked={!!selectedDeck?.cardIds.includes(c.id)}
                      onChange={() => toggleCardInSelectedDeck(c.id)}
                      onLabel="Dans deck"
                      offLabel="Hors deck"
                    />
                  </div>
                </div>
                {manageEditingCardId === c.id ? (
                  <div onClick={event => event.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Recto</span>
                        <input
                          value={manageDraft.front}
                          onChange={event => setManageDraft(current => ({ ...current, front: event.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: JP, fontSize: 22, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                        />
                        <input
                          value={manageDraft.frontNote}
                          onChange={event => setManageDraft(current => ({ ...current, frontNote: event.target.value }))}
                          placeholder="Ligne 2 optionnelle"
                          style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#78716c', fontFamily: JP, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Verso</span>
                        <textarea
                          value={manageDraft.back}
                          onChange={event => setManageDraft(current => ({ ...current, back: event.target.value }))}
                          rows={3}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                        />
                        <input
                          value={manageDraft.backNote}
                          onChange={event => setManageDraft(current => ({ ...current, backNote: event.target.value }))}
                          placeholder="Ligne 2 optionnelle"
                          style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#78716c', fontFamily: UI, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </label>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {manageDraft.tags.map(tag => {
                        const { color } = getTagStyle(tags, tag)
                        return (
                          <span
                            key={`${c.id}-${tag}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 10px',
                              fontFamily: UI,
                              fontSize: 11,
                              border: `1px solid ${color.border}`,
                              background: color.bg,
                              color: color.text,
                              borderRadius: 999,
                            }}
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeDraftTag(tag)}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: color.text, fontSize: 12, lineHeight: 1 }}
                              aria-label={`Supprimer le tag ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => setManageTagMenuCardId(current => current === c.id ? null : c.id)}
                        style={btn({
                          width: 28,
                          height: 28,
                          padding: 0,
                          borderRadius: 999,
                          background: '#f5f2ee',
                          color: '#5f574f',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        })}
                        aria-label="Ajouter un tag"
                      >
                        +
                      </button>
                    </div>
                    {manageTagMenuCardId === c.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#f8f6f2', border: '1px solid #ece8e2' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {tags.filter(tag => !manageDraft.tags.includes(tag.name)).map(tag => {
                            const color = getTagColorOption(tag.color)
                            return (
                              <button
                                key={`${c.id}-add-${tag.name}`}
                                type="button"
                                onClick={() => addDraftTag(tag.name)}
                                style={btn({
                                  padding: '5px 10px',
                                  fontSize: 11,
                                  borderColor: color.border,
                                  background: color.bg,
                                  color: color.text,
                                  borderRadius: 999,
                                })}
                              >
                                {tag.name}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            value={manageNewTagValue}
                            onChange={event => setManageNewTagValue(event.target.value)}
                            onKeyDown={event => event.key === 'Enter' && createAndAddDraftTag()}
                            placeholder="Nouveau tag"
                            style={{ flex: 1, padding: '9px 11px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          />
                          <button type="button" onClick={createAndAddDraftTag} style={btn({ padding: '8px 12px', background: '#1c1917', color: '#faf8f5', border: 'none' })}>
                            Ajouter
                          </button>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <button type="button" onClick={() => deleteCard(c.id)} style={btn({ padding: '8px 12px', borderColor: '#fca5a5', color: '#b91c1c', background: '#fff5f5' })}>
                        Supprimer
                      </button>
                      <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={cancelManagedCardEdit} style={btn({ padding: '8px 12px', background: '#f5f2ee', color: '#5f574f' })}>
                        Annuler
                      </button>
                      <button type="button" onClick={() => saveManagedCard(c.id)} disabled={!manageDraft.front.trim() || !manageDraft.back.trim()} style={btn({ padding: '8px 12px', background: '#1c1917', color: '#faf8f5', border: 'none' })}>
                        Enregistrer
                      </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontFamily: UI, fontSize: 11, color: '#5f574f', background: '#ece8e2', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      {getMasteryVisual(c.memory?.mastery || 1).icon} {c.memory?.mastery || 1}/5
                    </span>
                    {(c.tags || []).map(tag => {
                      const { color } = getTagStyle(tags, tag)
                      return (
                        <span
                          key={`${c.id}-${tag}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '5px 10px',
                            fontFamily: UI,
                            fontSize: 11,
                            border: `1px solid ${color.border}`,
                            background: color.bg,
                            color: color.text,
                            borderRadius: 999,
                          }}
                        >
                          {tag}
                        </span>
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

        {tab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 16 }}>
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

      <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: 'min(500px, calc(100vw - 40px))', padding: '12px 0 calc(12px + env(safe-area-inset-bottom))', background: '#f5f2ee', zIndex: 40 }}>
        <div style={{ display: 'flex', gap: 6, background: '#e8e3db', border: '1px solid #ddd4c9', borderRadius: 18, padding: 6, boxShadow: '0 12px 30px rgba(28,25,23,0.10)' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              flex: 1, padding: '11px 4px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontFamily: UI, fontSize: 12, fontWeight: 600,
              background: tab === i ? '#fff' : 'transparent',
              color: tab === i ? '#1c1917' : '#8a8178',
              boxShadow: tab === i ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all .2s', outline: 'none',
            }}>{t}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
