import { UI } from '../../app/constants'

export function ToggleSwitch({ checked, onChange, onLabel = 'On', offLabel = 'Off' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: UI, fontSize: 11, color: checked ? '#1c1917' : '#a8a29e', fontWeight: 500 }}>
        {checked ? onLabel : offLabel}
      </span>
      <div
        onClick={onChange}
        style={{
          width: 38,
          height: 21,
          borderRadius: 11,
          cursor: 'pointer',
          background: checked ? '#1c1917' : '#d6cfc4',
          position: 'relative',
          transition: 'background .25s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2.5,
            left: checked ? 19 : 2.5,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            transition: 'left .25s cubic-bezier(.4,.2,.2,1)',
          }}
        />
      </div>
    </div>
  )
}
