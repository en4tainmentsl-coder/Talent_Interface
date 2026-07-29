// ═══════════════════════════════════════════════════════════════════════════
// r2-delete  —  En4tainment
// Deletes a sensitive asset from the private R2 bucket. Admin only.
//
// Removes the object from storage only. Clearing the DB reference
// (nic_*_public_id, or the documents row) is the caller's responsibility.
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

    const res = await aws.fetch(
      `${R2_ENDPOINT}/${R2_BUCKET}/${object_key}`,
      { method: "DELETE" },
    );

    // R2 returns 204 on success, and also when the key never existed.
    if (!res.ok && res.status !== 404) {
      const detail = await res.text();
      console.error("R2 delete failed:", res.status, detail);
      return json({ error: "Delete failed" }, 502);
    }

    return json({ success: true, object_key });
  } catch (err) {
    console.error("r2-delete error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});