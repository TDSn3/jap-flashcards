export const DEFAULT_CARDS = [
  { id: 1, front: 'ねこ', back: 'Chat 🐱', active: true, tags: [] },
  { id: 2, front: 'いぬ', back: 'Chien 🐶', active: true, tags: [] },
  { id: 3, front: 'さかな', back: 'Poisson 🐟', active: true, tags: [] },
]

export const JP = "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif"
export const UI = "'Inter', 'Helvetica Neue', Arial, sans-serif"
export const SIGNUP_ENABLED = import.meta.env.VITE_ENABLE_SIGNUP === 'true'

export const TAG_COLOR_OPTIONS = [
  { id: 'neutral', label: 'Neutre', bg: '#f5f2ee', border: '#d6cfc4', text: '#5f574f' },
  { id: 'rose', label: 'Rose', bg: '#fde2e4', border: '#f9bec7', text: '#8a3d55' },
  { id: 'peach', label: 'Peche', bg: '#fde7d8', border: '#f7c9aa', text: '#8b5a3c' },
  { id: 'butter', label: 'Beurre', bg: '#fdf1c7', border: '#f3df92', text: '#786127' },
  { id: 'mint', label: 'Menthe', bg: '#ddf4e4', border: '#b7e7c5', text: '#2f6b4f' },
  { id: 'sky', label: 'Ciel', bg: '#ddeffd', border: '#b8daf8', text: '#365f8d' },
  { id: 'lavender', label: 'Lavande', bg: '#ece4fb', border: '#d5c6f7', text: '#5e4b8a' },
]

export const DEFAULT_TAG_COLOR = TAG_COLOR_OPTIONS[0].id
export const DEFAULT_DECK_NAME = 'Deck principal'
export const DISPLAY_SETTINGS_KEY = 'flashcards-display-settings'
export const DISPLAY_MODE_OPTIONS = [
  { id: 'primary', label: 'Ligne principale' },
  { id: 'both', label: 'Les deux' },
  { id: 'secondary', label: 'Seconde ligne' },
  { id: 'secondary-first', label: 'Seconde puis principale' },
]
export const DEFAULT_DISPLAY_SETTINGS = {
  frontMode: 'primary',
  backMode: 'primary',
  showMasteryBadge: false,
}

export const TABS = ['Révision', 'Gérer', 'Tags']
export const BULK_UNDO_MS = 5000
