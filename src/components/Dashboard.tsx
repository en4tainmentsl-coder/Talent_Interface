import React, { useState, useEffect } from 'react';
import { supabase, Earning } from '../supabase';
import { TrendingUp, Calendar, MapPin, DollarSign, ArrowUpRight, Loader2, Star, Heart, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../utils';
import CalendarPreview from './CalendarPreview';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    upcomingGigs: 0,
    completedGigs: 0,
    starRating: 4.8,
    heartRating: 95,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch Bookings for stats
    const { data: bookingsData } = await supabase
      .from('booking_requests')
      .select('status')
      .eq('talent_id', user.id);

    if (bookingsData) {
      const upcoming = bookingsData.filter(b => b.status === 'confirmed').length;
      const completed = bookingsData.filter(b => b.status === 'completed').length;
      
      setStats(prev => ({
        ...prev,
        upcomingGigs: upcoming,
        completedGigs: completed,
      }));
    }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tight">Artist Dashboard</h1>
        <div className="text-sm text-gray-500">Welcome back, {format(new Date(), 'MMMM do')}</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-black text-white p-8 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">Upcoming Gigs</span>
          </div>
          <div>
            <div className="text-4xl font-bold">{stats.upcomingGigs}</div>
            <p className="text-white/40 text-sm mt-1">Confirmed events</p>
          </div>
        </div>

        <div className="bg-emerald-500 text-white p-8 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-white/10 rounded-2xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">Completed Gigs</span>
          </div>
          <div>
            <div className="text-4xl font-bold">{stats.completedGigs}</div>
            <p className="text-white/40 text-sm mt-1">Successfully delivered</p>
          </div>
        </div>

        <div className="bg-white border p-8 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-yellow-50 rounded-2xl">
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Star Rating</span>
          </div>
          <div>
            <div className="text-4xl font-bold text-black">{stats.starRating}</div>
            <p className="text-gray-400 text-sm mt-1">Average fan feedback</p>
          </div>
        </div>

        <div className="bg-white border p-8 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-red-50 rounded-2xl">
              <Heart className="w-6 h-6 text-red-500 fill-red-500" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Heart Rating</span>
          </div>
          <div>
            <div className="text-4xl font-bold text-black">{stats.heartRating}%</div>
            <p className="text-gray-400 text-sm mt-1">Venue love score</p>
          </div>
        </div>
      </div>

      <CalendarPreview />
    </div>
  );
}

function CheckCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
