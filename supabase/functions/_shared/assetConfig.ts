// ─── Asset type configuration ───────────────────────────────────────────────
// Maps every asset_type value to its Cloudinary folder, upload preset,
// access mode, and which app it belongs to.

export type AssetType =
  | 'talent_avatar'
  | 'talent_cover'
  | 'talent_portfolio'
  | 'kyc_front'
  | 'kyc_back'
  | 'client_avatar'
  | 'venue_avatar'
  | 'venue_document'

export interface AssetConfig {
  folder: string
  upload_preset: string
  resource_type: 'image' | 'video' | 'raw' | 'auto'
  access_mode: 'public' | 'authenticated'
  app: 'en410' | 'en4tainment'
}

export const ASSET_CONFIG: Record<AssetType, AssetConfig> = {
  // ── En410 (talent mobile app) ──────────────────────────────────────────────
  talent_avatar: {
    folder: 'en410/avatars',
    upload_preset: 'en410_avatars',
    resource_type: 'image',
    access_mode: 'public',
    app: 'en410',
  },
  talent_cover: {
    folder: 'en410/profiles',
    upload_preset: 'en410_artist_profile',
    resource_type: 'image',
    access_mode: 'public',
    app: 'en410',
  },
  talent_portfolio: {
    folder: 'en410/portfolio',
    upload_preset: 'en410_artist_portfolio',
    resource_type: 'auto',
    access_mode: 'public',
    app: 'en410',
  },
  kyc_front: {
    folder: 'en410/kyc',
    upload_preset: 'en410_artist_kyc',
    resource_type: 'image',
    access_mode: 'authenticated',
    app: 'en410',
  },
  kyc_back: {
    folder: 'en410/kyc',
    upload_preset: 'en410_artist_kyc',
    resource_type: 'image',
    access_mode: 'authenticated',
    app: 'en410',
  },

  // ── En4tainment (client/venue web app) ────────────────────────────────────
  client_avatar: {
    folder: 'en4tainment/avatars',
    upload_preset: 'en4tainment_avatars',
    resource_type: 'image',
    access_mode: 'public',
    app: 'en4tainment',
  },
  venue_avatar: {
    folder: 'en4tainment/avatars',
    upload_preset: 'en4tainment_avatars',
    resource_type: 'image',
    access_mode: 'public',
    app: 'en4tainment',
  },
  venue_document: {
    folder: 'en4tainment/documents',
    upload_preset: 'en4tainment_documents',
    resource_type: 'raw',
    access_mode: 'authenticated',
    app: 'en4tainment',
  },
}
