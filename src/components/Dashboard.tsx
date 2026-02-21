import React, { useState, useEffect } from 'react';
import { supabase, Earning } from '../supabase';
import { TrendingUp, Calendar, MapPin, DollarSign, ArrowUpRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../utils';

export default function Dashboard() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    completedGigs: 0,
  });

  useEffect(() => {
    fetchEarnings();
  }, []);

  async function fetchEarnings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('earnings')
      .select('*')
      .eq('talent_id', user.id)
      .order('date', { ascending: false });

    if (data) {
      setEarnings(data);
      const total = data.reduce((sum, e) => sum + e.amount, 0);
      const now = new Date();
      const thisMonth = data
        .filter(e => {
          const d = new Date(e.date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, e) => sum + e.amount, 0);
      
      setStats({
        total,
        thisMonth,
        completedGigs: data.length,
      });
    }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tight">Talent Dashboard</h1>
        <div className="text-sm text-gray-500">Welcome back, {format(new Date(), 'MMMM do')}</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black text-white p-8 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-white/10 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">Total Earnings</span>
          </div>
          <div>
            <div className="text-4xl font-bold">{formatCurrency(stats.total)}</div>
            <p className="text-white/40 text-sm mt-1">Lifetime performance revenue</p>
          </div>
        </div>

        <div className="bg-emerald-500 text-white p-8 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">This Month</span>
          </div>
          <div>
            <div className="text-4xl font-bold">{formatCurrency(stats.thisMonth)}</div>
            <p className="text-white/40 text-sm mt-1">Revenue for {format(new Date(), 'MMMM')}</p>
          </div>
        </div>

        <div className="bg-white border p-8 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-gray-100 rounded-2xl">
              <CheckCircle className="w-6 h-6 text-gray-600" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Gigs Completed</span>
          </div>
          <div>
            <div className="text-4xl font-bold text-black">{stats.completedGigs}</div>
            <p className="text-gray-400 text-sm mt-1">Successfully delivered events</p>
          </div>
        </div>
      </div>

      {/* Recent Earnings Table */}
      <div className="bg-white border rounded-[2rem] overflow-hidden">
        <div className="p-8 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent Earnings</h2>
          <button className="text-sm font-bold text-emerald-600 hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase">Venue</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase">Date</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase">Amount</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {earnings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-gray-500">No earnings recorded yet.</td>
                </tr>
              ) : (
                earnings.map((earning) => (
                  <tr key={earning.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-bold">{earning.venue_name}</div>
                    </td>
                    <td className="px-8 py-6 text-sm text-gray-600">
                      {format(new Date(earning.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-mono font-bold">{formatCurrency(earning.amount)}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Paid</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
