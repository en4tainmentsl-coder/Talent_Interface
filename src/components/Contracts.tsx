import React, { useState, useEffect } from 'react';
import { supabase, BookingRequest } from '../supabase';
import { FileText, MapPin, Calendar, Clock, Download, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Contracts() {
  const [contracts, setContracts] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContracts();
  }, []);

  async function fetchContracts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Contracts are confirmed or completed bookings
    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('talent_id', user.id)
      .in('status', ['confirmed', 'completed'])
      .order('event_date', { ascending: false });

    if (data) {
      setContracts(data);
    }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-emerald-100 rounded-2xl">
          <FileText className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Artist Contracts</h1>
          <p className="text-gray-500 font-medium">Manage and view your performance agreements with venues.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {contracts.length === 0 ? (
          <div className="bg-white border rounded-[2.5rem] p-12 text-center space-y-4">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No active contracts found.</p>
            <p className="text-sm text-gray-400">Contracts appear here once a booking is confirmed.</p>
          </div>
        ) : (
          contracts.map((contract) => (
            <div key={contract.id} className="bg-white border rounded-[2.5rem] p-8 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      contract.status === 'confirmed' ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                    )}>
                      {contract.status === 'confirmed' ? 'Active Contract' : 'Completed'}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">ID: {contract.id.slice(0, 8)}</span>
                  </div>
                  
                  <h2 className="text-2xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors">
                    {contract.venue_name}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      {format(new Date(contract.event_date), 'MMMM do, yyyy')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      {contract.event_time} ({contract.duration})
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      {contract.venue_type}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors">
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                  <button className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-900 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
