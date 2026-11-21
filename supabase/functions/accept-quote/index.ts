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

    // ── Notification ────────────────────────────────────────────────────────
    // The booking is committed by this point. Everything below is best effort:
    // a failed lookup or a bounced email must never turn a successful
    // acceptance into an error for the client. Same rule as review-talent.
    //
    // Two recipients, because until 2026-11-21 there were none. The talent had
    // no way to learn they had been booked, and nobody at En4 learned that a
    // booking was waiting on a manual payment arrangement.
    //
    // Embeds are deliberately avoided here. PostgREST returns a one-to-one
    // embed as an object and a one-to-many as an array, and getting that wrong
    // fails silently - which is exactly how the client could not see a quote
    // for a week. Plain lookups cannot be ambiguous.
    try {
      const { data: booking } = await admin
        .from('bookings')
        .select('starts_at, talent_payout_amount, client_total_amount, talent_id, quote_id, client_user_id')
        .eq('id', bookingId)
        .single()

      if (booking) {
        const fmtMoney = (v: unknown) =>
          Number(v ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

        const eventWhen = new Date(booking.starts_at).toLocaleString('en-GB', {
          timeZone: 'Asia/Colombo',
          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        })

        const [talentRes, contactRes, clientRes, quoteRes] = await Promise.all([
          admin.from('profiles_talent').select('stage_name').eq('id', booking.talent_id).maybeSingle(),
          admin.from('talent_contact').select('email').eq('talent_id', booking.talent_id).maybeSingle(),
          admin.from('profiles_clients').select('full_name').eq('user_id', booking.client_user_id).maybeSingle(),
          admin.from('quotes').select('quote_request_id').eq('id', booking.quote_id).maybeSingle(),
        ])

        let eventWhere = 'See the booking in your dashboard'
        if (quoteRes.data?.quote_request_id) {
          const { data: request } = await admin
            .from('quote_requests')
            .select('location, event_address')
            .eq('id', quoteRes.data.quote_request_id)
            .maybeSingle()
          eventWhere = request?.event_address || request?.location || eventWhere
        }

        const stageName   = talentRes.data?.stage_name ?? 'your act'
        const talentEmail = contactRes.data?.email ?? null
        const payout      = fmtMoney(booking.talent_payout_amount)
        const clientTotal = fmtMoney(booking.client_total_amount)

        const notify = async (template: string, to: string | null, data: Record<string, unknown>) => {
          try {
            const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ template, to, data }),
            })
            if (!res.ok) console.error('send-email failed:', template, res.status, await res.text())
          } catch (e) {
            console.error('send-email threw:', template, e)
          }
        }

        if (talentEmail) {
          await notify('booking_created_talent', talentEmail, {
            stage_name:  stageName,
            event_when:  eventWhen,
            event_where: eventWhere,
            payout,
          })
        } else {
          console.error('accept-quote: no contact email for talent', booking.talent_id, '- not notified')
        }

        await notify('booking_created_admin', null, {
          booking_id:   bookingId,
          talent:       stageName,
          client:       clientRes.data?.full_name ?? 'Unknown client',
          event_when:   eventWhen,
          event_where:  eventWhere,
          client_total: clientTotal,
          payout,
        })
      } else {
        console.error('accept-quote: could not read booking', bookingId, '- nobody notified')
      }
    } catch (e) {
      console.error('accept-quote: notification step threw —', e)
    }

    return json({ success: true, booking_id: bookingId })

  } catch (err) {
    console.error('accept-quote error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
