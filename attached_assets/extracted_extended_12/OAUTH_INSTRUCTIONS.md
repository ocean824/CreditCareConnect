# 🔐 OAuth Login with Supabase (Google, GitHub)

Supabase supports OAuth providers via their Auth module.

## 🔧 Setup Steps in Supabase Dashboard:
1. Go to `Authentication` > `Providers`
2. Enable **Google** and/or **GitHub**
3. Enter your client ID and secret from Google/GitHub Developer Console
4. Save changes

## 🔑 Required ENV Variables (optional override):
- SUPABASE_OAUTH_REDIRECT_URL=http://localhost:3000/oauth/callback

## Example Usage (frontend):
```ts
import { supabase } from './supabaseClient';

// Login with Google
const { user, error } = await supabase.auth.signInWithOAuth({
  provider: 'google'
});

// Login with GitHub
const { user, error } = await supabase.auth.signInWithOAuth({
  provider: 'github'
});
```
Redirects are handled automatically.