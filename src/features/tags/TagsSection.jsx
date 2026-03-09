import { JP, TAG_COLOR_OPTIONS, UI } from '../../app/constants'
import { btn } from '../../app/styles'
import { getTagColorOption } from '../../app/utils'

export function TagsSection({
  newTag,
  setNewTag,
  addTag,
  newTagColor,
  setNewTagColor,
  tags,
  editingTagName,
  editingTagValue,
  setEditingTagValue,
  saveTagName,
  setEditingTagName,
  setTagColorPicker,
  tagColorPicker,
  updateTagColor,
  startEditingTag,
  setTagPicker,
  tagPicker,
  deleteTag,
  cards,
  toggleCardTag,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 16 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={newTag}
          onChange={event => setNewTag(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && addTag()}
          placeholder="ex : animaux"
          style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
        />
        <button
          onClick={addTag}
          disabled={!newTag.trim()}
          style={btn({
            padding: '12px 14px',
            background: newTag.trim() ? '#1c1917' : '#e8e2d9',
            color: newTag.trim() ? '#faf8f5' : '#a8a29e',
            border: 'none',
          })}
        >
          Ajouter
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TAG_COLOR_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => setNewTagColor(option.id)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: `2px solid ${newTagColor === option.id ? option.text : option.border}`,
              background: option.bg,
              cursor: 'pointer',
            }}
            aria-label={option.label}
            title={option.label}
          />
        ))}
      </div>

      {tags.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tags.map(tag => (
            <div
              key={tag.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: '#fff',
                border: '1px solid #e8e2d9',
                borderRadius: 12,
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setTagColorPicker(current => current === tag.name ? null : tag.name)}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: getTagColorOption(tag.color).bg,
                        border: `1px solid ${getTagColorOption(tag.color).border}`,
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'transform .15s ease, box-shadow .15s ease',
                        boxShadow: tagColorPicker === tag.name ? '0 0 0 3px rgba(0,0,0,0.06)' : 'none',
                      }}
                      aria-label={`Changer la couleur du tag ${tag.name}`}
                      title="Changer la couleur"
                      onMouseEnter={event => { event.currentTarget.style.transform = 'scale(1.08)' }}
                      onMouseLeave={event => { event.currentTarget.style.transform = 'scale(1)' }}
                    />
                    {tagColorPicker === tag.name && (
                      <div style={{
                        position: 'absolute',
                        top: 22,
                        left: 0,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        width: 116,
                        padding: 8,
                        borderRadius: 10,
                        background: '#fff',
                        border: '1px solid #e8e2d9',
                        boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
                        zIndex: 20,
                      }}>
                        {TAG_COLOR_OPTIONS.map(option => (
                          <button
                            key={`${tag.name}-${option.id}`}
                            type="button"
                            onClick={() => updateTagColor(tag.name, option.id)}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 999,
                              border: `2px solid ${tag.color === option.id ? option.text : option.border}`,
                              background: option.bg,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                            aria-label={option.label}
                            title={option.label}
                          />
                        ))}
                      </div>
                    )}
                    {editingTagName === tag.name ? (
                      <input
                        value={editingTagValue}
                        onChange={event => setEditingTagValue(event.target.value)}
                        onBlur={() => saveTagName(tag.name)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') saveTagName(tag.name)
                          if (event.key === 'Escape') {
                            setEditingTagName(null)
                            setEditingTagValue('')
                          }
                        }}
                        autoFocus
                        style={{
                          fontFamily: UI,
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#1c1917',
                          border: '1px solid #d6cfc4',
                          borderRadius: 8,
                          padding: '4px 8px',
                          outline: 'none',
                          background: '#fff',
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingTag(tag.name)}
                        style={{
                          fontFamily: UI,
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#1c1917',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          borderRadius: 6,
                          transition: 'background .15s ease, color .15s ease',
                        }}
                        onMouseEnter={event => { event.currentTarget.style.background = '#f5f2ee' }}
                        onMouseLeave={event => { event.currentTarget.style.background = 'transparent' }}
                        title="Renommer le tag"
                      >
                        {tag.name}
                      </button>
                    )}
                  </div>
                  <div style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>
                    {(cards || []).filter(card => (card.tags || []).includes(tag.name)).length} carte(s)
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setTagPicker(current => current === tag.name ? null : tag.name)}
                    style={btn({ borderColor: '#d6cfc4', color: '#5f574f', background: '#f5f2ee' })}
                  >
                    Ajouter
                  </button>
                  <button onClick={() => deleteTag(tag.name)} style={btn({ borderColor: '#fca5a5', color: '#b91c1c', background: '#fff5f5' })}>
                    Supprimer
                  </button>
                </div>
              </div>
              {tagPicker === tag.name && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #eee7de', paddingTop: 12 }}>
                  <div style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                    Ajouter ce tag aux flashcards
                  </div>
                  {(cards || []).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {cards.map(card => {
                        const selected = (card.tags || []).includes(tag.name)
                        return (
                          <button
                            key={`${tag.name}-${card.id}`}
                            onClick={() => toggleCardTag(card.id, tag.name)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 10,
                              border: `1px solid ${selected ? '#1c1917' : '#e8e2d9'}`,
                              background: selected ? '#f5f2ee' : '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ textAlign: 'left', minWidth: 0 }}>
                              <div style={{ fontFamily: JP, fontSize: 18, fontWeight: 600, color: '#1c1917' }}>{card.front}</div>
                              <div style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>{card.back}</div>
                            </div>
                            <span style={{ fontFamily: UI, fontSize: 11, color: selected ? '#faf8f5' : getTagColorOption(tag.color).text, background: selected ? getTagColorOption(tag.color).text : getTagColorOption(tag.color).bg, padding: '4px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                              {selected ? 'Ajoute' : 'Ajouter'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e' }}>Aucune flashcard disponible.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontFamily: UI, color: '#a8a29e', textAlign: 'center', padding: '24px 0' }}>Aucun tag pour le moment.</p>
      )}
    </div>
  )
}
