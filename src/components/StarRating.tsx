import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Star, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../utils';

interface StarRatingProps {
  talentId: string;
  bookingId?: string; // Added bookingId prop
  onSuccess?: () => void;
}

/**
 * StarRating Component
 * 
 * Business Rules:
 * - Store ratings in reviews table
 * - Only users with 'client' role are allowed to submit
 * - Rating value must be between 1 and 5 inclusive
 * - Ratings are final (no editing or deleting)
 * - Store reviewer_user_id on insert
 * - Clear, user-friendly error messages for non-clients
 */
export default function StarRating({ talentId, bookingId, onSuccess }: StarRatingProps) {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    checkUserRole();
  }, []);

  async function checkUserRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCheckingRole(false);
        return;
      }

      const { data, error: roleError } = await supabase
        .from('profiles_users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (roleError) throw roleError;
      setUserRole(data?.role || null);
    } catch (err) {
      console.error('Error checking user role:', err);
    } finally {
      setCheckingRole(false);
    }
  }

  const handleSubmit = async (selectedRating: number) => {
    if (userRole !== 'client') {
      setError('Only clients are permitted to submit ratings.');
      return;
    }

    if (selectedRating < 1 || selectedRating > 5) {
      setError('Rating must be between 1 and 5.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // If bookingId is provided, verify it's completed
      if (bookingId) {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('booking_status')
          .eq('id', bookingId)
          .single();
        
        if (bookingError) throw bookingError;
        if (booking?.booking_status !== 'completed') {
          throw new Error('Ratings can only be submitted for completed bookings.');
        }
      }

      // Insert into reviews table
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          rating: selectedRating,
          reviewer_user_id: user.id,
          talent_id: talentId,
          booking_id: bookingId || null, // TODO: Ensure booking_id is passed from parent
          stage_presence_rating: selectedRating,
          musical_ability_rating: selectedRating,
          professionalism_rating: selectedRating,
          sound_quality_rating: selectedRating,
          audience_response_rating: selectedRating,
          created_at: new Date().toISOString()
        });

      if (reviewError) throw reviewError;

      setSuccess(true);
      setRating(selectedRating);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingRole) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Checking permissions...</div>;
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
        <CheckCircle2 className="w-5 h-5" />
        <span className="font-bold">Rating submitted!</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Submit Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              disabled={submitting || userRole !== 'client'}
              onClick={() => handleSubmit(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className={cn(
                "p-1 transition-all transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
                userRole !== 'client' ? "cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <Star
                className={cn(
                  "w-8 h-8 transition-colors",
                  (hover || rating) >= star 
                    ? "text-yellow-400 fill-yellow-400" 
                    : "text-gray-200"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100 text-sm animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {userRole !== 'client' && !error && (
        <p className="text-xs text-gray-400 italic">Only clients can rate artists.</p>
      )}
    </div>
  );
}
