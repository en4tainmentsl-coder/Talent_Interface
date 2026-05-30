import { supabase } from "../supabase";

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id:  string;
};

const PRESET_TO_ASSET_TYPE: Record<string, string> = {
  'en410_avatars':          'talent_avatar',
  'en410_artist_profile':   'talent_cover',
  'en410_artist_portfolio': 'talent_portfolio',
  'en410_artist_kyc':       'kyc_front',
}

export async function uploadToCloudinary(
  file:         File,
  uploadPreset: string,
  _tag?:        string
): Promise<CloudinaryUploadResult> {

  // 1. Map preset name to asset_type
  const assetType = PRESET_TO_ASSET_TYPE[uploadPreset]
  if (!assetType) throw new Error(`Unknown upload preset: ${uploadPreset}`)

  // 2. Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to upload files.')

  // 3. Get signature from Edge Function
  const { data: signData, error: signError } = await supabase.functions.invoke(
    'cloudinary-sign',
    { body: { asset_type: assetType, user_id: user.id } }
  )
  if (signError || !signData?.signature) {
    throw new Error(signError?.message ?? 'Failed to get upload signature')
  }

  const {
    signature,
    timestamp,
    cloud_name,
    api_key,
    upload_preset,
    folder,
    access_mode,
  } = signData

  // 4. Build FormData and upload directly to Cloudinary
  const formData = new FormData()
  formData.append('file',          file)
  formData.append('api_key',       api_key)
  formData.append('timestamp',     String(timestamp))
  formData.append('signature',     signature)
  formData.append('upload_preset', upload_preset)
  formData.append('folder',        folder)
  if (access_mode === 'authenticated') {
    formData.append('access_mode', 'authenticated')
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
    { method: 'POST', body: formData }
  )

  const result = await response.json()

  if (result.error) {
    throw new Error(result.error.message ?? 'Cloudinary upload failed')
  }

  return { secure_url: result.secure_url, public_id: result.public_id }
}