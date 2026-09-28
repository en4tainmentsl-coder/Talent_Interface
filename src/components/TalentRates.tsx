import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { supabase } from '../supabase';
import { Lock, Loader2 } from 'lucide-react';
import { cn } from '../utils';
import PriceInput from './PriceInput';

// ═══════════════════════════════════════════════════════════════════════════
// Per-category rates. D-038 (eight categories), D-046 (rates are never public).
//
// Replaces the single profiles_talent.pricing_per_session field. Writes to
// talent_rates, which is a different table with its own RLS: a talent reads and
// writes only their own rows, and nobody else sees a rate but admin.
//
// EIGHT ROWS ALWAYS EXIST. They are seeded when the profile is created, and a
// talent holds SELECT and UPDATE only — no INSERT, no DELETE. An empty field is
// an UPDATE to NULL, meaning "I do not do this work", not a deleted row. That is
// what makes the 30-day cooldown real: if opting out removed the row, opting
// back in would reset the clock.
//
// THE COOLDOWN IS SHOWN, NOT VALIDATED. Each row carries rate_updated_at, so a
// locked category is computable on load and renders disabled with its unlock
// date. The database exception stays as the guard, but a talent should never
// reach it by normal use — the same principle as the quote-request backstop.
//
// SAVED AS A SEPARATE STEP from the profile upsert, deliberately. A talent
// editing their bio must not be blocked by a wedding rate they changed three
// weeks ago.
// ═══════════════════════════════════════════════════════════════════════════

const COOLDOWN_DAYS = 30;

// Floor matches price_ranges Range 1 (D-039). Below it a rate resolves to no
// range at all and the talent drops out of every client filter.
const MIN_RATE = 1000;
const MAX_RATE = 10000000;

type Category =
  | 'special_events' | 'wedding' | 'concert' | 'club_pub'
  | 'dinner_service' | 'lunch_service' | 'spot_performance';

const CATEGORIES: { key: Category; label: string; hint?: string }[] = [
  { key: 'special_events',   label: 'Special events', hint: 'Corporate, birthday and private events' },
  { key: 'wedding',          label: 'Weddings' },
  { key: 'concert',          label: 'Concerts' },
  { key: 'club_pub',         label: 'Clubs and pubs' },
  { key: 'dinner_service',   label: 'Dinner service' },
  { key: 'lunch_service',    label: 'Lunch service' },
  { key: 'spot_performance', label: 'Spot performance', hint: 'A short set, typically two or three songs' },
];

interface Row {
  id: string;
  category: Category;
  amount: number | null;
  rate_updated_at: string | null;
}

export interface TalentRatesHandle {
  /** Persists changed rates. Returns null on success, or a message to show. */
  save: () => Promise<string | null>;
  /** True when at least one category has a rate — the submission gate. */
  hasAnyRate: () => boolean;
}

function unlockDate(rateUpdatedAt: string | null): Date | null {
  if (!rateUpdatedAt) return null;
  const d = new Date(rateUpdatedAt);
  d.setDate(d.getDate() + COOLDOWN_DAYS);
  return d > new Date() ? d : null;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

interface Props {
  talentId: string | null;
  onDirty?: () => void;
}

const TalentRates = forwardRef<TalentRatesHandle, Props>(({ talentId, onDirty }, ref) => {
  const [rows, setRows]       = useState<Row[]>([]);
  const [draft, setDraft]     = useState<Record<Category, number | null>>({} as any);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!talentId) { setLoading(false); return; }

    (async () => {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from('talent_rates')
        .select('id, category, amount, rate_updated_at')
        .eq('talent_id', talentId);

      if (cancelled) return;

      if (loadError) {
        setError('Could not load your rates. Reload the page to try again.');
        setLoading(false);
        return;
      }

      // amount arrives as a numeric string from PostgREST, not a number.
      const loaded: Row[] = (data ?? []).map((r: any) => ({
        id: r.id,
        category: r.category as Category,
        amount: r.amount == null ? null : Number(r.amount),
        rate_updated_at: r.rate_updated_at,
      }));

      setRows(loaded);
      setDraft(Object.fromEntries(loaded.map(r => [r.category, r.amount])) as Record<Category, number | null>);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [talentId]);

  const rowFor = (c: Category) => rows.find(r => r.category === c);

  useImperativeHandle(ref, () => ({
    hasAnyRate: () => CATEGORIES.some(c => draft[c.key] != null),

    save: async () => {
      if (!talentId) return null;

      // Only send what changed. An unchanged locked row must not be written, or
      // the cooldown trigger rejects a save the talent did not ask for.
      const changed = rows.filter(r => (draft[r.category] ?? null) !== (r.amount ?? null));
      if (changed.length === 0) return null;

      const failures: string[] = [];

      for (const r of changed) {
        const next = draft[r.category] ?? null;

        if (next != null && (next < MIN_RATE || next > MAX_RATE)) {
          failures.push(`${CATEGORIES.find(c => c.key === r.category)!.label}: rates must be between ${MIN_RATE.toLocaleString()} and ${MAX_RATE.toLocaleString()}`);
          continue;
        }

        const { error: saveError } = await supabase
          .from('talent_rates')
          .update({ amount: next })
          .eq('id', r.id);

        if (saveError) {
          // The cooldown trigger raises 23514 with a message written for the
          // talent, so surface it rather than replacing it with our own.
          failures.push(saveError.message);
        }
      }

      // Re-read so the UI shows what actually persisted, including the new
      // rate_updated_at that starts each changed category's next 30 days.
      const { data } = await supabase
        .from('talent_rates')
        .select('id, category, amount, rate_updated_at')
        .eq('talent_id', talentId);

      if (data) {
        const fresh: Row[] = data.map((r: any) => ({
          id: r.id,
          category: r.category as Category,
          amount: r.amount == null ? null : Number(r.amount),
          rate_updated_at: r.rate_updated_at,
        }));
        setRows(fresh);
        setDraft(Object.fromEntries(fresh.map(r => [r.category, r.amount])) as Record<Category, number | null>);
      }

      return failures.length ? failures.join('. ') : null;
    },
  }), [rows, draft, talentId]);

  if (!talentId) {
    return (
      <p className="text-sm text-gray-500">
        Save your profile once, then set your rates here.
      </p>
    );
  }

  if (loading) {
    return (
      <p className="text-sm text-gray-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your rates…
      </p>
    );
  }

  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Set a rate only for the kinds of work you take. Leave the rest blank — blank
        means you don't do that kind of booking, and you won't be shown to clients
        looking for it. You need at least one.
      </p>

      <div className="space-y-3">
        {CATEGORIES.map(({ key, label, hint }) => {
          const row      = rowFor(key);
          const locked   = unlockDate(row?.rate_updated_at ?? null);
          const value    = draft[key] ?? null;

          return (
            <div key={key} className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 sm:items-center">
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  {label}
                  {locked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                </label>
                {hint && <p className="text-xs text-gray-500">{hint}</p>}
                {locked && (
                  <p className="text-xs text-amber-600">
                    Locked until {fmtDate(locked)}
                  </p>
                )}
              </div>

              <div>
                {locked ? (
                  <div className={cn(
                    'w-full p-3 rounded-xl border bg-gray-50 text-gray-500',
                    'cursor-not-allowed select-none',
                  )}>
                    {value == null ? 'Not offered' : value.toLocaleString('en-US')}
                  </div>
                ) : (
                  <PriceInput
                    value={value}
                    onChange={(n) => {
                      setDraft(d => ({ ...d, [key]: n }));
                      onDirty?.();
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        A rate can be changed once every {COOLDOWN_DAYS} days, per category. Clearing
        a rate counts as a change. Your rates are never shown to clients or to other
        performers.
      </p>
    </div>
  );
});

TalentRates.displayName = 'TalentRates';
export default TalentRates;