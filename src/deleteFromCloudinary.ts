// ═══════════════════════════════════════════════════════════════════════════
// deleteFromCloudinary.ts  —  En4tainment / En410
// Deletes a Cloudinary asset and clears the reference in Supabase DB.
//
// USAGE:
//   import { deleteFromCloudinary } from '@/lib/deleteFromCloudinary'
//
//   const result = await deleteFromCloudinary({
//     publicId:  'en410/avatars/abc123',
//     assetType: 'talent_avatar',
//     talentId:  talentProfile.id,
//   })
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase'
type AssetType =
  | 'talent_avatar'
  | 'talent_cover'
  | 'talent_portfolio'
  | 'kyc_front'
  | 'kyc_back'
  | 'client_avatar'
  | 'venue_avatar'
  | 'venue_document'

export interface DeleteOptions {
  publicId:  string
  assetType: AssetType
  talentId?: string
  clientId?: string
  venueId?:  string
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
  const { publicId, assetType, talentId, clientId, venueId } = options

  const { error } = await supabase.functions.invoke('cloudinary-delete', {
    body: {
      asset_type: assetType,
      public_id:  publicId,
      talent_id:  talentId,
      client_id:  clientId,
      venue_id:   venueId,
    },
  })

  if (error) {
    console.error('cloudinary-delete error:', error)
    return { success: false, error: error.message ?? 'Failed to delete asset' }
  }

  return { success: true }
}
