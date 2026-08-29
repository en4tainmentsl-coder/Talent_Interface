// ═══════════════════════════════════════════════════════════════════════════
// r2-deliver  —  En4tainment
// Issues a short-lived presigned GET URL for a sensitive asset.
//
// Every successful delivery writes to sensitive_asset_access_log BEFORE the
// URL is issued. A logging failure blocks delivery — there is no path to
// viewing an identity document that leaves no trace.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

// NOTE: this list deliberately DIVERGES from the other six functions.
// admin.en4tainment.com is added here only. The Directus KYC review
// extension calls r2-deliver from that origin; nothing in the admin panel
// has any reason to call cloudinary-sign, upload-document or the delete
// functions, and granting it there would widen their surface for no gain.
// If the panel ever needs one of those, add it deliberately rather than
// inheriting it.
const ALLOWED_ORIGINS = [
  "https://www.en4tainment.com",
  "https://en4tainment.com",
  "https://app.en4tainment.com",
  "https://admin.en4tainment.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

// Origin allowlist rather than "*". Every caller of this function sends a JWT
// in the Authorization header and a hostile origin cannot read a Supabase
// session out of localStorage, so the wildcard was not an open door -- but it
// is defence in depth, and the three Cloudinary functions already do this.
// Kept byte-identical to the implementation in cloudinary-sign.
//
// Falls back to the canonical origin rather than echoing an unknown one, so an
// unlisted origin gets a response the browser refuses instead of a permissive
// one. Vary: Origin stops a cache serving one origin"s response to another.
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const R2_ACCOUNT_ID        = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID     = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET            = Deno.env.get("R2_BUCKET")!;
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const DELIVERY_TTL_SECONDS = 120;

Deno.serve(async (req) => {
  const corsHeaders = cors(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Authenticate ─────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // talent_id is deliberately NOT read from the body. It used to be, and was
    // written straight into the audit log — see the audit block below.
    const { asset_type, object_key } = await req.json();

    if (!["kyc_front", "kyc_back", "venue_document"].includes(asset_type)) {
      return json({ error: "Unsupported asset_type" }, 400);
    }
    if (!object_key || typeof object_key !== "string") {
      return json({ error: "object_key is required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Role check ───────────────────────────────────────────────────────
    // .toLowerCase() guards against the known 'User' vs 'user' default drift.
    const { data: roleRow } = await admin
      .from("profiles_users")
      .select("role")
      .eq("id", user.id)
      .single();

    let permitted = (roleRow?.role ?? "").toLowerCase() === "admin";

    // ── Confirm the key is referenced by a real row ──────────────────────
    // Stops an admin enumerating the bucket with guessed keys.
    let referenced = false;
    let subjectEntityId: string | null = null;

    if (asset_type === "venue_document") {
      const { data } = await admin
        .from("documents")
        .select("id, related_entity_id, uploaded_by_user_id")
        .eq("file_path", object_key)
        .eq("storage_bucket", R2_BUCKET)
        .maybeSingle();

      if (data) {
        referenced = true;
        subjectEntityId = data.related_entity_id;
        // The original uploader may read their own document back.
        if (!permitted && data.uploaded_by_user_id === user.id) permitted = true;
      }
    } else {
      const col = asset_type === "kyc_front"
        ? "nic_front_public_id"
        : "nic_back_public_id";

      const { data } = await admin
        .from("talent_identity")
        .select("id, talent_id")
        .eq(col, object_key)
        .eq("nic_storage_bucket", R2_BUCKET)
        .maybeSingle();

      if (data) {
        referenced = true;
        subjectEntityId = data.talent_id;
      }
    }

    // 403 before 404 so response codes can't be used to probe what exists.
    if (!permitted)  return json({ error: "Forbidden" }, 403);
    if (!referenced) return json({ error: "Not found" }, 404);

    // ── Audit BEFORE issuing the URL ─────────────────────────────────────
    const { error: logError } = await admin
      .from("sensitive_asset_access_log")
      .insert({
        accessed_by_user_id: user.id,
        asset_type,
        object_key,
        storage_bucket: R2_BUCKET,
        // subject_talent_id is the TALENT whose identity document is being
        // read. A venue document has no talent subject — its subject is the
        // venue, and that is already carried by subject_entity_id below. So
        // this is null on that branch rather than being filled from the body.
        //
        // It previously read `talent_id ?? null` from the request body. The
        // caller is the party being audited, so letting them supply a field
        // that lands in the audit row let them attribute their own access to
        // an arbitrary talent, or null it out. Every other identity field in
        // this insert comes from the verified JWT or from a row looked up
        // server-side; this was the exception.
        //
        // Note the table has no foreign keys, so nothing at the database level
        // would have rejected a fabricated uuid either.
        subject_talent_id: asset_type === "venue_document"
          ? null
          : subjectEntityId,
        subject_entity_id: asset_type === "venue_document"
          ? subjectEntityId
          : null,
        ip_address: req.headers.get("cf-connecting-ip")
          ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim()
          ?? null,
        user_agent: req.headers.get("user-agent"),
      });

    if (logError) {
      console.error("audit write failed:", logError);
      return json({ error: "Access logging failed" }, 500);
    }

    // ── Presign the GET ──────────────────────────────────────────────────
    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    });

    const target = new URL(`${R2_ENDPOINT}/${R2_BUCKET}/${object_key}`);
    target.searchParams.set("X-Amz-Expires", String(DELIVERY_TTL_SECONDS));

    const signed = await aws.sign(target.toString(), {
      method: "GET",
      aws: { signQuery: true },
    });

    return json({
      url:        signed.url,
      expires_in: DELIVERY_TTL_SECONDS,
    });
  } catch (err) {
    console.error("r2-deliver error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
