import { UI } from '../../app/constants'

export function EmptyDeck() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#a8a29e' }}>
      <div style={{ fontSize: 38, marginBottom: 12 }}>🃏</div>
      <p style={{ fontFamily: UI, fontSize: 14 }}>Le deck est vide — activez des cartes dans "Gérer".</p>
    </div>
  )
}
