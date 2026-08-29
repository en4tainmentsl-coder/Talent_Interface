// ═══════════════════════════════════════════════════════════════════════════
// r2-delete  —  En4tainment
// Deletes a sensitive asset from the private R2 bucket. Admin only.
//
// Removes the object from storage only. Clearing the DB reference
// (nic_*_public_id, or the documents row) is the caller's responsibility.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const ALLOWED_ORIGINS = [
  "https://www.en4tainment.com",
  "https://en4tainment.com",
  "https://app.en4tainment.com",
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

    const { data: roleRow } = await admin
      .from("profiles_users")
      .select("role")
      .eq("id", user.id)
      .single();

    if ((roleRow?.role ?? "").toLowerCase() !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const { object_key } = await req.json();
    if (!object_key || typeof object_key !== "string") {
      return json({ error: "object_key is required" }, 400);
    }

    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    });

    const objectUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${object_key}`;

    // ── Existence check BEFORE the delete ────────────────────────────────
    // R2 returns 204 from DELETE whether or not the key was there, so a bare
    // success response cannot distinguish "removed it" from "it was never
    // there". An erasure under PDPA s.16 has to be evidenced, not assumed —
    // and s.17(3) may require that record to be produced to the Authority.
    const beforeRes = await aws.fetch(objectUrl, { method: "HEAD" });

    if (beforeRes.status !== 200 && beforeRes.status !== 404) {
      console.error("R2 HEAD (before) failed:", beforeRes.status);
      return json({ error: "Storage check failed" }, 502);
    }
    const existedBefore = beforeRes.status === 200;

    const res = await aws.fetch(objectUrl, { method: "DELETE" });

    if (!res.ok && res.status !== 404) {
      const detail = await res.text();
      console.error("R2 delete failed:", res.status, detail);
      return json({ error: "Delete failed" }, 502);
    }

    // ── Confirm absence AFTER the delete ─────────────────────────────────
    // R2 is strongly consistent, so a 404 here is a real answer rather than
    // a race. Anything else means the object survived and the caller must
    // not be told the erasure succeeded.
    const afterRes = await aws.fetch(objectUrl, { method: "HEAD" });
    const verifiedAbsent = afterRes.status === 404;

    if (!verifiedAbsent) {
      console.error("R2 object still present after delete:", afterRes.status);
      return json({
        error: "Delete could not be verified",
        object_key,
        existed_before: existedBefore,
        verified_absent: false,
      }, 502);
    }

    return json({
      success: true,
      object_key,
      existed_before: existedBefore,
      verified_absent: true,
    });
    
  } catch (err) {
    console.error("r2-delete error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
