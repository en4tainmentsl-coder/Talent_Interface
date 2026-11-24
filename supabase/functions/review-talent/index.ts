// ═══════════════════════════════════════════════════════════════════════════
// review-talent  —  En4tainment
// The KYC reviewer's approve/reject action. Spec: Todoist 6hPPgf579WrHHHqX.
//
// Called by the kyc-document-review Directus extension using the reviewer's own
// SUPABASE session (the extension already signs reviewers in separately, which
// is what makes r2-deliver issue presigned URLs).
//
// Why this exists rather than the Directus dropdowns: approval was TWO
// uncoupled fields. approval_status = 'approved' publishes nobody; only
// profile_status = 'active' sets is_public, via handle_talent_approval. An
// admin changing one and not the other produced an approved-but-invisible or
// active-but-unapproved talent, silently.
//
// 2026-11-24 — 2-OF-3 APPROVAL. An approve no longer approves on its own: it
// records a signature, and the profile goes live only when a SECOND named
// reviewer signs the same review cycle. This calls record_talent_review_as
// rather than review_talent precisely because that function reports back
// whether promotion happened — review_talent returns three columns and cannot
// say. Without that, the FIRST approver's click emailed the talent "your
// profile is approved" while the profile was still pending and invisible.
//
// One rejection rejects outright; that has not changed.
//
// The caller's identity must appear in public.reviewers. Signing in with the
// shared admin.001 account, or any role = 'admin' account that is not a named
// reviewer, is refused 42501 by design.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGINS = [
  'https://admin.en4tainment.com',
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
const REASONS = ['documents_unclear', 'identity_mismatch', 'incomplete_profile',
                 'unsuitable_content', 'duplicate_account', 'other']

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

    const { talent_id, decision, reason, note } = await req.json()

    if (typeof talent_id !== 'string' || !UUID_RE.test(talent_id)) {
      return json({ error: 'A valid talent_id is required' }, 400)
    }
    if (decision !== 'approve' && decision !== 'reject') {
      return json({ error: 'decision must be "approve" or "reject"' }, 400)
    }
    if (decision === 'reject') {
      if (typeof reason !== 'string' || !REASONS.includes(reason)) {
        return json({ error: 'A valid rejection reason is required' }, 400)
      }
      if ((reason === 'other' || reason === 'incomplete_profile') &&
          (typeof note !== 'string' || note.trim().length === 0)) {
        return json({ error: `A note is required for "${reason}"` }, 400)
      }
    }
    if (note != null && typeof note !== 'string') {
      return json({ error: 'note must be a string' }, 400)
    }
    if (typeof note === 'string' && note.length > 1000) {
      return json({ error: 'note is too long (1000 characters maximum)' }, 400)
    }

    const admin = createClient(url, serviceKey)

    // record_talent_review_as independently re-checks that the caller is a
    // named reviewer, that the profile is awaiting review, and that this
    // reviewer opened both NIC images within the last 30 minutes. It is
    // revoked from anon and authenticated, so it cannot be reached from a
    // browser — only through this function's service-role client.
    const { data, error: rpcError } = await admin.rpc('record_talent_review_as', {
      p_talent_id: talent_id,
      p_approver:  user.id,
      p_decision:  decision,
      p_reason:    decision === 'reject' ? reason : null,
      p_note:      typeof note === 'string' && note.trim() ? note.trim() : null,
    })

    if (rpcError) {
      // These messages are written for the reviewer to read — the document
      // check, the reviewer check and the completeness gate all say exactly
      // what is wrong.
      console.error('record_talent_review_as failed:', rpcError.code, rpcError.message)
      switch (rpcError.code) {
        case '42501': return json({ error: rpcError.message }, 403)
        case '22023': return json({ error: rpcError.message }, 400)
        case '23505': return json({ error: rpcError.message }, 409)
        case '23514': return json({ error: rpcError.message }, 409)
        case '42704': return json({ error: 'That talent profile could not be found.' }, 404)
        default:      return json({ error: 'Could not record the decision. Please try again.' }, 500)
      }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.stage_name) {
      console.error('record_talent_review_as returned no row')
      return json({ error: 'Could not record the decision. Please try again.' }, 500)
    }

    const nowLive  = row.now_live === true
    const signures = Number(row.approvals_now ?? 0)
    const required = Number(row.approvals_required ?? 2)

    // What the talent is told, and when.
    //   reject            -> tell them now; one rejection is final for this cycle
    //   approve + live    -> tell them now; the second signature landed
    //   approve, not live -> tell them NOTHING. They are not approved yet, and
    //                        saying otherwise is the bug this replaced.
    const template =
      decision === 'reject' ? 'talent_rejected' :
      nowLive               ? 'talent_approved' : null

    // The decision is already recorded. A failed email must not undo it, but it
    // must not be silent either: the response says whether it was sent.
    let notified = false
    if (template) {
      if (row.account_email) {
        try {
          const res = await fetch(`${url}/functions/v1/send-email`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              template,
              to: row.account_email,
              data: {
                stage_name: row.stage_name,
                reason:     decision === 'reject' ? reason : undefined,
                note:       typeof note === 'string' && note.trim() ? note.trim() : undefined,
              },
            }),
          })
          notified = res.ok
          if (!res.ok) console.error('send-email failed:', res.status, await res.text())
        } catch (e) {
          console.error('send-email threw:', e)
        }
      } else {
        console.error('review-talent: no account email for talent', talent_id, '- not notified')
      }
    }

    return json({
      success:            true,
      decision,
      stage_name:         row.stage_name,
      approvals_now:      signures,
      approvals_required: required,
      now_live:           nowLive,
      notified,
    })

  } catch (err) {
    console.error('review-talent error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})