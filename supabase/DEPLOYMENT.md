Edge Functions — deployment
This directory is the source of record for the Supabase Edge Functions of the
En4tainment platform. Migrations do not live here — they belong to
`Audience-Interface/supabase/migrations/`. That split is deliberate; do not
add migrations to this repo.
Deployment is manual and deliberate. There is no deploy-on-merge, because
deploy ordering sometimes matters (see Ordering below).
---
What is deployed is not necessarily what is here
Three separate paths can change a function in production, and only one of them
updates this directory:
Path	Changes production	Changes this repo
Supabase Dashboard editor	yes	no
`supabase functions deploy`	yes	no
Committing a file here	no	yes
This has caused four production incidents. `.github/workflows/edge-function-drift.yml`
now compares the two nightly and on every PR touching `supabase/functions/**`,
and fails the build on any difference.
A green drift check means "repo matches production". It does not mean
"production is current". After merging a change you must still deploy it,
and the check will fail until you do.
---
Deploying
1. Make sure your working tree is what you think it is
```bash
git checkout main
git pull origin main
git status --short
```
`supabase functions deploy` ships what is on your local disk, not what is
on GitHub. It does not check, and it does not warn.
This is not hypothetical: on 2026-08-28 a deploy from a Codespace whose `main`
was months behind pushed an ancient `cloudinary-sign` to production — no
`public_id` generation, wildcard CORS, referencing a function that no longer
existed. The CLI printed success. Nothing surfaced the regression until the
deployed source was read back by hand.
2. Verify the specific file you are about to deploy
```bash
wc -l supabase/functions/<slug>/index.ts
grep -c "<a string you expect to be present>" supabase/functions/<slug>/index.ts
```
Cheap, and it is the check that would have prevented the incident above.
Verify before the irreversible action, not after it.
3. Deploy one named function
```bash
npx -y supabase@latest functions deploy <slug> --project-ref sqovyodycuyajmumcjnn
```
Name the slug. A bare `supabase functions deploy` pushes all functions and
gives up control of ordering.
If the CLI is not installed, `npx` is preferred over a global install so
nothing is added to `package.json`. Authenticate with
`npx -y supabase@latest login` rather than exporting `SUPABASE_ACCESS_TOKEN` —
the login persists to `~/.supabase` and survives new terminals, an exported
variable does not.
4. Verify the deploy actually took
Read the deployed source back — via the Supabase dashboard, or
`supabase functions download --use-api --project-ref sqovyodycuyajmumcjnn`
into a scratch checkout. Confirm the version number incremented and the
content is what you expect.
Or push a commit and let the drift check do it: it fails if the repo and
production disagree.
Do not treat the CLI's success message as verification. It reports that an
upload completed, not that the correct code is live.
---
Ordering
When a change spans two functions that must agree, deploy in the order that
keeps the system working in the intermediate state.
Worked example — the `public_id` namespace binding of 2026-08-28, where
`cloudinary-sign` began issuing prefixed ids and `process-upload` began
requiring them:
`cloudinary-sign` first → issues prefixed ids; the old `process-upload`
accepts anything. Uploads keep working throughout.
`process-upload` first → rejects every id, because `cloudinary-sign` is
still issuing the old format. Every upload breaks until the second
deploy lands.
Work out which order degrades gracefully before deploying, not after.
---
Secrets
Set in the Supabase dashboard under Project Settings → Edge Functions →
Secrets. They are shared by every function in the project.
`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically and do not need adding.
A secret must exist before the function that reads it is deployed.
Functions that require one should fail closed with an explicit
"Server misconfiguration" error rather than proceeding without it — a missing
secret should look like a misconfiguration, not like a broken feature.
---
Staging
There is no staging project yet. When there is, it needs its own secrets —
its own Cloudinary account, its own R2 bucket, and its own NIC HMAC key.
Deploying these functions to a staging project without changing those values
means staging writes to, and deletes from, production storage.
Staging origins must also be added to the `ALLOWED_ORIGINS` array in every
function that has one, or browser calls from staging fail CORS preflight with
an error that looks like a bug rather than a config gap.
---
What this document deliberately does not contain
No list of deployed functions, no database column names, no expected response
shapes. The previous version of this file carried all three and every one of
them was wrong by the time anyone read it — it described a `_shared/`
directory that no longer exists, a function that was never deployed, omitted
four that were, and listed column names that had since been renamed.
The source is the inventory. The drift check enforces it. This file covers
process and hazards only, because those are what stay true.
