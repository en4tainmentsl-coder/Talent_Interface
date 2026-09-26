// ═══════════════════════════════════════════════════════════════════════════
// request-deletion  —  En4tainment
// The talent-facing "Delete my profile" action. Spec: Todoist 6hcPC3qXjH55JpQ5.
//
// This is the ONLY path to a deletion request. request_profile_deletion(uuid)
// is SECURITY DEFINER, REVOKEd from authenticated and granted to service_role
// only, so the browser cannot reach it directly and skip the notifications.
//
// The profile row is never deleted. The RPC sets deletion_requested_at and
// hides the profile; check_talent_deletion_gate refuses if bookings, quote
// requests or sent quotes are outstanding.
//
// The confirmation goes to the VERIFIED ACCOUNT ADDRESS (auth.users.email),
// not profiles_talent.email, which is user-editable and was found diverging
// from the sign-in address on a live row. It is a security notice.
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

    const url        = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(url, serviceKey)

    const { data, error: rpcError } = await admin
      .rpc('request_profile_deletion', { p_user_id: user.id })

    if (rpcError) {
      // The RPC and the gate trigger raise messages written to be read by the
      // person, so they are passed through rather than replaced.
      console.error('request_profile_deletion failed:', rpcError.code, rpcError.message)
      if (rpcError.code === '42501') return json({ error: rpcError.message }, 409)
      return json({ error: 'Could not process the request. Please try again.' }, 500)
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.talent_id) {
      console.error('request_profile_deletion returned no row')
      return json({ error: 'Could not process the request. Please try again.' }, 500)
    }

    if (row.contact_email && row.contact_email !== row.account_email) {
      console.log('deletion: contact address differs from account address for', row.talent_id)
    }

    // The request is already recorded and the profile already hidden. A failed
    // email must not fail the request, but it must not be silent either: the
    // response reports what was sent so the caller can surface it.
    const send = async (template: string, to: string | null, payload: Record<string, unknown>) => {
      try {
        const res = await fetch(`${url}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ template, to, data: payload }),
        })
        if (!res.ok) {
          console.error('send-email failed:', template, res.status, await res.text())
          return false
        }
        return true
      } catch (e) {
        console.error('send-email threw:', template, e)
        return false
      }
    }

    const notified = { talent: false, admin: false }

    if (row.account_email) {
      notified.talent = await send('deletion_requested_talent', row.account_email, {
        stage_name: row.stage_name,
      })
    } else {
      console.error('deletion: no account email for talent', row.talent_id, '- talent not notified')
    }

    notified.admin = await send('deletion_requested_admin', null, {
      stage_name: row.stage_name,
      talent_id:  row.talent_id,
    })

    if (!notified.admin) {
      console.error('DELETION ALERT NOT DELIVERED for', row.talent_id, '- 14-day clock is running')
    }

    return json({
      success:      true,
      requested_at: row.requested_at,
      notified,
    })

  } catch (err) {
    console.error('request-deletion error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})