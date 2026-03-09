import { DISPLAY_MODE_OPTIONS, UI } from '../../app/constants'
import { btn } from '../../app/styles'
import { ToggleSwitch } from '../../components/ui/ToggleSwitch'

export function AppHeader({
  saveStatus,
  settingsOpen,
  setSettingsOpen,
  displaySettings,
  setDisplaySettings,
  handleSignOut,
  setShowAddCardPanel,
  selectedDeckId,
  setSelectedDeckId,
  decks,
}) {
  return (
    <div style={{ width: '100%', maxWidth: 500, marginBottom: 18, paddingTop: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <button
              onClick={() => setSettingsOpen(current => !current)}
              aria-label="Ouvrir les réglages"
              style={btn({ padding: '8px 12px', fontSize: 12, background: '#f5f2ee', color: '#5f574f' })}
            >
              Settings
            </button>
            {saveStatus === 'saved' && <span style={{ fontFamily: UI, fontSize: 12, color: '#86efac' }}>✓ sauvegardé</span>}
            {saveStatus === 'error' && <span style={{ fontFamily: UI, fontSize: 12, color: '#fca5a5' }}>⚠ erreur</span>}
            {settingsOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: 260, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 12, boxShadow: '0 12px 30px rgba(28,25,23,0.12)', padding: 8, zIndex: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 10px 12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Affichage recto</span>
                    <select
                      value={displaySettings.frontMode}
                      onChange={event => setDisplaySettings(current => ({ ...current, frontMode: event.target.value }))}
                      style={{ width: '100%', padding: '9px 34px 9px 10px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 13, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 17px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                    >
                      {DISPLAY_MODE_OPTIONS.map(option => (
                        <option key={`front-${option.id}`} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Affichage verso</span>
                    <select
                      value={displaySettings.backMode}
                      onChange={event => setDisplaySettings(current => ({ ...current, backMode: event.target.value }))}
                      style={{ width: '100%', padding: '9px 34px 9px 10px', borderRadius: 10, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 13, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 17px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                    >
                      {DISPLAY_MODE_OPTIONS.map(option => (
                        <option key={`back-${option.id}`} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Score sur la carte</span>
                    <ToggleSwitch
                      checked={displaySettings.showMasteryBadge}
                      onChange={() => setDisplaySettings(current => ({ ...current, showMasteryBadge: !current.showMasteryBadge }))}
                      onLabel="On"
                      offLabel="Off"
                    />
                  </label>
                </div>
                <div style={{ height: 1, background: '#ece8e2', margin: '0 8px 8px' }} />
                <button
                  onClick={handleSignOut}
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: UI, fontSize: 13, color: '#5f574f' }}
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <button
              onClick={() => {
                setShowAddCardPanel(current => !current)
                setSettingsOpen(false)
              }}
              style={btn({ padding: '8px 12px', fontSize: 12, background: '#1c1917', color: '#faf8f5', border: 'none' })}
            >
              Ajouter une carte
            </button>
          </div>
        </div>
        <div>
          <select
            value={selectedDeckId || ''}
            onChange={event => setSelectedDeckId(event.target.value)}
            style={{ width: '100%', padding: '12px 38px 12px 12px', borderRadius: 12, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 14, outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #78716c 50%), linear-gradient(135deg, #78716c 50%, transparent 50%)', backgroundPosition: 'calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
          >
            {decks.map(deckItem => (
              <option key={deckItem.id} value={deckItem.id}>{deckItem.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ height: 1, background: '#e2dbd0', marginTop: 16 }} />
    </div>
  )
}
