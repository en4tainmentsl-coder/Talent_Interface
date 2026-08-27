// ═══════════════════════════════════════════════════════════════════════════
// cloudinary-delete  —  En4tainment
// Deletes a PUBLIC asset from Cloudinary and clears its DB reference.
//
// Sensitive assets (kyc_front, kyc_back, venue_document) live in private R2
// and are deleted via r2-delete. They are rejected here.
//
// AUTHORISATION MODEL
//   The DB write is scoped by owner AND public_id, and must affect exactly one
//   row before anything is destroyed at Cloudinary. Previously the non-admin
//   path cleared the caller's own row by id while destroying the caller-supplied
//   public_id — so any authenticated user could delete another user's asset.
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

const MIGRATED_TO_R2 = ['kyc_front', 'kyc_back', 'venue_document']
const PUBLIC_TYPES = [
  'talent_avatar', 'talent_cover', 'talent_portfolio',
  'client_avatar', 'venue_avatar',
]

Deno.serve(async (req: Request) => {
  const corsHeaders = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
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
      return json({ error: `'${asset_type}' is stored in R2. Use r2-delete.` }, 400)
    }
    if (!PUBLIC_TYPES.includes(asset_type)) {
      return json({ error: `Unknown asset_type: ${asset_type}` }, 400)
    }

    // profiles_users.id is the auth uid. maybeSingle() so a missing profile row
    // is a clean 'not an admin' rather than a swallowed error.
    const { data: roleRow } = await admin
      .from('profiles_users').select('role').eq('id', user.id).maybeSingle()
    const isAdmin = (roleRow?.role ?? '').toLowerCase() === 'admin'

    async function ownProfileId(table: string): Promise<string | null> {
      const { data } = await admin
        .from(table).select('id').eq('user_id', user.id).maybeSingle()
      return data?.id ?? null
    }

    // ── Authorise + clear the DB reference FIRST ───────────────────────
    // Order matters: if the DB write fails we still have the Cloudinary asset,
    // which is recoverable. The reverse leaves a dangling reference.
    // Every branch scopes by public_id and requires a matched row.
    let matched = 0

    if (asset_type === 'talent_avatar' || asset_type === 'talent_cover') {
      const idCol   = asset_type === 'talent_avatar' ? 'profile_photo_public_id' : 'cover_photo_public_id'
      const urlCol  = asset_type === 'talent_avatar' ? 'profile_photo_url'       : 'cover_photo_url'
      const patch   = { [idCol]: null, [urlCol]: null, updated_at: new Date().toISOString() }

      let q = admin.from('profiles_talent').update(patch).eq(idCol, public_id)

      if (!isAdmin) {
        const talentId = await ownProfileId('profiles_talent')
        if (!talentId) return json({ error: 'Forbidden' }, 403)
        q = q.eq('id', talentId)
      }

      const { data, error } = await q.select('id')
      if (error) {
        console.error('profiles_talent update failed:', error.code)
        return json({ error: 'Failed to clear asset reference' }, 500)
      }
      matched = data?.length ?? 0
    }

    else if (asset_type === 'talent_portfolio') {
      let sel = admin.from('talent_media').select('id, resource_type')
        .eq('cloudinary_public_id', public_id)

      if (!isAdmin) {
        const talentId = await ownProfileId('profiles_talent')
        if (!talentId) return json({ error: 'Forbidden' }, 403)
        sel = sel.eq('talent_id', talentId)
      }

      const { data: rows, error: selError } = await sel
      if (selError) {
        console.error('talent_media select failed:', selError.code)
        return json({ error: 'Failed to clear asset reference' }, 500)
      }

      if (rows && rows.length > 0) {
        // cloudinary_public_id is NOT NULL — delete the row, don't null it.
        const { error: delError } = await admin
          .from('talent_media').delete().in('id', rows.map((r) => r.id))
        if (delError) {
          console.error('talent_media delete failed:', delError.code)
          return json({ error: 'Failed to clear asset reference' }, 500)
        }
      }
      matched = rows?.length ?? 0
    }

    else {
      const table = asset_type === 'client_avatar' ? 'profiles_clients' : 'profiles_venues'
      let q = admin.from(table)
        .update({ avatar_url: null, avatar_public_id: null })
        .eq('avatar_public_id', public_id)

      if (!isAdmin) {
        const profileId = await ownProfileId(table)
        if (!profileId) return json({ error: 'Forbidden' }, 403)
        q = q.eq('id', profileId)
      }

      const { data, error } = await q.select('id')
      if (error) {
        console.error(`${table} update failed:`, error.code)
        return json({ error: 'Failed to clear asset reference' }, 500)
      }
      matched = data?.length ?? 0
    }

    // No row matched — the asset is not the caller's, or does not exist.
    // Stop here. Destroying it would be the exact hole this guard closes.
    if (matched === 0) {
      return json({ error: 'Asset not found or not yours to delete' }, 403)
    }

    // ── Destroy at Cloudinary ────────────────────────────────────────
    // Admin API DELETE /resources/image/upload, not POST /image/destroy —
    // destroy returns {"result":"not found"} for assets that demonstrably
    // exist when the account is in dynamic folder mode.
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')!
    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY')!
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')!

    const authBasic = btoa(`${apiKey}:${apiSecret}`)
    const url = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`)
    url.searchParams.append('public_ids[]', public_id)

    const res  = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { Authorization: `Basic ${authBasic}` },
    })
    const data = await res.json()

    if (!res.ok) {
      console.error('Cloudinary delete HTTP error:', res.status)
      return json({ error: 'Cloudinary deletion failed', db_reference_cleared: true }, 502)
    }

    // { deleted: { "<public_id>": "deleted" | "not_found" } }
    const outcome = data?.deleted?.[public_id] ?? 'unknown'

    // 'not_found' is NOT success. Reporting it as such would mark a PDPA
    // erasure complete while the file is still live.
    if (outcome !== 'deleted') {
      console.error('Cloudinary did not delete asset. Outcome:', outcome)
      return json({
        error: 'Asset reference cleared, but the file was not confirmed deleted at Cloudinary',
        cloudinary_outcome: outcome,
        db_reference_cleared: true,
      }, 502)
    }

    return json({ success: true, cloudinary: outcome, rows_affected: matched })

  } catch (err) {
    console.error('cloudinary-delete error:', String(err))
    return json({ error: 'Internal server error' }, 500)
  }
})
