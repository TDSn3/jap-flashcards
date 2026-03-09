import { useState, useEffect, useRef, useCallback } from 'react'
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
  getNextReviewSummary,
  isCardDueToday,
} from './reviewUtils'
import { createSnowballState, reconcileSnowballState, reorderVisibleCards, shuffleSnowballGroups } from './snowballUtils'
import {
  BULK_UNDO_MS,
  DEFAULT_CARDS,
  DEFAULT_DECK_NAME,
  DEFAULT_TAG_COLOR,
  DISPLAY_SETTINGS_KEY,
  SIGNUP_ENABLED,
  UI,
} from './app/constants'
import {
  createDeck,
  dedupeTags,
  deriveTagsFromCards,
  loadDisplaySettings,
  normalizeCard,
  normalizeDeck,
  normalizeTagName,
  shuffleArray,
} from './app/utils'
import { AuthScreen } from './features/auth/AuthScreen'
import { SchemaSetupScreen } from './features/auth/SchemaSetupScreen'
import { AppHeader } from './features/layout/AppHeader'
import { AddCardPanel } from './features/cards/AddCardPanel'
import { ReviewSection } from './features/review/ReviewSection'
import { BottomNav } from './features/layout/BottomNav'
import { ManageSection } from './features/manage/ManageSection'
import { TagsSection } from './features/tags/TagsSection'

let nextId = 10
const EMPTY_ARRAY = []

export { ClassicMode } from './features/review/ClassicMode'

// ── App ───────────────────────────────────────────────────────────────────────
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

  const allCards = cards || EMPTY_ARRAY
  const selectedDeck = decks.find(deck => deck.id === selectedDeckId) || null
  const getSortedDeckIds = useCallback(() => {
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
  }, [allCards, selectedDeck])
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
  useEffect(() => {
    if (!cards || !selectedDeckId) return
    setDeckOrder(getSortedDeckIds())
  }, [cards, decks, selectedDeckId, getSortedDeckIds])

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
      <AppHeader
        saveStatus={saveStatus}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        displaySettings={displaySettings}
        setDisplaySettings={setDisplaySettings}
        handleSignOut={handleSignOut}
        showAddCardPanel={showAddCardPanel}
        setShowAddCardPanel={setShowAddCardPanel}
        selectedDeckId={selectedDeckId}
        setSelectedDeckId={setSelectedDeckId}
        decks={decks}
      />

      <AddCardPanel
        show={showAddCardPanel}
        setShow={setShowAddCardPanel}
        newFront={newFront}
        setNewFront={setNewFront}
        newFrontNote={newFrontNote}
        setNewFrontNote={setNewFrontNote}
        newBack={newBack}
        setNewBack={setNewBack}
        newBackNote={newBackNote}
        setNewBackNote={setNewBackNote}
        addCard={addCard}
        tags={tags}
        newCardTags={newCardTags}
        toggleNewCardTag={toggleNewCardTag}
      />

      {/* Content */}
      <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column' }}>

        {tab === 0 && (
          <ReviewSection
            reviewMode={reviewMode}
            setReviewMode={setReviewMode}
            selectedDeckId={selectedDeckId}
            deck={deck}
            toggleCardInSelectedDeck={toggleCardInSelectedDeck}
            rateCard={rateCard}
            shuffleDeck={shuffleDeck}
            resetDeckOrder={resetDeckOrder}
            canResetDeckOrder={canResetDeckOrder}
            reversed={reversed}
            setReversed={setReversed}
            setTab={setTab}
            displaySettings={displaySettings}
            shuffleDeckKeepingVisible={shuffleDeckKeepingVisible}
            snowballState={snowballState}
            setSelectedDeckSnowballState={setSelectedDeckSnowballState}
            placeSnowballCardInInvisible={placeSnowballCardInInvisible}
            reorderSnowballVisibleCards={reorderSnowballVisibleCards}
            smartDeck={smartDeck}
            smartReviewStarted={smartReviewStarted}
            setSmartReviewStarted={setSmartReviewStarted}
            smartNextReviewSummary={smartNextReviewSummary}
          />
        )}

        {tab === 1 && (
          <ManageSection
            selectedDeckId={selectedDeckId}
            setSelectedDeckId={setSelectedDeckId}
            decks={decks}
            deleteSelectedDeck={deleteSelectedDeck}
            newDeckName={newDeckName}
            setNewDeckName={setNewDeckName}
            addDeck={addDeck}
            cards={cards}
            managedCards={managedCards}
            showBulkUndo={showBulkUndo}
            undoBulkDeckAction={undoBulkDeckAction}
            bulkUndo={bulkUndo}
            bulkUndoOpacity={bulkUndoOpacity}
            allCardsIncludedInSelectedDeck={allCardsIncludedInSelectedDeck}
            excludeAllCardsFromSelectedDeck={excludeAllCardsFromSelectedDeck}
            includeAllCardsInSelectedDeck={includeAllCardsInSelectedDeck}
            bulkActionLabel={bulkActionLabel}
            manageSort={manageSort}
            updateSelectedDeckSort={updateSelectedDeckSort}
            manageGroupInactive={manageGroupInactive}
            setManageGroupInactive={setManageGroupInactive}
            manageFiltersOpen={manageFiltersOpen}
            setManageFiltersOpen={setManageFiltersOpen}
            clearManageFilters={clearManageFilters}
            tags={tags}
            manageTagFilter={manageTagFilter}
            setManageTagFilter={setManageTagFilter}
            manageStatusFilter={manageStatusFilter}
            setManageStatusFilter={setManageStatusFilter}
            manageMasteryFilter={manageMasteryFilter}
            setManageMasteryFilter={setManageMasteryFilter}
            manageDateFilter={manageDateFilter}
            setManageDateFilter={setManageDateFilter}
            openManageCardEditor={openManageCardEditor}
            selectedDeck={selectedDeck}
            toggleCardInSelectedDeck={toggleCardInSelectedDeck}
            manageEditingCardId={manageEditingCardId}
            manageDraft={manageDraft}
            setManageDraft={setManageDraft}
            manageTagMenuCardId={manageTagMenuCardId}
            setManageTagMenuCardId={setManageTagMenuCardId}
            removeDraftTag={removeDraftTag}
            addDraftTag={addDraftTag}
            manageNewTagValue={manageNewTagValue}
            setManageNewTagValue={setManageNewTagValue}
            createAndAddDraftTag={createAndAddDraftTag}
            deleteCard={deleteCard}
            cancelManagedCardEdit={cancelManagedCardEdit}
            saveManagedCard={saveManagedCard}
          />
        )}

        {tab === 2 && (
          <TagsSection
            newTag={newTag}
            setNewTag={setNewTag}
            addTag={addTag}
            newTagColor={newTagColor}
            setNewTagColor={setNewTagColor}
            tags={tags}
            editingTagName={editingTagName}
            editingTagValue={editingTagValue}
            setEditingTagValue={setEditingTagValue}
            saveTagName={saveTagName}
            setEditingTagName={setEditingTagName}
            setTagColorPicker={setTagColorPicker}
            tagColorPicker={tagColorPicker}
            updateTagColor={updateTagColor}
            startEditingTag={startEditingTag}
            setTagPicker={setTagPicker}
            tagPicker={tagPicker}
            deleteTag={deleteTag}
            cards={cards}
            toggleCardTag={toggleCardTag}
          />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  )
}
