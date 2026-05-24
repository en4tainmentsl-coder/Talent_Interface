# En4tainment — Edge Functions: Deployment & Testing Guide

## Folder structure produced

supabase/
  functions/
    _shared/
      cors.ts              ← shared CORS headers (all functions import this)
      assetConfig.ts       ← maps asset_type → folder, preset, access_mode
    cloudinary-sign/
      index.ts             ← generates SHA-1 upload signature for browser
    process-upload/
      index.ts             ← saves Cloudinary metadata to Supabase DB
    cloudinary-delete/
      index.ts             ← deletes from Cloudinary + clears DB reference
    cloudinary-kyc-deliver/
      index.ts             ← generates signed delivery URL for KYC (admin only)

---

## Step 1 — Prerequisites

Install the Supabase CLI if you haven't already:
  https://supabase.com/docs/guides/cli/getting-started

Log in:
  supabase login

Link your project (run once per repo, from the repo root):
  supabase link --project-ref YOUR_PROJECT_REF

Your project ref is the subdomain in your Supabase URL:
  https://abcdefghijkl.supabase.co  →  project ref = abcdefghijkl

---

## Step 2 — Copy the functions folder

Place the entire supabase/ folder in the ROOT of whichever repo
you want to deploy from. Either Audience-Interface or Talent_Interface
will work — the functions are shared infrastructure.

Your repo root should look like:
  src/
  supabase/
    functions/
      _shared/
      cloudinary-sign/
      process-upload/
      cloudinary-delete/
      cloudinary-kyc-deliver/
  package.json
  vite.config.ts
  ...

---

## Step 3 — Add secrets to Supabase Dashboard

Go to: Supabase Dashboard → Edge Functions → Manage secrets

Add these three (the fourth is auto-injected by Supabase):

  CLOUDINARY_CLOUD_NAME    your Cloudinary cloud name
  CLOUDINARY_API_KEY       numeric API key from Cloudinary dashboard
  CLOUDINARY_API_SECRET    API secret from Cloudinary dashboard

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already present —
Supabase injects these automatically, you do not need to add them.

---

## Step 4 — Deploy all four functions

From your repo root, run one command per function:

  supabase functions deploy cloudinary-sign
  supabase functions deploy process-upload
  supabase functions deploy cloudinary-delete
  supabase functions deploy cloudinary-kyc-deliver

Or deploy all at once:
  supabase functions deploy

After deployment you should see all four listed in:
  Supabase Dashboard → Edge Functions

---

## Step 5 — Test cloudinary-sign with curl

Replace YOUR_PROJECT_REF and YOUR_ANON_KEY with your real values.

  curl -X POST \
    'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cloudinary-sign' \
    -H 'Authorization: Bearer YOUR_ANON_KEY' \
    -H 'Content-Type: application/json' \
    -d '{"asset_type":"talent_avatar","user_id":"test-user-123"}'

Expected response:
  {
    "signature": "a3f9c2...",
    "timestamp": 1716000000,
    "cloud_name": "...",
    "api_key": "...",
    "upload_preset": "en410_avatars",
    "folder": "en410/avatars",
    "resource_type": "image",
    "access_mode": "public"
  }

---

## Valid asset_type values

  talent_avatar      → en410/avatars,      preset: en410_avatars
  talent_cover       → en410/profiles,     preset: en410_artist_profile
  talent_portfolio   → en410/portfolio,    preset: en410_artist_portfolio
  kyc_front          → en410/kyc,          preset: en410_artist_kyc  (authenticated)
  kyc_back           → en410/kyc,          preset: en410_artist_kyc  (authenticated)
  client_avatar      → en4tainment/avatars, preset: en4tainment_avatars
  venue_avatar       → en4tainment/avatars, preset: en4tainment_avatars
  venue_document     → en4tainment/documents, preset: en4tainment_documents (authenticated)

---

## Notes on the DB columns assumed

process-upload writes to these columns. If your actual column names differ,
update process-upload/index.ts accordingly:

  profiles_talent   : avatar_url, avatar_public_id, cover_url, cover_public_id
  talent_media      : talent_id, public_id, secure_url, resource_type, bytes, width, height, sort_order
  talent_identity   : talent_id, kyc_id_front_public_id, kyc_id_back_public_id, kyc_status
  profiles_clients  : avatar_url, avatar_public_id
  profiles_venues   : avatar_url, avatar_public_id
  documents         : uploaded_by_user_id, venue_id, public_id, resource_type, bytes
