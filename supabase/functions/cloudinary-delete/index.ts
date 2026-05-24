// cloudinary-delete
// Deletes an asset from Cloudinary by public_id, then clears the reference
// in the corresponding Supabase table.
//
// POST body:
//   asset_type  : AssetType
//   public_id   : string
//   talent_id   : string?
//   client_id   : string?
//   venue_id    : string?
//   sort_order  : number?  (required for talent_portfolio to clear the right row)

import { corsHeaders } from '../_shared/cors.ts'
import { ASSET_CONFIG, AssetType } from '../_shared/assetConfig.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { asset_type, public_id, talent_id, client_id, venue_id, sort_order } = body

    if (!asset_type || !public_id) {
      return new Response(
        JSON.stringify({ error: 'asset_type and public_id are required' }),
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

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')!
    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY')!
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')!

    // ── 1. Build deletion signature ──────────────────────────────────────────
    const timestamp = Math.floor(Date.now() / 1000)
    const signatureString = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`
    const msgBuffer  = new TextEncoder().encode(signatureString)
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer)
    const hashArray  = Array.from(new Uint8Array(hashBuffer))
    const signature  = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // ── 2. Call Cloudinary destroy API ───────────────────────────────────────
    const resourceType = config.resource_type === 'auto' ? 'image' : config.resource_type
    const formData = new FormData()
    formData.append('public_id',  public_id)
    formData.append('api_key',    apiKey)
    formData.append('timestamp',  String(timestamp))
    formData.append('signature',  signature)

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      { method: 'POST', body: formData }
    )
    const cloudinaryData = await cloudinaryRes.json()

    if (cloudinaryData.result !== 'ok' && cloudinaryData.result !== 'not found') {
      console.error('Cloudinary delete failed:', cloudinaryData)
      return new Response(
        JSON.stringify({ error: 'Cloudinary deletion failed', detail: cloudinaryData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. Clear DB reference ────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let error: unknown = null

    if (asset_type === 'talent_avatar' && talent_id) {
      ;({ error } = await supabase
        .from('profiles_talent')
        .update({ avatar_url: null, avatar_public_id: null })
        .eq('id', talent_id))
    } else if (asset_type === 'talent_cover' && talent_id) {
      ;({ error } = await supabase
        .from('profiles_talent')
        .update({ cover_url: null, cover_public_id: null })
        .eq('id', talent_id))
    } else if (asset_type === 'talent_portfolio' && talent_id) {
      ;({ error } = await supabase
        .from('talent_media')
        .delete()
        .eq('talent_id', talent_id)
        .eq('public_id', public_id))
    } else if ((asset_type === 'kyc_front' || asset_type === 'kyc_back') && talent_id) {
      const column = asset_type === 'kyc_front'
        ? 'kyc_id_front_public_id'
        : 'kyc_id_back_public_id'
      ;({ error } = await supabase
        .from('talent_identity')
        .update({ [column]: null })
        .eq('talent_id', talent_id))
    } else if (asset_type === 'client_avatar' && client_id) {
      ;({ error } = await supabase
        .from('profiles_clients')
        .update({ avatar_url: null, avatar_public_id: null })
        .eq('id', client_id))
    } else if (asset_type === 'venue_avatar' && venue_id) {
      ;({ error } = await supabase
        .from('profiles_venues')
        .update({ avatar_url: null, avatar_public_id: null })
        .eq('id', venue_id))
    } else if (asset_type === 'venue_document' && venue_id) {
      ;({ error } = await supabase
        .from('documents')
        .delete()
        .eq('public_id', public_id))
    }

    if (error) {
      console.error('cloudinary-delete DB error:', error)
      return new Response(
        JSON.stringify({ error: 'DB cleanup failed', detail: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, cloudinary: cloudinaryData.result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('cloudinary-delete error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
