# Apple account linking — backend setup

Settings → Account → "Connect Apple sign-in" runs two attempts:

1. **Native fast path** (works today, no setup): the native Apple sheet +
   Supabase automatic email-match linking. Succeeds whenever the Apple ID
   shares the account's email.
2. **Web fallback** (handles Hide My Email, zero user instructions): Supabase
   *manual identity linking* through Apple's web sheet — binds the Apple
   identity to the signed-in account regardless of email. Until the setup
   below is done, this reports "unavailable" and the user just sees a short
   "couldn't connect" toast — nothing breaks.

## Manual steps to activate the web fallback

### Apple Developer portal
1. **Services ID**: Identifiers → new → Services ID, e.g.
   `com.octavio.spotted.auth`. Enable *Sign in with Apple*, configure it:
   - Primary App ID: `com.octavio.spotted`
   - Domain: `nvywxqntsrlrmlrpfuub.supabase.co`
   - Return URL: `https://nvywxqntsrlrmlrpfuub.supabase.co/auth/v1/callback`
2. **Key**: Keys → new → enable *Sign in with Apple* → download the `.p8`
   (once!). Note the **Key ID**. Team ID is `RDVYP26JPD`.

### Client secret
Apple web OAuth uses a short-lived JWT as the client secret, signed with the
`.p8`. Generate it per Supabase's docs ("Sign in with Apple" → secret
generation snippet). **It expires every 6 months** — calendar a rotation.

### Supabase dashboard
3. Authentication → Providers → **Apple**:
   - Client IDs: `com.octavio.spotted.auth,com.octavio.spotted`
     (Services ID FIRST — Supabase uses the first entry as the web-flow client ID; the bundle ID anywhere in the list covers native token validation)
   - Secret Key (for OAuth): paste the generated JWT
4. Authentication → Settings: enable **Allow manual linking**.
5. Authentication → URL Configuration → Redirect URLs: add
   `spotted://link-apple`

After step 5, the settings flow silently upgrades: users whose Apple ID hides
their email get the Apple web sheet (Face ID, one tap) and the identity links
to their existing account — no instructions, no account switching.
