// ═══════════════════════════════════════════════════════════════════════════
// uploadToR2.ts  —  En4tainment / En410
// Uploads SENSITIVE assets to the private Cloudflare R2 bucket.
//
// Scope: kyc_front, kyc_back.
// Public assets (avatar, cover, portfolio) go via cloudinaryUpload.ts.
//
// No mock fallback and no direct-DB fallback: a silent fake success on an
// identity document is worse than a visible error.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from '../supabase'

export type R2AssetType = 'kyc_front' | 'kyc_back'

export interface R2UploadOptions {
  file:        File
  assetType:   R2AssetType
  talentId:    string
  onProgress?: (pct: number) => void
}

export interface R2UploadResult {
  success:     boolean
  objectKey?:  string
  kycStatus?:  string
  error?:      string
  stage?:      'validate' | 'sign' | 'upload' | 'save'
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 8 * 1024 * 1024

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)

    // Must match the Content-Type signed by r2-sign-upload, or R2
    // rejects with SignatureDoesNotMatch.
    xhr.setRequestHeader('Content-Type', contentType)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.((e.loaded / e.total) * 100)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`R2 responded ${xhr.status}`))
    xhr.onerror   = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))

    xhr.timeout = 120_000
    xhr.send(file)
  })
}

export async function uploadToR2(
  opts: R2UploadOptions,
): Promise<R2UploadResult> {
  const { file, assetType, talentId, onProgress } = opts

  // ── 0. Validate locally ────────────────────────────────────────────────
  if (!ALLOWED_MIME.includes(file.type)) {
    return { success: false, error: 'Please upload a JPG, PNG, WEBP or PDF file.', stage: 'validate' }
  }
  if (file.size > MAX_BYTES) {
    return { success: false, error: 'File is too large. Maximum size is 8MB.', stage: 'validate' }
  }
  if (!talentId) {
    return { success: false, error: 'Talent profile not found.', stage: 'validate' }
  }

  // ── 1. Sign ────────────────────────────────────────────────────────────
  onProgress?.(5)

  const { data: signData, error: signError } = await supabase.functions.invoke(
    'r2-sign-upload',
    {
      body: {
        asset_type:   assetType,
        content_type: file.type,
        size_bytes:   file.size,
        talent_id:    talentId,
      },
    },
  )

  if (signError || !signData?.upload_url) {
    console.error('r2-sign-upload failed:', signError, signData)
    return {
      success: false,
      error:   signData?.error ?? signError?.message ?? 'Could not authorise upload',
      stage:   'sign',
    }
  }

  // ── 2. Direct PUT to R2 ────────────────────────────────────────────────
  try {
    await putWithProgress(
      signData.upload_url,
      file,
      signData.content_type,
      (p) => onProgress?.(5 + Math.round(p * 0.8)),
    )
  } catch (err) {
    console.error('R2 upload error:', err)
    return { success: false, error: 'Upload failed. Please try again.', stage: 'upload' }
  }

  onProgress?.(85)

  // ── 3. Persist metadata ────────────────────────────────────────────────
  const { data: saveData, error: saveError } = await supabase.functions.invoke(
    'process-upload',
    {
      body: {
        asset_type:     assetType,
        public_id:      signData.object_key,
        storage_bucket: signData.storage_bucket,
        content_type:   file.type,
        bytes:          file.size,
      },
    },
  )

  if (saveError || saveData?.error) {
    console.error('process-upload failed:', saveError, saveData)
    return {
      success: false,
      error:   saveData?.error ?? saveError?.message ?? 'Failed to save upload',
      stage:   'save',
    }
  }

  onProgress?.(100)

  return {
    success:   true,
    objectKey: signData.object_key,
    kycStatus: saveData?.kyc_status,
  }
}