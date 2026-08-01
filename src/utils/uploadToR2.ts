// ═══════════════════════════════════════════════════════════════════════════
// uploadToR2.ts  —  En4tainment / En410
// Uploads SENSITIVE assets (NIC images) to the private Cloudflare R2 bucket.
//
// Scope: kyc_front, kyc_back.
// Public assets (avatar, cover, feature photos) go via cloudinaryUpload.ts.
//
// CHANGED: this now posts the file to `upload-document`, which receives the
// bytes, inspects them, and writes to R2 itself. The previous flow used
// `r2-sign-upload` (presigned PUT), which could only pin the *declared*
// Content-Type header — a modified client could declare application/pdf and
// send anything. It also accepted a client-supplied talent_id with no
// ownership check. Both are gone: ownership now comes from the JWT.
//
// No mock fallback and no direct-DB fallback: a silent fake success on an
// identity document is worse than a visible error.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from '../supabase'

export type R2AssetType = 'kyc_front' | 'kyc_back'

export interface R2UploadOptions {
  file:        File
  assetType:   R2AssetType
  onProgress?: (pct: number) => void
}

export interface R2UploadResult {
  success:    boolean
  objectKey?: string
  kycStatus?: string
  error?:     string
  stage?:     'validate' | 'upload'
}

// Client-side pre-checks only. The server re-checks both, on the actual bytes,
// and its answer is the one that counts. These exist to fail fast and give a
// clearer message — never as the security boundary.
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 2 * 1024 * 1024 // 2 MiB — must match MAX_BYTES in upload-document

export async function uploadToR2(opts: R2UploadOptions): Promise<R2UploadResult> {
  const { file, assetType, onProgress } = opts

  // ── 0. Validate locally ──────────────────────────────────────────────────
  if (!ALLOWED_MIME.includes(file.type)) {
    return {
      success: false,
      error: 'Please upload a JPG, PNG, WEBP or PDF file.',
      stage: 'validate',
    }
  }
  if (file.size > MAX_BYTES) {
    return {
      success: false,
      error: 'File is too large. Maximum size is 2MB.',
      stage: 'validate',
    }
  }

  // ── 1. Single call: auth, size, content inspection, R2 write, DB row ─────
  // No talent_id is sent. upload-document resolves the talent from the JWT.
  onProgress?.(10)

  const form = new FormData()
  form.append('asset_type', assetType)
  form.append('file', file)

  const { data, error } = await supabase.functions.invoke('upload-document', {
    body: form,
  })

  if (error || data?.error) {
    console.error('upload-document failed:', error, data)
    return {
      success: false,
      error: data?.error ?? error?.message ?? 'Upload failed. Please try again.',
      stage: 'upload',
    }
  }

  onProgress?.(100)

  return {
    success:   true,
    objectKey: data?.object_key,
    kycStatus: data?.kyc_status,
  }
}
