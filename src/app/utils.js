import { normalizeMemory } from '../reviewUtils'
import {
  DEFAULT_DECK_NAME,
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_TAG_COLOR,
  DISPLAY_MODE_OPTIONS,
  DISPLAY_SETTINGS_KEY,
  TAG_COLOR_OPTIONS,
} from './constants'

export const normalizeTagName = (value) => value.trim()

export const getTagColorOption = (colorId) => (
  TAG_COLOR_OPTIONS.find(option => option.id === colorId) || TAG_COLOR_OPTIONS[0]
)

export const normalizeTagEntry = (value, index = 0) => {
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

export const dedupeTags = (values = []) => {
  const seen = new Set()
  return values.map(normalizeTagEntry).filter(tag => {
    if (!tag) return false
    const key = tag.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const normalizeCard = (card) => ({
  ...card,
  frontNote: (card.frontNote || '').trim(),
  backNote: (card.backNote || '').trim(),
  active: card.active ?? true,
  tags: dedupeTags((card.tags || []).map(tag => ({ name: tag, color: DEFAULT_TAG_COLOR }))).map(tag => tag.name),
  memory: normalizeMemory(card.memory),
  createdAt: card.createdAt || new Date().toISOString(),
})

export const loadDisplaySettings = () => {
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

export const deriveTagsFromCards = (cards) => dedupeTags(cards.flatMap(card => card.tags || []))

export const getTagMeta = (tags, tagName) => (
  tags.find(tag => tag.name === tagName) || { name: tagName, color: DEFAULT_TAG_COLOR }
)

export const getTagStyle = (tags, tagName) => {
  const meta = getTagMeta(tags, tagName)
  const color = getTagColorOption(meta.color)
  return { meta, color }
}

export const createDeck = (id, name, cardIds = [], sortMode = 'created-desc') => ({
  id,
  name: normalizeTagName(name) || DEFAULT_DECK_NAME,
  cardIds: [...new Set(cardIds)],
  sortMode,
})

export const normalizeDeck = (deck) => (
  createDeck(deck.id, deck.name, deck.cardIds || [], deck.sortMode || 'created-desc')
)

export const shuffleArray = (items) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const toggleFilterValue = (values, value) => (
  values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value]
)
