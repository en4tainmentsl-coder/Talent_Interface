import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar, MapPin, Users, Clock, Loader2, Send, XCircle, CheckCircle2,
  AlertTriangle, Inbox, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { supabase } from '../supabase';
import { cn } from '../utils';
import PriceInput from './PriceInput';

// ═══════════════════════════════════════════════════════════════════════════
// Quote requests — the talent's side of the booking chain.
//
// A client or venue raises a quote request naming this talent. Here the
// talent sees it, sees what they would be paid, and either sends a quote or
// declines.
//
// THE FEE IS NOT AN INPUT. Settled 2026-10-25: the fee is the talent's stored
// rate for the event category, pinned on the request when it was raised. This
// screen is review-and-send. The only things the talent supplies are how many
// performers, when they arrive to set up, an optional note, and — on distant
// bookings only — a meals and an accommodation fee.
//
// THE TALENT NEVER SEES THE CLIENT'S TOTAL. Settled 2026-10-25. `quotes` is
// readable row-wide by the talent, so nothing in the database stops this file
// selecting total_client_price or commission_client_amount. Leaving them out
// of every select string below IS the control. Anyone widening those selects
// needs to know that.
//
// WRITES GO THROUGH EDGE FUNCTIONS. `quotes` has no INSERT policy and a
// talent has SELECT only on `quote_requests`, both by design. submit-quote
// and decline-quote-request verify the JWT and call service-role functions
// that resolve the talent from the verified user id.
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  (import.meta as any).env?.SUPABASE_URL ||
  '';
const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.SUPABASE_ANON_KEY ||
  '';

// Every time on this screen is Sri Lanka time, whatever the device is set to.
// A talent checking a request from abroad must still see, and enter, the
// event's local time. Sri Lanka has no daylight saving, so the offset is fixed.
const LK_TZ = 'Asia/Colombo';
const LK_OFFSET = '+05:30';

const NOTES_MAX = 1000;
const DECLINE_NOTE_MAX = 200;

interface RequestRow {
  id: string;
  event_type: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  event_address: string | null;
  special_requirements: string | null;
  status: 'open' | 'matched' | 'expired' | 'cancelled' | 'converted' | 'declined';
  responds_by: string;
  audience_capacity: string;
  sound_provided: boolean | null;
  lights_provided: boolean | null;
  meals_provided: boolean | null;
  decline_reason: string | null;
  created_at: string;
}

// Deliberately no total_client_price, commission_client_amount, base_amount,
// or tax and gateway columns. See the header.
interface QuoteRow {
  id: string;
  quote_request_id: string;
  quote_status: 'pending' | 'accepted' | 'rejected' | 'expired';
  quoted_amount: number | string;
  travel_fee: number | string | null;
  meals_fee: number | string | null;
  accommodation_fee: number | string | null;
  commission_talent_amount: number | string | null;
  talent_payout_amount: number | string | null;
  performer_count: number | null;
  setup_arrival_at: string | null;
  notes_to_client: string | null;
  expires_at: string;
  rejected_reason: string | null;
  rejected_note: string | null;
}

interface Preview {
  talent_fee: number;
  travel_fee: number;
  meals_fee: number;
  accommodation_fee: number;
  commission_talent_amount: number;
  talent_payout: number;
  distance_km: number | null;
  coordinates_estimated: boolean;
  package_label: string | null;
  meals_threshold_km: number;
  accommodation_threshold_km: number;
}

type Tab = 'answer' | 'quoted' | 'closed';

const EVENT_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  corporate: 'Corporate event',
  birthday: 'Birthday',
  concert: 'Concert',
  private: 'Private event',
  dinner_service: 'Dinner service (hotel or restaurant)',
  lunch_service: 'Lunch service (hotel or restaurant)',
  club_pub: 'Club or pub',
  spot_performance: 'Spot performance',
};

const CAPACITY_LABELS: Record<string, string> = {
  under_100: 'Under 100 guests',
  '100_to_300': '100 to 300 guests',
  '301_to_750': '301 to 750 guests',
  '751_to_1500': '751 to 1,500 guests',
  over_1500: 'Over 1,500 guests',
};

// Must match public.quote_decline_reason, and the copy of this list in
// supabase/functions/decline-quote-request/index.ts.
const DECLINE_REASONS: { value: string; label: string }[] = [
  { value: 'schedule_conflict', label: "I'm not available then" },
  { value: 'outside_service_area', label: "It's too far for me to travel" },
  { value: 'event_type_mismatch', label: "It's not the kind of event I play" },
  { value: 'other', label: 'Another reason' },
];

const DECLINED_SENTENCES: Record<string, string> = {
  schedule_conflict: "You declined this request because you weren't available.",
  outside_service_area: 'You declined this request because it was too far to travel.',
  event_type_mismatch: "You declined this request because it wasn't the kind of event you play.",
  other: 'You declined this request.',
};

// The client picks an enum; the talent reads a sentence.
// Must cover every value of public.quote_rejection_reason.
const CLIENT_REJECTION_SENTENCES: Record<string, string> = {
  price_too_high: 'The client felt the price was too high.',
  booked_alternative_talent: 'The client booked another artist.',
  terms_not_suitable: "The terms didn't suit the client.",
  event_cancelled: 'The event was cancelled.',
  event_postponed: 'The event was postponed.',
  client_other: 'The client decided not to go ahead.',
};

const DEFAULT_PERFORMERS: Record<string, number> = { solo: 1, duo: 2, '3-piece': 3, dj: 1 };

const num = (v: number | string | null | undefined) => Number(v ?? 0);

const money = (v: number | string | null | undefined) =>
  `LKR ${num(v).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const lkDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: LK_TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

const lkTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: LK_TZ, hour: 'numeric', minute: '2-digit', hour12: true,
  });

// "2026-11-26T18:30" in Sri Lanka time, for a datetime-local input's min/max.
function lkInputValue(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: LK_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).reduce<Record<string, string>>((a, x) => ({ ...a, [x.type]: x.value }), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// The reverse: what the talent typed is Sri Lanka time, whatever the device.
const lkInputToDate = (v: string) => new Date(`${v}:00${LK_OFFSET}`);

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

const declared = (v: boolean | null) => (v === true ? 'Provided' : v === false ? 'Not provided' : 'Not stated');

async function callFunction(slug: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'Your session has expired. Please sign in again.' };
  try {
    // Raw fetch, NOT functions.invoke: invoke does not expose the response
    // body on a non-2xx, and these functions' messages are written to be
    // shown to the talent.
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body?.error ?? 'Something went wrong. Please try again.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the server. Please check your connection and try again.' };
  }
}

export default function QuoteRequests() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [performerType, setPerformerType] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteRow>>({});
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('answer');
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // quote_requests.talent_id and quotes.talent_id reference
    // profiles_talent.id, NOT the auth user id.
    const { data: talent, error: talentError } = await supabase
      .from('profiles_talent')
      .select('id, type_of_performer')
      .eq('user_id', user.id)
      .maybeSingle();

    if (talentError) { setLoadError('Could not load your profile. Please try again.'); setLoading(false); return; }
    if (!talent) { setHasProfile(false); setLoading(false); return; }
    setPerformerType(talent.type_of_performer ?? null);

    const [reqRes, quoteRes, nameRes] = await Promise.all([
      supabase
        .from('quote_requests')
        .select('id, event_type, starts_at, ends_at, location, event_address, special_requirements, status, responds_by, audience_capacity, sound_provided, lights_provided, meals_provided, decline_reason, created_at')
        .eq('talent_id', talent.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('quotes')
        .select('id, quote_request_id, quote_status, quoted_amount, travel_fee, meals_fee, accommodation_fee, commission_talent_amount, talent_payout_amount, performer_count, setup_arrival_at, notes_to_client, expires_at, rejected_reason, rejected_note')
        .eq('talent_id', talent.id),
      supabase.rpc('get_quote_request_client_names'),
    ]);

    if (reqRes.error || quoteRes.error) {
      setLoadError('Could not load your requests. Please try again.');
      setLoading(false);
      return;
    }

    setRequests((reqRes.data ?? []) as RequestRow[]);
    setQuotes(Object.fromEntries(((quoteRes.data ?? []) as QuoteRow[]).map(q => [q.quote_request_id, q])));
    // A missing name is not worth failing the page over.
    setClientNames(Object.fromEntries(
      ((nameRes.data ?? []) as { quote_request_id: string; full_name: string }[])
        .map(n => [n.quote_request_id, n.full_name]),
    ));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const now = Date.now();
    const g: Record<Tab, RequestRow[]> = { answer: [], quoted: [], closed: [] };
    for (const r of requests) {
      if (quotes[r.id]) g.quoted.push(r);
      // The hourly expiry job may not have caught up, so a request whose
      // window has passed is treated as closed here whatever its status says.
      else if (r.status === 'open' && new Date(r.responds_by).getTime() > now) g.answer.push(r);
      else g.closed.push(r);
    }
    g.answer.sort((a, b) => new Date(a.responds_by).getTime() - new Date(b.responds_by).getTime());
    return g;
  }, [requests, quotes]);

  const onDone = async (message: string, goTo: Tab) => {
    setOpenId(null);
    setNotice(message);
    await load();
    setTab(goTo);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading requests">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'answer', label: 'To answer' },
    { id: 'quoted', label: 'Quoted' },
    { id: 'closed', label: 'Closed' },
  ];
  const visible = groups[tab];

  return (
    <div className="max-w-4xl mx-auto p-0 md:p-4 space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Requests</h1>
        <p className="text-gray-500 mt-2">
          Booking requests sent to you. Send a quote or decline before the time runs out.
        </p>
      </div>

      {notice && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800" role="status">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium flex-1">{notice}</p>
          <button onClick={() => setNotice(null)} className="text-sm font-bold underline">Dismiss</button>
        </div>
      )}

      {loadError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700" role="alert">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium flex-1">{loadError}</p>
          <button onClick={() => { setLoading(true); load(); }} className="text-sm font-bold underline">Try again</button>
        </div>
      )}

      {!hasProfile ? (
        <EmptyState title="Finish your profile first" body="Requests appear here once your profile is approved and visible to clients." />
      ) : (
        <>
          <div className="flex gap-2" role="tablist" aria-label="Request groups">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => { setTab(t.id); setOpenId(null); }}
                className={cn(
                  'px-4 py-2 rounded-2xl text-sm font-bold transition-colors',
                  tab === t.id ? 'bg-black text-white' : 'bg-white border text-gray-500 hover:text-black',
                )}
              >
                {t.label}
                <span className={cn('ml-2 text-xs', tab === t.id ? 'text-white/60' : 'text-gray-400')}>
                  {groups[t.id].length}
                </span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title={tab === 'answer' ? 'Nothing waiting for you' : tab === 'quoted' ? 'No quotes sent yet' : 'Nothing here yet'}
              body={tab === 'answer'
                ? "When a client or venue asks for you, the request appears here and you'll have 48 hours to answer."
                : tab === 'quoted'
                  ? 'Quotes you send appear here, with what the client decided.'
                  : 'Requests you declined, and ones that expired or were cancelled, appear here.'}
            />
          ) : (
            <ul className="space-y-4">
              {visible.map(r => (
                <li key={r.id}>
                  <RequestCard
                    request={r}
                    quote={quotes[r.id]}
                    clientName={clientNames[r.id]}
                    performerType={performerType}
                    answerable={tab === 'answer'}
                    open={openId === r.id}
                    onToggle={() => setOpenId(openId === r.id ? null : r.id)}
                    onDone={onDone}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white border rounded-[2rem] p-10 text-center space-y-2">
      <Inbox className="w-8 h-8 mx-auto text-gray-300" />
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto">{body}</p>
    </div>
  );
}

function StatusPill({ request, quote }: { request: RequestRow; quote?: QuoteRow }) {
  let label: string;
  let tone: string;
  if (quote) {
    if (quote.quote_status === 'accepted') { label = 'Accepted'; tone = 'bg-emerald-100 text-emerald-700'; }
    else if (quote.quote_status === 'rejected') { label = 'Client declined'; tone = 'bg-gray-100 text-gray-600'; }
    else if (quote.quote_status === 'expired') { label = 'Quote expired'; tone = 'bg-gray-100 text-gray-600'; }
    else { label = 'Waiting for the client'; tone = 'bg-amber-100 text-amber-700'; }
  } else if (request.status === 'declined') { label = 'You declined'; tone = 'bg-gray-100 text-gray-600'; }
  else if (request.status === 'cancelled') { label = 'Cancelled by the client'; tone = 'bg-gray-100 text-gray-600'; }
  else if (request.status === 'open' && new Date(request.responds_by).getTime() > Date.now()) {
    label = timeLeft(request.responds_by); tone = 'bg-amber-100 text-amber-700';
  } else { label = 'Expired'; tone = 'bg-gray-100 text-gray-600'; }
  return <span className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap', tone)}>{label}</span>;
}

interface CardProps {
  request: RequestRow;
  quote?: QuoteRow;
  clientName?: string;
  performerType: string | null;
  answerable: boolean;
  open: boolean;
  onToggle: () => void;
  onDone: (message: string, goTo: Tab) => Promise<void>;
}

function RequestCard({ request, quote, clientName, performerType, answerable, open, onToggle, onDone }: CardProps) {
  const where = request.event_address || request.location || 'Location not given';
  const panelId = `request-panel-${request.id}`;

  return (
    <div className="bg-white border rounded-[2rem] shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full text-left p-6 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
      >
        <div className="space-y-2 min-w-0">
          <h2 className="text-lg font-bold">{EVENT_LABELS[request.event_type] ?? request.event_type}</h2>
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>{lkDateTime(request.starts_at)} to {lkTime(request.ends_at)}</span>
          </p>
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="truncate">{where}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          <StatusPill request={request} quote={quote} />
          {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div id={panelId} className="border-t p-6 space-y-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <Fact label="Requested by" value={clientName || 'Name not available'} />
            <Fact label="Audience" value={CAPACITY_LABELS[request.audience_capacity] ?? request.audience_capacity} icon={<Users className="w-4 h-4" />} />
            <Fact label="Sound system" value={declared(request.sound_provided)} />
            <Fact label="Lighting" value={declared(request.lights_provided)} />
            <Fact label="Meals for performers" value={declared(request.meals_provided)} />
            <Fact label="Times shown in" value="Sri Lanka time" icon={<Clock className="w-4 h-4" />} />
          </dl>

          {request.special_requirements && (
            <div className="text-sm">
              <p className="font-bold text-gray-400 uppercase tracking-widest text-xs mb-1">From the client</p>
              <p className="text-gray-700 whitespace-pre-wrap">{request.special_requirements}</p>
            </div>
          )}

          {quote ? (
            <SentQuote quote={quote} />
          ) : request.status === 'declined' ? (
            <p className="text-sm text-gray-600">
              {DECLINED_SENTENCES[request.decline_reason ?? ''] ?? 'You declined this request.'}
            </p>
          ) : answerable ? (
            <Composer request={request} performerType={performerType} onDone={onDone} />
          ) : (
            <p className="text-sm text-gray-600">This request is closed and can no longer be answered.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="font-bold text-gray-400 uppercase tracking-widest text-xs mb-1">{label}</dt>
      <dd className="flex items-center gap-2 text-gray-800">{icon}{value}</dd>
    </div>
  );
}

function Breakdown({ fee, commission, travel, meals, accommodation, payout, children }: {
  fee: number; commission: number; travel: number; meals: number; accommodation: number; payout: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-2xl p-5 space-y-2 text-sm">
      <Line label="Your fee" value={money(fee)} />
      <Line label="En4tainment service fee" value={`− ${money(commission)}`} muted />
      <Line label="Travel" value={money(travel)} />
      {meals > 0 && <Line label="Meals" value={money(meals)} />}
      {accommodation > 0 && <Line label="Accommodation" value={money(accommodation)} />}
      <div className="flex justify-between font-bold text-base pt-3 mt-1 border-t">
        <span>You receive</span><span>{money(payout)}</span>
      </div>
      {children}
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between', muted ? 'text-gray-500' : 'text-gray-800')}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function SentQuote({ quote }: { quote: QuoteRow }) {
  return (
    <div className="space-y-4">
      <Breakdown
        fee={num(quote.quoted_amount)}
        commission={num(quote.commission_talent_amount)}
        travel={num(quote.travel_fee)}
        meals={num(quote.meals_fee)}
        accommodation={num(quote.accommodation_fee)}
        payout={num(quote.talent_payout_amount)}
      />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
        {quote.performer_count != null && <Fact label="Performers" value={String(quote.performer_count)} />}
        {quote.setup_arrival_at && <Fact label="You arrive to set up" value={lkDateTime(quote.setup_arrival_at)} />}
      </dl>
      {quote.notes_to_client && (
        <div className="text-sm">
          <p className="font-bold text-gray-400 uppercase tracking-widest text-xs mb-1">Your note</p>
          <p className="text-gray-700 whitespace-pre-wrap">{quote.notes_to_client}</p>
        </div>
      )}
      {quote.quote_status === 'pending' && (
        <p className="text-sm text-gray-600">The client has until {lkDateTime(quote.expires_at)} to accept.</p>
      )}
      {quote.quote_status === 'accepted' && (
        <p className="text-sm font-medium text-emerald-700">The client accepted. This is a booking.</p>
      )}
      {quote.quote_status === 'rejected' && (
        <div className="text-sm text-gray-600 space-y-1">
          <p>{CLIENT_REJECTION_SENTENCES[quote.rejected_reason ?? ''] ?? CLIENT_REJECTION_SENTENCES.client_other}</p>
          {quote.rejected_note && <p className="italic">&ldquo;{quote.rejected_note}&rdquo;</p>}
        </div>
      )}
      {quote.quote_status === 'expired' && (
        <p className="text-sm text-gray-600">This quote ran out before the client answered.</p>
      )}
    </div>
  );
}

function Composer({ request, performerType, onDone }: {
  request: RequestRow;
  performerType: string | null;
  onDone: (message: string, goTo: Tab) => Promise<void>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(true);

  const [performers, setPerformers] = useState<string>(
    performerType && DEFAULT_PERFORMERS[performerType] ? String(DEFAULT_PERFORMERS[performerType]) : '',
  );
  const [setupAt, setSetupAt] = useState('');
  const [notes, setNotes] = useState('');
  const [meals, setMeals] = useState<number | null>(null);
  const [accommodation, setAccommodation] = useState<number | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);

  // A message about a field is stale the moment that field is edited.
  useEffect(() => { setFormError(null); }, [performers, setupAt, notes, meals, accommodation]);

  // Only the latest preview call may write state: a slow response for an old
  // fee must not overwrite the figure for the one now on screen.
  const previewSeq = useRef(0);

  useEffect(() => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('preview_quote_pricing', {
        p_quote_request_id: request.id,
        p_meals_fee: meals ?? 0,
        p_accommodation_fee: accommodation ?? 0,
      });
      if (seq !== previewSeq.current) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setPreview(null);
        setPreviewError(error?.code === '42501' || error?.code === '22004'
          ? error.message
          : 'Could not work out what you would be paid. Please try again.');
      } else {
        setPreviewError(null);
        setPreview({
          talent_fee: num(row.talent_fee),
          travel_fee: num(row.travel_fee),
          meals_fee: num(row.meals_fee),
          accommodation_fee: num(row.accommodation_fee),
          commission_talent_amount: num(row.commission_talent_amount),
          talent_payout: num(row.talent_payout),
          distance_km: row.distance_km == null ? null : num(row.distance_km),
          coordinates_estimated: !!row.coordinates_estimated,
          package_label: row.package_label ?? null,
          meals_threshold_km: num(row.meals_threshold_km),
          accommodation_threshold_km: num(row.accommodation_threshold_km),
        });
      }
      setPreviewing(false);
    }, 350);
    return () => clearTimeout(handle);
  }, [request.id, meals, accommodation]);

  // The thresholds come from the rate configuration in force, by way of the
  // preview. They are not hardcoded here: the database enforces them, and a
  // copy in this file would disagree with it the first time a rate row changes.
  const canAddMeals = !!preview && preview.distance_km != null && preview.distance_km >= preview.meals_threshold_km;
  const canAddAccommodation = !!preview && preview.distance_km != null && preview.distance_km >= preview.accommodation_threshold_km;

  const setupMax = lkInputValue(new Date(new Date(request.starts_at).getTime() - 60_000));
  const setupMin = lkInputValue(new Date(Date.now() + 60_000));

  const validate = (): string | null => {
    const n = Number(performers);
    if (!performers || !Number.isInteger(n) || n < 1 || n > 50) return 'Say how many performers will be on stage, between 1 and 50.';
    if (!setupAt) return 'Say when you will arrive to set up.';
    const t = lkInputToDate(setupAt).getTime();
    if (Number.isNaN(t)) return 'Say when you will arrive to set up.';
    if (t <= Date.now() || t >= new Date(request.starts_at).getTime()) {
      return 'Your setup arrival time must be in the future and before the event starts.';
    }
    if (notes.trim().length > NOTES_MAX) return `Your note is too long (${NOTES_MAX} characters maximum).`;
    if (!preview) return 'Wait for the figures to load before sending.';
    return null;
  };

  const askToSend = () => {
    const problem = validate();
    setFormError(problem);
    if (!problem) setConfirming(true);
  };

  const send = async () => {
    setBusy(true);
    const result = await callFunction('submit-quote', {
      quote_request_id: request.id,
      performer_count: Number(performers),
      setup_arrival_at: lkInputToDate(setupAt).toISOString(),
      notes_to_client: notes.trim() || null,
      meals_fee: canAddMeals ? (meals ?? 0) : 0,
      accommodation_fee: canAddAccommodation ? (accommodation ?? 0) : 0,
    });
    setBusy(false);
    setConfirming(false);
    if (!result.ok) { setFormError(result.error ?? 'Could not send the quote.'); return; }
    await onDone('Your quote was sent. You can see it under Quoted.', 'quoted');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold mb-3">What you would be paid</h3>
        {previewError ? (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm" role="alert">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <p>{previewError}</p>
          </div>
        ) : !preview ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 p-5 bg-gray-50 rounded-2xl" role="status">
            <Loader2 className="w-4 h-4 animate-spin" /> Working it out…
          </div>
        ) : (
          <div className={cn('transition-opacity', previewing && 'opacity-60')}>
            <Breakdown
              fee={preview.talent_fee}
              commission={preview.commission_talent_amount}
              travel={preview.travel_fee}
              meals={canAddMeals ? preview.meals_fee : 0}
              accommodation={canAddAccommodation ? preview.accommodation_fee : 0}
              payout={preview.talent_payout}
            >
              <div className="pt-3 space-y-1 text-xs text-gray-500">
                {preview.package_label && <p>Your fee covers: {preview.package_label}.</p>}
                <p>
                  Your fee is the rate you set for this kind of event. It can&rsquo;t be changed for one booking.
                </p>
                {preview.coordinates_estimated ? (
                  <p className="text-amber-700">
                    Travel is an estimate, because the distance to this event couldn&rsquo;t be measured.
                  </p>
                ) : preview.distance_km != null && (
                  <p>
                    {preview.travel_fee > 0
                      ? `Travel is for ${preview.distance_km.toLocaleString('en-LK')} km each way, there and back.`
                      : `No travel is charged: the event is ${preview.distance_km.toLocaleString('en-LK')} km from your base.`}
                  </p>
                )}
              </div>
            </Breakdown>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <h3 className="font-bold">Your quote</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor={`performers-${request.id}`} className="block text-sm font-bold mb-2">Performers on stage</label>
            <input
              id={`performers-${request.id}`}
              type="number" inputMode="numeric" min={1} max={50} step={1}
              value={performers}
              onChange={e => setPerformers(e.target.value)}
              className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label htmlFor={`setup-${request.id}`} className="block text-sm font-bold mb-2">You arrive to set up</label>
            <input
              id={`setup-${request.id}`}
              type="datetime-local"
              min={setupMin} max={setupMax}
              value={setupAt}
              onChange={e => setSetupAt(e.target.value)}
              aria-describedby={`setup-hint-${request.id}`}
              className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <p id={`setup-hint-${request.id}`} className="text-xs text-gray-500 mt-1">
              Sri Lanka time. The event starts {lkDateTime(request.starts_at)}.
            </p>
          </div>
        </div>

        {(canAddMeals || canAddAccommodation) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {canAddMeals && (
              <div>
                <label className="block text-sm font-bold mb-2">Meals (optional)</label>
                <PriceInput value={meals} onChange={setMeals} />
                <p className="text-xs text-gray-500 mt-1">
                  For bookings {preview!.meals_threshold_km.toLocaleString('en-LK')} km or more away. Whole rupees, for the whole act.
                </p>
              </div>
            )}
            {canAddAccommodation && (
              <div>
                <label className="block text-sm font-bold mb-2">Accommodation (optional)</label>
                <PriceInput value={accommodation} onChange={setAccommodation} />
                <p className="text-xs text-gray-500 mt-1">
                  For bookings {preview!.accommodation_threshold_km.toLocaleString('en-LK')} km or more away. Whole rupees, for the whole act.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor={`notes-${request.id}`} className="block text-sm font-bold mb-2">Note to the client (optional)</label>
          <textarea
            id={`notes-${request.id}`}
            rows={3}
            maxLength={NOTES_MAX}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything the client should know before they accept."
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">{notes.length} / {NOTES_MAX}</p>
        </div>
      </div>

      {formError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm" role="alert">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <p>{formError}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={askToSend}
          disabled={busy || !preview}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          <Send className="w-4 h-4" /> Send quote
        </button>
        <button
          onClick={() => { setFormError(null); setDeclining(true); }}
          disabled={busy}
          className="flex items-center justify-center gap-2 px-6 py-3 border font-bold rounded-2xl text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <XCircle className="w-4 h-4" /> Decline
        </button>
      </div>

      {confirming && preview && (
        <Dialog title="Send this quote?" onClose={() => !busy && setConfirming(false)}>
          <p className="text-sm text-gray-700">
            If the client accepts, you receive <strong>{money(preview.talent_payout)}</strong> for {Number(performers)}{' '}
            {Number(performers) === 1 ? 'performer' : 'performers'}, arriving {lkDateTime(lkInputToDate(setupAt).toISOString())}.
          </p>
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>A quote can&rsquo;t be changed or withdrawn once it is sent. Check the details before you send.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setConfirming(false)} disabled={busy}
              className="flex-1 px-4 py-3 border font-bold rounded-2xl hover:bg-gray-50 disabled:opacity-50"
            >
              Go back
            </button>
            <button
              onClick={send} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send quote
            </button>
          </div>
        </Dialog>
      )}

      {declining && (
        <DeclineDialog
          requestId={request.id}
          onClose={() => setDeclining(false)}
          onDeclined={() => onDone('You declined the request. The client will see your reason.', 'closed')}
        />
      )}
    </div>
  );
}

function DeclineDialog({ requestId, onClose, onDeclined }: {
  requestId: string; onClose: () => void; onDeclined: () => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) { setError('Choose a reason.'); return; }
    if (reason === 'other' && note.trim().length === 0) {
      setError('Please say why, so the client knows what to do next.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await callFunction('decline-quote-request', {
      quote_request_id: requestId,
      reason,
      note: note.trim() || null,
    });
    setBusy(false);
    if (!result.ok) { setError(result.error ?? 'Could not decline the request.'); return; }
    await onDeclined();
  };

  return (
    <Dialog title="Decline this request?" onClose={() => !busy && onClose()}>
      <p className="text-sm text-gray-700">
        The client is told you can&rsquo;t take it, and why. This closes the request and can&rsquo;t be undone.
      </p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold mb-2">Reason</legend>
        {DECLINE_REASONS.map(r => (
          <label key={r.value} className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 text-sm">
            <input
              type="radio" name={`decline-${requestId}`} value={r.value}
              checked={reason === r.value}
              onChange={() => { setReason(r.value); setError(null); }}
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor={`decline-note-${requestId}`} className="block text-sm font-bold mb-2">
          Note to the client {reason === 'other' ? '' : '(optional)'}
        </label>
        <textarea
          id={`decline-note-${requestId}`}
          rows={2}
          maxLength={DECLINE_NOTE_MAX}
          value={note}
          onChange={e => { setNote(e.target.value); setError(null); }}
          className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none"
        />
        <p className="text-xs text-gray-500 mt-1">{note.length} / {DECLINE_NOTE_MAX}</p>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onClose} disabled={busy}
          className="flex-1 px-4 py-3 border font-bold rounded-2xl hover:bg-gray-50 disabled:opacity-50"
        >
          Go back
        </button>
        <button
          onClick={submit} disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-black text-white font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Decline request
        </button>
      </div>
    </Dialog>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // onClose is a new function on every render of the parent. Held in a ref so
  // the effect below runs once: re-running it would pull focus back to the
  // dialog on every keystroke in a field inside it.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-4 outline-none max-h-[90vh] overflow-auto"
      >
        <h3 className="text-xl font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
