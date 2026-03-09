import { TABS, UI } from '../../app/constants'

export function BottomNav({ tab, setTab }) {
  return (
    <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: 'min(500px, calc(100vw - 40px))', padding: '12px 0 calc(12px + env(safe-area-inset-bottom))', background: '#f5f2ee', zIndex: 40 }}>
      <div style={{ display: 'flex', gap: 6, background: '#e8e3db', border: '1px solid #ddd4c9', borderRadius: 18, padding: 6, boxShadow: '0 12px 30px rgba(28,25,23,0.10)' }}>
        {TABS.map((label, index) => (
          <button
            key={label}
            onClick={() => setTab(index)}
            style={{
              flex: 1,
              padding: '11px 4px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontFamily: UI,
              fontSize: 12,
              fontWeight: 600,
              background: tab === index ? '#fff' : 'transparent',
              color: tab === index ? '#1c1917' : '#8a8178',
              boxShadow: tab === index ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all .2s',
              outline: 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
