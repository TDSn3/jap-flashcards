import { useEffect, useRef, useState } from 'react'
import { DEFAULT_DISPLAY_SETTINGS, UI } from '../../app/constants'
import { btn } from '../../app/styles'
import { shuffleArray } from '../../app/utils'
import { FlipCard } from '../../components/cards/FlipCard'
import { DirSwitch } from '../../components/ui/DirSwitch'
import { EmptyDeck } from '../../components/ui/EmptyDeck'
import { advanceMemory, getMasteryVisual, isCardDueToday } from '../../reviewUtils'

export function ClassicMode({
  deck,
  removeFromDeck,
  rateCard,
  onShuffle,
  onResetOrder,
  canResetOrder,
  reversed,
  setReversed,
  onChooseDeck,
  intelligentMode = false,
  nextReviewSummary = null,
  displaySettings = DEFAULT_DISPLAY_SETTINGS,
}) {
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

  useEffect(() => () => {
    if (enterAnimationFrameRef.current) cancelAnimationFrame(enterAnimationFrameRef.current)
  }, [])

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
        setFlipped(currentValue => !currentValue)
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
          <DirSwitch reversed={reversed} onChange={() => { setReversed(value => !value); setFlipped(false) }} />
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
            <button
              key={option.rating}
              onClick={() => completeCard(option.rating)}
              style={btn({
                padding: '10px 8px',
                fontSize: 12,
                borderColor: option.rating === 'again' ? '#fecaca' : option.rating === 'hard' ? '#fde68a' : option.rating === 'good' ? '#bfdbfe' : '#bbf7d0',
                background: option.rating === 'again' ? '#fff5f5' : option.rating === 'hard' ? '#fffbea' : option.rating === 'good' ? '#eff6ff' : '#f0fdf4',
                color: option.rating === 'again' ? '#b91c1c' : option.rating === 'hard' ? '#a16207' : option.rating === 'good' ? '#1d4ed8' : '#15803d',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              })}
            >
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
