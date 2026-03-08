import { describe, expect, it } from 'vitest'
import {
  advanceMemory,
  createDefaultMemory,
  getNextReviewSummary,
  isCardDueToday,
} from './reviewUtils'

describe('reviewUtils', () => {
  it('marks cards without nextReviewAt as due today', () => {
    expect(isCardDueToday({ memory: createDefaultMemory() }, new Date('2026-03-08T10:00:00Z'))).toBe(true)
  })

  it('computes spaced repetition dates deterministically', () => {
    const now = new Date('2026-03-08T10:00:00Z')
    const updated = advanceMemory(createDefaultMemory(), 'good', now)

    expect(updated.repetitions).toBe(1)
    expect(updated.intervalDays).toBe(1)
    expect(updated.mastery).toBe(2)
    expect(updated.nextReviewAt).toBe('2026-03-09T10:00:00.000Z')
  })

  it('returns the next review date summary with same-day card count', () => {
    const cards = [
      { id: 1, memory: { nextReviewAt: '2026-03-10T09:00:00.000Z', repetitions: 1 } },
      { id: 2, memory: { nextReviewAt: '2026-03-10T18:00:00.000Z', repetitions: 3 } },
      { id: 3, memory: { nextReviewAt: '2026-03-12T08:00:00.000Z', repetitions: 2 } },
    ]

    expect(getNextReviewSummary(cards, new Date('2026-03-08T10:00:00Z'))).toEqual({
      dateLabel: '10/03/2026',
      count: 2,
    })
  })

  it('does not treat future cards as due today', () => {
    const card = {
      memory: {
        ...createDefaultMemory(),
        repetitions: 2,
        nextReviewAt: '2026-03-10T10:00:00.000Z',
      },
    }

    expect(isCardDueToday(card, new Date('2026-03-08T10:00:00Z'))).toBe(false)
  })
})
