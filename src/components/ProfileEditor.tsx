import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Camera, Upload, Save, Loader2, CheckCircle2, X, Info, Image as ImageIcon, Edit3 } from 'lucide-react';
import { cn } from '../utils';
import Markdown from 'react-markdown';
import { ARTIST_AGREEMENT } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';
import { uploadToR2 } from '../utils/uploadToR2';

// ═══════════════════════════════════════════════════════════════════════════
// Field mapping notes (verified against information_schema)
//
//   form field            → profiles_talent column
//   ─────────────────────────────────────────────────────────────────────────
//   trailer_link          → url_trailer_video
//   live_link             → url_live_performace_video   (typo is in the DB)
//   price_per_session     → pricing_per_session
//   secondary_locations[] → optional_location_1 .. _4
//   genre_ids[]           → primary_/secondary_/tertiary_genre_id  (uuid FKs)
//   performance_type      → type_of_performer   (enum: solo|duo|3-piece|full band|dj)
//   ensemble_type         → type_of_ensemble
//   languages             → languages   (TEXT, not an array — joined on save)
//
// REMOVED — no column exists for these, so submitting them made every save fail:
//   • bank_* fields. Bank data is tokenised via Payable.lk into
//     talent_payout_accounts (payable_account_id + bank_account_last_4).
//     There is deliberately no full-account-number column. Collecting one
//     here and discarding it is worse than not collecting it.
//   • preferred_days. `availability` is date-range based, not a weekly
//     preference. Needs a column or table before this can be re-added.
// ═══════════════════════════════════════════════════════════════════════════

const FEATURE_SLOTS = [0, 1, 2];
const FEATURE_MEDIA_TYPE = 'profile_photo';

interface GenreRow { id: string; genre_name: string }

interface FeaturePhoto {
  sort_order: number;
  public_id:  string;
  secure_url: string;
}

function InfoTooltip({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setIsOpen(false)}
        className="text-gray-400 hover:text-emerald-600 transition-colors focus:outline-none"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-xl shadow-xl pointer-events-none"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const profileSchema = z.object({
  stage_name:          z.string().min(2, 'Stage name is required'),
  full_name:           z.string().min(2, 'Full name is required'),
  email:               z.string().email('Invalid email'),
  mobile:              z.string().min(8, 'Mobile number is required'),
  trailer_link:        z.string().url('Invalid URL').or(z.string().length(0)),
  live_link:           z.string().url('Invalid URL').or(z.string().length(0)),
  price_per_session:   z.number().min(0),
  primary_location:    z.string().min(2, 'Primary location is required'),
  secondary_locations: z.array(z.string()).length(4),
  languages:           z.string().min(2, 'Enter at least one language'),
  performance_type:    z.enum(['solo', 'duo', '3-piece', 'full band', 'dj']),
  ensemble_type:       z.string().min(2, 'Required'),
  // Genres are uuid foreign keys into `genres`. Primary is NOT NULL in the DB.
  genre_ids: z.tuple([
    z.string().uuid('Select a primary genre'),
    z.string().uuid().or(z.string().length(0)),
    z.string().uuid().or(z.string().length(0)),
  ]),
  // Optional on load: the raw NIC is never returned from the server, so the
  // field starts empty even when one is already on file.
  national_id_number: z.string().min(5, 'Required').or(z.string().length(0)),
  bio: z.string().min(10, 'Bio should be at least 10 characters'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileEditor() {
  const navigate = useNavigate();
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [talentId, setTalentId]               = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl]             = useState<string>('');
  const [coverUrl, setCoverUrl]               = useState<string>('');
  const [features, setFeatures]               = useState<FeaturePhoto[]>([]);
  const [kycData, setKycData]                 = useState<any>(null);
  const [genresList, setGenresList]           = useState<GenreRow[]>([]);
  const [user, setUser]                       = useState<any>(null);
  const [showAgreement, setShowAgreement]     = useState(false);
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [pendingValues, setPendingValues]     = useState<ProfileFormValues | null>(null);
  const [approvalStatus, setApprovalStatus]   = useState<string | null>(null);
  const [isEditing, setIsEditing]             = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const agreementRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } =
    useForm<ProfileFormValues>({
      resolver: zodResolver(profileSchema),
      defaultValues: {
        secondary_locations: ['', '', '', ''],
        genre_ids: ['', '', ''],
        languages: '',
      },
    });

  useEffect(() => {
    async function getInitialData() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // genre_name, not name. Ordered by display_order, active only.
      const { data: genresData } = await supabase
        .from('genres')
        .select('id, genre_name')
        .eq('is_active', true)
        .order('display_order');
      if (genresData) setGenresList(genresData as GenreRow[]);

      if (user) {
        const { data: p } = await supabase
          .from('profiles_talent')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (p) {
          setTalentId(p.id);
          setApprovalStatus(p.approval_status ?? null);
          setAvatarUrl(p.profile_photo_url ?? '');
          setCoverUrl(p.cover_photo_url ?? '');

          const [kycRes, mediaRes] = await Promise.all([
            supabase.from('talent_identity').select('*').eq('talent_id', p.id).maybeSingle(),
            supabase
              .from('talent_media')
              .select('sort_order, cloudinary_public_id, cloudinary_secure_url')
              .eq('talent_id', p.id)
              .eq('media_type', FEATURE_MEDIA_TYPE)
              .order('sort_order'),
          ]);

          setFeatures(
            (mediaRes.data ?? []).map((m: any) => ({
              sort_order: m.sort_order,
              public_id:  m.cloudinary_public_id,
              secure_url: m.cloudinary_secure_url,
            })),
          );

          reset({
            stage_name:        p.stage_name ?? '',
            full_name:         p.full_name ?? '',
            email:             p.email ?? '',
            mobile:            p.mobile ?? '',
            trailer_link:      p.url_trailer_video ?? '',
            live_link:         p.url_live_performace_video ?? '',
            price_per_session: Number(p.pricing_per_session ?? 0),
            primary_location:  p.primary_location ?? '',
            secondary_locations: [
              p.optional_location_1 ?? '',
              p.optional_location_2 ?? '',
              p.optional_location_3 ?? '',
              p.optional_location_4 ?? '',
            ],
            languages:        p.languages ?? '',
            performance_type: p.type_of_performer ?? 'solo',
            ensemble_type:    p.type_of_ensemble ?? '',
            genre_ids: [
              p.primary_genre_id ?? '',
              p.secondary_genre_id ?? '',
              p.tertiary_genre_id ?? '',
            ],
            national_id_number: '',
            bio: p.bio ?? '',
          });

          if (kycRes.data) setKycData(kycRes.data);
        }
      }
      setLoading(false);
    }
    getInitialData();
  }, [reset]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) return;
    setPendingValues(values);
    setShowAgreement(true);
    setHasReadToBottom(false);
  };

  const handleAgreement = async () => {
    if (!user || !pendingValues) return;
    setSaving(true);
    setShowAgreement(false);

    try {
      const v = pendingValues;

      // Explicit column mapping. Never spread form values into an upsert —
      // PostgREST rejects the whole statement if any key is not a column.
      const row: Record<string, unknown> = {
        user_id:                   user.id,
        stage_name:                v.stage_name,
        full_name:                 v.full_name,
        email:                     v.email,
        mobile:                    v.mobile,
        url_trailer_video:         v.trailer_link || null,
        url_live_performace_video: v.live_link || null,
        pricing_per_session:       v.price_per_session,
        primary_location:          v.primary_location,
        optional_location_1:       v.secondary_locations[0] || null,
        optional_location_2:       v.secondary_locations[1] || null,
        optional_location_3:       v.secondary_locations[2] || null,
        optional_location_4:       v.secondary_locations[3] || null,
        languages:                 v.languages,
        type_of_performer:         v.performance_type,
        type_of_ensemble:          v.ensemble_type,
        primary_genre_id:          v.genre_ids[0],
        secondary_genre_id:        v.genre_ids[1] || null,
        tertiary_genre_id:         v.genre_ids[2] || null,
        bio:                       v.bio,
        updated_at:                new Date().toISOString(),
      };
      if (talentId) row.id = talentId;

      const { data: saved, error: profileError } = await supabase
        .from('profiles_talent')
        .upsert(row, { onConflict: 'user_id' })
        .select('id')
        .single();
      if (profileError) throw profileError;
      if (saved?.id) setTalentId(saved.id);

      // NIC is hashed server-side by submit-nic — the raw number is never
      // written to the database or logged. Blank means "no change".
      if (v.national_id_number) {
        const { data: nicData, error: nicError } = await supabase.functions.invoke(
          'submit-nic',
          { body: { nic_number: v.national_id_number } },
        );
        // invoke() does not surface 4xx JSON bodies as `error`, so a duplicate
        // NIC (409) would otherwise look like success.
        if (nicError || nicData?.error) {
          throw new Error(nicData?.error ?? nicError?.message ?? 'Failed to save identity number');
        }
        setKycData((prev: any) => ({
          ...prev,
          nic_last_four: nicData?.nic_last_four,
          kyc_status:    nicData?.kyc_status ?? prev?.kyc_status,
        }));
        setValue('national_id_number', '');
      }

      alert('Profile saved successfully!');
      setIsEditing(false);
    } catch (error: any) {
      alert(error.message ?? 'Could not save profile');
    } finally {
      setSaving(false);
      setPendingValues(null);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) setHasReadToBottom(true);
  };

  // Persist public asset metadata. No direct-DB fallback: process-upload is
  // the server-side checkpoint, and a client-side write that fires precisely
  // when that checkpoint rejects an upload is a bypass, not a fallback.
  const persistUpload = async (
    assetType: string,
    publicId: string,
    secureUrl: string,
    extra: Record<string, unknown> = {},
  ) => {
    const { data, error } = await supabase.functions.invoke('process-upload', {
      body: {
        asset_type:    assetType,
        public_id:     publicId,
        secure_url:    secureUrl,
        resource_type: 'image',
        ...extra,
      },
    });
    if (error || data?.error) {
      throw new Error(data?.error ?? error?.message ?? 'Failed to save upload');
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    uploadTarget: 'avatar' | 'cover' | 'feature' | 'nic_front' | 'nic_back',
    featureIndex?: number,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    event.target.value = '';
    setUploadingTarget(uploadTarget === 'feature' ? `feature-${featureIndex}` : uploadTarget);

    try {
      // ── Sensitive: NIC images go to private R2, never Cloudinary ─────────
      if (uploadTarget === 'nic_front' || uploadTarget === 'nic_back') {
        if (!talentId) {
          throw new Error('Please save your profile before uploading identity documents.');
        }

        const assetType = uploadTarget === 'nic_front' ? 'kyc_front' : 'kyc_back';
        const r2 = await uploadToR2({ file, assetType });
        if (!r2.success) throw new Error(r2.error ?? 'Upload failed');

        const idColumn = uploadTarget === 'nic_front'
          ? 'nic_front_public_id'
          : 'nic_back_public_id';

        setKycData((prev: any) => ({
          ...prev,
          [idColumn]: r2.objectKey,
          // Status comes from the server: it decides whether this upload
          // completed the set (both images + NIC number).
          kyc_status: r2.kycStatus ?? prev?.kyc_status ?? 'pending',
        }));

        alert('Identity document uploaded securely.');
        return;
      }

      if (!talentId) throw new Error('Please save your profile before uploading images.');

      // ── Public: Cloudinary ───────────────────────────────────────────────
      if (uploadTarget === 'avatar') {
        const r = await uploadToCloudinary(file, 'en410_avatars');
        await persistUpload('talent_avatar', r.public_id, r.secure_url);
        setAvatarUrl(r.secure_url);

      } else if (uploadTarget === 'cover') {
        const r = await uploadToCloudinary(file, 'en410_artist_profile');
        await persistUpload('talent_cover', r.public_id, r.secure_url);
        setCoverUrl(r.secure_url);

      } else if (uploadTarget === 'feature') {
        if (featureIndex === undefined) throw new Error('featureIndex required');

        // uq_talent_media_slot is UNIQUE (talent_id, sort_order), so an
        // occupied slot must be cleared before the new row can be inserted.
        // Deleting via cloudinary-delete also removes the old file, rather
        // than leaving an unreferenced asset behind.
        const existing = features.find((f) => f.sort_order === featureIndex);
        if (existing) {
          const { data: delData, error: delError } = await supabase.functions.invoke(
            'cloudinary-delete',
            { body: { asset_type: 'talent_portfolio', public_id: existing.public_id } },
          );
          if (delError || delData?.error) {
            throw new Error(delData?.error ?? delError?.message ?? 'Could not replace the existing photo');
          }
          setFeatures((prev) => prev.filter((f) => f.sort_order !== featureIndex));
        }

        const r = await uploadToCloudinary(file, 'en410_artist_portfolio');
        await persistUpload('talent_portfolio', r.public_id, r.secure_url, {
          media_type: FEATURE_MEDIA_TYPE,
          sort_order: featureIndex,
        });

        setFeatures((prev) => [
          ...prev.filter((f) => f.sort_order !== featureIndex),
          { sort_order: featureIndex, public_id: r.public_id, secure_url: r.secure_url },
        ]);
      }

      alert('Uploaded successfully!');
    } catch (error: any) {
      console.error('handleFileUpload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploadingTarget(null);
    }
  };

  const featureUrl = (idx: number) =>
    features.find((f) => f.sort_order === idx)?.secure_url ?? '';

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-gray-500">Please sign in to continue.</p>
      </div>
    );
  }

  if (approvalStatus === 'approved' && !isEditing) {
    return (
      <div className="max-w-2xl mx-auto p-10 bg-white shadow-xl rounded-3xl my-10 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <h1 className="text-3xl font-bold">Your profile is live</h1>
        <p className="text-gray-500">Your talent profile has been approved and is published on the public site.</p>
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Edit Details
        </button>
      </div>
    );
  }

  if (approvalStatus === 'pending_approval') {
    return (
      <div className="max-w-2xl mx-auto p-10 bg-white shadow-xl rounded-3xl my-10 text-center space-y-4">
        <Loader2 className="w-12 h-12 text-gray-400 mx-auto" />
        <h1 className="text-3xl font-bold">Under review</h1>
        <p className="text-gray-500">Your profile has been submitted and is awaiting admin approval. We'll email you once it's reviewed.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white shadow-xl rounded-3xl my-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Artist Profile</h1>
          <p className="text-gray-500">Complete your details to start receiving bookings.</p>
        </div>
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <form className="space-y-12">
        {/* Media & Identity */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b pb-2">Media &amp; Identity</h2>

          {!talentId && (
            <p className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-3">
              Save your profile once before uploading images or identity documents.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group">
                {avatarUrl
                  ? <img src={avatarUrl} className="w-full h-full object-cover" alt="Profile" />
                  : <Camera className="text-gray-400" />}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
                         onChange={(e) => handleFileUpload(e, 'avatar')} />
                  {uploadingTarget === 'avatar'
                    ? <Loader2 className="text-white w-6 h-6 animate-spin" />
                    : <Upload className="text-white w-6 h-6" />}
                </label>
              </div>
              <span className="text-sm font-medium flex items-center">
                Profile Picture
                <InfoTooltip content="Upload a clear, high-quality photo of yourself, the band, or logo. This will primarily be used in the app." />
              </span>
            </div>

            <div className="flex flex-col items-center space-y-4">
              <div className="w-full aspect-[16/9] rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group">
                {coverUrl
                  ? <img src={coverUrl} className="w-full h-full object-cover" alt="Cover" />
                  : <ImageIcon className="text-gray-400" />}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
                         onChange={(e) => handleFileUpload(e, 'cover')} />
                  {uploadingTarget === 'cover'
                    ? <Loader2 className="text-white w-6 h-6 animate-spin" />
                    : <Upload className="text-white w-6 h-6" />}
                </label>
              </div>
              <span className="text-sm font-medium flex items-center">
                Profile Cover Picture
                <InfoTooltip content="This image appears at the top of your Web profile page. Choose a visually striking photo that showcases your performance style, stage presence, or artistic identity." />
              </span>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Identity Verification</h3>
                {kycData?.kyc_status && (
                  <span className={cn(
                    'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                    kycData.kyc_status === 'verified'  ? 'bg-emerald-100 text-emerald-700' :
                    kycData.kyc_status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                    kycData.kyc_status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700',
                  )}>
                    {kycData.kyc_status}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(['nic_front', 'nic_back'] as const).map((side) => {
                  const label  = side === 'nic_front' ? 'NIC Front' : 'NIC Back';
                  const column = side === 'nic_front' ? 'nic_front_public_id' : 'nic_back_public_id';
                  return (
                    <div key={side} className="space-y-2">
                      <label className="text-sm font-medium flex items-center">
                        {label}
                        <InfoTooltip content="Stored in private encrypted storage, never publicly accessible, and only viewable by verification staff. Maximum size 2MB." />
                      </label>
                      <div className="h-32 bg-gray-50 rounded-xl border border-dashed flex items-center justify-center relative overflow-hidden">
                        {uploadingTarget === side ? (
                          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                        ) : kycData?.[column] ? (
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-600">Uploaded</span>
                          </div>
                        ) : (
                          <Upload className="text-gray-300" />
                        )}
                        <input
                          type="file"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(e) => handleFileUpload(e, side)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">National ID Number</label>
                <input
                  {...register('national_id_number')}
                  placeholder={kycData?.nic_last_four ? 'Enter a new number to replace' : '200012345678 or 901234567V'}
                  className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {kycData?.nic_last_four && (
                  <p className="text-xs text-gray-500">
                    On file: •••••••••{kycData.nic_last_four} — leave blank to keep it unchanged.
                  </p>
                )}
                {errors.national_id_number && (
                  <p className="text-red-500 text-xs">{errors.national_id_number.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Feature Pictures */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center">
              Profile Feature Pictures
              <InfoTooltip content="These images appear on your Web profile page. Choose three visually striking photos that showcase your performance style, stage presence, or artistic identity." />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {FEATURE_SLOTS.map((idx) => (
                <div key={idx} className="h-40 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                  {featureUrl(idx)
                    ? <img src={featureUrl(idx)} className="w-full h-full object-cover" alt={`Feature ${idx + 1}`} />
                    : <ImageIcon className="text-gray-300 w-8 h-8" />}
                  <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
                           onChange={(e) => handleFileUpload(e, 'feature', idx)} />
                    {uploadingTarget === `feature-${idx}`
                      ? <Loader2 className="text-white w-6 h-6 animate-spin" />
                      : <Upload className="text-white w-6 h-6" />}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Basic Info */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">
              Stage Name
              <InfoTooltip content="The name displayed publicly on your Web profile. It can be your real name or your artist alias." />
            </label>
            <input {...register('stage_name')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. The Jazz Cat" />
            {errors.stage_name && <p className="text-red-500 text-xs">{errors.stage_name.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name (Account Handler)</label>
            <input {...register('full_name')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
            {errors.full_name && <p className="text-red-500 text-xs">{errors.full_name.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input {...register('email')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
            {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mobile Number</label>
            <input {...register('mobile')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
            {errors.mobile && <p className="text-red-500 text-xs">{errors.mobile.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">
              Price per Session
              <InfoTooltip content="Your standard rate for a single performance. You can adjust this per booking when submitting a quotation." />
            </label>
            <input type="number" step="0.01" {...register('price_per_session', { valueAsNumber: true })} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </section>

        {/* Social Links */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Social Proof (FB/IG)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                Trailer Video Link
                <InfoTooltip content="A short video that represents your act. Think of it as your highlight reel." />
              </label>
              <input {...register('trailer_link')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="https://..." />
              {errors.trailer_link && <p className="text-red-500 text-xs">{errors.trailer_link.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                Live Performance Link
                <InfoTooltip content="A recording or stream of a live performance, so clients can gauge your stage presence." />
              </label>
              <input {...register('live_link')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="https://..." />
              {errors.live_link && <p className="text-red-500 text-xs">{errors.live_link.message}</p>}
            </div>
          </div>
        </section>

        {/* Locations */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2 flex items-center">
            Travel &amp; Locations
            <InfoTooltip content="The areas you're willing to travel to for bookings." />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary Location</label>
              <input {...register('primary_location')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
              {errors.primary_location && <p className="text-red-500 text-xs">{errors.primary_location.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Other Locations Willing to Travel</label>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <input key={i} {...register(`secondary_locations.${i}` as const)} className="w-full p-2 rounded-lg border text-sm" placeholder={`Location ${i + 1}`} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Performance Details */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b pb-2 flex items-center">
            Performance Details
            <InfoTooltip content="What clients can expect from your performance — genre, style, and ensemble." />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Performance Type</label>
              <select {...register('performance_type')} className="w-full p-3 rounded-xl border outline-none">
                <option value="solo">Solo</option>
                <option value="duo">Duo</option>
                <option value="3-piece">3 Piece</option>
                <option value="full band">Full Band</option>
                <option value="dj">DJ</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ensemble Type</label>
              <input {...register('ensemble_type')} className="w-full p-3 rounded-xl border outline-none" placeholder="e.g. Guitar x Vocals" />
              {errors.ensemble_type && <p className="text-red-500 text-xs">{errors.ensemble_type.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Genres (Pick 3)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <select
                    key={i}
                    {...register(`genre_ids.${i}` as const)}
                    className="w-full p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">{i === 0 ? 'Primary genre' : `Genre ${i + 1} (optional)`}</option>
                    {genresList.map((g) => (
                      <option key={g.id} value={g.id}>{g.genre_name}</option>
                    ))}
                  </select>
                ))}
              </div>
              {errors.genre_ids && <p className="text-red-500 text-xs">A primary genre is required.</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Languages</label>
              <input {...register('languages')} className="w-full p-3 rounded-xl border outline-none" placeholder="e.g. English, Sinhala, Tamil" />
              {errors.languages && <p className="text-red-500 text-xs">{errors.languages.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bio</label>
            <textarea {...register('bio')} rows={4} className="w-full p-3 rounded-xl border outline-none" placeholder="Tell us about your musical journey..." />
            {errors.bio && <p className="text-red-500 text-xs">{errors.bio.message}</p>}
          </div>
        </section>
      </form>

      {/* Agreement Modal */}
      <AnimatePresence>
        {showAgreement && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAgreement(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-8 border-b flex items-center justify-between bg-gray-50/50">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Artist Agreement</h2>
                  <p className="text-sm text-gray-500 font-medium">Please review and accept to continue</p>
                </div>
                <button onClick={() => setShowAgreement(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div ref={agreementRef} onScroll={handleScroll}
                   className="flex-1 overflow-y-auto p-8 prose prose-slate max-w-none scroll-smooth">
                <div className="markdown-body">
                  <Markdown>{ARTIST_AGREEMENT}</Markdown>
                </div>
                {!hasReadToBottom && (
                  <div className="sticky bottom-0 left-0 right-0 py-4 bg-gradient-to-t from-white to-transparent flex justify-center">
                    <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-bold animate-bounce shadow-sm border border-emerald-100">
                      Scroll to bottom to accept ↓
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t bg-gray-50/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                  {hasReadToBottom ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" /> Ready to accept
                    </span>
                  ) : (
                    <span>Please read the full agreement</span>
                  )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={() => setShowAgreement(false)}
                          className="flex-1 sm:flex-none px-8 py-4 text-gray-600 font-bold hover:bg-gray-100 rounded-2xl transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleAgreement} disabled={!hasReadToBottom}
                          className="flex-1 sm:flex-none px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-emerald-200 active:scale-95">
                    I Agree &amp; Save
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}