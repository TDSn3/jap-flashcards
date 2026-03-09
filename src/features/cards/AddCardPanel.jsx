import { JP, UI } from '../../app/constants'
import { btn } from '../../app/styles'
import { getTagColorOption } from '../../app/utils'

export function AddCardPanel({
  show,
  setShow,
  newFront,
  setNewFront,
  newFrontNote,
  setNewFrontNote,
  newBack,
  setNewBack,
  newBackNote,
  setNewBackNote,
  addCard,
  tags,
  newCardTags,
  toggleNewCardTag,
}) {
  if (!show) return null

  return (
    <div style={{ width: '100%', maxWidth: 500, marginBottom: 20, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 18, padding: '18px 16px', boxShadow: '0 14px 34px rgba(28,25,23,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: UI, fontSize: 15, fontWeight: 600, color: '#1c1917' }}>Ajouter une carte</div>
          <div style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>
            La nouvelle carte sera ajoutée au deck sélectionné.
          </div>
        </div>
        <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', fontSize: 18, padding: '0 4px' }}>
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={{ fontFamily: UI, fontSize: 11, color: '#78716c', display: 'block', marginBottom: 8, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Recto
          </label>
          <input value={newFront} onChange={e => setNewFront(e.target.value)} placeholder="ex : ねこ"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: JP, fontSize: 28, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
          <input value={newFrontNote} onChange={e => setNewFrontNote(e.target.value)} placeholder="Ligne 2 optionnelle"
            style={{ width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#78716c', fontFamily: JP, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontFamily: UI, fontSize: 11, color: '#78716c', display: 'block', marginBottom: 8, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Verso
          </label>
          <input value={newBack} onChange={e => setNewBack(e.target.value)} placeholder="ex : Chat 🐱"
            onKeyDown={e => e.key === 'Enter' && addCard()}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 17, outline: 'none', boxSizing: 'border-box' }} />
          <input value={newBackNote} onChange={e => setNewBackNote(e.target.value)} placeholder="Ligne 2 optionnelle"
            style={{ width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#78716c', fontFamily: UI, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontFamily: UI, fontSize: 11, color: '#78716c', display: 'block', marginBottom: 8, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Tags
          </label>
          {tags.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tags.map(tag => {
                const selected = newCardTags.includes(tag.name)
                const color = getTagColorOption(tag.color)
                return (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => toggleNewCardTag(tag.name)}
                    style={btn({
                      padding: '8px 12px',
                      borderColor: selected ? color.text : color.border,
                      background: color.bg,
                      color: color.text,
                    })}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          ) : (
            <p style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e' }}>Crée d’abord des tags dans l’onglet Tags.</p>
          )}
        </div>
        <button onClick={addCard} disabled={!newFront.trim() || !newBack.trim()}
          style={btn({
            padding: 14,
            width: '100%',
            fontSize: 14,
            background: newFront.trim() && newBack.trim() ? '#1c1917' : '#e8e2d9',
            color: newFront.trim() && newBack.trim() ? '#faf8f5' : '#a8a29e',
            border: 'none',
          })}
        >
          Ajouter la carte
        </button>
      </div>
    </div>
  )
}
