// ═══════════════════════════════════════════════════════════════════════════
// accept-quote  —  En4tainment
// Accepts a quote and creates the booking.
//
// This function is deliberately thin. All three writes (quote -> accepted,
// booking INSERT, request -> converted) happen inside the Postgres function
// accept_quote_and_create_booking, so they share one transaction. Doing them
// here as separate PostgREST calls would leave an accepted quote with no
// booking if any step failed, and the quote could not then be re-accepted.
//
// Authorisation is enforced twice: the caller must present a valid JWT, and
// the RPC independently checks that the caller is the client who raised the
// request. The RPC is service_role only and REVOKEd from authenticated, so
// it cannot be reached directly from the browser.
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

    const { quote_id, message_to_talent } = await req.json()

    if (!quote_id || typeof quote_id !== 'string' || !UUID_RE.test(quote_id)) {
      return json({ error: 'A valid quote_id is required' }, 400)
    }

    if (message_to_talent != null && typeof message_to_talent !== 'string') {
      return json({ error: 'message_to_talent must be a string' }, 400)
    }

    if (typeof message_to_talent === 'string' && message_to_talent.length > 2000) {
      return json({ error: 'message_to_talent is too long (2000 characters maximum)' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: bookingId, error: rpcError } = await admin.rpc(
      'accept_quote_and_create_booking',
      {
        p_quote_id:       quote_id,
        p_client_user_id: user.id,
        p_message:        message_to_talent ?? null,
      },
    )

    if (rpcError) {
      // The RPC raises with deliberate error codes. Its messages are written
      // to be shown to the client, so they are passed through rather than
      // replaced with something vaguer.
      console.error('accept_quote_and_create_booking failed:', rpcError.code, rpcError.message)

      switch (rpcError.code) {
        case '23503':
          return json({ error: 'That quote could not be found.' }, 404)
        case '42501':
          return json({ error: rpcError.message }, 403)
        case '22004':
          return json({
            error: 'This quote has not been priced and cannot be accepted. Please contact support.',
          }, 409)
        case '23505':
          return json({ error: 'A booking already exists for this quote.' }, 409)
        default:
          return json({ error: 'Could not accept the quote. Please try again.' }, 500)
      }
    }

    if (!bookingId) {
      console.error('accept_quote_and_create_booking returned no booking id')
      return json({ error: 'Could not accept the quote. Please try again.' }, 500)
    }

    return json({ success: true, booking_id: bookingId })

  } catch (err) {
    console.error('accept-quote error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
