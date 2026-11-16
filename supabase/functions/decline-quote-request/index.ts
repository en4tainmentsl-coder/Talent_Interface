// ═══════════════════════════════════════════════════════════════════════════
// decline-quote-request  —  En4tainment
// A talent declines a quote request addressed to them, with a reason.
//
// The mirror of decline-quote, in the other direction: there a client turns
// down a quote; here a talent turns down the request before quoting at all.
// Without it the only way to say no was to let the request run out its
// 48 hours, with the client waiting on an answer that was never coming.
//
// Deliberately thin. The Postgres function decline_quote_request does the
// work under a row lock: it checks the caller owns the talent the request was
// sent to and that the request is still open, then sets the status, the
// reason and the note in one statement.
//
// Declining CLOSES the request. A request names one talent and that cannot
// be changed, so there is nobody else it could pass to.
//
// Not to be confused with decline-quote. Slugs are close; the actors are not.
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

// Must match public.quote_decline_reason, and the copy of this list in
// src/components/QuoteRequests.tsx.
const REASONS = ['schedule_conflict', 'outside_service_area', 'event_type_mismatch', 'other'] as const
const NOTE_MAX = 200

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

    const { quote_request_id, reason, note } = body as Record<string, unknown>

    if (typeof quote_request_id !== 'string' || !UUID_RE.test(quote_request_id)) {
      return json({ error: 'A valid quote_request_id is required' }, 400)
    }

    if (typeof reason !== 'string' || !REASONS.includes(reason as typeof REASONS[number])) {
      return json({ error: 'A valid reason is required' }, 400)
    }

    if (note != null && typeof note !== 'string') {
      return json({ error: 'note must be a string' }, 400)
    }

    const trimmedNote = typeof note === 'string' ? note.trim() : ''

    if (trimmedNote.length > NOTE_MAX) {
      return json({ error: `Your note is too long (${NOTE_MAX} characters maximum).` }, 400)
    }

    // chk_qreq_decline_note_required enforces this too. Checked here so the
    // talent gets a usable message instead of a mapped constraint violation.
    if (reason === 'other' && trimmedNote.length === 0) {
      return json({ error: 'Please say why, so the client knows what to do next.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: rpcError } = await admin.rpc('decline_quote_request', {
      p_quote_request_id: quote_request_id,
      p_talent_user_id:   user.id,
      p_reason:           reason,
      p_note:             trimmedNote.length > 0 ? trimmedNote : null,
    })

    if (rpcError) {
      // The RPC's 42501 and 23514 messages are written to be shown to the
      // talent, so they pass through.
      console.error('decline_quote_request failed:', rpcError.code, rpcError.message)

      switch (rpcError.code) {
        case '23503':
          return json({ error: 'That request could not be found.' }, 404)
        case '42501':
          return json({ error: rpcError.message }, 403)
        case '23502':
          return json({ error: 'A reason is required.' }, 400)
        case '23514':
          // A message we raised ourselves is passed through. A raw CHECK
          // constraint violation shares this code and names tables and
          // columns; that is never shown.
          return json({
            error: /^new row for relation/i.test(rpcError.message)
              ? 'That decline could not be recorded as given.'
              : rpcError.message,
          }, 400)
        default:
          return json({ error: 'Could not decline the request. Please try again.' }, 500)
      }
    }

    // decline_quote_request RETURNS void, so a successful call yields
    // data: null. Do not add a truthiness guard on the result here.

    // No email to the client here, by decision (2026-11-16): client-facing
    // notifications for the quote flow land together with the client-KYC
    // visibility gate. The client sees the declined status, the reason and
    // the note on their dashboard.

    return json({ success: true })

  } catch (err) {
    console.error('decline-quote-request error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
