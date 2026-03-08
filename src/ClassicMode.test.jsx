import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassicMode } from './App'
import { createDefaultMemory } from './reviewUtils'

if (!window.PointerEvent) {
  window.PointerEvent = MouseEvent
}

const baseProps = {
  removeFromDeck: vi.fn(),
  rateCard: vi.fn(),
  onShuffle: vi.fn(),
  onResetOrder: vi.fn(),
  canResetOrder: false,
  reversed: false,
  setReversed: vi.fn(),
  onChooseDeck: vi.fn(),
}

const makeCard = (id, front, extra = {}) => ({
  id,
  front,
  back: `back-${front}`,
  tags: [],
  memory: createDefaultMemory(),
  createdAt: '2026-03-08T10:00:00.000Z',
  ...extra,
})

const flushAnimation = () => {
  act(() => {
    vi.advanceTimersByTime(250)
  })
}

const clickAndFlush = (element) => {
  act(() => {
    fireEvent.click(element)
    vi.advanceTimersByTime(250)
  })
}

describe('ClassicMode regressions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('shows the intelligent empty state when the smart deck is finished', () => {
    render(
      <ClassicMode
        {...baseProps}
        intelligentMode
        nextReviewSummary={{ dateLabel: '10/03/2026', count: 2 }}
        deck={[makeCard(1, '猫', { memory: { ...createDefaultMemory(), repetitions: 1, nextReviewAt: '2026-03-08T09:00:00.000Z' } })]}
      />,
    )

    fireEvent.pointerDown(screen.getByText('猫'))
    fireEvent.pointerUp(screen.getByText('猫'))
    fireEvent.click(screen.getByRole('button', { name: 'Bien' }))

    expect(screen.getByText("Rien à réviser aujourd’hui")).toBeTruthy()
    expect(screen.getByText('10/03/2026')).toBeTruthy()
    expect(screen.getByText('2 cartes a reviser')).toBeTruthy()
  })

  it('keeps swipe working on the last remaining card', () => {
    render(
      <ClassicMode
        {...baseProps}
        deck={[makeCard(1, '最後')]}
      />,
    )

    const card = screen.getByText('最後')
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 200, button: 0, pointerType: 'mouse' })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 340 })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 340 })

    flushAnimation()

    expect(screen.getByText('Deck terminé')).toBeTruthy()
  })

  it('moves retry cards to the end of the review loop', () => {
    render(
      <ClassicMode
        {...baseProps}
        deck={[makeCard(1, 'A'), makeCard(2, 'B'), makeCard(3, 'C')]}
      />,
    )

    clickAndFlush(screen.getByRole('button', { name: /Reessayer/i }))
    expect(screen.getByText('B')).toBeTruthy()

    clickAndFlush(screen.getByRole('button', { name: /Valider/i }))
    expect(screen.getByText('C')).toBeTruthy()

    clickAndFlush(screen.getByRole('button', { name: /Valider/i }))
    expect(screen.getByText('A')).toBeTruthy()
  })
})
