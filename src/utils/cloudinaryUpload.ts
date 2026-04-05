import { supabase } from "../supabase";

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
};

/**
 * Gets a signed upload signature from the Edge Function,
 * then uploads the file directly to Cloudinary.
 */
export async function uploadToCloudinary(
  file: File,
  uploadPreset: string,
  tags?: string
): Promise<CloudinaryUploadResult> {
  // 1. Get the session token to pass to the Edge Function
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("You must be logged in to upload files.");

  // 2. Request a signed upload from our Edge Function
  const { data: signData, error: signError } = await supabase.functions.invoke(
    "cloudinary-sign",
    {
      body: { uploadPreset, tags: tags ?? null },
      headers: { Authorization: `Bearer ${session.access_token}` },
    }
  );

  if (signError) throw new Error(`Signing failed: ${signError.message}`);

  const { signature, timestamp, apiKey, cloudName } = signData;

  // 3. Build the FormData for Cloudinary
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  if (tags) formData.append("tags", tags);

  // 4. POST directly to Cloudinary
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error?.message ?? "Cloudinary upload failed"
    );
  }

  const result = await response.json();
  return { secure_url: result.secure_url, public_id: result.public_id };
}
