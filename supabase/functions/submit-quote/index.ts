// ═══════════════════════════════════════════════════════════════════════════
// submit-quote  —  En4tainment
// A talent sends a quote in answer to a quote request addressed to them.
//
// Deliberately thin, like accept-quote. Every rule lives in the Postgres
// function submit_quote, which checks them under a row lock on the request
// and inserts in the same transaction: the caller owns the talent the request
// was sent to, the talent is approved, the request is still open and inside
// its response window, and the required fields are present. The pricing is
// done by the triggers on quotes, exactly as for any insert.
//
// WHAT THIS FUNCTION DOES NOT ACCEPT
//   * A talent id. The talent is resolved in the database from the verified
//     user id; a client-supplied one would let anyone quote as anyone.
//   * A price. Settled 2026-10-25: the fee is the talent's stored rate for the
//     category, pinned on the request when it was raised. There is nothing to
//     negotiate here and so nothing to send.
//
// Authorisation is enforced twice: the caller must present a valid JWT, and
// the RPC independently checks ownership. The RPC is service_role only and
// REVOKEd from authenticated, so it cannot be reached from the browser.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGINS = [
  'https://www.en4tainment.com',
  'https://en4tainment.com',
  'https://app.en4tainment.com',
  'https://talent-interface.en4tainment-sl.workers.dev',
  'http://localhost:5173',
  'http://localhost:3000',
];

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOTES_MAX = 1000
// Matches the numeric(12,2) money columns on quotes.
const FEE_MAX = 9_999_999_999.99

// A fee must be a plain non-negative number with at most two decimals.
// Anything else is refused rather than rounded: a silently adjusted amount on
// a document the talent cannot edit afterwards is worse than an error.
function parseFee(v: unknown): number | null {
  if (v == null) return 0
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (v < 0 || v > FEE_MAX) return null
  if (Math.round(v * 100) !== v * 100) return null
  return v
}

Deno.serve(async (req: Request) => {
  const corsHeaders = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

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

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'A JSON body is required' }, 400)

    const {
      quote_request_id, performer_count, setup_arrival_at,
      notes_to_client, meals_fee, accommodation_fee,
    } = body as Record<string, unknown>

    if (typeof quote_request_id !== 'string' || !UUID_RE.test(quote_request_id)) {
      return json({ error: 'A valid quote_request_id is required' }, 400)
    }

    if (typeof performer_count !== 'number' || !Number.isInteger(performer_count) ||
        performer_count < 1 || performer_count > 50) {
      return json({ error: 'Say how many performers will be on stage, between 1 and 50.' }, 400)
    }

    if (typeof setup_arrival_at !== 'string' || Number.isNaN(Date.parse(setup_arrival_at))) {
      return json({ error: 'Say when you will arrive to set up.' }, 400)
    }

    if (notes_to_client != null && typeof notes_to_client !== 'string') {
      return json({ error: 'notes_to_client must be a string' }, 400)
    }

    const notes = typeof notes_to_client === 'string' ? notes_to_client.trim() : ''
    if (notes.length > NOTES_MAX) {
      return json({ error: `Your note to the client is too long (${NOTES_MAX} characters maximum).` }, 400)
    }

    const meals = parseFee(meals_fee)
    const accommodation = parseFee(accommodation_fee)
    if (meals === null || accommodation === null) {
      return json({ error: 'Meals and accommodation must be amounts in rupees, zero or more.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: quoteId, error: rpcError } = await admin.rpc('submit_quote', {
      p_quote_request_id:  quote_request_id,
      p_talent_user_id:    user.id,
      p_performer_count:   performer_count,
      p_setup_arrival_at:  new Date(setup_arrival_at).toISOString(),
      p_notes:             notes.length > 0 ? notes : null,
      p_meals_fee:         meals,
      p_accommodation_fee: accommodation,
    })

    if (rpcError) {
      // submit_quote and the pricing triggers raise with deliberate codes, and
      // their 42501 and 23514 messages are written to be shown to the talent,
      // so they pass through rather than being replaced with something vaguer.
      console.error('submit_quote failed:', rpcError.code, rpcError.message)

      switch (rpcError.code) {
        case '23503':
          return json({ error: 'That request could not be found.' }, 404)
        case '42501':
          return json({ error: rpcError.message }, 403)
        case '23514':
          // A message we raised ourselves is passed through. A raw CHECK
          // constraint violation shares this code and names tables and
          // columns; that is never shown.
          return json({
            error: /^new row for relation/i.test(rpcError.message)
              ? 'That quote could not be sent as given. Please check the details and try again.'
              : rpcError.message,
          }, 400)
        case '23505':
          return json({ error: 'You have already sent a quote for this request.' }, 409)
        case '22004':
          return json({
            error: 'This request cannot be priced right now. Please contact support.',
          }, 409)
        default:
          return json({ error: 'Could not send the quote. Please try again.' }, 500)
      }
    }

    if (!quoteId) {
      console.error('submit_quote returned no quote id')
      return json({ error: 'Could not send the quote. Please try again.' }, 500)
    }

    // No email to the client here, by decision (2026-11-16). A quote is to
    // stay hidden from the client until their KYC is verified, and that gate
    // is not built yet; the notification belongs with it.

    return json({ success: true, quote_id: quoteId })

  } catch (err) {
    console.error('submit-quote error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
