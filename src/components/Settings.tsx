import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../supabase';
import { AlertTriangle, ExternalLink, Loader2, CheckCircle2, User } from 'lucide-react';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

// ═══════════════════════════════════════════════════════════════════════════
// Settings — account actions for a talent.
//
// A HUB, not a container: profile editing lives elsewhere (eventually the
// profile. subdomain), deletion stays in-app. See Todoist 6hcqCCCwJmP68P6X.
//
// Deliberately NOT part of ProfileEditor: that form is about what is on your
// profile, this is about your account, and a delete control one mis-tap from
// the editor's sticky Save bar is an accident waiting to happen on a phone.
// ═══════════════════════════════════════════════════════════════════════════

// Set this when profile.en4tainment.com is live. While empty, editing stays
// in-app at /profile. Changing this one line is also the PWA exit test:
// tap Edit from an INSTALLED PWA and see whether it returns cleanly.
const PROFILE_SITE_URL = '';

// Mirror the fallback in supabase.ts: the build may set either name.
const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  (import.meta as any).env?.SUPABASE_URL ||
  '';
  
export default function Settings() {
  const navigate = useNavigate();

  const [loading, setLoading]         = useState(true);
  const [stageName, setStageName]     = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  const [expanded, setExpanded]   = useState(false);
  const [typed, setTyped]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [doneAt, setDoneAt]       = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      setAccountEmail(user.email ?? '');

      const { data } = await supabase
        .from('profiles_talent')
        .select('stage_name, deletion_requested_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setStageName(data.stage_name ?? '');
        setAlreadyRequested(Boolean(data.deletion_requested_at));
      }
      setLoading(false);
    })();
  }, [navigate]);

  const openEditor = () => {
    if (PROFILE_SITE_URL) window.location.href = PROFILE_SITE_URL;
    else navigate('/profile');
  };

  const confirmMatches =
    typed.trim().toLowerCase() === stageName.trim().toLowerCase() && stageName.length > 0;

  const requestDeletion = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Your session has expired. Please sign in again.'); return; }

      // Raw fetch, NOT functions.invoke: invoke does not expose the response
      // body on a non-2xx, and the gate's message (which names exactly what is
      // outstanding) is the most useful thing we can show.
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/request-deletion`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setDoneAt(body.requested_at);
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const eraseBy = (iso: string) =>
    new Date(new Date(iso).getTime() + 14 * 86_400_000)
      .toLocaleDateString('en-GB', {
        timeZone: 'Asia/Colombo', day: 'numeric', month: 'long', year: 'numeric',
      });

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  if (doneAt) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto bg-white rounded-2xl border p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Your request has been received</h2>
        <p className="text-gray-600">
          Your profile is no longer visible. Your information will be erased by{' '}
          <strong>{eraseBy(doneAt)}</strong>. We have emailed a confirmation to {accountEmail}.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Changed your mind? Reply to that email before the date above.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-gray-400" />
          <h2 className="font-bold">Your account</h2>
        </div>
        <dl className="text-sm space-y-2 mb-6">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Stage name</dt><dd className="font-medium">{stageName || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Sign-in email</dt><dd className="font-medium truncate">{accountEmail}</dd>
          </div>
        </dl>
        <button onClick={openEditor}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors">
          Edit my profile
          {PROFILE_SITE_URL ? <ExternalLink className="w-4 h-4" /> : null}
        </button>
      </section>

      <section className="bg-white rounded-2xl border border-red-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="font-bold text-red-700">Delete my profile</h2>
        </div>

        {alreadyRequested ? (
          <p className="text-sm text-gray-600">
            A deletion request is already in progress. If you have changed your mind,
            reply to the confirmation email we sent to {accountEmail}.
          </p>
        ) : !expanded ? (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Remove your profile from En4tainment. This cannot be undone once it is carried out.
            </p>
            <button onClick={() => setExpanded(true)}
              className="text-sm font-bold text-red-600 hover:underline">
              I want to delete my profile
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>Your profile comes off the site <strong>straight away</strong> and no new booking requests can reach you.</li>
              <li>Your personal information is erased <strong>within 14 days</strong>.</li>
              <li>Bookings, invoices and payments are kept as the law requires, with your name and details removed from them.</li>
              <li><strong>You cannot undo this yourself.</strong> If you change your mind, you will need to contact us.</li>
            </ul>

            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Type <strong>{stageName}</strong> to confirm:
              </label>
              <input value={typed} onChange={(e) => setTyped(e.target.value)}
                className="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder={stageName} autoComplete="off" />
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{error}</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setExpanded(false); setTyped(''); setError(null); }}
                className="flex-1 px-4 py-3 rounded-2xl border font-bold text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={requestDeletion} disabled={!confirmMatches || submitting}
                className={cn(
                  'flex-1 px-4 py-3 rounded-2xl font-bold text-sm text-white transition-colors',
                  confirmMatches && !submitting ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 cursor-not-allowed',
                )}>
                {submitting ? 'Working…' : 'Delete my profile'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}