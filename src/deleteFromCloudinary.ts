// ═══════════════════════════════════════════════════════════════════════════
// deleteFromCloudinary.ts  —  En4tainment / En410
// Deletes a PUBLIC Cloudinary asset and clears its reference in Supabase.
//
// Sensitive assets (KYC, venue documents) live in private R2 and are never
// deleted through this path — cloudinary-delete rejects them outright.
//
// Ownership is enforced server-side from the session JWT: a user can only
// delete their own assets, an admin can delete any. No id (talentId,
// clientId, venueId, etc.) is sent from the client — the previous version
// of this file sent talent_id/client_id/venue_id, but cloudinary-delete
// never reads them; they did nothing except imply a scoping that wasn't
// actually happening.
//
// USAGE:
//   import { deleteFromCloudinary } from './deleteFromCloudinary'
//
//   const result = await deleteFromCloudinary({
//     publicId:  'en410/avatars/abc123',
//     assetType: 'talent_avatar',
//   })
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase'

// Matches the asset types cloudinary-delete actually accepts. kyc_front,
// kyc_back, and venue_document are deliberately excluded — the function
// rejects them with a 400 pointing at upload-document/r2-delete, so
// including them here would be a type that lies about what's valid.
export type AssetType =
  | 'talent_avatar'
  | 'talent_cover'
  | 'talent_portfolio'
  | 'client_avatar'
  | 'venue_avatar'

export interface DeleteOptions {
  publicId:  string
  assetType: AssetType
}

export interface DeleteResult {
  success: true
}

export interface DeleteError {
  success: false
  error:   string
}

export async function deleteFromCloudinary(
  options: DeleteOptions
): Promise<DeleteResult | DeleteError> {
  const { publicId, assetType } = options

  const { data, error } = await supabase.functions.invoke('cloudinary-delete', {
    body: {
      asset_type: assetType,
      public_id:  publicId,
    },
  })

  // Check data?.error as well as the transport-level error — invoke() does
  // not surface 4xx JSON bodies as `error`, so a rejected delete (wrong
  // owner, asset not found, migrated-to-R2 type) would otherwise look like
  // success.
  if (error || data?.error) {
    console.error('cloudinary-delete error:', error, data)
    return {
      success: false,
      error:   data?.error ?? error?.message ?? 'Failed to delete asset',
    }
  }

  return { success: true }
}
