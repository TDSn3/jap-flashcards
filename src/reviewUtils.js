export const DAY_MS = 24 * 60 * 60 * 1000

export const createDefaultMemory = () => ({
  mastery: 1,
  repetitions: 0,
  lapses: 0,
  intervalDays: 0,
  easeFactor: 2.5,
  lastReviewedAt: null,
  nextReviewAt: null,
})

export const normalizeMemory = (memory = {}) => ({
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

export const advanceMemory = (memory, rating, now = new Date()) => {
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

export const getMasteryVisual = (mastery) => {
  if (mastery <= 1) return { icon: '◔', label: 'Fragile' }
  if (mastery === 2) return { icon: '◑', label: 'Debut' }
  if (mastery === 3) return { icon: '◕', label: 'Moyen' }
  if (mastery === 4) return { icon: '⬤', label: 'Solide' }
  return { icon: '✦', label: 'Ancre' }
}

export const isCardDueToday = (card, now = new Date()) => {
  const memory = normalizeMemory(card.memory)
  if (!memory.nextReviewAt || memory.repetitions === 0) return true
  const dueAt = new Date(memory.nextReviewAt)
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  return dueAt.getTime() <= endOfToday.getTime()
}

export const getNextReviewSummary = (cards, now = new Date()) => {
  const upcoming = cards
    .map(card => ({ id: card.id, nextReviewAt: normalizeMemory(card.memory).nextReviewAt }))
    .filter(card => card.nextReviewAt && new Date(card.nextReviewAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime())

  if (upcoming.length === 0) return null

  const first = new Date(upcoming[0].nextReviewAt)
  const sameDayCount = upcoming.filter(card => {
    const value = new Date(card.nextReviewAt)
    return value.getFullYear() === first.getFullYear()
      && value.getMonth() === first.getMonth()
      && value.getDate() === first.getDate()
  }).length

  return {
    dateLabel: first.toLocaleDateString('fr-FR'),
    count: sameDayCount,
  }
}
