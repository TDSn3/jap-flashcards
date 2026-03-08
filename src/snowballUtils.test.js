import { describe, expect, it } from 'vitest'
import { createSnowballState, moveVisibleCardToInvisible, reconcileSnowballState, reorderVisibleCards, shuffleSnowballGroups } from './snowballUtils'

const makeDeck = (...ids) => ids.map(id => ({ id }))

describe('snowballUtils', () => {
  it('preserves visible and hidden groups when deck order changes', () => {
    const existing = createSnowballState(makeDeck(1, 2, 3, 4), {
      visibleIds: [1, 3],
      removedCards: [4],
      flipped: { 1: true, 3: false, 4: true },
    })

    const reconciled = reconcileSnowballState(makeDeck(3, 1, 2, 4), existing)

    expect(reconciled.visibleIds).toEqual([1, 3])
    expect(reconciled.removedCards).toEqual([4])
    expect(reconciled.flipped).toEqual({ 1: true, 3: false })
    expect(reconciled.orderKey).toBe('3,1,2,4')
  })

  it('merges removed cards back into the invisible shuffled pile', () => {
    const reverseShuffle = (items) => [...items].reverse()

    const shuffled = shuffleSnowballGroups([1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4], [5, 6], reverseShuffle)

    expect(shuffled.visibleIds).toEqual([4, 3, 2, 1])
    expect(shuffled.hiddenIds).toEqual([6, 5, 7])
    expect(shuffled.removedIds).toEqual([])
    expect(shuffled.deckOrder).toEqual([4, 3, 2, 1, 6, 5, 7])
  })

  it('can move a visible card to the top or bottom of the invisible pile', () => {
    const state = createSnowballState(makeDeck(1, 2, 3, 4), {
      visibleIds: [1, 2, 3],
      removedCards: [4],
      flipped: { 2: true },
    })

    expect(moveVisibleCardToInvisible(state, 2, 'top')).toMatchObject({
      visibleIds: [1, 3],
      removedCards: [2, 4],
      flipped: {},
    })

    expect(moveVisibleCardToInvisible(state, 2, 'bottom')).toMatchObject({
      visibleIds: [1, 3],
      removedCards: [4, 2],
      flipped: {},
    })
  })

  it('can reorder visible cards by drag target', () => {
    expect(reorderVisibleCards([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3])
  })
})
