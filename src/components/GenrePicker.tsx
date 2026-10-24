import React, { useId, useMemo, useRef, useState } from 'react';
import { cn } from '../utils';

// Genre picker: one combobox, three labelled slots.
//
// Writes to profiles_talent.primary_/secondary_/tertiary_genre_id (uuid FKs).
// primary_genre_id is NOT NULL, and profiles_talent_genres_distinct_check
// requires the three to be distinct AND secondary to be set whenever tertiary
// is. Both rules are structural here: picks always fill the first empty slot
// and removals compact, so a gap can never exist.
//
// Decided 2026-10-22 (Todoist 6hpXW456pH9w35QX). Replaces three <select>
// elements. Unlike TownAutocomplete there is no network per keystroke — the
// active genre list is already in memory — and the list OPENS ON FOCUS, because
// a talent who never types still has to discover that Baila exists.

export type GenreRow = { id: string; genre_name: string };

interface Props {
  options: GenreRow[];
  /** [primary, secondary, tertiary] — ids, '' for empty. Never gapped. */
  value: [string, string, string];
  onChange: (next: [string, string, string]) => void;
  invalid?: boolean;
}

const SLOT_LABELS = ['Primary', 'Second', 'Third'] as const;

export default function GenrePicker({ options, value, onChange, invalid }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const picked = value.filter(Boolean);
  const full = picked.length >= 3;

  const byId = useMemo(
    () => Object.fromEntries(options.map((o) => [o.id, o.genre_name])),
    [options],
  );

  // Already-picked genres never appear in the list: the distinct rule becomes
  // unreachable rather than merely validated.
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    return options
      .filter((o) => !picked.includes(o.id))
      .filter((o) => !q || o.genre_name.toLowerCase().includes(q));
  }, [options, picked, text]);

  const commit = (next: string[]) => {
    const compact = next.filter(Boolean).slice(0, 3);
    onChange([compact[0] ?? '', compact[1] ?? '', compact[2] ?? ''] as [string, string, string]);
  };

  const add = (id: string) => {
    commit([...picked, id]);
    setText('');
    setActive(-1);
    setOpen(false);
  };

  const remove = (i: number) => commit(picked.filter((_, j) => j !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= picked.length) return;
    const next = [...picked];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      // Without this, Enter submits the whole profile form.
      e.preventDefault();
      if (active >= 0) add(matches[active].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={full}
          placeholder={full ? 'Three genres chosen' : 'Choose a genre, or start typing'}
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => !full && setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(
            'w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none',
            full && 'bg-gray-100 text-gray-500',
            invalid && 'border-red-500',
          )}
        />

        {open && !full && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border bg-white shadow-lg"
          >
            {matches.length === 0 && (
              <li className="p-3 text-sm text-gray-500">No genres match that.</li>
            )}
            {matches.map((g, i) => (
              <li
                key={g.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: it fires before the input's blur closes the list.
                onMouseDown={(e) => { e.preventDefault(); add(g.id); }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm',
                  i === active ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-gray-50',
                )}
              >
                {g.genre_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {picked.length > 0 && (
        <ul className="space-y-1">
          {picked.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-xs font-medium text-gray-500">{SLOT_LABELS[i]}</span>
              <span className="flex-1">{byId[id] ?? 'Unknown genre'}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                aria-label={`Move ${byId[id]} up`} className="px-1 text-gray-400 disabled:opacity-30 hover:text-gray-700">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1}
                aria-label={`Move ${byId[id]} down`} className="px-1 text-gray-400 disabled:opacity-30 hover:text-gray-700">↓</button>
              <button type="button" onClick={() => remove(i)}
                aria-label={`Remove ${byId[id]}`} className="px-1 text-gray-400 hover:text-red-600">✕</button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-500">
        {picked.length === 0
          ? 'Pick up to three. The first is your primary genre and shows on your profile card.'
          : 'The first genre shows on your profile card. Reorder with the arrows.'}
      </p>
    </div>
  );
}