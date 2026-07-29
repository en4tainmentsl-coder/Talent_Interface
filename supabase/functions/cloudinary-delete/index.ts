// ═══════════════════════════════════════════════════════════════════════════
// cloudinary-delete  —  En4tainment
// Deletes a PUBLIC asset from Cloudinary and clears its DB reference.
//
// Sensitive assets (kyc_front, kyc_back, venue_document) live in private R2
// and are deleted via r2-delete. They are rejected here.
//
// Identity comes from the verified JWT. Users may delete their own assets;
// admins may delete any.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MIGRATED_TO_R2 = ['kyc_front', 'kyc_back', 'venue_document']

const RESOURCE_TYPE_MAP: Record<string, string> = {
  talent_avatar:    'image',
  talent_cover:     'image',
  talent_portfolio: 'auto',
  client_avatar:    'image',
  venue_avatar:     'image',
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

    const { asset_type, public_id } = await req.json()

    if (!asset_type || !public_id) {
      return json({ error: 'asset_type and public_id are required' }, 400)
    }

    if (MIGRATED_TO_R2.includes(asset_type)) {
      return json({
        error: `'${asset_type}' is stored in R2. Use r2-delete.`,
      }, 400)
    }

    const resourceType = RESOURCE_TYPE_MAP[asset_type]
    if (!resourceType) return json({ error: `Unknown asset_type: ${asset_type}` }, 400)

    const { data: roleRow } = await admin
      .from('profiles_users').select('role').eq('id', user.id).single()
    const isAdmin = (roleRow?.role ?? '').toLowerCase() === 'admin'

    async function ownProfileId(table: string): Promise<string | null> {
      const { data } = await admin
        .from(table).select('id').eq('user_id', user.id).maybeSingle()
      return data?.id ?? null
    }

    // ── Authorise + clear the DB reference FIRST ──────────────────────────
    // Order matters: if the DB write fails we still have the Cloudinary asset,
    // which is recoverable. The reverse leaves a dangling reference.
    let dbError: unknown = null

    if (asset_type === 'talent_avatar' || asset_type === 'talent_cover') {
      const talentId = await ownProfileId('profiles_talent')
      if (!talentId && !isAdmin) return json({ error: 'Forbidden' }, 403)

      const patch = asset_type === 'talent_avatar'
        ? { profile_photo_url: null, profile_photo_public_id: null }
        : { cover_photo_url: null, cover_photo_public_id: null }

      const q = admin.from('profiles_talent').update(patch)
      ;({ error: dbError } = isAdmin
        ? await q.eq(asset_type === 'talent_avatar'
            ? 'profile_photo_public_id' : 'cover_photo_public_id', public_id)
        : await q.eq('id', talentId!))
    }

    else if (asset_type === 'talent_portfolio') {
      const talentId = await ownProfileId('profiles_talent')
      if (!talentId && !isAdmin) return json({ error: 'Forbidden' }, 403)

      // cloudinary_public_id is NOT NULL — delete the row, don't null it.
      const q = admin.from('talent_media').delete().eq('cloudinary_public_id', public_id)
      ;({ error: dbError } = isAdmin ? await q : await q.eq('talent_id', talentId!))
    }

    else if (asset_type === 'client_avatar' || asset_type === 'venue_avatar') {
      const table = asset_type === 'client_avatar' ? 'profiles_clients' : 'profiles_venues'
      const profileId = await ownProfileId(table)
      if (!profileId && !isAdmin) return json({ error: 'Forbidden' }, 403)

      const q = admin.from(table).update({ avatar_url: null, avatar_public_id: null })
      ;({ error: dbError } = isAdmin
        ? await q.eq('avatar_public_id', public_id)
        : await q.eq('id', profileId!))
    }

    if (dbError) {
      console.error('cloudinary-delete DB error:', dbError)
      return json({ error: 'Failed to clear asset reference' }, 500)
    }

    // ── Destroy at Cloudinary ─────────────────────────────────────────────
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')!
    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY')!
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')!

    const timestamp = Math.floor(Date.now() / 1000)
    const signatureString = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`
    const hashBuffer = await crypto.subtle.digest(
      'SHA-1', new TextEncoder().encode(signatureString),
    )
    const signature = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0')).join('')

    const formData = new FormData()
    formData.append('public_id', public_id)
    formData.append('api_key',   apiKey)
    formData.append('timestamp', String(timestamp))
    formData.append('signature', signature)

    const res  = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      { method: 'POST', body: formData },
    )
    const data = await res.json()

    if (data.result !== 'ok' && data.result !== 'not found') {
      console.error('Cloudinary destroy failed:', data)
      return json({ error: 'Cloudinary deletion failed' }, 502)
    }

    return json({ success: true, cloudinary: data.result })

  } catch (err) {
    console.error('cloudinary-delete error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})