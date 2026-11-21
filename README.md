# Talent_Interface (En410)

The Talent-facing side of the En4tainment marketplace: a React PWA where
performers manage their profile, KYC, rates, quotes and bookings.

Deployed to **app.en4tainment.com** via Cloudflare Workers Builds on merge to
`main` — there is no GitHub deploy workflow and none is needed. The worker is
`talent-interface`; `talent-interface.en4tainment-sl.workers.dev` serves the
same deployment and has no service worker registered, which makes it the
reliable place to confirm what actually shipped.

Clients and Venues use a separate app, `Audience-Interface`, served at
www.en4tainment.com.

## Run locally

Prerequisites: Node.js.

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the two values. See that
   file for why the `VITE_` prefix is required and why Cloudflare needs them as
   **build** variables rather than runtime ones.
3. `npm run dev`

## What lives in the other repo

`Audience-Interface` is the single home for several things. This is deliberate,
not an accident of history.

| What | Where | Why |
|---|---|---|
| Database migrations | `Audience-Interface/supabase/migrations/` | D-015. **Never write a migration into this repo.** |
| Decision register | `Audience-Interface/docs/decisions.md` | Why the system is the way it is |
| Verified-wrong assumptions | `Audience-Interface/docs/corrections.md` | Read before designing on an unverified assumption |
| Legal documents | `Audience-Interface/docs/legal/` | See below |

## Legal documents describe this app but live elsewhere

Two of the documents in `Audience-Interface/docs/legal/` describe **En410**,
meaning this repo:

- `talent-privacy-policy.md`
- `talent-terms.md`

They are kept in one place on purpose. Two copies with one of them stale is
how the Talent calendar disclosure was silently lost during a previous
revision, and the same failure retired the old standalone decision register in
October 2026.

**The rule.** `Audience-Interface/docs/README.md` rule 2 says a PR that changes
behaviour a document describes changes the document in the same PR. That cannot
literally happen across two repos, so here it becomes: **open a companion PR on
Audience-Interface in the same sitting.** Not later, not on a list.

**Changes to these files should make you check the disclosures:**

- the OAuth scope list in `src/App.tsx` — the `calendar.events` scope is a
  *sensitive* scope and is exactly what a Google verification reviewer compares
  against the Talent privacy policy
- `src/utils/googleCalendar.ts` — what is read, written and deleted
- `src/components/CalendarPreview.tsx` — currently a passive read of the
  talent's whole primary calendar; being replaced by import-on-demand
- anything touching KYC documents, payout accounts, or what a Client or Venue
  can see about a Talent

**This rule depends on someone remembering it.** That is a real weakness and
should not be dressed up as equivalent to a same-repo rule. A CI check to
enforce it properly is tracked as Todoist `6hvJvq3WjcmmFM95`.

## Known trap

`src/supabase.ts` is a **hand-maintained** type file and has drifted from the
real schema at least twice — a column that does not exist in the database, and
a `talent_type` union missing `dj` and carrying `'3 piece'` instead of
`'3-piece'`. Prefer the generated `database.types.ts`. If you are reconciling
types, deleting `supabase.ts` outright is the better fix.
