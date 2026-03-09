import { UI } from '../../app/constants'

export function DirSwitch({ reversed, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ece8e2', borderRadius: 50, padding: '5px 14px' }}>
      <span style={{ fontFamily: UI, fontSize: 13, fontWeight: 600, color: reversed ? '#a8a29e' : '#1c1917', transition: 'color .2s' }}>Recto</span>
      <div onClick={onChange} style={{ width: 38, height: 21, borderRadius: 11, cursor: 'pointer', background: reversed ? '#1c1917' : '#d6cfc4', position: 'relative', transition: 'background .25s' }}>
        <div style={{ position: 'absolute', top: 2.5, left: reversed ? 19 : 2.5, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left .25s cubic-bezier(.4,.2,.2,1)' }} />
      </div>
      <span style={{ fontFamily: UI, fontSize: 13, fontWeight: 500, color: reversed ? '#1c1917' : '#a8a29e', transition: 'color .2s' }}>Verso</span>
    </div>
  )
}
