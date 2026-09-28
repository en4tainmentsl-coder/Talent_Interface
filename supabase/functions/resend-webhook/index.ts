// ═══════════════════════════════════════════════════════════════════════════
// resend-webhook — En4tainment
//
// Receives delivery events from Resend and records the outcome in
// email_deliveries. This is the only thing in the platform that knows whether
// an email actually arrived.
//
// WHY IT EXISTS
// -------------
// A 2xx from Resend means ACCEPTED, not received. On 2026-09-27 a contact-form
// test stored its row, set notified_at, left notify_error NULL, and bounced -
// every signal said success. Without this function that is unknowable.
//
// verify_jwt = FALSE, and this is the only function in the project set that way.
// Resend has no JWT. That makes signature verification the ONLY thing standing
// between this endpoint and anyone who wants to write fake delivery data.
// MUST be deployed with --no-verify-jwt, every time, or it silently reverts to
// the project default and Resend's calls start failing with 401.
//
// SIGNATURE VERIFICATION (Svix, which Resend uses)
// ------------------------------------------------
// The signed payload is `${svix-id}.${svix-timestamp}.${raw body}`, HMAC-SHA256
// with the base64 secret after stripping the `whsec_` prefix. The raw body text
// must be read BEFORE parsing - re-serialising parsed JSON changes the bytes and
// the signature will never match.
//
// The timestamp is checked against a 5-minute window, because a valid signature
// is replayable forever without it.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const TOLERANCE_SECONDS = 300

// Events we record. Opened and clicked are deliberately ignored: behavioural
// tracking of talent and clients, answering no operational question.
const HANDLED = new Set([
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
])

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verify(raw: string, headers: Headers, secret: string): Promise<string | null> {
  const id        = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signature = headers.get('svix-signature')

  if (!id || !timestamp || !signature) return 'missing signature headers'

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return 'bad timestamp'
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > TOLERANCE_SECONDS) {
    return 'timestamp outside tolerance'
  }

  const key = await crypto.subtle.importKey(
    'raw',
    b64ToBytes(secret.replace(/^whsec_/, '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))

  // The header carries a space-separated list of `v1,<sig>` so a secret can be
  // rotated without downtime: both old and new signatures appear during overlap.
  const ok = signature.split(' ').some(part => {
    const [version, sig] = part.split(',')
    return version === 'v1' && sig && timingSafeEqual(sig, expected)
  })

  return ok ? null : 'signature mismatch'
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!secret) {
    console.error('resend-webhook: RESEND_WEBHOOK_SECRET is not set')
    return new Response(JSON.stringify({ error: 'Not configured' }), { status: 500 })
  }

  const raw = await req.text()

  const failure = await verify(raw, req.headers, secret)
  if (failure) {
    console.warn('resend-webhook: rejected —', failure)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(raw)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const type = String(event?.type ?? '')

  // 200 on anything we don't handle. A non-2xx makes Resend retry an event we
  // are never going to want.
  if (!HANDLED.has(type)) {
    return new Response(JSON.stringify({ ok: true, ignored: type }), { status: 200 })
  }

  const data      = event?.data ?? {}
  const resendId  = String(data.email_id ?? data.id ?? '')
  if (!resendId) {
    console.warn('resend-webhook: event without an email id —', type)
    return new Response(JSON.stringify({ ok: true, ignored: 'no id' }), { status: 200 })
  }

  const recipient = Array.isArray(data.to) ? String(data.to[0] ?? '').slice(0, 320)
                  : data.to ? String(data.to).slice(0, 320)
                  : null

  const at = (() => {
    const v = event?.created_at ?? data?.created_at
    const d = v ? new Date(v) : new Date()
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  })()

  const row: Record<string, unknown> = { resend_id: resendId, last_event_at: at }
  if (recipient) row.recipient = recipient

  switch (type) {
    case 'email.sent':             row.sent_at = at; break
    case 'email.delivered':        row.delivered_at = at; break
    case 'email.delivery_delayed': row.delayed_at = at; break
    case 'email.complained':       row.complained_at = at; break
    case 'email.bounced': {
      row.bounced_at = at
      const b = data.bounce ?? {}
      // Resend has moved these field names before; read what is there rather
      // than losing the reason, which is the whole point of the row.
      const reason = b.message ?? b.reason ?? b.description ?? (Object.keys(b).length ? JSON.stringify(b) : null)
      row.bounce_type   = [b.type, b.subType].filter(Boolean).join('/').slice(0, 100) || null
      row.bounce_reason = reason ? String(reason).slice(0, 2000) : 'No reason supplied by the receiving server.'
      break
    }
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Upsert, because a webhook event can arrive before send-email has written
  // its row. Whichever lands first creates it.
  const { error } = await admin
    .from('email_deliveries')
    .upsert(row, { onConflict: 'resend_id' })

  if (error) {
    // 500 so Resend retries — losing a bounce is the failure this exists to stop.
    console.error('resend-webhook: upsert failed —', error)
    return new Response(JSON.stringify({ error: 'Could not record event' }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})