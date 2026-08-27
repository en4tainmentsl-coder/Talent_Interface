// ═══════════════════════════════════════════════════════════════════════════
// cloudinary-sign  —  En4tainment
// Generates a SHA-1 signed upload signature so the browser can upload
// directly to Cloudinary without exposing the API secret.
//
// SCOPE: PUBLIC assets only. Sensitive assets (KYC, venue documents) go
// through upload-document, which proxies the bytes into private R2.
//
// NOTE: this function cannot enforce a size limit — it never sees the bytes,
// and Cloudinary has no signable size parameter. Preset max_file_size is
// silently discarded on the free plan. Size enforcement requires proxying
// uploads through an Edge Function; tracked separately.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Explicit allowlist. '*' let any origin on the internet drive uploads with a
// signed-in user's session; only the app's own origins need access.
const ALLOWED_ORIGINS = [
  'https://www.en4tainment.com',
  'https://en4tainment.com',
  'https://app.en4tainment.com',
  'http://localhost:5173',
  'http://localhost:3000',
]

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const MIGRATED_TO_R2 = ['kyc_front', 'kyc_back', 'venue_document']

// resource_type is 'image' everywhere. Portfolio was previously 'auto', which
// routed uploads to /auto/upload and allowed video and audio through — the
// talent_media CHECK and the product decision both say image-only.
const ASSET_CONFIG: Record<string, {
  folder: string
  upload_preset: string
  resource_type: 'image'
}> = {
  talent_avatar:    { folder: 'en410/avatars',       upload_preset: 'en410_avatars',          resource_type: 'image' },
  talent_cover:     { folder: 'en410/profiles',      upload_preset: 'en410_artist_profile',   resource_type: 'image' },
  talent_portfolio: { folder: 'en410/portfolio',     upload_preset: 'en410_artist_portfolio', resource_type: 'image' },
  client_avatar:    { folder: 'en4tainment/avatars', upload_preset: 'en4tainment_avatars',    resource_type: 'image' },
  venue_avatar:     { folder: 'en4tainment/avatars', upload_preset: 'en4tainment_avatars',    resource_type: 'image' },
}

Deno.serve(async (req: Request) => {
  const corsHeaders = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
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

    const { asset_type } = await req.json()
    if (!asset_type) return json({ error: 'asset_type is required' }, 400)

    if (MIGRATED_TO_R2.includes(asset_type)) {
      return json({
        error: `'${asset_type}' is no longer served by Cloudinary. Use upload-document.`,
      }, 400)
    }

    const config = ASSET_CONFIG[asset_type]
    if (!config) {
      return json({
        error: `Unknown asset_type: ${asset_type}. Valid values: ${Object.keys(ASSET_CONFIG).join(', ')}`,
      }, 400)
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY')
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('cloudinary-sign: missing Cloudinary env vars')
      return json({ error: 'Server misconfiguration' }, 500)
    }

    // Bind the signature to one specific destination object.
    //
    // Without this, the signature covers only folder + timestamp + preset, so
    // it is a bearer token good for UNLIMITED uploads into a shared folder for
    // its full one-hour validity. Signing a server-generated public_id, with
    // overwrite:false set on every preset, means a replayed signature targets
    // an object that already exists and cannot write new content — one
    // signature, one upload.
    //
    // Generated server-side and never taken from the request: a client-supplied
    // public_id would let a caller aim the upload at someone else's asset path.
    const publicId = crypto.randomUUID()

    // Cloudinary requires parameters sorted alphabetically by key, joined with
    // '&', with the API secret appended directly to the end (no separator).
    // The client must send EXACTLY these params plus file, api_key, signature —
    // any extra signed-eligible field breaks the signature, and any missing one
    // does too. If you add a param here, update every caller in the same PR.
    const timestamp = Math.floor(Date.now() / 1000)
    const params: Record<string, string> = {
      folder:        config.folder,
      public_id:     publicId,
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
      public_id:     publicId,
      resource_type: config.resource_type,
    })
  } catch (err) {
    console.error('cloudinary-sign error:', String(err))
    return json({ error: 'Internal server error' }, 500)
  }
})
