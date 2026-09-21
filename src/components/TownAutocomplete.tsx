import React, { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { cn } from '../utils';

// Town picker for the talent's base location.
//
// The talent types, matching towns appear, and they choose one. The chosen town's
// id is saved as profiles_talent.base_town_id; base_latitude / base_longitude are
// then DERIVED from it by a database trigger (migration 20260921100000) and are never
// sent by the client. That matters because travel is charged on distance (D-005).
//
// Rules (decided 2026-09-21, Todoist 6hX929667RvXHPm5):
// - Must pick from the list. Typing clears any previous pick, and the form refuses
//   to save until a town is chosen, so free text can never stand in for a town.
// - Suggestions show the district ("Athurugiriya, Colombo") because town names
//   repeat across districts.
// - Data: GeoNames, CC BY 4.0. The attribution line below is a licence requirement.

export type TownPick = { id: number; label: string };

type TownRow = { id: number; name: string; label: string; rank: number };

interface Props {
  /** Text shown in the field (the form's primary_location). */
  value: string;
  /** The currently chosen town, or null if none has been picked. */
  townId: number | null;
  /** pick is null while the talent is typing; set once they choose a town. */
  onChange: (pick: TownPick | null, text: string) => void;
  invalid?: boolean;
}

const MIN_CHARS = 2;
const MAX_SHOWN = 8;
const DEBOUNCE_MS = 200;

// % and _ are wildcards in ILIKE; escape them so they match literally.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m);

export default function TownAutocomplete({ value, townId, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<TownRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  const requestId = useRef(0);
  const listId = useId();

  // Search as the talent types. Only runs while the list is open, so a saved town
  // loading into the field doesn't trigger a search.
  useEffect(() => {
    if (!open) return;
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setResults([]);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('towns')
        .select('id, name, label, rank')
        .ilike('name', `%${escapeLike(q)}%`)
        .order('rank', { ascending: false })
        .limit(40);

      // Ignore responses that arrive after a newer keystroke.
      if (id !== requestId.current) return;

      setLoading(false);
      if (error) {
        console.error('Town search failed:', error);
        setFailed(true);
        setResults([]);
        return;
      }
      setFailed(false);

      // Best matches first: well-known towns, then names that START with what was
      // typed, then shorter names.
      const lower = q.toLowerCase();
      const sorted = ((data ?? []) as TownRow[]).sort(
        (a, b) =>
          b.rank - a.rank ||
          Number(b.name.toLowerCase().startsWith(lower)) -
            Number(a.name.toLowerCase().startsWith(lower)) ||
          a.name.length - b.name.length,
      );
      setResults(sorted.slice(0, MAX_SHOWN));
      setActive(-1);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, open]);

  const pick = (t: TownRow) => {
    onChange({ id: t.id, label: t.label }, t.label);
    setOpen(false);
    setResults([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      // Without this, Enter would submit the whole profile form.
      e.preventDefault();
      if (active >= 0) pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && value.trim().length >= MIN_CHARS;

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Start typing your town"
        value={value}
        onChange={(e) => {
          // Any edit discards the previous pick: the text no longer names a chosen town.
          onChange(null, e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (!townId && value.trim().length >= MIN_CHARS) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none',
          invalid && 'border-red-500',
        )}
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border bg-white shadow-lg"
        >
          {loading && results.length === 0 && (
            <li className="p-3 text-sm text-gray-500">Searching…</li>
          )}
          {!loading && failed && (
            <li className="p-3 text-sm text-red-600">Couldn't load towns. Please try again.</li>
          )}
          {!loading && !failed && results.length === 0 && (
            <li className="p-3 text-sm text-gray-500">No towns match. Check the spelling, or try a nearby town.</li>
          )}
          {results.map((t, i) => (
            <li
              key={t.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: it fires before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(t);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm',
                i === active ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-gray-50',
              )}
            >
              {t.label}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-xs text-gray-500">
        {townId
          ? 'Travel charges are measured from the centre of this town.'
          : 'Start typing, then choose your town from the list.'}
      </p>
      <p className="text-[10px] text-gray-400">
        Town list:{' '}
        <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer" className="underline">
          GeoNames
        </a>
        , CC BY 4.0
      </p>
    </div>
  );
}
