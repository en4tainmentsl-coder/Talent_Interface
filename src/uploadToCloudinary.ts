// ═══════════════════════════════════════════════════════════════════════════
// uploadToCloudinary.ts  —  En4tainment / En410
// Shared client utility for uploading media assets to Cloudinary.
//
// FLOW:
//   1. Call cloudinary-sign Edge Function → get signature + upload params
//   2. Upload file directly from browser to Cloudinary
//   3. Call process-upload Edge Function → save metadata to Supabase DB
//
// USAGE:
//   import { uploadToCloudinary } from 'src/supabase.ts'
//
//   const result = await uploadToCloudinary({
//     file:      selectedFile,
//     assetType: 'talent_avatar',
//     userId:    user.id,
//     talentId:  talentProfile.id,
//   })
//
//   if (result.success) {
//     console.log(result.secureUrl)   // use for display
//     console.log(result.publicId)    // stored in DB
//   }
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export type AssetType =
  | 'talent_avatar'
  | 'talent_cover'
  | 'talent_portfolio'
  | 'kyc_front'
  | 'kyc_back'
  | 'client_avatar'
  | 'venue_avatar'
  | 'venue_document'

export interface UploadOptions {
  file:       File
  assetType:  AssetType
  userId:     string        // auth user UUID — always required
  talentId?:  string        // profiles_talent.id — required for talent/kyc assets
  clientId?:  string        // profiles_clients.id — required for client assets
  venueId?:   string        // profiles_venues.id  — required for venue assets
  sortOrder?: number        // 0-based index for talent_portfolio items
  onProgress?: (percent: number) => void  // optional upload progress callback
}

export interface UploadResult {
  success:    true
  publicId:   string
  secureUrl:  string | null  // null for KYC assets (access_mode=authenticated)
  resourceType: string
  bytes:      number
  width:      number | null
  height:     number | null
}

export interface UploadError {
  success: false
  error:   string
  stage:   'sign' | 'upload' | 'save'  // which step failed
}

// ── KYC asset types — these never store secure_url ───────────────────────────
const KYC_ASSET_TYPES: AssetType[] = ['kyc_front', 'kyc_back']

// ── Main upload function ──────────────────────────────────────────────────────
export async function uploadToCloudinary(
  options: UploadOptions
): Promise<UploadResult | UploadError> {
  const {
    file,
    assetType,
    userId,
    talentId,
    clientId,
    venueId,
    sortOrder = 0,
    onProgress,
  } = options

  const isKyc = KYC_ASSET_TYPES.includes(assetType)

  // ── Validate required profile ID is present ──────────────────────────────
  if (['talent_avatar', 'talent_cover', 'talent_portfolio', 'kyc_front', 'kyc_back'].includes(assetType) && !talentId) {
    return { success: false, error: 'talentId is required for this asset type', stage: 'sign' }
  }
  if (assetType === 'client_avatar' && !clientId) {
    return { success: false, error: 'clientId is required for client_avatar', stage: 'sign' }
  }
  if (['venue_avatar', 'venue_document'].includes(assetType) && !venueId) {
    return { success: false, error: 'venueId is required for venue assets', stage: 'sign' }
  }

  // ── Step 1: Get signature from Edge Function ─────────────────────────────
  onProgress?.(5)

  const { data: signData, error: signError } = await supabase.functions.invoke(
    'cloudinary-sign',
    { body: { asset_type: assetType, user_id: userId } }
  )

  if (signError || !signData?.signature) {
    console.error('cloudinary-sign error:', signError)
    return {
      success: false,
      error:   signError?.message ?? 'Failed to get upload signature',
      stage:   'sign',
    }
  }

  const { signature, timestamp, cloud_name, api_key, upload_preset, folder, access_mode } = signData

  // ── Step 2: Upload directly from browser to Cloudinary ──────────────────
  onProgress?.(15)

  const formData = new FormData()
  formData.append('file',          file)
  formData.append('api_key',       api_key)
  formData.append('timestamp',     String(timestamp))
  formData.append('signature',     signature)
  formData.append('upload_preset', upload_preset)
  formData.append('folder',        folder)

  // KYC assets require access_mode in the upload call
  if (access_mode === 'authenticated') {
    formData.append('access_mode', 'authenticated')
  }

  let cloudinaryData: Record<string, unknown>

  try {
    // Use XMLHttpRequest instead of fetch so we can track upload progress
    cloudinaryData = await uploadWithProgress(
      `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
      formData,
      (percent) => onProgress?.(15 + Math.round(percent * 0.7)) // 15–85% range
    )
  } catch (err) {
    console.error('Cloudinary upload error:', err)
    return {
      success: false,
      error:   'Failed to upload file to Cloudinary',
      stage:   'upload',
    }
  }

  if (cloudinaryData.error) {
    const msg = (cloudinaryData.error as { message: string }).message
    console.error('Cloudinary rejected upload:', msg)
    return { success: false, error: msg, stage: 'upload' }
  }

  onProgress?.(85)

  const publicId    = cloudinaryData.public_id    as string
  const secureUrl   = cloudinaryData.secure_url   as string
  const resourceType = cloudinaryData.resource_type as string
  const bytes       = cloudinaryData.bytes        as number
  const width       = (cloudinaryData.width       as number) ?? null
  const height      = (cloudinaryData.height      as number) ?? null

  // ── Step 3: Save metadata to Supabase via process-upload ────────────────
  const processBody: Record<string, unknown> = {
    asset_type:    assetType,
    user_id:       userId,
    public_id:     publicId,
    resource_type: resourceType,
    bytes,
    width,
    height,
    sort_order:    sortOrder,
  }

  // Only send secure_url for public assets — never for KYC
  if (!isKyc) processBody['secure_url'] = secureUrl

  // Attach the correct profile ID
  if (talentId) processBody['talent_id'] = talentId
  if (clientId) processBody['client_id'] = clientId
  if (venueId)  processBody['venue_id']  = venueId

  const { error: processError } = await supabase.functions.invoke(
    'process-upload',
    { body: processBody }
  )

  if (processError) {
    console.error('process-upload error:', processError)
    return {
      success: false,
      error:   processError.message ?? 'Failed to save upload metadata',
      stage:   'save',
    }
  }

  onProgress?.(100)

  return {
    success:      true,
    publicId,
    secureUrl:    isKyc ? null : secureUrl,
    resourceType,
    bytes,
    width,
    height,
  }
}

// ── XMLHttpRequest wrapper with progress tracking ────────────────────────────
function uploadWithProgress(
  url:      string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded / e.total)
      }
    })

    xhr.addEventListener('load', () => {
      try {
        resolve(JSON.parse(xhr.responseText))
      } catch {
        reject(new Error('Invalid JSON response from Cloudinary'))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

    xhr.open('POST', url)
    xhr.send(formData)
  })
}
