// cloudinary-sign
// Generates a SHA-1 signed upload signature so the browser can upload
// directly to Cloudinary without exposing the API secret.
//
// POST body: { asset_type: AssetType, user_id: string }
// Returns:   { signature, timestamp, cloud_name, api_key, upload_preset, folder, resource_type }

import { corsHeaders } from '../_shared/cors.ts'
import { ASSET_CONFIG, AssetType } from '../_shared/assetConfig.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Parse and validate request body ──────────────────────────────────
    const body = await req.json()
    const { asset_type, user_id } = body

    if (!asset_type || !user_id) {
      return new Response(
        JSON.stringify({ error: 'asset_type and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const config = ASSET_CONFIG[asset_type as AssetType]
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Unknown asset_type: ${asset_type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Read env vars ─────────────────────────────────────────────────────
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY')
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

    if (!cloudName || !apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'Cloudinary env vars not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. Build signature string ────────────────────────────────────────────
    // Parameters MUST be sorted alphabetically before hashing.
    // access_mode is only included for authenticated (KYC) assets.
    const timestamp = Math.floor(Date.now() / 1000)

    const params: Record<string, string> = {
      folder: config.folder,
      timestamp: String(timestamp),
      upload_preset: config.upload_preset,
    }

    if (config.access_mode === 'authenticated') {
      params['access_mode'] = 'authenticated'
    }

    // Sort keys alphabetically and build the string to sign
    const signatureString =
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&') + apiSecret

    // ── 4. SHA-1 hash using Web Crypto ───────────────────────────────────────
    const msgBuffer  = new TextEncoder().encode(signatureString)
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer)
    const hashArray  = Array.from(new Uint8Array(hashBuffer))
    const signature  = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // ── 5. Return signing payload to browser ─────────────────────────────────
    return new Response(
      JSON.stringify({
        signature,
        timestamp,
        cloud_name:     cloudName,
        api_key:        apiKey,
        upload_preset:  config.upload_preset,
        folder:         config.folder,
        resource_type:  config.resource_type,
        access_mode:    config.access_mode,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('cloudinary-sign error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
