// ═══════════════════════════════════════════════════════════════════════════
// process-upload  —  En4tainment
// Persists upload metadata after a direct-to-storage upload.
//
//   • Cloudinary    — public assets (avatars, covers, portfolio)
//   • Cloudflare R2 — sensitive assets (KYC, venue documents)
//
// The caller's identity always comes from the verified JWT, never the body.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CLOUDINARY_TYPES = [
  'talent_avatar', 'talent_cover', 'talent_portfolio',
  'client_avatar', 'venue_avatar',
]
const R2_TYPES = ['kyc_front', 'kyc_back', 'venue_document']

// talent_media.resource_type enum: image | video | raw | audio
function toResourceType(mime?: string, hint?: string): string {
  if (hint && ['image', 'video', 'raw', 'audio'].includes(hint)) return hint
  if (mime?.startsWith('image/')) return 'image'
  if (mime?.startsWith('video/')) return 'video'
  if (mime?.startsWith('audio/')) return 'audio'
  return 'raw'
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
      public_id,          // Cloudinary public_id  OR  R2 object key
      secure_url,         // Cloudinary only
      storage_bucket,     // R2 only
      content_type,       // mime, used to derive resource_type
      resource_type,      // optional explicit override
      media_type,         // optional, talent_portfolio only
      bytes,
      format,
      title,
      sort_order,
      file_name,          // venue_document only
      related_entity_id,  // venue_document only
    } = body

    if (!asset_type) return json({ error: 'asset_type is required' }, 400)
    if (!public_id)  return json({ error: 'public_id is required' }, 400)

    const isR2 = R2_TYPES.includes(asset_type)
    if (!isR2 && !CLOUDINARY_TYPES.includes(asset_type)) {
      return json({ error: `Unknown asset_type: ${asset_type}` }, 400)
    }
    if (isR2 && !storage_bucket) {
      return json({ error: 'storage_bucket is required for this asset type' }, 400)
    }

    // Resolve auth uid → profile row. Never trust a client-sent profile id.
    async function resolveProfile(table: string) {
      const { data } = await admin
        .from(table).select('id').eq('user_id', user.id).maybeSingle()
      return data?.id ?? null
    }

    // ═══ SENSITIVE — KYC (R2) ════════════════════════════════════════════
    if (asset_type === 'kyc_front' || asset_type === 'kyc_back') {
      const talentId = await resolveProfile('profiles_talent')
      if (!talentId) return json({ error: 'No talent profile for this user' }, 400)

      const col = asset_type === 'kyc_front'
        ? 'nic_front_public_id'
        : 'nic_back_public_id'

      // Store the image reference only. Status stays 'pending' here —
      // advancing it now would violate the completeness constraint, since
      // the other image and the NIC hash may not be present yet.
      const { error: upsertError } = await admin
        .from('talent_identity')
        .upsert({
          talent_id:          talentId,
          [col]:              public_id,
          nic_storage_bucket: storage_bucket,
          updated_at:         new Date().toISOString(),
        }, { onConflict: 'talent_id' })

      if (upsertError) {
        console.error('talent_identity upsert failed:', upsertError.code)
        return json({ error: 'Failed to save KYC metadata' }, 500)
      }

      // Advance to 'submitted' only once all four pieces are in place.
      const { data: row } = await admin
        .from('talent_identity')
        .select('nic_hash, nic_last_four, nic_front_public_id, nic_back_public_id, kyc_status')
        .eq('talent_id', talentId)
        .single()

      const complete = !!(
        row?.nic_hash &&
        row?.nic_last_four &&
        row?.nic_front_public_id &&
        row?.nic_back_public_id
      )

      // The 'pending' guard stops a verified talent being knocked back to
      // 'submitted' by re-uploading an image.
      if (complete && row?.kyc_status === 'pending') {
        const { error: statusError } = await admin
          .from('talent_identity')
          .update({ kyc_status: 'submitted', updated_at: new Date().toISOString() })
          .eq('talent_id', talentId)

        if (statusError) {
          // Non-fatal: the upload saved. Status can be re-evaluated later.
          console.error('kyc_status advance failed:', statusError.code)
        }
      }

      return json({
        success:    true,
        asset_type,
        storage:    'r2',
        kyc_status: complete ? 'submitted' : 'pending',
      })
    }

    // ═══ SENSITIVE — venue documents (R2) ════════════════════════════════
    if (asset_type === 'venue_document') {
      if (!file_name)         return json({ error: 'file_name is required' }, 400)
      if (!related_entity_id) return json({ error: 'related_entity_id is required' }, 400)

      const { data: venueRow } = await admin
        .from('profiles_venues')
        .select('id')
        .eq('id', related_entity_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!venueRow) return json({ error: 'Not authorised for this venue' }, 403)

      const { error } = await admin
        .from('documents')
        .insert({
          related_entity_type: 'venue',
          related_entity_id,
          file_name,
          storage_bucket,
          file_path:           public_id,
          uploaded_by_user_id: user.id,
        })

      if (error) {
        console.error('documents insert failed:', error.code)
        return json({ error: 'Failed to save document metadata' }, 500)
      }
      return json({ success: true, asset_type, storage: 'r2' })
    }

    // ═══ PUBLIC — Cloudinary ═════════════════════════════════════════════
    if (!secure_url) return json({ error: 'secure_url is required' }, 400)

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

    // Talent portfolio
    if (asset_type === 'talent_portfolio') {
      const talentId = await resolveProfile('profiles_talent')
      if (!talentId) return json({ error: 'No talent profile for this user' }, 400)

      const { error } = await admin
        .from('talent_media')
        .insert({
          talent_id:             talentId,
          cloudinary_public_id:  public_id,
          cloudinary_secure_url: secure_url,
          resource_type:         toResourceType(content_type, resource_type),
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
    console.error('process-upload error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
