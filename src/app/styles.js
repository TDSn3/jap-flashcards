import { UI } from './constants'

export const btn = (extra = {}) => ({
  fontFamily: UI,
  fontSize: 13,
  fontWeight: 500,
  padding: '10px 16px',
  borderRadius: 10,
  cursor: 'pointer',
  border: '1px solid #e2dbd0',
  background: '#fff',
  color: '#1c1917',
  transition: 'opacity .15s',
  outline: 'none',
  ...extra,
})
