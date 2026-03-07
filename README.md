# Flashcards PWA

Application React + Vite déployée sur Vercel avec authentification Supabase.

## Ce qui protège l'accès

- l'app exige maintenant une connexion Supabase avant d'entrer
- chaque utilisateur lit et écrit uniquement ses propres lignes via `user_id` + RLS
- par défaut, l'inscription depuis le site est désactivée

Si tu veux laisser des gens créer leur compte eux-mêmes, passe `VITE_ENABLE_SIGNUP=true` dans Vercel.

## Variables Vercel

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_SIGNUP=false`

Copie locale:

```bash
cp .env.example .env.local
```

## Setup Supabase

1. Dans Supabase Auth, active le provider `Email`.
2. Si tu veux que personne ne puisse créer de compte tout seul, laisse `VITE_ENABLE_SIGNUP=false` et crée les utilisateurs depuis le dashboard Supabase.
3. Exécute le SQL de [supabase/schema.sql](/Users/thomas/Downloads/flashcards-pwa/supabase/schema.sql) dans l'éditeur SQL Supabase.

Le schéma crée de nouvelles tables sécurisées:

- `app_cards`
- `app_decks`
- `app_tags`
- `app_meta`

Les anciennes tables ne sont pas supprimées.

## Node

Le projet attend Node `20.19+` ou `22.x`.

## Scripts

```bash
npm install
npm run dev
npm run build
```
