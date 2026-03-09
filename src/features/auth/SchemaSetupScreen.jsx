import { UI } from '../../app/constants'
import { btn } from '../../app/styles'

export function SchemaSetupScreen({ email, onSignOut }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f2ee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 20, padding: 24, boxShadow: '0 18px 40px rgba(28,25,23,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: UI, fontSize: 24, color: '#1c1917', margin: 0 }}>Supabase non migré</h1>
            <p style={{ fontFamily: UI, fontSize: 13, color: '#78716c', lineHeight: 1.5, marginTop: 8 }}>
              Connecté en tant que {email}, mais les tables sécurisées par utilisateur n’existent pas encore.
            </p>
          </div>
          <button onClick={onSignOut} style={btn({ background: '#f5f2ee', color: '#5f574f' })}>Se déconnecter</button>
        </div>
        <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 14, background: '#fffbea', border: '1px solid #fde68a', fontFamily: UI, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
          Exécute le SQL du fichier <code>supabase/schema.sql</code> dans l’éditeur SQL Supabase, puis recharge la page.
        </div>
        <div style={{ marginTop: 18, fontFamily: UI, fontSize: 13, color: '#5f574f', lineHeight: 1.7 }}>
          Le nouveau schéma crée `app_cards`, `app_decks`, `app_tags` et `app_meta` avec `user_id` + RLS. Les anciennes tables sont laissées intactes.
        </div>
      </div>
    </div>
  )
}
