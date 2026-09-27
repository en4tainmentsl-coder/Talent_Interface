// ═══════════════════════════════════════════════════════════════════════════
// contact  —  En4tainment
// Public contact-form endpoint. Stores the enquiry, then notifies info@.
//
// WHY STORE FIRST
// The row is written before the email is attempted, so a failed or rate-capped
// send never loses the message. The visitor is told "sent" once the row exists,
// because at that point their message genuinely is safe. Delivery is our
// problem, not theirs.
//
// verify_jwt = true, matching every other function in the project. An
// anonymous visitor still reaches this: supabase.functions.invoke attaches
// the publishable key automatically, and that key is public by design. The
// alternative, verify_jwt = false, would mean remembering --no-verify-jwt on
// every future deploy or silently reverting to the house default. Nothing in
// the request is trusted regardless; the guards below do the real work.
//
// TWO LIMITS THAT BEHAVE DIFFERENTLY — this asymmetry is the point:
//   Per IP   — abuse. REJECTED, nothing stored.
//   Global   — quota. STORED, email skipped, notify_error records why.
// Resend's free tier is 100/day across the WHOLE platform, shared with talent
// approvals, rejections and deletion notices. An unthrottled contact form could
// burn the day's quota and silently stop an approval email. Capping contact at
// 30 leaves 70 for transactional mail, and the enquiry still survives.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGINS = [
  'https://www.en4tainment.com',
  'https://en4tainment.com',
  'http://localhost:5173',
  'http://localhost:3000',
]

const MAX_PER_IP_HOUR = 3
const MAX_PER_IP_DAY  = 10
const MAX_EMAILS_DAY  = 30
const MAX_MESSAGE     = 5000

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

// submitter_ip is inet. A value Postgres cannot parse fails the INSERT and
// loses the enquiry, so anything unparseable becomes null — the message
// matters more than the rate limit. x-forwarded-for is client-supplied:
// treat it as a nuisance filter, not as identity.
function clientIp(req: Request): string | null {
  const first = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  if (!first || first.length > 45) return null
  const v4 = /^\d{1,3}(\.\d{1,3}){3}$/
  if (v4.test(first)) return first.split('.').every(o => Number(o) <= 255) ? first : null
  if (/^[0-9a-fA-F:]+$/.test(first) && first.includes(':')) return first
  return null
}

Deno.serve(async (req: Request) => {
  const corsHeaders = cors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const payload = await req.json().catch(() => null)
    if (!payload || typeof payload !== 'object') {
      return json({ error: 'Invalid request body' }, 400)
    }

    const p = payload as Record<string, unknown>

    // Honeypot. A hidden field no human can see. If it is filled, report success
    // and discard — never tell a bot it was caught, or the next attempt adapts.
    if (str(p.website, 200).length > 0) {
      return json({ success: true })
    }

    const firstName = str(p.first_name, 100)
    const lastName  = str(p.last_name, 100)
    const email     = str(p.email, 320)
    const message   = str(p.message, MAX_MESSAGE)

    if (!firstName)                return json({ error: 'First name is required.' }, 400)
    if (!lastName)                 return json({ error: 'Last name is required.' }, 400)
    if (!EMAIL_RE.test(email))     return json({ error: 'A valid email address is required.' }, 400)
    if (!message)                  return json({ error: 'A message is required.' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const now     = Date.now()
    const hourAgo = new Date(now - 3_600_000).toISOString()
    const dayAgo  = new Date(now - 86_400_000).toISOString()
    const ip      = clientIp(req)

    // Per-IP: abuse control. Rejected outright, nothing stored.
    // Skipped when no IP is available — better to accept a real enquiry than to
    // refuse everyone behind a proxy that strips the header.
    if (ip) {
      const [hourRes, dayRes] = await Promise.all([
        admin.from('contact_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('submitter_ip', ip).gte('created_at', hourAgo),
        admin.from('contact_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('submitter_ip', ip).gte('created_at', dayAgo),
      ])
      if ((hourRes.count ?? 0) >= MAX_PER_IP_HOUR || (dayRes.count ?? 0) >= MAX_PER_IP_DAY) {
        return json({ error: 'Too many messages from this address. Please try again later.' }, 429)
      }
    }

    const { data: row, error: insertError } = await admin
      .from('contact_submissions')
      .insert({
        first_name:   firstName,
        last_name:    lastName,
        email:        email,
        message:      message,
        submitter_ip: ip,
        user_agent:   str(req.headers.get('user-agent'), 500) || null,
      })
      .select('id')
      .single()

    if (insertError || !row) {
      console.error('contact insert failed:', insertError)
      return json({ error: 'Could not save your message. Please try again.' }, 500)
    }

    // From here the message is safe. Nothing below this line may return a failure
    // to the visitor — their enquiry is stored either way.

    // Global quota: rows that were stored but never emailed did not consume
    // quota, so only successfully notified rows are counted.
    const { count: sentToday } = await admin
      .from('contact_submissions')
      .select('id', { count: 'exact', head: true })
      .not('notified_at', 'is', null)
      .gte('notified_at', dayAgo)

    if ((sentToday ?? 0) >= MAX_EMAILS_DAY) {
      await admin.from('contact_submissions')
        .update({ notify_error: `Daily contact email cap of ${MAX_EMAILS_DAY} reached; email skipped to preserve transactional quota.` })
        .eq('id', row.id)
      console.warn('contact email cap reached; row', row.id, 'stored without notification')
      return json({ success: true })
    }

    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: 'contact_received',
          data: { name: `${firstName} ${lastName}`, email, message },
        }),
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`send-email ${res.status}: ${detail.slice(0, 300)}`)
      }

      await admin.from('contact_submissions')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', row.id)

    } catch (mailErr) {
      // The enquiry is stored. Record why nobody was told, and move on.
      console.error('contact notification failed for row', row.id, mailErr)
      await admin.from('contact_submissions')
        .update({ notify_error: String(mailErr).slice(0, 1000) })
        .eq('id', row.id)
    }

    return json({ success: true })

  } catch (err) {
    console.error('contact error:', err)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
