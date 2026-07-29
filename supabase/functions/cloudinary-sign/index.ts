// ═══════════════════════════════════════════════════════════════════════════
// cloudinary-sign  —  En4tainment
// Generates a SHA-1 signed upload signature so the browser can upload
// directly to Cloudinary without exposing the API secret.
//
// SCOPE: PUBLIC assets only. Sensitive assets (KYC, venue documents) are
// served by r2-sign-upload against a private Cloudflare R2 bucket and are
// explicitly rejected here.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Migrated off Cloudinary. Rejected with a clear message rather than
// "unknown asset_type", so a stale client is diagnosable.
const MIGRATED_TO_R2 = ['kyc_front', 'kyc_back', 'venue_document']

// All remaining assets are public. There is deliberately no 'authenticated'
// access_mode path any more — if you find yourself adding one, that asset
// belongs in R2 instead.
const ASSET_CONFIG: Record<string, {
  folder: string
  upload_preset: string
  resource_type: 'image' | 'video' | 'raw' | 'auto'
}> = {
  talent_avatar:    { folder: 'en410/avatars',       upload_preset: 'en410_avatars',          resource_type: 'image' },
  talent_cover:     { folder: 'en410/profiles',      upload_preset: 'en410_artist_profile',   resource_type: 'image' },
  talent_portfolio: { folder: 'en410/portfolio',     upload_preset: 'en410_artist_portfolio', resource_type: 'auto'  },
  client_avatar:    { folder: 'en4tainment/avatars', upload_preset: 'en4tainment_avatars',    resource_type: 'image' },
  venue_avatar:     { folder: 'en4tainment/avatars', upload_preset: 'en4tainment_avatars',    resource_type: 'image' },
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    // ── Authenticate ───────────────────────────────────────────────────────
    // The anon key ships in client-side JS, so it is not an access control.
    // Verify a real user session before handing out an upload signature.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    // ── Validate asset_type ────────────────────────────────────────────────
    const { asset_type } = await req.json()

    if (!asset_type) return json({ error: 'asset_type is required' }, 400)

    if (MIGRATED_TO_R2.includes(asset_type)) {
      return json({
        error: `'${asset_type}' is no longer served by Cloudinary. Use r2-sign-upload.`,
      }, 400)
    }

    const config = ASSET_CONFIG[asset_type]
    if (!config) {
      return json({
        error: `Unknown asset_type: ${asset_type}. Valid values: ${Object.keys(ASSET_CONFIG).join(', ')}`,
      }, 400)
    }

    // ── Env ────────────────────────────────────────────────────────────────
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY')
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('cloudinary-sign: missing Cloudinary env vars')
      return json({ error: 'Server misconfiguration' }, 500)
    }

    // ── Build the signature ────────────────────────────────────────────────
    // Cloudinary requires parameters sorted alphabetically by key, joined with
    // '&', with the API secret appended directly to the end (no separator).
    const timestamp = Math.floor(Date.now() / 1000)
    const params: Record<string, string> = {
      folder:        config.folder,
      timestamp:     String(timestamp),
      upload_preset: config.upload_preset,
    }

    const signatureString =
      Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + apiSecret

    const msgBuffer  = new TextEncoder().encode(signatureString)
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer)
    const signature  = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return json({
      signature,
      timestamp,
      cloud_name:    cloudName,
      api_key:       apiKey,
      upload_preset: config.upload_preset,
      folder:        config.folder,
      resource_type: config.resource_type,
      access_mode:   'public',   // retained for frontend compatibility
    })
  } catch (err) {
    console.error('cloudinary-sign error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})