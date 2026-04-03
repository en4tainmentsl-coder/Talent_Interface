import React, { useState, useEffect, useRef } from 'react';
import { supabase, Profile, Genre } from '../supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Camera, Upload, Save, Loader2, CheckCircle2, X, Info, Image as ImageIcon, HelpCircle, Edit3 } from 'lucide-react';
import { cn } from '../utils';
import Markdown from 'react-markdown';
import { ARTIST_AGREEMENT } from '../constants';
import { motion, AnimatePresence } from 'motion/react';

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
  stage_name: z.string().min(2, "Stage name is required"),
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email"),
  mobile: z.string().min(8, "Mobile number is required"),
  fb_trailer_link: z.string().url("Invalid URL").or(z.string().length(0)),
  fb_live_link: z.string().url("Invalid URL").or(z.string().length(0)),
  price_per_session: z.number().min(0),
  primary_location: z.string().min(2, "Primary location is required"),
  secondary_locations: z.array(z.string()).length(4, "Exactly 4 secondary locations required"),
  bank_name_on_account: z.string().min(2, "Required"),
  bank_account_number: z.string().min(5, "Required"),
  bank_name: z.string().min(2, "Required"),
  bank_branch_code: z.string().min(2, "Required"),
  preferred_days: z.array(z.string()).min(1, "Select at least one day"),
  languages: z.array(z.string()).min(1, "Select at least one language"),
  performance_type: z.enum(['solo', 'duo', '3 piece', 'full band']),
  ensemble_type: z.string().min(2, "Required"),
  national_id_number: z.string().min(5, "Required"),
  bio: z.string().min(10, "Bio should be at least 10 characters"),
  genres: z.array(z.string()).length(3, "Exactly 3 genres required"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kycData, setKycData] = useState<any>(null);
  const [genresList, setGenresList] = useState<Genre[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showAgreement, setShowAgreement] = useState(false);
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [pendingValues, setPendingValues] = useState<ProfileFormValues | null>(null);
  const agreementRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      secondary_locations: ['', '', '', ''],
      genres: ['', '', ''],
      preferred_days: [],
      languages: [],
    }
  });

  useEffect(() => {
    async function getInitialData() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      // Fetch genres
      const { data: genresData } = await supabase
        .from('genres')
        .select('*')
        .order('name');
      if (genresData) setGenresList(genresData);

      if (user) {
        const [profileRes, kycRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('talent_identity').select('*').eq('talent_id', user.id).single()
        ]);
        
        if (profileRes.data) {
          setProfile(profileRes.data);
          reset({
            ...profileRes.data,
            national_id_number: kycRes.data?.national_id_number || '',
            secondary_locations: profileRes.data.secondary_locations || ['', '', '', ''],
            genres: profileRes.data.genres || ['', '', ''],
          });
        }
        if (kycRes.data) {
          setKycData(kycRes.data);
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
      const { national_id_number, ...profileValues } = pendingValues;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...profileValues,
          updated_at: new Date().toISOString(),
        });
      if (profileError) throw profileError;

      // Update national ID in talent_identity
      const { error: kycError } = await supabase
        .from('talent_identity')
        .upsert({
          talent_id: user.id,
          national_id_number,
          updated_at: new Date().toISOString(),
        });
      if (kycError) throw kycError;

      alert('Profile saved successfully!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
      setPendingValues(null);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setHasReadToBottom(true);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, bucket: string, field: string, index?: number) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      if (field === 'nic_front_url' || field === 'nic_back_url') {
        const { error: kycError } = await supabase
          .from('talent_identity')
          .upsert({
            talent_id: user.id,
            [field]: publicUrl,
            kyc_status: 'pending',
            updated_at: new Date().toISOString(),
          });
        if (kycError) throw kycError;
        setKycData(prev => ({ ...prev, [field]: publicUrl, kyc_status: 'pending' }));
      } else {
        // Update profile with new URL
        let updateData: any = { id: user.id };
        
        if (typeof index === 'number' && field === 'profile_feature_urls') {
          const currentFeatures = [...(profile?.profile_feature_urls || ['', '', ''])];
          currentFeatures[index] = publicUrl;
          updateData[field] = currentFeatures;
        } else {
          updateData[field] = publicUrl;
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .upsert(updateData);

        if (updateError) throw updateError;
        
        setProfile(prev => {
          if (!prev) return null;
          if (typeof index === 'number' && field === 'profile_feature_urls') {
            const currentFeatures = [...(prev.profile_feature_urls || ['', '', ''])];
            currentFeatures[index] = publicUrl;
            return { ...prev, profile_feature_urls: currentFeatures };
          }
          return { ...prev, [field as keyof Profile]: publicUrl };
        });
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <h1 className="text-2xl font-bold">Please Sign In</h1>
      <button 
        onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
        className="px-6 py-2 bg-black text-white rounded-full"
      >
        Sign in with Google
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white shadow-xl rounded-3xl my-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Artist Profile</h1>
          <p className="text-gray-500">Complete your details to start receiving bookings.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button 
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          <button 
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors text-sm font-medium justify-center"
          >
            <Edit3 className="w-4 h-4" />
            Edit Profile
          </button>
        </div>
      </div>

      <form className="space-y-12">
        {/* Media Section */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b pb-2">Media & Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group">
                {profile?.profile_picture_url ? (
                  <img src={profile.profile_picture_url} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <Camera className="text-gray-400" />
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'avatars', 'profile_picture_url')} accept="image/*" />
                  <Upload className="text-white w-6 h-6" />
                </label>
              </div>
              <span className="text-sm font-medium flex items-center">
                Profile Picture <InfoTooltip content="Upload a clear, high-quality photo of yourself, the band, or logo. This will primarily be used in the app." />
              </span>
            </div>

            <div className="flex flex-col items-center space-y-4">
              <div className="w-full aspect-[16/9] rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group">
                {profile?.profile_cover_url ? (
                  <img src={profile.profile_cover_url} className="w-full h-full object-cover" alt="Cover" />
                ) : (
                  <ImageIcon className="text-gray-400" />
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'covers', 'profile_cover_url')} accept="image/*" />
                  <Upload className="text-white w-6 h-6" />
                </label>
              </div>
              <span className="text-sm font-medium flex items-center">
                Profile Cover Picture <InfoTooltip content="This image appears at the top of your Web profile page. Choose a visually striking photo that showcases your performance style, stage presence, or artistic identity." />
              </span>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Identity Verification</h3>
                {kycData?.kyc_status && (
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    kycData.kyc_status === 'verified' ? "bg-emerald-100 text-emerald-700" :
                    kycData.kyc_status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {kycData.kyc_status}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center">
                    NIC Front <InfoTooltip content="Upload a clear photo of the front side of your National Identity Card. This is required for identity verification and to ensure the safety and trust of our platform." />
                  </label>
                  <div className="h-32 bg-gray-50 rounded-xl border border-dashed flex items-center justify-center relative overflow-hidden">
                    {kycData?.nic_front_url ? <img src={kycData.nic_front_url} className="w-full h-full object-cover" /> : <Upload className="text-gray-300" />}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'documents', 'nic_front_url')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center">
                    NIC Back <InfoTooltip content="Upload a clear photo of the back of your National Identity Card. Both sides are required to complete your identity verification successfully." />
                  </label>
                  <div className="h-32 bg-gray-50 rounded-xl border border-dashed flex items-center justify-center relative overflow-hidden">
                    {kycData?.nic_back_url ? <img src={kycData.nic_back_url} className="w-full h-full object-cover" /> : <Upload className="text-gray-300" />}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'documents', 'nic_back_url')} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">National ID Number</label>
                <input {...register('national_id_number')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
                {errors.national_id_number && <p className="text-red-500 text-xs">{errors.national_id_number.message}</p>}
              </div>
            </div>
          </div>

          {/* Feature Pictures Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center">
              Profile Feature Pictures <InfoTooltip content="These image appear in your Web profile page. Choose a selection of three (3) visually striking photos that further showcase your performance style, stage presence, or artistic identity." />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="h-40 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                  {profile?.profile_feature_urls?.[idx] ? (
                    <img src={profile.profile_feature_urls[idx]} className="w-full h-full object-cover" alt={`Feature ${idx + 1}`} />
                  ) : (
                    <ImageIcon className="text-gray-300 w-8 h-8" />
                  )}
                  <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'features', 'profile_feature_urls', idx)} accept="image/*" />
                    <Upload className="text-white w-6 h-6" />
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
              Stage Name <InfoTooltip content="This is the name that will be displayed publicly on your Web profile. It can be your real name or your artist/performer alias — choose something that represents your brand." />
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
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mobile Number</label>
            <input {...register('mobile')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">
              Price per Session <InfoTooltip content="Set your standard rate for a single performance or session. This amount will be shown to clients when browsing your profile. You can adjust this at any time based on event type or duration when submitting a quotation." />
            </label>
            <input type="number" {...register('price_per_session', { valueAsNumber: true })} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </section>

        {/* Social Links */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Social Proof (FB/IG)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                Trailer Video Link <InfoTooltip content="Paste a link to a short video that best represents your act or performance style. Think of this as your highlight reel — make it engaging to attract more bookings." />
              </label>
              <input {...register('fb_trailer_link')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                Live Performance Link <InfoTooltip content="Share a link to a recording or stream of one of your live performances. This gives clients a real sense of your stage presence, energy, and audience interaction." />
              </label>
              <input {...register('fb_live_link')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="https://..." />
            </div>
          </div>
        </section>

        {/* Locations */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2 flex items-center">
            Travel & Locations <InfoTooltip content="Specify the cities, you're willing to travel for bookings. This helps clients find performers available in their area and avoids scheduling conflicts." />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary Location</label>
              <input {...register('primary_location')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Other 4 Locations Willing to Travel</label>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map(i => (
                  <input key={i} {...register(`secondary_locations.${i}`)} className="w-full p-2 rounded-lg border text-sm" placeholder={`Location ${i+1}`} />
                ))}
              </div>
              {errors.secondary_locations && <p className="text-red-500 text-xs">{errors.secondary_locations.message}</p>}
            </div>
          </div>
        </section>

        {/* Performance Details */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b pb-2 flex items-center">
            Performance Details <InfoTooltip content="Describe what clients can expect from your performance — including your genre, style, set duration, equipment needs, or any special requirements. The more detailed and concise you are, the more confident clients will feel booking you." />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Performance Type</label>
              <select {...register('performance_type')} className="w-full p-3 rounded-xl border outline-none">
                <option value="solo">Solo</option>
                <option value="duo">Duo</option>
                <option value="3 piece">3 Piece</option>
                <option value="full band">Full Band</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ensemble Type</label>
              <input {...register('ensemble_type')} className="w-full p-3 rounded-xl border outline-none" placeholder="e.g. Guitar x Vocals" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Genres (Pick 3)</label>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1].map(i => (
                  <select 
                    key={i} 
                    {...register(`genres.${i}`)} 
                    className="w-full p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Genre {i+1}</option>
                    {genresList.map(genre => (
                      <option key={genre.id} value={genre.name}>{genre.name}</option>
                    ))}
                  </select>
                ))}
                <input 
                  {...register('genres.2')} 
                  className="w-full p-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-emerald-500" 
                  placeholder="Any other Genre" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Preferred Days</label>
              <div className="flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <label key={day} className="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full border cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input type="checkbox" value={day} {...register('preferred_days')} className="rounded text-emerald-600" />
                    <span className="text-xs font-medium">{day}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Languages (e.g. English, Spanish)</label>
              <input {...register('languages', { setValueAs: (v) => typeof v === 'string' ? v.split(',').map(s => s.trim()) : v })} className="w-full p-3 rounded-xl border outline-none" placeholder="Comma separated" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Bio</label>
            <textarea {...register('bio')} rows={4} className="w-full p-3 rounded-xl border outline-none" placeholder="Tell us about your musical journey..." />
          </div>
        </section>

        {/* Bank Details */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2 flex items-center">
            Bank Details (For Earnings) <InfoTooltip content="Enter your bank account information to receive payouts for completed performances. Your financial details are encrypted and stored securely, and will only be used to transfer your earnings." />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name on Account</label>
              <input {...register('bank_name_on_account')} className="w-full p-3 rounded-xl border outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Account Number</label>
              <input {...register('bank_account_number')} className="w-full p-3 rounded-xl border outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bank Name</label>
              <input {...register('bank_name')} className="w-full p-3 rounded-xl border outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Branch Code</label>
              <input {...register('bank_branch_code')} className="w-full p-3 rounded-xl border outline-none" />
            </div>
          </div>
        </section>
      </form>

      {/* Agreement Modal */}
      <AnimatePresence>
        {showAgreement && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                <button 
                  onClick={() => setShowAgreement(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div 
                ref={agreementRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-8 prose prose-slate max-w-none scroll-smooth"
              >
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
                      <CheckCircle2 className="w-4 h-4" />
                      Ready to accept
                    </span>
                  ) : (
                    <span>Please read the full agreement</span>
                  )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => setShowAgreement(false)}
                    className="flex-1 sm:flex-none px-8 py-4 text-gray-600 font-bold hover:bg-gray-100 rounded-2xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAgreement}
                    disabled={!hasReadToBottom}
                    className="flex-1 sm:flex-none px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-emerald-200 active:scale-95"
                  >
                    I Agree & Save
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
