import React, { useState, useEffect } from 'react';
import { supabase, Earning } from '../supabase';
import { TrendingUp, Calendar, MapPin, DollarSign, ArrowUpRight, Loader2, Star, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../utils';
import CalendarPreview from './CalendarPreview';
import StarRating from './StarRating';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    upcomingGigs: 0,
    completedGigs: 0,
    starRating: 4.8,
    totalEarnings: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch Bookings for stats
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('status')
      .eq('talent_id', user.id);

    if (bookingsData) {
      const upcoming = bookingsData.filter(b => b.status === 'confirmed' || b.status === 'in_progress').length;
      const completed = bookingsData.filter(b => b.status === 'completed').length;
      
      setStats(prev => ({
        ...prev,
        upcomingGigs: upcoming,
        completedGigs: completed,
      }));
    }

    // Fetch Earnings
    const { data: earningsData } = await supabase
      .from('talent_payout_transactions')
      .select('*')
      .eq('talent_id', user.id)
      .order('created_at', { ascending: false });

    if (earningsData) {
      const total = earningsData.reduce((sum, t) => sum + (t.amount || 0), 0);
      setStats(prev => ({ ...prev, totalEarnings: total }));
      setRecentTransactions(earningsData.slice(0, 5));
    }

    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tight">Artist Dashboard</h1>
        <div className="text-sm text-gray-500 hidden sm:block">Welcome back, {format(new Date(), 'MMMM do')}</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-black text-white p-8 rounded-[2rem] space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">Upcoming</span>
          </div>
          <div>
            <div className="text-4xl font-bold">{stats.upcomingGigs}</div>
            <p className="text-white/40 text-sm mt-1 font-medium">Confirmed events</p>
          </div>
        </div>

        <div className="bg-emerald-500 text-white p-8 rounded-[2rem] space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-white/10 rounded-2xl">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">Completed</span>
          </div>
          <div>
            <div className="text-4xl font-bold">{stats.completedGigs}</div>
            <p className="text-white/40 text-sm mt-1 font-medium">Delivered</p>
          </div>
        </div>

        <div className="bg-white border p-8 rounded-[2rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Earnings</span>
          </div>
          <div>
            <div className="text-4xl font-bold text-black">{formatCurrency(stats.totalEarnings)}</div>
            <p className="text-gray-400 text-sm mt-1 font-medium">Total payouts</p>
          </div>
        </div>

        <div className="bg-white border p-8 rounded-[2rem] space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-yellow-50 rounded-2xl">
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Rating</span>
          </div>
          <div>
            <div className="text-4xl font-bold text-black">{stats.starRating}</div>
            <p className="text-gray-400 text-sm mt-1 font-medium">Avg feedback</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CalendarPreview />
        </div>
        <div className="lg:col-span-1 space-y-8">
          {/* Recent Earnings Widget */}
          <div className="bg-white border p-8 rounded-[2rem] shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Recent Earnings</h2>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="space-y-4">
              {recentTransactions.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No transactions yet.</p>
              ) : (
                recentTransactions.map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                    <div>
                      <p className="text-sm font-bold">{t.venue_name || 'Gig Payment'}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{format(new Date(t.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="text-sm font-black text-emerald-600">
                      +{formatCurrency(t.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Rating Demo Section */}
          <div className="bg-white border p-8 rounded-[2rem] shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <Star className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Feedback</h2>
                <p className="text-gray-500 text-xs">Organisers can leave feedback here.</p>
              </div>
            </div>
            <StarRating talentId="mock-artist-id" />
          </div>
        </div>
      </div>
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
