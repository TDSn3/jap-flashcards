import { useCallback, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createSnowballState } from '../../snowballUtils'
import { DEFAULT_DISPLAY_SETTINGS, JP, UI } from '../../app/constants'
import { btn } from '../../app/styles'
import { DirSwitch } from '../../components/ui/DirSwitch'
import { EmptyDeck } from '../../components/ui/EmptyDeck'
import { FaceText } from '../../components/cards/FaceText'
import { getFaceTextMetrics } from '../../components/cards/getFaceTextMetrics'

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

export function SnowballMode({
  deck,
  reversed,
  setReversed,
  onShuffleVisible,
  onResetOrder,
  canResetOrder,
  snowballState,
  setSnowballState,
  onPlaceInvisibleCard,
  onReorderVisibleCards,
  displaySettings = DEFAULT_DISPLAY_SETTINGS,
}) {
  const visibleIds = snowballState?.visibleIds || []
  const flipped = snowballState?.flipped || {}
  const done = snowballState?.done || false
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

    const trashContainer = droppableContainers.find(container => container.id === 'snowball-trash')
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
      droppableContainers: droppableContainers.filter(container => container.id !== 'snowball-trash'),
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

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '56px 0' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🎉</div>
        <p style={{ fontFamily: UI, fontSize: 16, fontWeight: 600, color: '#1c1917', marginBottom: 6 }}>Bravo, série complète !</p>
        <p style={{ fontFamily: UI, fontSize: 13, color: '#a8a29e', marginBottom: 28 }}>Toutes les cartes passées en accumulation.</p>
        <button onClick={restart} style={btn({ background: '#1c1917', color: '#faf8f5', border: 'none' })}>Recommencer</button>
      </div>
    )
  }

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
            <DirSwitch reversed={reversed} onChange={() => { setReversed(value => !value); setSnowballState(current => ({ ...current, flipped: {} })) }} />
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
            {waveCards.map(card => {
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
                      onPointerDown={event => handleRowPointerDown(card.id, event)}
                      onPointerMove={event => handleRowPointerMove(card.id, event)}
                      onPointerUp={event => handleRowPointerUp(card.id, event)}
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
