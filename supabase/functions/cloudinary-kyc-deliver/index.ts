// cloudinary-kyc-deliver
// Generates a short-lived signed delivery URL for KYC assets.
// These assets use access_mode=authenticated in Cloudinary, meaning
// secure_url alone is not accessible — a signed URL must be generated.
//
// This endpoint is ADMIN ONLY. The calling user's role is verified against
// profiles_users before a URL is issued.
//
// POST body:  { public_id: string }
// Returns:    { url: string, expires_at: number }

import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPIRY_SECONDS = 300 // signed URL valid for 5 minutes

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Verify the caller is an admin ─────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!

    // Use the caller's JWT to check their role
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await callerClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up role in profiles_users using service role (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile } = await adminClient
      .from('profiles_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Parse request body ────────────────────────────────────────────────
    const body = await req.json()
    const { public_id } = body

    if (!public_id) {
      return new Response(
        JSON.stringify({ error: 'public_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. Generate signed delivery URL ─────────────────────────────────────
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')!
    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY')!
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')!

    const expiresAt       = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS
    const signatureString = `expires_at=${expiresAt}&public_id=${public_id}${apiSecret}`
    const msgBuffer       = new TextEncoder().encode(signatureString)
    const hashBuffer      = await crypto.subtle.digest('SHA-1', msgBuffer)
    const hashArray       = Array.from(new Uint8Array(hashBuffer))
    const signature       = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    const signedUrl =
      `https://res.cloudinary.com/${cloudName}/image/authenticated` +
      `/s--${signature}--` +
      `/e_expires:${expiresAt}` +
      `/${public_id}`

    return new Response(
      JSON.stringify({ url: signedUrl, expires_at: expiresAt }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('cloudinary-kyc-deliver error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
