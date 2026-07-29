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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R2_ACCOUNT_ID        = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID     = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET            = Deno.env.get("R2_BUCKET")!;
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const DELIVERY_TTL_SECONDS = 120;

Deno.serve(async (req) => {
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

    const { asset_type, object_key, talent_id } = await req.json();

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
        subject_talent_id: asset_type === "venue_document"
          ? (talent_id ?? null)
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