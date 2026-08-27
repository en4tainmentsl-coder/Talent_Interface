// ═══════════════════════════════════════════════════════════════════════════
// process-upload  —  En4tainment
// Persists upload metadata after a direct-to-Cloudinary upload.
//
// SCOPE: PUBLIC assets only (Cloudinary). Sensitive assets (kyc_front,
// kyc_back, venue_document) are handled entirely by upload-document, which
// receives the bytes, inspects them, writes to private R2, and writes the DB
// row itself in one call. Those branches lived here previously and have been
// removed — having two functions capable of writing talent_identity /
// documents was the exact drift pattern that caused repeated bugs earlier in
// this project. upload-document is now the only writer for those tables.
//
// SIZE ENFORCEMENT: cloudinary-sign never sees file bytes (the browser
// uploads directly to Cloudinary), so this is the earliest point any
// Supabase-side code can act on the actual size Cloudinary reported. If
// bytes exceeds MAX_BYTES, the asset is destroyed on Cloudinary via the
// Admin API before the DB row is written — the file must not survive on
// Cloudinary AND be un-recorded in Supabase, or it becomes an orphaned,
// billable, unreferenced, undeletable-by-normal-means asset.
//
// NOTE: bytes is client-reported (Cloudinary's own upload response, relayed
// by the browser). This is a product-level backstop against accidental
// oversized uploads, not a hard security boundary — a deliberately malicious
// client could misreport bytes. It does not carry the same guarantee as
// upload-document's server-side magic-byte/size check on actual bytes.
//
// The caller's identity always comes from the verified JWT, never the body.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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

const CLOUDINARY_TYPES = [
  'talent_avatar', 'talent_cover', 'talent_portfolio',
  'client_avatar', 'venue_avatar',
]

// Single source of truth for the size cap on this path. Matches
// upload-document's MAX_BYTES by product decision (one number, all
// categories) — the two constants are independent because the two functions
// have no shared module, so if either changes, check the other.
const MAX_BYTES = 5 * 1024 * 1024 // 5 MiB

// talent_media.resource_type enum: image | video | raw | audio.
// chk_media_resource_type permits only image | video | raw — cloudinary-sign
// no longer returns 'auto' for anything, so in practice this always resolves
// to 'image' now. Kept general rather than hardcoded in case that changes.
function toResourceType(mime?: string, hint?: string): string {
  if (hint && ['image', 'video', 'raw'].includes(hint)) return hint
  if (mime?.startsWith('image/')) return 'image'
  if (mime?.startsWith('video/')) return 'video'
  return 'raw'
}

// Deletes an asset that already landed on Cloudinary but must not be kept.
// Mirrors cloudinary-delete's proven pattern exactly:
//   - Admin API DELETE /resources/image/upload, not POST /image/destroy —
//     destroy returns {"result":"not found"} for assets that demonstrably
//     exist when the account is in dynamic folder mode.
//   - resource_type is hardcoded to 'image', matching cloudinary-sign, which
//     never issues anything else today.
//   - The per-asset outcome in the response body is checked explicitly.
//     res.ok alone is not enough — Cloudinary can return 200 with a false
//     'not_found' for an asset that is still live, and treating that as
//     success would silently leave the oversized asset in place.
async function destroyCloudinaryAsset(publicId: string): Promise<boolean> {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const apiKey    = Deno.env.get('CLOUDINARY_API_KEY')
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('process-upload: missing Cloudinary env vars, cannot clean up', publicId)
    return false
  }

  const authBasic = btoa(`${apiKey}:${apiSecret}`)
  const url = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`)
  url.searchParams.append('public_ids[]', publicId)

  try {
    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { Authorization: `Basic ${authBasic}` },
    })

    if (!res.ok) {
      console.error('process-upload: Cloudinary cleanup DELETE HTTP error', res.status, publicId)
      return false
    }

    const data = await res.json()
    const outcome = data?.deleted?.[publicId] ?? 'unknown'

    if (outcome !== 'deleted') {
      console.error('process-upload: Cloudinary cleanup did not confirm deletion', outcome, publicId)
      return false
    }
    return true
  } catch (err) {
    console.error('process-upload: Cloudinary cleanup DELETE threw', String(err), publicId)
    return false
  }
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
    // ── Authenticate ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json()
    const {
      asset_type,
      public_id,
      secure_url,
      content_type,
      resource_type,
      media_type,   // talent_portfolio only
      bytes,
      format,
      title,
      sort_order,   // talent_portfolio only
    } = body

    if (!asset_type)  return json({ error: 'asset_type is required' }, 400)
    if (!public_id)   return json({ error: 'public_id is required' }, 400)
    if (!secure_url)  return json({ error: 'secure_url is required' }, 400)

    if (!CLOUDINARY_TYPES.includes(asset_type)) {
      return json({
        error: `Unknown or unsupported asset_type: ${asset_type}. ` +
               `KYC and venue documents go through upload-document.`,
      }, 400)
    }

    // ── Size enforcement ──────────────────────────────────────────────
    // The file already landed on Cloudinary by the time this runs (direct
    // browser upload). A client-side check in uploadToCloudinary.ts stops
    // this in the common case, but that check is bypassable — this is the
    // real, server-side backstop. If oversized, destroy the Cloudinary
    // asset and reject before any DB row is written, so nothing durable
    // (billable Cloudinary asset, or an orphaned/undersized-checked DB row)
    // survives a rejected upload.
    const resolvedResourceType = toResourceType(content_type, resource_type)

    if (typeof bytes === 'number' && bytes > MAX_BYTES) {
      const cleaned = await destroyCloudinaryAsset(public_id)
      console.error(
        'process-upload: rejected oversized upload',
        { asset_type, public_id, bytes, max_bytes: MAX_BYTES, cloudinary_cleanup: cleaned },
      )
      return json({
        error: `File exceeds the ${Math.round(MAX_BYTES / 1048576)}MB limit`,
        max_bytes: MAX_BYTES,
        received_bytes: bytes,
      }, 413)
    }

    // Resolve auth uid → profile row. Never trust a client-sent profile id.
    async function resolveProfile(table: string) {
      const { data } = await admin
        .from(table).select('id').eq('user_id', user.id).maybeSingle()
      return data?.id ?? null
    }

    // Talent avatar / cover
    if (asset_type === 'talent_avatar' || asset_type === 'talent_cover') {
      const talentId = await resolveProfile('profiles_talent')
      if (!talentId) return json({ error: 'No talent profile for this user' }, 400)

      const patch = asset_type === 'talent_avatar'
        ? { profile_photo_url: secure_url, profile_photo_public_id: public_id }
        : { cover_photo_url:   secure_url, cover_photo_public_id:   public_id }

      const { error } = await admin
        .from('profiles_talent')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', talentId)

      if (error) {
        console.error('profiles_talent update failed:', error.code)
        return json({ error: 'Failed to save metadata' }, 500)
      }
      return json({ success: true, asset_type, storage: 'cloudinary' })
    }

    // Talent portfolio (feature photos + gallery)
    if (asset_type === 'talent_portfolio') {
      const talentId = await resolveProfile('profiles_talent')
      if (!talentId) return json({ error: 'No talent profile for this user' }, 400)

      const { error } = await admin
        .from('talent_media')
        .insert({
          talent_id:             talentId,
          cloudinary_public_id:  public_id,
          cloudinary_secure_url: secure_url,
          resource_type:         resolvedResourceType,
          media_type:            media_type ?? 'gallery',
          format:                format ?? null,
          folder:                'en410/portfolio',
          bytes:                 bytes ?? null,
          title:                 title ?? null,
          sort_order:            sort_order ?? 0,
        })

      if (error) {
        console.error('talent_media insert failed:', error.code)
        return json({ error: 'Failed to save metadata' }, 500)
      }
      return json({ success: true, asset_type, storage: 'cloudinary' })
    }

    // Client / venue avatar
    if (asset_type === 'client_avatar' || asset_type === 'venue_avatar') {
      const table = asset_type === 'client_avatar' ? 'profiles_clients' : 'profiles_venues'

      const profileId = await resolveProfile(table)
      if (!profileId) return json({ error: `No ${table} profile for this user` }, 400)

      const { error } = await admin
        .from(table)
        .update({ avatar_url: secure_url, avatar_public_id: public_id })
        .eq('id', profileId)

      if (error) {
        console.error(`${table} update failed:`, error.code)
        return json({ error: 'Failed to save metadata' }, 500)
      }
      return json({ success: true, asset_type, storage: 'cloudinary' })
    }

    return json({ error: 'Unhandled asset_type' }, 400)

  } catch (err) {
    console.error('process-upload error:', String(err))
    return json({ error: 'Internal server error' }, 500)
  }
})
