// ═══════════════════════════════════════════════════════════════════════════
// r2-sign-upload  —  En4tainment
// Issues a short-lived presigned PUT URL so the browser can upload a
// sensitive asset directly to the private Cloudflare R2 bucket.
//
// Scope: kyc_front, kyc_back, venue_document ONLY.
// Public assets go via cloudinary-sign.
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

type AssetRule = {
  prefix: string;
  maxBytes: number;
  mime: string[];
};

const RULES: Record<string, AssetRule> = {
  kyc_front: {
    prefix: "en410/kyc",
    maxBytes: 8 * 1024 * 1024,
    mime: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  },
  kyc_back: {
    prefix: "en410/kyc",
    maxBytes: 8 * 1024 * 1024,
    mime: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  },
  venue_document: {
    prefix: "en4tainment/documents",
    maxBytes: 15 * 1024 * 1024,
    mime: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  },
};

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

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
    // ── Authenticate the caller ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // ── Validate the request ─────────────────────────────────────────────
    const {
      asset_type,
      content_type,
      size_bytes,
      talent_id,
      related_entity_id,
      file_name,
    } = await req.json();

    const rule = RULES[asset_type];
    if (!rule) {
      return json({
        error: `Unsupported asset_type: ${asset_type}. This endpoint handles ${Object.keys(RULES).join(", ")} only.`,
      }, 400);
    }

    if (!rule.mime.includes(content_type)) {
      return json({ error: `Content type not allowed: ${content_type}` }, 400);
    }

    if (typeof size_bytes !== "number" || size_bytes <= 0) {
      return json({ error: "size_bytes is required" }, 400);
    }
    if (size_bytes > rule.maxBytes) {
      return json({
        error: `File exceeds ${Math.round(rule.maxBytes / 1048576)}MB limit`,
      }, 400);
    }

    let ownerId: string;
    if (asset_type === "venue_document") {
      if (!related_entity_id) return json({ error: "related_entity_id is required" }, 400);
      if (!file_name)         return json({ error: "file_name is required" }, 400);
      ownerId = related_entity_id;
    } else {
      if (!talent_id) return json({ error: "talent_id is required" }, 400);
      ownerId = talent_id;
    }

    // ── Build an unguessable object key ──────────────────────────────────
    const objectKey =
      `${rule.prefix}/${ownerId}/${crypto.randomUUID()}.${EXT[content_type]}`;

    // ── Presign the PUT ──────────────────────────────────────────────────
    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    });

    const target = new URL(`${R2_ENDPOINT}/${R2_BUCKET}/${objectKey}`);
    target.searchParams.set("X-Amz-Expires", "300");

    const signed = await aws.sign(target.toString(), {
      method: "PUT",
      headers: { "content-type": content_type },
      aws: { signQuery: true },
    });

    return json({
      upload_url:     signed.url,
      object_key:     objectKey,
      storage_bucket: R2_BUCKET,
      content_type,
      expires_in:     300,
    });
  } catch (err) {
    console.error("r2-sign-upload error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});