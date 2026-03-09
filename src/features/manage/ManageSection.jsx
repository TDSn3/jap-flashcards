import { JP, UI } from '../../app/constants'
import { btn } from '../../app/styles'
import { getTagColorOption, getTagStyle, toggleFilterValue } from '../../app/utils'
import { ToggleSwitch } from '../../components/ui/ToggleSwitch'
import { getMasteryVisual } from '../../reviewUtils'

export function ManageSection({
  selectedDeckId,
  setSelectedDeckId,
  decks,
  deleteSelectedDeck,
  newDeckName,
  setNewDeckName,
  addDeck,
  cards,
  managedCards,
  showBulkUndo,
  undoBulkDeckAction,
  bulkUndo,
  bulkUndoOpacity,
  allCardsIncludedInSelectedDeck,
  excludeAllCardsFromSelectedDeck,
  includeAllCardsInSelectedDeck,
  bulkActionLabel,
  manageSort,
  updateSelectedDeckSort,
  manageGroupInactive,
  setManageGroupInactive,
  manageFiltersOpen,
  setManageFiltersOpen,
  clearManageFilters,
  tags,
  manageTagFilter,
  setManageTagFilter,
  manageStatusFilter,
  setManageStatusFilter,
  manageMasteryFilter,
  setManageMasteryFilter,
  manageDateFilter,
  setManageDateFilter,
  openManageCardEditor,
  selectedDeck,
  toggleCardInSelectedDeck,
  manageEditingCardId,
  manageDraft,
  setManageDraft,
  manageTagMenuCardId,
  setManageTagMenuCardId,
  removeDraftTag,
  addDraftTag,
  manageNewTagValue,
  setManageNewTagValue,
  createAndAddDraftTag,
  deleteCard,
  cancelManagedCardEdit,
  saveManagedCard,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 6 }}>Deck</div>
            <select
              value={selectedDeckId || ''}
              onChange={event => setSelectedDeckId(event.target.value)}
              style={{ width: '100%', padding: '10px 38px 10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 14, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
            >
              {decks.map(deckItem => (
                <option key={deckItem.id} value={deckItem.id}>{deckItem.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={deleteSelectedDeck}
            disabled={decks.length <= 1}
            style={btn({
              borderColor: decks.length > 1 ? '#fca5a5' : '#e8e2d9',
              color: decks.length > 1 ? '#b91c1c' : '#a8a29e',
              background: decks.length > 1 ? '#fff5f5' : '#f5f2ee',
            })}
          >
            Supprimer
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={newDeckName}
            onChange={event => setNewDeckName(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && addDeck()}
            placeholder="Nouveau deck"
            style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
          <button
            onClick={addDeck}
            disabled={!newDeckName.trim()}
            style={btn({
              background: newDeckName.trim() ? '#1c1917' : '#e8e2d9',
              color: newDeckName.trim() ? '#faf8f5' : '#a8a29e',
              border: 'none',
            })}
          >
            Creer
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {cards.length === 0
          ? <p style={{ fontFamily: UI, color: '#a8a29e', textAlign: 'center', padding: '32px 0' }}>Aucune carte.</p>
          : <p style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e' }}>{managedCards.length} flashcard(s) affichee(s) / {cards.length}</p>}
        {cards.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showBulkUndo && (
              <button
                onClick={undoBulkDeckAction}
                title={`Annuler ${bulkUndo.actionLabel.toLowerCase()}`}
                aria-label={`Annuler ${bulkUndo.actionLabel.toLowerCase()}`}
                style={btn({
                  padding: '8px 12px',
                  background: '#fff',
                  color: '#5f574f',
                  borderColor: '#d6cfc4',
                  opacity: bulkUndoOpacity,
                  transition: 'opacity .1s linear',
                })}
              >
                ↩ Revenir
              </button>
            )}
            <button
              onClick={allCardsIncludedInSelectedDeck ? excludeAllCardsFromSelectedDeck : includeAllCardsInSelectedDeck}
              style={btn({ background: '#f5f2ee', color: '#5f574f' })}
            >
              {bulkActionLabel}
            </button>
          </div>
        )}
      </div>
      {cards.length > 0 && (
        <div style={{ width: '100%' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Tri</span>
            <select value={manageSort} onChange={event => updateSelectedDeckSort(event.target.value)} style={{ width: '100%', padding: '10px 38px 10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 13, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}>
              <option value="created-desc">Ordre d'ajout recent</option>
              <option value="alpha">Ordre alphabetique</option>
              <option value="created-asc">Ordre d'ajout ancien</option>
              <option value="recent-review">Revise le plus recemment</option>
              <option value="mastery">Score de memorisation</option>
            </select>
          </label>
        </div>
      )}
      {cards.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: UI, fontSize: 12, fontWeight: 600, color: '#1c1917' }}>Inactif en bas</span>
            <span style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e' }}>Trie les actifs ensemble, puis les inactifs ensemble.</span>
          </div>
          <ToggleSwitch
            checked={manageGroupInactive}
            onChange={() => setManageGroupInactive(current => !current)}
            onLabel="On"
            offLabel="Off"
          />
        </div>
      )}
      {cards.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setManageFiltersOpen(open => !open)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 14px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: UI,
              color: '#1c1917',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Filtres
            </span>
            <span style={{ fontSize: 14, color: '#78716c', paddingRight: 2 }}>{manageFiltersOpen ? '▾' : '▸'}</span>
          </button>
          {manageFiltersOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, padding: '0 14px 14px' }}>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={clearManageFilters} style={btn({ padding: '8px 12px', fontSize: 12, background: '#f5f2ee', color: '#5f574f' })}>
                  Clear filters
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Filtre tag</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map(tag => {
                    const active = manageTagFilter.includes(tag.name)
                    const color = getTagColorOption(tag.color)
                    return (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => setManageTagFilter(current => toggleFilterValue(current, tag.name))}
                        style={btn({
                          padding: '6px 10px',
                          fontSize: 12,
                          borderColor: active ? color.text : color.border,
                          background: color.bg,
                          color: color.text,
                        })}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Filtre etat</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { id: 'active', label: 'Actif' },
                    { id: 'inactive', label: 'Inactif' },
                  ].map(option => {
                    const active = manageStatusFilter.includes(option.id)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setManageStatusFilter(current => toggleFilterValue(current, option.id))}
                        style={btn({
                          padding: '6px 10px',
                          fontSize: 12,
                          borderColor: active ? '#1c1917' : '#d6cfc4',
                          background: active ? '#1c1917' : '#fff',
                          color: active ? '#faf8f5' : '#5f574f',
                        })}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Filtre score</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['1', '2', '3', '4', '5'].map(score => {
                    const active = manageMasteryFilter.includes(score)
                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setManageMasteryFilter(current => toggleFilterValue(current, score))}
                        style={btn({
                          padding: '6px 10px',
                          fontSize: 12,
                          borderColor: active ? '#1c1917' : '#d6cfc4',
                          background: active ? '#1c1917' : '#fff',
                          color: active ? '#faf8f5' : '#5f574f',
                        })}
                      >
                        {score} / 5
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Filtre date d'ajout</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { id: 'today', label: "Aujourd'hui" },
                    { id: '7d', label: '7 jours' },
                    { id: '30d', label: '30 jours' },
                  ].map(option => {
                    const active = manageDateFilter.includes(option.id)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setManageDateFilter(current => toggleFilterValue(current, option.id))}
                        style={btn({
                          padding: '6px 10px',
                          fontSize: 12,
                          borderColor: active ? '#1c1917' : '#d6cfc4',
                          background: active ? '#1c1917' : '#fff',
                          color: active ? '#faf8f5' : '#5f574f',
                        })}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {managedCards.map(c => (
        <div key={c.id} onClick={() => openManageCardEditor(c)} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#fff',
          border: '1px solid #e8e2d9',
          borderRadius: 12,
          padding: '13px 16px',
          opacity: selectedDeck?.cardIds.includes(c.id) ? 1 : 0.55,
          transition: 'opacity .2s',
          cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: JP, fontSize: 20, fontWeight: 600, color: '#1c1917' }}>{c.front}</div>
              {c.frontNote && <div style={{ fontFamily: JP, fontSize: 14, color: '#a8a29e', marginTop: 3 }}>{c.frontNote}</div>}
              <div style={{ fontFamily: UI, fontSize: 12, color: '#a8a29e', marginTop: 2 }}>{c.back}</div>
              {c.backNote && <div style={{ fontFamily: UI, fontSize: 12, color: '#c9c1b6', marginTop: 3 }}>{c.backNote}</div>}
            </div>
            <div onClick={event => event.stopPropagation()}>
              <ToggleSwitch
                checked={!!selectedDeck?.cardIds.includes(c.id)}
                onChange={() => toggleCardInSelectedDeck(c.id)}
                onLabel="Dans deck"
                offLabel="Hors deck"
              />
            </div>
          </div>
          {manageEditingCardId === c.id ? (
            <div onClick={event => event.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Recto</span>
                  <input
                    value={manageDraft.front}
                    onChange={event => setManageDraft(current => ({ ...current, front: event.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: JP, fontSize: 22, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <input
                    value={manageDraft.frontNote}
                    onChange={event => setManageDraft(current => ({ ...current, frontNote: event.target.value }))}
                    placeholder="Ligne 2 optionnelle"
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#78716c', fontFamily: JP, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Verso</span>
                  <textarea
                    value={manageDraft.back}
                    onChange={event => setManageDraft(current => ({ ...current, back: event.target.value }))}
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                  <input
                    value={manageDraft.backNote}
                    onChange={event => setManageDraft(current => ({ ...current, backNote: event.target.value }))}
                    placeholder="Ligne 2 optionnelle"
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#78716c', fontFamily: UI, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {manageDraft.tags.map(tag => {
                  const { color } = getTagStyle(tags, tag)
                  return (
                    <span
                      key={`${c.id}-${tag}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 10px',
                        fontFamily: UI,
                        fontSize: 11,
                        border: `1px solid ${color.border}`,
                        background: color.bg,
                        color: color.text,
                        borderRadius: 999,
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeDraftTag(tag)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: color.text, fontSize: 12, lineHeight: 1 }}
                        aria-label={`Supprimer le tag ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setManageTagMenuCardId(current => current === c.id ? null : c.id)}
                  style={btn({
                    width: 28,
                    height: 28,
                    padding: 0,
                    borderRadius: 999,
                    background: '#f5f2ee',
                    color: '#5f574f',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}
                  aria-label="Ajouter un tag"
                >
                  +
                </button>
              </div>
              {manageTagMenuCardId === c.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#f8f6f2', border: '1px solid #ece8e2' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tags.filter(tag => !manageDraft.tags.includes(tag.name)).map(tag => {
                      const color = getTagColorOption(tag.color)
                      return (
                        <button
                          key={`${c.id}-add-${tag.name}`}
                          type="button"
                          onClick={() => addDraftTag(tag.name)}
                          style={btn({
                            padding: '5px 10px',
                            fontSize: 11,
                            borderColor: color.border,
                            background: color.bg,
                            color: color.text,
                            borderRadius: 999,
                          })}
                        >
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={manageNewTagValue}
                      onChange={event => setManageNewTagValue(event.target.value)}
                      onKeyDown={event => event.key === 'Enter' && createAndAddDraftTag()}
                      placeholder="Nouveau tag"
                      style={{ flex: 1, padding: '9px 11px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button type="button" onClick={createAndAddDraftTag} style={btn({ padding: '8px 12px', background: '#1c1917', color: '#faf8f5', border: 'none' })}>
                      Ajouter
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button type="button" onClick={() => deleteCard(c.id)} style={btn({ padding: '8px 12px', borderColor: '#fca5a5', color: '#b91c1c', background: '#fff5f5' })}>
                  Supprimer
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={cancelManagedCardEdit} style={btn({ padding: '8px 12px', background: '#f5f2ee', color: '#5f574f' })}>
                    Annuler
                  </button>
                  <button type="button" onClick={() => saveManagedCard(c.id)} disabled={!manageDraft.front.trim() || !manageDraft.back.trim()} style={btn({ padding: '8px 12px', background: '#1c1917', color: '#faf8f5', border: 'none' })}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: UI, fontSize: 11, color: '#5f574f', background: '#ece8e2', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                {getMasteryVisual(c.memory?.mastery || 1).icon} {c.memory?.mastery || 1}/5
              </span>
              {(c.tags || []).map(tag => {
                const { color } = getTagStyle(tags, tag)
                return (
                  <span
                    key={`${c.id}-${tag}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '5px 10px',
                      fontFamily: UI,
                      fontSize: 11,
                      border: `1px solid ${color.border}`,
                      background: color.bg,
                      color: color.text,
                      borderRadius: 999,
                    }}
                  >
                    {tag}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      ))}
      {cards.length > 0 && managedCards.length === 0 && (
        <p style={{ fontFamily: UI, color: '#a8a29e', textAlign: 'center', padding: '24px 0' }}>Aucune carte ne correspond aux filtres.</p>
      )}
    </div>
  )
}
