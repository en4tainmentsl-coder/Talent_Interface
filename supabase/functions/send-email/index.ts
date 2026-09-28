// ═══════════════════════════════════════════════════════════════════════════
// send-email  —  En4tainment
// Template dispatcher for transactional email, via Resend.
//
// Callers name a template and supply its data; the templates live here so
// that wording, sender and reply-to stay consistent across the platform.
// This is NOT the multi-channel notification dispatcher (in_app/push/sms),
// which is deferred until the booking and quote enums settle. That layer,
// when built, calls this.
//
// Authorisation: service-role key, OR a user JWT whose profiles_users.role
// is 'admin'. Nothing else. Without this the function is an open relay on a
// verified sending domain.
//
// Sender must stay on the mail.en4tainment.com subdomain: SPF and DKIM are
// published there, and the apex SPF authorises Cloudflare, not Resend.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FROM          = 'En4tainment <notifications@mail.en4tainment.com>'
const REPLY_TO      = 'support@en4tainment.com'
const ADMIN_ALERT_TO = 'alerts@en4tainment.com'
const CONTACT_TO     = 'info@en4tainment.com'

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Every interpolated value is user-controlled somewhere upstream.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function colomboDate(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000)
  return d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Colombo', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// The gateway verifies the JWT signature before invoking (verify_jwt = true),
// so claims are trustworthy here. Reading the role claim is more robust than
// comparing against SUPABASE_SERVICE_ROLE_KEY, which varies by key format.
function jwtRole(token: string): string | null {
  try {
    const p = token.split('.')[1]
    if (!p) return null
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)))?.role ?? null
  } catch {
    return null
  }
}

function layout(heading: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f6f6f6;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#171717">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:8px;padding:32px">
    <tr><td>
    <h1 style="font-size:22px;line-height:28px;margin:0 0 16px 0">${heading}</h1>
    ${bodyHtml}
    <hr style="margin:32px 0 16px 0;border:none;border-top:1px solid #e5e5e5">
    <p style="font-size:13px;color:#737373;margin:0">En4tainment &middot; operated by REAP Holdings (Pvt) Ltd</p>
    </td></tr></table></td></tr></table></body></html>`
}

// replyTo is optional; templates that omit it fall back to the platform REPLY_TO.
// A contact enquiry must reply to the person who wrote in, not to support@.
type Built = { to: string; subject: string; html: string; text: string; replyTo?: string }

// Templates that fix their own recipient and ignore any supplied "to".
const INTERNAL_TEMPLATES = new Set(['deletion_requested_admin', 'contact_received'])

const TEMPLATES: Record<string, (d: Record<string, unknown>, to: string | null) => Built> = {

  talent_approved: (d, to) => {
    const name = esc(d.stage_name)
    return {
      to: to!,
      subject: 'Your En4tainment profile is approved',
      text: `Hi ${name}, your profile has been approved and is now visible to clients and venues. Sign in at https://app.en4tainment.com`,
      html: layout('Your profile is approved', `
        <p>Hi ${name},</p>
        <p>Your profile has been reviewed and approved. It is now visible to clients and venues, and you can start receiving quote requests.</p>
        <p><a href="https://app.en4tainment.com" style="display:inline-block;padding:11px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:8px">Open your dashboard</a></p>`),
    }
  },

    talent_rejected: (d, to) => {
    const name   = esc(d.stage_name)
    const reason = String(d.reason ?? '')
    const note   = d.note ? esc(d.note) : null

    // The reviewer picks an enum; the talent reads a sentence. Never show the
    // label itself — "documents_unclear" means nothing to the person receiving it.
    const SENTENCES: Record<string, string> = {
      documents_unclear:
        `We couldn't read your NIC images clearly enough to verify them. This usually happens when the photo is blurry, too dark, or part of the card is cut off. Please upload both sides again, with the whole card visible and in good light.`,
      identity_mismatch:
        `The details on your profile don't match the NIC you uploaded. This is often a typo in a name or date of birth rather than anything serious. Please check both and correct whichever is wrong.`,
      incomplete_profile:
        `We need a bit more detail on your profile before we can list you.`,
      unsuitable_content:
        `Some of the photos, videos or text on your profile don't meet our listing guidelines. Please review and replace anything that isn't suitable for a public booking profile.`,
      duplicate_account:
        `It looks like you already have a profile with us. We don't list the same performer twice.`,
      other: '',
    }

    const sentence = SENTENCES[reason] ?? ''
    // A duplicate should get back into their existing account, not build a second one.
    const isDuplicate = reason === 'duplicate_account'

    const parts: string[] = [`<p>Hi ${name},</p>`]
    parts.push(`<p>We reviewed your profile and couldn't approve it yet.</p>`)
    if (sentence) parts.push(`<p>${esc(sentence)}</p>`)
    if (note) {
      parts.push(`<blockquote style="background:#f0f4f9;border-radius:4px;margin:0 0 16px 0;padding:16px">${note}</blockquote>`)
    }

    if (isDuplicate) {
      parts.push(`<p><strong>Please reply to this email</strong> and we'll help you get back into your original profile.</p>`)
    } else {
      parts.push(`<p>You can update your profile and submit it again — there's no limit on resubmissions.</p>`)
      parts.push(`<p><a href="https://app.en4tainment.com" style="display:inline-block;padding:11px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:8px">Update my profile</a></p>`)
      parts.push(`<p style="font-size:14px;color:#525252">If this doesn't look right, reply to this email and we'll take another look.</p>`)
    }

    const textBody = [
      `Hi ${name}, we reviewed your profile and couldn't approve it yet.`,
      sentence,
      note ? String(d.note) : '',
      isDuplicate
        ? 'Please reply to this email and we will help you get back into your original profile.'
        : 'You can update your profile and submit it again at https://app.en4tainment.com',
    ].filter(Boolean).join(' ')

    return {
      to: to!,
      subject: 'About your En4tainment profile',
      text: textBody,
      html: layout(`We couldn't approve your profile yet`, parts.join('\n')),
    }
  },

  deletion_requested_talent: (d, to) => {
    const name = esc(d.stage_name)
    const due  = colomboDate(14)
    return {
      to: to!,
      subject: 'We have received your deletion request',
      text: `Hi ${name}, we have received your request to delete your En4tainment profile. Your profile is no longer visible and will be erased by ${due}. Bookings, invoices and payments are kept as the law requires, with your name removed. This request cannot be withdrawn online — reply to this email if you have changed your mind.`,
      html: layout('We have received your deletion request', `
        <p>Hi ${name},</p>
        <p>Your profile has been <strong>removed from public view straight away</strong>, and no new quote requests can reach you.</p>
        <p>Your personal information will be erased by <strong>${esc(due)}</strong>.</p>
        <p>Bookings, invoices and payments have to be kept for legal and tax reasons. Those records stay, with your name and personal details removed from them.</p>
        <p><strong>This cannot be undone once the erasure is carried out.</strong> If you have changed your mind, reply to this email before that date and we will stop the process.</p>
        <p style="font-size:14px;color:#525252">If you believe this request was not made by you, reply immediately.</p>`),
    }
  },

  deletion_requested_admin: (d) => {
    const name = esc(d.stage_name)
    const id   = esc(d.talent_id)
    const due  = colomboDate(14)
    return {
      to: ADMIN_ALERT_TO,
      subject: `ACTION REQUIRED: deletion request — erase by ${due}`,
      text: `Talent ${name} (${id}) has requested deletion. Profile is hidden. Erasure due by ${due}.`,
      html: layout('Deletion request received', `
        <p><strong>${name}</strong> has requested deletion of their profile.</p>
        <p>Talent ID: <code>${id}</code></p>
        <p>The profile is already hidden and quote requests are blocked. What remains is the erasure itself.</p>
        <p style="padding:16px;background:#fef2f2;border-radius:4px">
          <strong>Due by ${esc(due)}</strong> — 14 calendar days from the request, which is our own commitment and stricter than the PDPA s.17 ceiling.</p>`),
    }
  },
  
  // Internal: recipient is fixed to CONTACT_TO, so a caller cannot redirect
  // enquiries elsewhere. replyTo is the submitter, so replying opens a
  // conversation with them rather than with support@.
  contact_received: (d) => {
    const name    = esc(d.name)
    const email   = String(d.email ?? '')
    const message = String(d.message ?? '')
    const safeReply = EMAIL_RE.test(email) ? email : undefined

    return {
      to: CONTACT_TO,
      replyTo: safeReply,
      subject: `Contact form: ${String(d.name ?? 'enquiry').slice(0, 60)}`,
      text: [
        `New contact form enquiry.`,
        `From: ${String(d.name ?? '')} <${email}>`,
        ``,
        message,
        ``,
        `Reply directly to this email to answer them.`,
      ].join('\n'),
      html: layout('New contact enquiry', `
        <p><strong>${name}</strong><br>
        <a href="mailto:${esc(email)}">${esc(email)}</a></p>
        <div style="background:#f0f4f9;border-radius:4px;padding:16px;white-space:pre-wrap">${esc(message)}</div>
        <p style="font-size:14px;color:#525252">Reply to this email to answer them directly.</p>`),
    }
  },
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

    const token       = authHeader.replace(/^Bearer\s+/i, '')
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    let   authorised  = token === serviceKey || jwtRole(token) === 'service_role'

    if (!authorised) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      )
      const { data: { user }, error: authError } = await userClient.auth.getUser()
      if (authError || !user) return json({ error: 'Unauthorized' }, 401)

      const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)
      const { data: profile } = await admin
        .from('profiles_users').select('role').eq('id', user.id).single()

      authorised = profile?.role === 'admin'
    }

    if (!authorised) return json({ error: 'Forbidden' }, 403)

    const { template, to, data } = await req.json()

    if (typeof template !== 'string' || !(template in TEMPLATES)) {
      return json({ error: 'Unknown template' }, 400)
    }

    // Internal templates fix their own recipient and ignore any supplied one.
    const internal = INTERNAL_TEMPLATES.has(template)
    if (!internal) {
      if (typeof to !== 'string' || !EMAIL_RE.test(to)) {
        return json({ error: 'A valid "to" address is required' }, 400)
      }
    }

    if (template === 'talent_rejected') {
      const d = (data ?? {}) as Record<string, unknown>
      const r = d.reason
      const VALID = ['documents_unclear', 'identity_mismatch', 'incomplete_profile',
                     'unsuitable_content', 'duplicate_account', 'other']
      if (typeof r !== 'string' || !VALID.includes(r)) {
        return json({ error: 'talent_rejected requires a valid "reason"' }, 400)
      }
      // These two carry no usable detail on their own, matching the DB constraint.
      if ((r === 'other' || r === 'incomplete_profile') &&
          (typeof d.note !== 'string' || d.note.trim().length === 0)) {
        return json({ error: `reason "${r}" requires a "note"` }, 400)
      }
    }

    const built = TEMPLATES[template](data ?? {}, internal ? null : to)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     FROM,
        to:       [built.to],
        reply_to: built.replyTo ?? REPLY_TO,
        subject:  built.subject,
        html:     built.html,
        text:     built.text,
      }),
    })

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error('resend send failed:', res.status, JSON.stringify(body))
      return json({ error: 'Could not send the email.' }, 502)
    }

    console.log('sent', template, '->', built.to, 'id', body?.id)

    // Record the send so resend-webhook has a row to attach the outcome to.
    // Previously this ID was logged and thrown away, so no email the platform
    // sent could ever be traced to a delivery outcome.
    //
    // Best effort, deliberately. The email HAS been accepted by Resend at this
    // point; failing the call because bookkeeping failed would make the caller
    // retry and send it twice. The webhook upserts on the same key, so a missed
    // insert here self-heals on the first event — just without the template.
    if (body?.id) {
      try {
        const tracker = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        )
        const { error: trackError } = await tracker
          .from('email_deliveries')
          .upsert(
            {
              resend_id: body.id,
              template,
              recipient: built.to,
              sent_at: new Date().toISOString(),
              last_event_at: new Date().toISOString(),
            },
            { onConflict: 'resend_id' },
          )
        if (trackError) console.error('send-email: could not record delivery row —', trackError)
      } catch (trackErr) {
        console.error('send-email: delivery tracking threw —', trackErr)
      }
    }

    return json({ success: true, id: body?.id })

  } catch (err) {
    console.error('send-email error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
