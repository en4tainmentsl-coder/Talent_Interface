// process-upload
// Called by the browser AFTER a successful direct upload to Cloudinary.
// Saves the returned metadata to the correct Supabase table using the
// service role key (bypasses RLS so it can write on behalf of any user).
//
// POST body:
//   asset_type    : AssetType
//   user_id       : string   (auth user UUID)
//   talent_id     : string?  (profiles_talent.id — required for talent assets)
//   client_id     : string?  (profiles_clients.id — required for client assets)
//   venue_id      : string?  (profiles_venues.id  — required for venue assets)
//   public_id     : string   (Cloudinary public_id)
//   secure_url    : string   (only for public assets; omit for KYC)
//   resource_type : string   ('image' | 'video' | 'raw')
//   bytes         : number
//   width         : number?
//   height        : number?
//   sort_order    : number?  (for portfolio items, 0-based)
//   side          : string?  ('front' | 'back' — for KYC only)

import { corsHeaders } from '../_shared/cors.ts'
import { ASSET_CONFIG, AssetType } from '../_shared/assetConfig.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      asset_type,
      user_id,
      talent_id,
      client_id,
      venue_id,
      public_id,
      secure_url,
      resource_type,
      bytes,
      width,
      height,
      sort_order = 0,
      side,
    } = body

    // ── Validate required fields ─────────────────────────────────────────────
    if (!asset_type || !user_id || !public_id || !resource_type) {
      return new Response(
        JSON.stringify({ error: 'asset_type, user_id, public_id and resource_type are required' }),
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

    // ── Build Supabase admin client (bypasses RLS) ───────────────────────────
    const supabaseUrl        = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase           = createClient(supabaseUrl, serviceRoleKey)

    // ── Route to correct table based on asset_type ───────────────────────────
    let error: unknown = null

    // ── Talent avatar (profiles_talent.avatar_url) ───────────────────────────
    if (asset_type === 'talent_avatar') {
      if (!talent_id) return missingField('talent_id', corsHeaders)
      ;({ error } = await supabase
        .from('profiles_talent')
        .update({ avatar_url: secure_url, avatar_public_id: public_id, updated_at: new Date().toISOString() })
        .eq('id', talent_id))
    }

    // ── Talent cover / profile banner (profiles_talent.cover_url) ────────────
    else if (asset_type === 'talent_cover') {
      if (!talent_id) return missingField('talent_id', corsHeaders)
      ;({ error } = await supabase
        .from('profiles_talent')
        .update({ cover_url: secure_url, cover_public_id: public_id, updated_at: new Date().toISOString() })
        .eq('id', talent_id))
    }

    // ── Talent portfolio (talent_media — upsert keyed on talent_id + sort_order) ──
    else if (asset_type === 'talent_portfolio') {
      if (!talent_id) return missingField('talent_id', corsHeaders)
      ;({ error } = await supabase
        .from('talent_media')
        .upsert(
          {
            talent_id,
            public_id,
            secure_url,
            resource_type,
            bytes:      bytes  ?? 0,
            width:      width  ?? null,
            height:     height ?? null,
            sort_order,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'talent_id,sort_order' }
        ))
    }

    // ── KYC front / back (talent_identity — store public_id only, NOT secure_url) ──
    else if (asset_type === 'kyc_front' || asset_type === 'kyc_back') {
      if (!talent_id) return missingField('talent_id', corsHeaders)
      const column = asset_type === 'kyc_front'
        ? 'kyc_id_front_public_id'
        : 'kyc_id_back_public_id'
      ;({ error } = await supabase
        .from('talent_identity')
        .upsert(
          {
            talent_id,
            [column]:   public_id,
            kyc_status: 'submitted',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'talent_id' }
        ))
    }

    // ── Client avatar (profiles_clients.avatar_url) ──────────────────────────
    else if (asset_type === 'client_avatar') {
      if (!client_id) return missingField('client_id', corsHeaders)
      ;({ error } = await supabase
        .from('profiles_clients')
        .update({ avatar_url: secure_url, avatar_public_id: public_id, updated_at: new Date().toISOString() })
        .eq('id', client_id))
    }

    // ── Venue avatar (profiles_venues.avatar_url) ─────────────────────────────
    else if (asset_type === 'venue_avatar') {
      if (!venue_id) return missingField('venue_id', corsHeaders)
      ;({ error } = await supabase
        .from('profiles_venues')
        .update({ avatar_url: secure_url, avatar_public_id: public_id, updated_at: new Date().toISOString() })
        .eq('id', venue_id))
    }

    // ── Venue document (documents table) ─────────────────────────────────────
    else if (asset_type === 'venue_document') {
      if (!venue_id) return missingField('venue_id', corsHeaders)
      ;({ error } = await supabase
        .from('documents')
        .insert({
          uploaded_by_user_id: user_id,
          venue_id,
          public_id,
          resource_type,
          bytes: bytes ?? 0,
          created_at: new Date().toISOString(),
        }))
    }

    if (error) {
      console.error('process-upload DB error:', error)
      return new Response(
        JSON.stringify({ error: 'Database write failed', detail: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('process-upload error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function missingField(field: string, headers: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: `${field} is required for this asset_type` }),
    { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
  )
}
