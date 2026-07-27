## What does this change?

<!-- One or two sentences. What problem does this solve? -->

## Which repo(s) / systems does this touch?

- [ ] Audience-Interface
- [ ] Talent_Interface (En410)
- [ ] en4-webhook-service
- [ ] NocoBase / admin config
- [ ] Supabase schema (migrations, RLS, functions)

## Schema changes?

- [ ] No schema changes
- [ ] Yes — migration file included and tested against a Supabase branch/local instance first

## Checklist

- [ ] I ran this locally and it builds without errors
- [ ] No secrets, API keys, or `.env` values are included in this diff
- [ ] I updated `.env.example` if new environment variables were added
- [ ] If this touches RLS policies, I re-checked role casing (`'talent'`, `'client'`, `'venue'`, `'admin'` — lowercase)

## Notes for reviewer (or future me)

<!-- Anything that needs context: why a workaround was used, what to test manually, known follow-ups -->
