import { DEFAULT_DISPLAY_SETTINGS, JP, UI } from '../../app/constants'
import { FaceText } from './FaceText'

export function FlipCard({
  front,
  frontNote,
  back,
  backNote,
  flipped,
  onClick,
  reversed,
  displaySettings = DEFAULT_DISPLAY_SETTINGS,
  masteryVisual = null,
  mastery = null,
}) {
  const faceA = reversed ? back : front
  const faceANote = reversed ? backNote : frontNote
  const faceB = reversed ? front : back
  const faceBNote = reversed ? frontNote : backNote
  const sizeA = reversed ? 28 : 54
  const sizeB = reversed ? 54 : 28
  const fontA = reversed ? UI : JP
  const fontB = reversed ? JP : UI
  const modeA = reversed ? displaySettings.backMode : displaySettings.frontMode
  const modeB = reversed ? displaySettings.frontMode : displaySettings.backMode

  return (
    <div onClick={onClick} style={{ width: '100%', height: 240, perspective: 1000, cursor: 'pointer', userSelect: 'none' }}>
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.52s cubic-bezier(0.4, 0.2, 0.2, 1)',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e2dbd0',
          boxShadow: '0 6px 32px rgba(0,0,0,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}>
          <FaceText
            primary={faceA}
            secondary={faceANote}
            mode={modeA}
            primaryFont={fontA}
            primarySize={sizeA}
            secondaryFont={fontA}
            secondarySize={Math.max(16, Math.round(sizeA * 0.48))}
            primaryColor="#1c1917"
            secondaryColor="#78716c"
          />
          {displaySettings.showMasteryBadge && masteryVisual && mastery !== null && (
            <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ece8e2', borderRadius: 999, padding: '6px 10px', fontFamily: UI, fontSize: 12, color: '#5f574f' }}>
              <span style={{ fontSize: 13, color: '#1c1917' }}>{masteryVisual.icon}</span>
              <span>{mastery}/5</span>
            </div>
          )}
        </div>
        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: '#1c1917',
          borderRadius: 16,
          border: '1px solid #2e2a26',
          boxShadow: '0 6px 32px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}>
          <FaceText
            primary={faceB}
            secondary={faceBNote}
            mode={modeB}
            primaryFont={fontB}
            primarySize={sizeB}
            secondaryFont={fontB}
            secondarySize={Math.max(16, Math.round(sizeB * 0.5))}
            primaryColor="#faf8f5"
            secondaryColor="#d6cfc4"
          />
          {displaySettings.showMasteryBadge && masteryVisual && mastery !== null && (
            <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '6px 10px', fontFamily: UI, fontSize: 12, color: '#d6cfc4' }}>
              <span style={{ fontSize: 13, color: '#faf8f5' }}>{masteryVisual.icon}</span>
              <span>{mastery}/5</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
