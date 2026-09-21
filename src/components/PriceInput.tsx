import React, { useLayoutEffect, useRef } from 'react';
import { cn } from '../utils';

// Starting-rate field. Whole rupees, shown with thousands separators as you type:
// 15000 -> 15,000. No decimals, and an empty rate shows as a blank field rather than 0.
//
// A browser number input cannot display separators, so this is a text input limited
// to digits, while the form still stores and sends a real number.
//
// Limits match the database constraint profiles_talent_pricing_range
// (> 0 and <= 10,000,000). The form schema enforces the range and requires a value;
// this component only stops more than 8 digits being typed.

const MAX_DIGITS = 8; // 10,000,000
const format = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

interface Props {
  value: number | null;
  onChange: (n: number | null) => void;
  invalid?: boolean;
}

export default function PriceInput({ value, onChange, invalid }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  // Where the cursor should land after re-formatting, counted in DIGITS rather than
  // characters, because inserting a comma shifts every character position.
  const caretDigits = useRef<number | null>(null);
  const display = value == null ? '' : format(value);

  useLayoutEffect(() => {
    const el = ref.current;
    const want = caretDigits.current;
    if (!el || want == null || document.activeElement !== el) return;
    caretDigits.current = null;
    let pos = 0;
    let seen = 0;
    while (pos < display.length && seen < want) {
      if (/\d/.test(display[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  }, [display]);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="e.g. 25,000"
      value={display}
      onChange={(e) => {
        // Drop anything from a decimal point onward. Otherwise pasting "25,000.00"
        // would strip the point and become 2,500,000 - a hundredfold error.
        const full = e.target.value;
        const cut = full.indexOf('.');
        const raw = cut >= 0 ? full.slice(0, cut) : full;
        const caret = Math.min(e.target.selectionStart ?? full.length, raw.length);
        let before = raw.slice(0, caret).replace(/\D/g, '').length;
        let digits = raw.replace(/\D/g, '');

        // Backspace just after a comma removes only the comma, leaving the digits
        // unchanged. Treat it as deleting the digit before the comma instead.
        const prev = value == null ? '' : String(value);
        if (digits === prev && raw.length < display.length && before > 0) {
          digits = digits.slice(0, before - 1) + digits.slice(before);
          before -= 1;
        }

        // No leading zeros, so a rate can never start with, or be, 0.
        const stripped = digits.replace(/^0+/, '');
        before = Math.max(0, before - (digits.length - stripped.length));
        digits = stripped;

        if (digits.length > MAX_DIGITS) return; // ignore keystrokes beyond the cap

        caretDigits.current = before;
        onChange(digits ? Number(digits) : null);
      }}
      className={cn(
        'w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none',
        invalid && 'border-red-500',
      )}
    />
  );
}
