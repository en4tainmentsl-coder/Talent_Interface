// ═══════════════════════════════════════════════════════════════════════════
// upload-document  —  En4tainment
// Proxy upload for SENSITIVE assets (KYC, venue documents) into private R2.
//
// Replaces r2-sign-upload. A presigned PUT can only pin the *declared*
// Content-Type header, not the actual bytes, so it cannot support hard-block.
// This function receives the bytes, inspects them, and only then writes to R2.
//
// ORDER OF OPERATIONS (hard-block: nothing is stored until every gate passes)
//   1. authenticate via JWT
//   2. resolve ownership from the JWT  — client-sent ids are ignored
//   3. size check against ACTUAL received bytes
//   4. magic-byte check against ACTUAL content — declared mime is ignored
//   5. PUT to R2
//   6. write the DB row; on failure, delete the R2 object (no orphans)
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R2_ACCOUNT_ID        = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID     = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET            = Deno.env.get("R2_BUCKET")!;
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Single source of truth for the size cap.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MiB

const PREFIX: Record<string, string> = {
  kyc_front:      "en410/kyc",
  kyc_back:       "en410/kyc",
  venue_document: "en4tainment/documents",
};

// ── Magic-byte detection ───────────────────────────────────────────────────
// Deliberately hand-rolled for exactly four formats. The client's declared
// content-type is never consulted; the return value of this function is the
// only thing that decides what the file is.
type Detected = { mime: string; ext: string } | null;

function detect(bytes: Uint8Array): Detected {
  const at = (i: number) => bytes[i];
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...bytes.slice(start, start + len));

  // PDF: "%PDF-"
  if (bytes.length >= 5 && ascii(0, 5) === "%PDF-") {
    return { mime: "application/pdf", ext: "pdf" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 &&
    at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  // WebP: "RIFF" ....  "WEBP"
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  let uploadedKey: string | null = null;
  let aws: AwsClient | null = null;

  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Parse multipart ──────────────────────────────────────────────────
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "Expected multipart/form-data" }, 400);
    }

    const asset_type = String(form.get("asset_type") ?? "");
    const file = form.get("file");

    if (!PREFIX[asset_type]) {
      return json({
        error: `Unsupported asset_type. Expected one of: ${Object.keys(PREFIX).join(", ")}`,
      }, 400);
    }
    if (!(file instanceof File)) return json({ error: "file part is required" }, 400);

    // ── 2. Resolve ownership from the JWT. Client-sent ids are ignored. ──
    let ownerId: string;
    let venueId: string | null = null;

    if (asset_type === "venue_document") {
      const related_entity_id = String(form.get("related_entity_id") ?? "");
      if (!related_entity_id) return json({ error: "related_entity_id is required" }, 400);

      const { data: venueRow } = await admin
        .from("profiles_venues")
        .select("id")
        .eq("id", related_entity_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!venueRow) return json({ error: "Not authorised for this venue" }, 403);
      venueId = venueRow.id;
      ownerId = venueRow.id;
    } else {
      const { data: talentRow } = await admin
        .from("profiles_talent")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!talentRow) return json({ error: "No talent profile for this user" }, 403);
      ownerId = talentRow.id;
    }

    // ── 3. Size check on ACTUAL bytes ────────────────────────────────────
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.byteLength === 0) return json({ error: "Empty file" }, 400);
    if (buf.byteLength > MAX_BYTES) {
      return json({
        error: `File exceeds the ${Math.round(MAX_BYTES / 1048576)}MB limit`,
        max_bytes: MAX_BYTES,
        received_bytes: buf.byteLength,
      }, 413);
    }

    // ── 4. Magic-byte check. Declared mime is not consulted. ─────────────
    const kind = detect(buf);
    if (!kind) {
      return json({
        error: "File content is not a recognised JPEG, PNG, WebP or PDF",
      }, 415);
    }

    // ── 5. PUT to R2 ─────────────────────────────────────────────────────
    aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    });

    const objectKey = `${PREFIX[asset_type]}/${ownerId}/${crypto.randomUUID()}.${kind.ext}`;

    const putRes = await aws.fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${objectKey}`, {
      method: "PUT",
      body: buf,
      headers: { "content-type": kind.mime },
    });

    if (!putRes.ok) {
      console.error("R2 PUT failed:", putRes.status);
      return json({ error: "Storage write failed" }, 502);
    }
    uploadedKey = objectKey;

    // ── 6. Write the DB row ──────────────────────────────────────────────
    if (asset_type === "venue_document") {
      const file_name = String(form.get("file_name") ?? file.name ?? "document");

      const { error } = await admin.from("documents").insert({
        related_entity_type: "venue",
        related_entity_id:   venueId,
        file_name,
        storage_bucket:      R2_BUCKET,
        file_path:           objectKey,
        uploaded_by_user_id: user.id,
      });

      if (error) {
        console.error("documents insert failed:", error.code);
        throw new Error("db_write_failed");
      }

      return json({
        success: true,
        asset_type,
        object_key: objectKey,
        storage_bucket: R2_BUCKET,
        bytes: buf.byteLength,
        detected_type: kind.mime,
      });
    }

    // KYC. Status stays 'pending' here — advancing it before the set is
    // complete violates talent_identity_complete_when_submitted_check.
    const col = asset_type === "kyc_front" ? "nic_front_public_id" : "nic_back_public_id";

    const { error: upsertError } = await admin
      .from("talent_identity")
      .upsert({
        talent_id:          ownerId,
        [col]:              objectKey,
        nic_storage_bucket: R2_BUCKET,
        updated_at:         new Date().toISOString(),
      }, { onConflict: "talent_id" });

    if (upsertError) {
      console.error("talent_identity upsert failed:", upsertError.code);
      throw new Error("db_write_failed");
    }

    // Advance to 'submitted' only when all four pieces are present, and only
    // from 'pending' — so a verified talent is not knocked back by a re-upload.
    const { data: row } = await admin
      .from("talent_identity")
      .select("nic_hash, nic_last_four, nic_front_public_id, nic_back_public_id, kyc_status")
      .eq("talent_id", ownerId)
      .single();

    const complete = !!(
      row?.nic_hash && row?.nic_last_four &&
      row?.nic_front_public_id && row?.nic_back_public_id
    );

    if (complete && row?.kyc_status === "pending") {
      const { error: statusError } = await admin
        .from("talent_identity")
        .update({ kyc_status: "submitted", updated_at: new Date().toISOString() })
        .eq("talent_id", ownerId);
      if (statusError) console.error("kyc_status advance failed:", statusError.code);
    }

    return json({
      success: true,
      asset_type,
      object_key: objectKey,
      storage_bucket: R2_BUCKET,
      bytes: buf.byteLength,
      detected_type: kind.mime,
      kyc_status: complete ? "submitted" : "pending",
    });

  } catch (err) {
    // Reap the R2 object if it landed but the DB row did not. Without this,
    // a failed write leaves an unreferenced, undeletable object in the bucket.
    if (uploadedKey && aws) {
      try {
        await aws.fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${uploadedKey}`, { method: "DELETE" });
        console.error("rolled back R2 object after DB failure");
      } catch (cleanupErr) {
        console.error("R2 rollback FAILED — orphaned object:", uploadedKey, String(cleanupErr));
      }
    }

    if (err instanceof Error && err.message === "db_write_failed") {
      return json({ error: "Failed to save upload metadata" }, 500);
    }
    console.error("upload-document error:", String(err));
    return json({ error: "Internal server error" }, 500);
  }
});
