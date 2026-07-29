// ═══════════════════════════════════════════════════════════════════════════
// cloudinaryUpload.ts  —  En4tainment / En410
// Uploads PUBLIC media assets to Cloudinary.
//
// Sensitive assets (NIC images) are NOT handled here — they go to the private
// Cloudflare R2 bucket via uploadToR2.ts. The KYC preset no longer exists in
// Cloudinary, so routing one here would fail at the API.
//
// There is no mock fallback: a fake success writes a random public_id to the
// database and shows the artist someone else's stock photo.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "../supabase";

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id:  string;
};

const PRESET_TO_ASSET_TYPE: Record<string, string> = {
  'en410_avatars':          'talent_avatar',
  'en410_artist_profile':   'talent_cover',
  'en410_artist_portfolio': 'talent_portfolio',
}

export async function uploadToCloudinary(
  file:         File,
  uploadPreset: string,
  _tag?:        string   // accepted for call-site compatibility; unused
): Promise<CloudinaryUploadResult> {

  const assetType = PRESET_TO_ASSET_TYPE[uploadPreset]
  if (!assetType) {
    throw new Error(
      `Unknown or unsupported upload preset: ${uploadPreset}. ` +
      `Identity documents must be uploaded via uploadToR2.`
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to upload files.')

  // ── 1. Signature ────────────────────────────────────────────────────────
  // Identity is resolved server-side from the JWT; no IDs are sent.
  const { data: signData, error: signError } = await supabase.functions.invoke(
    'cloudinary-sign',
    { body: { asset_type: assetType } }
  )

  if (signError || signData?.error || !signData?.signature) {
    console.error('cloudinary-sign failed:', signError, signData)
    throw new Error(
      signData?.error ?? signError?.message ?? 'Could not authorise upload. Please try again.'
    )
  }

  const {
    signature, timestamp, cloud_name, api_key,
    upload_preset, folder, resource_type,
  } = signData

  // ── 2. Upload ───────────────────────────────────────────────────────────
  const formData = new FormData()
  formData.append('file',          file)
  formData.append('api_key',       api_key)
  formData.append('timestamp',     String(timestamp))
  formData.append('signature',     signature)
  formData.append('upload_preset', upload_preset)
  formData.append('folder',        folder)

  // resource_type comes from the signer — 'auto' for portfolio so video and
  // audio are accepted, 'image' for avatars and covers.
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud_name}/${resource_type ?? 'image'}/upload`,
    { method: 'POST', body: formData }
  )

  const result = await response.json()

  if (result.error) {
    console.error('Cloudinary rejected upload:', result.error)
    throw new Error(result.error.message ?? 'Cloudinary upload failed')
  }

  if (!result.secure_url || !result.public_id) {
    throw new Error('Cloudinary returned an incomplete response')
  }

  return { secure_url: result.secure_url, public_id: result.public_id }
}