import React, { useState, useEffect, useRef } from 'react';
import { supabase, Profile } from '../supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Camera, Upload, Save, Loader2, CheckCircle2, X } from 'lucide-react';
import { cn } from '../utils';
import Markdown from 'react-markdown';
import { ARTIST_AGREEMENT } from '../constants';
import { motion, AnimatePresence } from 'motion/react';

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
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setProfile(data);
          reset({
            ...data,
            secondary_locations: data.secondary_locations || ['', '', '', ''],
            genres: data.genres || ['', '', ''],
          });
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
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...pendingValues,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, bucket: string, field: keyof Profile) => {
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

      // Update profile with new URL
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, [field]: publicUrl });

      if (updateError) throw updateError;
      
      setProfile(prev => prev ? { ...prev, [field]: publicUrl } : null);
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
        <button 
          onClick={handleSubmit(onSubmit)}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
          Save Profile
        </button>
      </div>

      <form className="space-y-12">
        {/* Media Section */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b pb-2">Media & Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
              <span className="text-sm font-medium">Profile Picture</span>
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">NIC Front</label>
                <div className="h-32 bg-gray-50 rounded-xl border border-dashed flex items-center justify-center relative overflow-hidden">
                  {profile?.nic_front_url ? <img src={profile.nic_front_url} className="w-full h-full object-cover" /> : <Upload className="text-gray-300" />}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'documents', 'nic_front_url')} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">NIC Back</label>
                <div className="h-32 bg-gray-50 rounded-xl border border-dashed flex items-center justify-center relative overflow-hidden">
                  {profile?.nic_back_url ? <img src={profile.nic_back_url} className="w-full h-full object-cover" /> : <Upload className="text-gray-300" />}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'documents', 'nic_back_url')} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Basic Info */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Stage Name</label>
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
            <label className="text-sm font-medium">National ID Number</label>
            <input {...register('national_id_number')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Price per Session</label>
            <input type="number" {...register('price_per_session', { valueAsNumber: true })} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </section>

        {/* Social Links */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Social Proof (FB/IG)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Trailer Video Link</label>
              <input {...register('fb_trailer_link')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Live Performance Link</label>
              <input {...register('fb_live_link')} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="https://..." />
            </div>
          </div>
        </section>

        {/* Locations */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Travel & Locations</h2>
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
          <h2 className="text-xl font-semibold border-b pb-2">Performance Details</h2>
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
                {[0, 1, 2].map(i => (
                  <input key={i} {...register(`genres.${i}`)} className="w-full p-2 rounded-lg border text-sm" placeholder={`Genre ${i+1}`} />
                ))}
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
          <h2 className="text-xl font-semibold border-b pb-2">Bank Details (For Earnings)</h2>
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
