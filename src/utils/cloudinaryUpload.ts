// ═══════════════════════════════════════════════════════════════════════════
// uploadToCloudinary.ts  —  En4tainment / En410
// Client utility for uploading PUBLIC media assets to Cloudinary.
//
// Sensitive assets (kyc_front, kyc_back, venue_document) are NOT handled here.
// They live in a private Cloudflare R2 bucket — see uploadToR2.ts.
//
// FLOW:
//   0. client-side size check (not a security boundary — see MAX_BYTES note)
//   1. cloudinary-sign  → signature + upload params
//   2. Direct browser upload to Cloudinary
//   3. process-upload   → persist metadata in Supabase
//
// USAGE:
//   import { uploadToCloudinary } from './uploadToCloudinary'
//
//   const result = await uploadToCloudinary({
//     file:      selectedFile,
//     assetType: 'talent_avatar',
//   })
//
//   if (result.success) console.log(result.secureUrl)
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export type AssetType =
  | 'talent_avatar'
  | 'talent_cover'
  | 'talent_portfolio'
  | 'client_avatar'
  | 'venue_avatar'

// talent_media.media_type — talent_portfolio only
export type MediaType =
  | 'profile_photo'
  | 'gallery'
  | 'trailer'
  | 'live_performance'
  | 'press_kit'
  | 'document'

export interface UploadOptions {
  file:        File
  assetType:   AssetType
  mediaType?:  MediaType   // talent_portfolio only, defaults to 'gallery'
  title?:      string      // talent_portfolio only
  sortOrder?:  number      // talent_portfolio only, 0-based
  onProgress?: (percent: number) => void
}

export interface UploadResult {
  success:      true
  publicId:     string
  secureUrl:    string
  resourceType: string
  bytes:        number
  width:        number | null
  height:       number | null
}

export interface UploadError {
  success: false
  error:   string
  stage:   'sign' | 'upload' | 'save'
}

// Client-side guard only — the real enforcement is server-side in
// process-upload, which checks the size Cloudinary reports after upload
// and deletes+rejects if it's over. This check exists purely so a user
// gets instant feedback instead of waiting through a multi-MB upload only
// to have it rejected afterwards. Keep this in sync with process-upload's
// MAX_BYTES and upload-document's MAX_BYTES — all three are independent
// constants in separate files/languages, no shared source of truth.
const MAX_BYTES = 5 * 1024 * 1024 // 5 MiB

// ── Main upload function ─────────────────────────────────────────────────────
export async function uploadToCloudinary(
  options: UploadOptions
): Promise<UploadResult | UploadError> {
  const { file, assetType, mediaType, title, sortOrder = 0, onProgress } = options

  // ── Step 0: Client-side size check ───────────────────────────────────────
  if (file.size > MAX_BYTES) {
    return {
      success: false,
      error:   `File exceeds the ${Math.round(MAX_BYTES / 1048576)}MB limit`,
      stage:   'sign',
    }
  }

  // ── Step 1: Get signature from Edge Function ─────────────────────────────
  // Identity comes from the session JWT — no IDs are sent from the client.
  onProgress?.(5)

  const { data: signData, error: signError } = await supabase.functions.invoke(
    'cloudinary-sign',
    { body: { asset_type: assetType } }
  )

  if (signError || !signData?.signature) {
    console.error('cloudinary-sign error:', signError, signData)
    return {
      success: false,
      error:   signData?.error ?? signError?.message ?? 'Failed to get upload signature',
      stage:   'sign',
    }
  }

  const { signature, timestamp, cloud_name, api_key, upload_preset, folder, resource_type } = signData

  // ── Step 2: Upload directly from browser to Cloudinary ──────────────────
  onProgress?.(15)

  const formData = new FormData()
  formData.append('file',          file)
  formData.append('api_key',       api_key)
  formData.append('timestamp',     String(timestamp))
  formData.append('signature',     signature)
  formData.append('upload_preset', upload_preset)
  formData.append('folder',        folder)

  let cloudinaryData: Record<string, unknown>

  try {
    // resource_type comes from the signer: 'image' for avatars/covers,
    // 'auto' for portfolio so video and audio are accepted too.
    cloudinaryData = await uploadWithProgress(
      `https://api.cloudinary.com/v1_1/${cloud_name}/${resource_type ?? 'image'}/upload`,
      formData,
      (percent) => onProgress?.(15 + Math.round(percent * 0.7))
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

  const publicId     = cloudinaryData.public_id     as string
  const secureUrl    = cloudinaryData.secure_url    as string
  const returnedType = cloudinaryData.resource_type as string
  const format       = (cloudinaryData.format       as string) ?? null
  const bytes        = cloudinaryData.bytes         as number
  const width        = (cloudinaryData.width        as number) ?? null
  const height        = (cloudinaryData.height        as number) ?? null

  // ── Step 3: Save metadata to Supabase via process-upload ────────────────
  const processBody: Record<string, unknown> = {
    asset_type:    assetType,
    public_id:     publicId,
    secure_url:    secureUrl,
    content_type:  file.type,
    resource_type: returnedType,
    bytes,
    format,
  }

  if (assetType === 'talent_portfolio') {
    processBody['media_type'] = mediaType ?? 'gallery'
    processBody['sort_order'] = sortOrder
    if (title) processBody['title'] = title
  }

  const { data: saveData, error: processError } = await supabase.functions.invoke(
    'process-upload',
    { body: processBody }
  )

  if (processError || saveData?.error) {
    console.error('process-upload error:', processError, saveData)
    return {
      success: false,
      error:   saveData?.error ?? processError?.message ?? 'Failed to save upload metadata',
      stage:   'save',
    }
  }

  onProgress?.(100)

  return {
    success:      true,
    publicId,
    secureUrl,
    resourceType: returnedType,
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
      if (e.lengthComputable) onProgress(e.loaded / e.total)
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
