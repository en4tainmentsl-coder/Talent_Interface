// ═══════════════════════════════════════════════════════════════════════════
// decline-quote  —  En4tainment
// Declines a received quote and closes the parent request.
//
// Thin, for the same reason accept-quote is thin: decline_quote sets the quote
// to 'rejected' and the request to 'cancelled' in one transaction, and the
// ORDER of those two writes matters (cascade_quote_request_close would rewrite
// a still-'pending' quote to 'expired'). Splitting them into two PostgREST
// calls from here would reintroduce exactly the bug the RPC exists to avoid.
//
// Authorisation is enforced twice: a valid JWT here, and the RPC independently
// checks the caller is the client who raised the request. The RPC is
// service_role only and REVOKEd from anon and authenticated.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGINS = [
  'https://www.en4tainment.com',
  'https://en4tainment.com',
  'https://app.en4tainment.com',
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

// Must match public.quote_rejection_reason exactly. Adding a label to the
// enum without adding it here rejects it at the door with a 400.
const REASONS = [
  'price_too_high',
  'booked_alternative_talent',
  'terms_not_suitable',
  'event_cancelled',
  'event_postponed',
  'client_other',
] as const

// Mirrors chk_quote_rejected_note_length.
const NOTE_MAX = 200

Deno.serve(async (req: Request) => {
  const corsHeaders = cors(req);
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

    const { quote_id, reason, note } = await req.json()

    if (!quote_id || typeof quote_id !== 'string' || !UUID_RE.test(quote_id)) {
      return json({ error: 'A valid quote_id is required' }, 400)
    }

    if (typeof reason !== 'string' || !REASONS.includes(reason as typeof REASONS[number])) {
      return json({ error: 'A valid reason is required' }, 400)
    }

    if (note != null && typeof note !== 'string') {
      return json({ error: 'note must be a string' }, 400)
    }

    const trimmedNote = typeof note === 'string' ? note.trim() : ''

    if (trimmedNote.length > NOTE_MAX) {
      return json({ error: `note is too long (${NOTE_MAX} characters maximum)` }, 400)
    }

    // chk_quote_rejected_note_required enforces this too. Checked here so the
    // user gets a usable message instead of a mapped constraint violation.
    if (reason === 'client_other' && trimmedNote.length === 0) {
      return json({ error: 'Please tell the artist why, so this is useful to them.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: rpcError } = await admin.rpc('decline_quote', {
      p_quote_id:       quote_id,
      p_client_user_id: user.id,
      p_reason:         reason,
      p_note:           trimmedNote.length > 0 ? trimmedNote : null,
    })

    if (rpcError) {
      // The RPC's 42501 messages are written to be shown to the client, so
      // they pass through rather than being replaced with something vaguer.
      console.error('decline_quote failed:', rpcError.code, rpcError.message)

      switch (rpcError.code) {
        case '23503':
          return json({ error: 'That quote could not be found.' }, 404)
        case '42501':
          return json({ error: rpcError.message }, 403)
        case '23502':
          return json({ error: 'A decline reason is required.' }, 400)
        case '23514':
          return json({ error: 'That decline could not be recorded as given.' }, 400)
        default:
          return json({ error: 'Could not decline the quote. Please try again.' }, 500)
      }
    }

    // decline_quote RETURNS void, so a successful call yields data: null.
    // Do not add a truthiness guard on the result here.

    // STEP 3 goes here: notify the talent via send-email. It must not be
    // awaited into the failure path -- the decline is already committed, and a
    // bounced email must not make the client think the decline failed.

    return json({ success: true })

  } catch (err) {
    console.error('decline-quote error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})