// ═══════════════════════════════════════════════════════════════════════════
// submit-nic  —  En4tainment
// Accepts a raw NIC number, hashes it server-side with an HMAC key held in
// Vault, and stores only the hash plus the last four digits.
//
// The raw number is never persisted and never logged. Hashing must happen
// here rather than in the browser: a client-computed hash proves nothing,
// since the client could send any value it likes.
//
// Duplicate NICs are rejected — one identity card, one talent account.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGINS = [
  'https://www.en4tainment.com',
  'https://en4tainment.com',
  'https://app.en4tainment.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

// Origin allowlist rather than '*'. Every caller of this function sends a JWT
// in the Authorization header and a hostile origin cannot read a Supabase
// session out of localStorage, so the wildcard was not an open door -- but it
// is defence in depth, and the three Cloudinary functions already do this.
// Kept byte-identical to the implementation in cloudinary-sign.
//
// Falls back to the canonical origin rather than echoing an unknown one, so an
// unlisted origin gets a response the browser refuses instead of a permissive
// one. Vary: Origin stops a cache serving one origin's response to another.
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// Sri Lankan NIC: 9 digits + V/X (old), or 12 digits (new).
const NIC_OLD = /^[0-9]{9}[VXvx]$/
const NIC_NEW = /^[0-9]{12}$/

function normaliseNic(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, '').toUpperCase()
  if (NIC_OLD.test(s) || NIC_NEW.test(s)) return s
  return null
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req: Request) => {
  const corsHeaders = cors(req);
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

    // ── Validate ───────────────────────────────────────────────────────────
    const { nic_number } = await req.json()

    if (!nic_number || typeof nic_number !== 'string') {
      return json({ error: 'nic_number is required' }, 400)
    }

    const nic = normaliseNic(nic_number)
    if (!nic) {
      return json({
        error: 'Invalid NIC format. Expected 12 digits, or 9 digits followed by V or X.',
      }, 400)
    }

    // ── Resolve the caller's talent profile ────────────────────────────────
    const { data: talentRow } = await admin
      .from('profiles_talent')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!talentRow) return json({ error: 'No talent profile for this user' }, 400)

    // ── Hash ───────────────────────────────────────────────────────────────
    const { data: key, error: keyError } = await admin.rpc('get_nic_hmac_key')
    if (keyError || !key) {
      console.error('vault key lookup failed:', keyError)
      return json({ error: 'Server misconfiguration' }, 500)
    }

    const nicHash = await hmacHex(key, nic)

    // Old-format NICs end in a letter, so the last four digits sit one back.
    const lastFour = NIC_OLD.test(nic) ? nic.slice(-5, -1) : nic.slice(-4)

    // ── Duplicate check ────────────────────────────────────────────────────
    const { data: existing } = await admin
      .from('talent_identity')
      .select('talent_id')
      .eq('nic_hash', nicHash)
      .maybeSingle()

    if (existing && existing.talent_id !== talentRow.id) {
      // Deliberately vague: confirming which account holds it would leak
      // that a specific NIC is registered.
      return json({
        error: 'This identity document is already associated with another account. Please contact support.',
      }, 409)
    }

    // ── Persist ────────────────────────────────────────────────────────────
    const { error: upsertError } = await admin
      .from('talent_identity')
      .upsert({
        talent_id:     talentRow.id,
        nic_hash:      nicHash,
        nic_last_four: lastFour,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'talent_id' })

    if (upsertError) {
      console.error('talent_identity upsert failed:', upsertError.code)
      if (upsertError.code === '23505') {
        return json({
          error: 'This identity document is already associated with another account. Please contact support.',
        }, 409)
      }
      return json({ error: 'Failed to save identity details' }, 500)
    }

    // ── Advance status if KYC is now complete ──────────────────────────────
    const { data: row } = await admin
      .from('talent_identity')
      .select('nic_hash, nic_last_four, nic_front_public_id, nic_back_public_id, kyc_status')
      .eq('talent_id', talentRow.id)
      .single()

    const complete = !!(
      row?.nic_hash &&
      row?.nic_last_four &&
      row?.nic_front_public_id &&
      row?.nic_back_public_id
    )

    if (complete && row?.kyc_status === 'pending') {
      await admin
        .from('talent_identity')
        .update({ kyc_status: 'submitted', updated_at: new Date().toISOString() })
        .eq('talent_id', talentRow.id)
    }

    return json({
      success:       true,
      nic_last_four: lastFour,
      kyc_status:    complete ? 'submitted' : 'pending',
    })

  } catch (err) {
    console.error('submit-nic error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
