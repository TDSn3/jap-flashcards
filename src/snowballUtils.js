export const createSnowballState = (deck = [], overrides = {}) => ({
  visibleIds: deck[0] ? [deck[0].id] : [],
  flipped: {},
  done: false,
  removedCards: [],
  sessionExcludedIds: [],
  orderKey: deck.map(card => card.id).join(','),
  ...overrides,
})

export const reconcileSnowballState = (deck = [], existingState = null) => {
  if (!existingState) return createSnowballState(deck)

  const deckIds = deck.map(card => card.id)
  const deckIdSet = new Set(deckIds)
  const visibleIds = (existingState.visibleIds || []).filter(id => deckIdSet.has(id))
  const sessionExcludedIds = (existingState.sessionExcludedIds || []).filter(id => deckIdSet.has(id) && !visibleIds.includes(id))
  const removedCards = (existingState.removedCards || []).filter(id => deckIdSet.has(id) && !visibleIds.includes(id) && !sessionExcludedIds.includes(id))
  const flipped = Object.fromEntries(
    Object.entries(existingState.flipped || {}).filter(([id]) => visibleIds.includes(Number(id)))
  )

  const nextVisibleIds = visibleIds.length > 0 || existingState.done
    ? visibleIds
    : deck[0]
      ? [deck[0].id]
      : []

  return {
    ...existingState,
    visibleIds: nextVisibleIds,
    removedCards,
    sessionExcludedIds,
    flipped,
    orderKey: deckIds.join(','),
  }
}

export const shuffleSnowballGroups = (deckIds = [], currentVisibleIds = [], removedIds = [], shuffleFn = (items) => items) => {
  const visibleSet = new Set(currentVisibleIds)
  const removedSet = new Set(removedIds)
  const hiddenIds = deckIds.filter(id => !visibleSet.has(id) && !removedSet.has(id))
  const invisibleIds = [...hiddenIds, ...removedIds]

  let nextVisibleIds
  let nextInvisibleIds

  if (currentVisibleIds.length === 1 && invisibleIds.length > 0) {
    const reshuffledPool = shuffleFn([...invisibleIds, currentVisibleIds[0]])
    nextVisibleIds = [reshuffledPool[0]]
    nextInvisibleIds = reshuffledPool.slice(1)
  } else {
    nextVisibleIds = shuffleFn(currentVisibleIds)
    nextInvisibleIds = shuffleFn(invisibleIds)
  }

  return {
    visibleIds: nextVisibleIds,
    hiddenIds: nextInvisibleIds,
    removedIds: [],
    deckOrder: [...nextVisibleIds, ...nextInvisibleIds],
  }
}

export const moveVisibleCardToInvisible = (state, cardId, position = 'top') => {
  const visibleIds = (state.visibleIds || []).filter(id => id !== cardId)
  const removedCards = (state.removedCards || []).filter(id => id !== cardId)
  const nextRemovedCards = position === 'bottom'
    ? [...removedCards, cardId]
    : [cardId, ...removedCards]
  const flipped = { ...(state.flipped || {}) }
  delete flipped[cardId]

  return {
    ...state,
    done: false,
    visibleIds,
    removedCards: nextRemovedCards,
    flipped,
  }
}

export const reorderVisibleCards = (visibleIds = [], draggedId, targetId) => {
  if (!draggedId || !targetId || draggedId === targetId) return visibleIds
  const current = [...visibleIds]
  const fromIndex = current.indexOf(draggedId)
  const targetIndex = current.indexOf(targetId)
  if (fromIndex === -1 || targetIndex === -1) return visibleIds
  const [moved] = current.splice(fromIndex, 1)
  current.splice(targetIndex, 0, moved)
  return current
}
