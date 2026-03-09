import { JP, UI } from '../../app/constants'
import { btn } from '../../app/styles'

export function AuthScreen({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  authMessage,
  authError,
  authBusy,
  isConfigured,
  signupEnabled,
}) {
  const title = mode === 'signin' || !signupEnabled ? 'Connexion' : 'Créer un compte'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f2ee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '1px solid #e8e2d9', borderRadius: 20, padding: 24, boxShadow: '0 18px 40px rgba(28,25,23,0.08)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <span style={{ fontFamily: JP, fontSize: 16, color: '#c9b99a', fontWeight: 600 }}>日本語</span>
          <h1 style={{ fontFamily: UI, fontSize: 24, color: '#1c1917', margin: 0 }}>{title}</h1>
          <p style={{ fontFamily: UI, fontSize: 13, color: '#78716c', lineHeight: 1.5 }}>
            L’accès à l’application est protégé par un compte Supabase. Sans connexion, personne ne peut entrer ni lire les données.
          </p>
        </div>

        {!isConfigured && (
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c', fontFamily: UI, fontSize: 13 }}>
            Variables Supabase manquantes. Configure `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans Vercel.
          </div>
        )}

        {signupEnabled && (
          <div style={{ display: 'flex', gap: 6, background: '#ece8e2', borderRadius: 12, padding: 4, marginBottom: 18 }}>
            {[
              { id: 'signin', label: 'Connexion' },
              { id: 'signup', label: 'Créer' },
            ].map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: mode === option.id ? '#fff' : 'transparent',
                  color: mode === option.id ? '#1c1917' : '#78716c',
                  fontFamily: UI,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="toi@example.com"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 15, outline: 'none' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontFamily: UI, fontSize: 11, color: '#78716c', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2dbd0', background: '#fff', color: '#1c1917', fontFamily: UI, fontSize: 15, outline: 'none' }}
            />
          </label>

          {authMessage && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontFamily: UI, fontSize: 13 }}>
              {authMessage}
            </div>
          )}
          {authError && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c', fontFamily: UI, fontSize: 13 }}>
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authBusy || !isConfigured}
            style={btn({
              padding: '13px 16px',
              background: '#1c1917',
              color: '#faf8f5',
              border: 'none',
              opacity: authBusy || !isConfigured ? 0.6 : 1,
            })}
          >
            {authBusy ? 'Chargement…' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  )
}
