import { UI } from '../../app/constants'
import { btn } from '../../app/styles'
import { ClassicMode } from './ClassicMode'
import { SnowballMode } from './SnowballMode'

export function ReviewSection({
  reviewMode,
  setReviewMode,
  selectedDeckId,
  deck,
  toggleCardInSelectedDeck,
  rateCard,
  shuffleDeck,
  resetDeckOrder,
  canResetDeckOrder,
  reversed,
  setReversed,
  setTab,
  displaySettings,
  shuffleDeckKeepingVisible,
  snowballState,
  setSelectedDeckSnowballState,
  placeSnowballCardInInvisible,
  reorderSnowballVisibleCards,
  smartDeck,
  smartReviewStarted,
  setSmartReviewStarted,
  smartNextReviewSummary,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, background: '#e8e3db', borderRadius: 12, padding: 4 }}>
        {[
          { id: 'classic', label: 'Classique' },
          { id: 'snowball', label: 'Accumulation' },
          { id: 'smart', label: 'Intelligent' },
        ].map(option => (
          <button
            key={option.id}
            onClick={() => setReviewMode(option.id)}
            style={{
              flex: 1,
              padding: '9px 4px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontFamily: UI,
              fontSize: 12,
              fontWeight: 600,
              background: reviewMode === option.id ? '#fff' : 'transparent',
              color: reviewMode === option.id ? '#1c1917' : '#8a8178',
              boxShadow: reviewMode === option.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all .2s',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {reviewMode === 'classic' && (
        <ClassicMode
          key={`${selectedDeckId || 'no-deck'}:${deck.map(card => card.id).join(',')}`}
          deck={deck}
          removeFromDeck={toggleCardInSelectedDeck}
          rateCard={rateCard}
          onShuffle={shuffleDeck}
          onResetOrder={resetDeckOrder}
          canResetOrder={canResetDeckOrder}
          reversed={reversed}
          setReversed={setReversed}
          onChooseDeck={() => setTab(1)}
          displaySettings={displaySettings}
        />
      )}
      {reviewMode === 'snowball' && (
        <SnowballMode
          deck={deck}
          reversed={reversed}
          setReversed={setReversed}
          onShuffleVisible={shuffleDeckKeepingVisible}
          onResetOrder={resetDeckOrder}
          canResetOrder={canResetDeckOrder}
          snowballState={snowballState}
          setSnowballState={setSelectedDeckSnowballState}
          onPlaceInvisibleCard={placeSnowballCardInInvisible}
          onReorderVisibleCards={reorderSnowballVisibleCards}
          displaySettings={displaySettings}
        />
      )}
      {reviewMode === 'smart' && (
        smartDeck.length > 0 ? (
          !smartReviewStarted ? (
            <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 16, padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: UI, fontSize: 12, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Révision intelligente</div>
              <div style={{ fontFamily: UI, fontSize: 18, color: '#1c1917', fontWeight: 600, marginTop: 8 }}>
                {smartDeck.length} carte{smartDeck.length !== 1 ? 's' : ''} à revoir aujourd’hui
              </div>
              <button
                onClick={() => setSmartReviewStarted(true)}
                style={btn({ marginTop: 18, width: '100%', padding: 14, background: '#1c1917', color: '#faf8f5', border: 'none' })}
              >
                Commencer
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ClassicMode
                key={`smart:${selectedDeckId || 'no-deck'}:${smartDeck.map(card => card.id).join(',')}`}
                deck={smartDeck}
                removeFromDeck={toggleCardInSelectedDeck}
                rateCard={rateCard}
                onShuffle={() => {}}
                onResetOrder={() => smartDeck.map(card => card.id)}
                canResetOrder={false}
                reversed={reversed}
                setReversed={setReversed}
                onChooseDeck={() => setTab(1)}
                intelligentMode
                nextReviewSummary={smartNextReviewSummary}
                displaySettings={displaySettings}
              />
            </div>
          )
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 16, padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: UI, fontSize: 16, fontWeight: 600, color: '#1c1917' }}>Rien à réviser aujourd’hui</div>
            <div style={{ fontFamily: UI, fontSize: 13, color: '#a8a29e', marginTop: 6 }}>
              Ce mode montre uniquement les cartes dues aujourd’hui selon la répétition espacée.
            </div>
            {smartNextReviewSummary && (
              <div style={{ marginTop: 18, background: '#f8f6f2', border: '1px solid #ece8e2', borderRadius: 12, padding: '12px 14px', textAlign: 'left' }}>
                <div style={{ fontFamily: UI, fontSize: 11, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Prochaine revision
                </div>
                <div style={{ fontFamily: UI, fontSize: 15, color: '#1c1917', marginTop: 6 }}>
                  {smartNextReviewSummary.dateLabel}
                </div>
                <div style={{ fontFamily: UI, fontSize: 12, color: '#78716c', marginTop: 4 }}>
                  {smartNextReviewSummary.count} carte{smartNextReviewSummary.count !== 1 ? 's' : ''} a reviser
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
