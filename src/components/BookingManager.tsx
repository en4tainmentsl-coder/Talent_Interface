import React, { useState, useEffect } from 'react';
import { supabase, BookingRequest, Quotation } from '../supabase';
import { Calendar, Clock, MapPin, Send, CheckCircle, XCircle, Loader2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { cn, formatCurrency } from '../utils';
import { motion } from 'motion/react';

export default function BookingManager() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [quotePrice, setQuotePrice] = useState<number>(0);
  const [quoteTerms, setQuoteTerms] = useState('');
  const [sending, setSending] = useState(false);

  const [activeTab, setActiveTab] = useState<'pending' | 'quoted' | 'confirmed'>('pending');

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('talent_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setRequests(data);
    setLoading(false);
  }

  const filteredRequests = requests.filter(r => r.status === activeTab);

  const handleSendQuote = async () => {
    if (!selectedRequest) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: quoteError } = await supabase
        .from('quotations')
        .insert({
          booking_id: selectedRequest.id,
          talent_id: user?.id,
          price: quotePrice,
          terms: quoteTerms,
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (quoteError) throw quoteError;

      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'quoted' })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      alert('Quotation sent successfully!');
      setSelectedRequest(null);
      fetchRequests();
      setActiveTab('quoted');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Booking Requests</h1>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-4 mb-8 border-b">
        {(['pending', 'quoted', 'confirmed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedRequest(null);
            }}
            className={cn(
              "pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-all relative",
              activeTab === tab ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            {tab}
            <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">
              {requests.filter(r => r.status === tab).length}
            </span>
            {activeTab === tab && (
              <motion.div 
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full"
              />
            )}
          </button>
        ))}
      </div>

      <div className={cn(
        "grid grid-cols-1 gap-8",
        selectedRequest ? "lg:grid-cols-3" : "lg:grid-cols-1"
      )}>
        <div className={cn(
          "space-y-4",
          selectedRequest ? "lg:col-span-2" : "lg:col-span-1"
        )}>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed">
              <p className="text-gray-500">No {activeTab} requests yet.</p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <div 
                key={request.id}
                onClick={() => setSelectedRequest(request)}
                className={cn(
                  "p-6 rounded-2xl border transition-all cursor-pointer hover:shadow-lg",
                  selectedRequest?.id === request.id ? "border-emerald-500 bg-emerald-50/30" : "bg-white"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{request.venue_name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{request.venue_type} • {request.details.substring(0, 50)}...</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(request.event_date), 'MMM dd, yyyy')}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    {request.event_time} ({request.duration})
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    Venue Location
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-1">
          {selectedRequest && (
            <div className="bg-white p-6 rounded-3xl shadow-xl border sticky top-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {activeTab === 'pending' ? 'Send Quotation' : 'Booking Details'}
                </h2>
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">Venue Details</p>
                  <p className="font-medium">{selectedRequest.venue_name}</p>
                  <p className="text-sm text-gray-600">{selectedRequest.details}</p>
                </div>

                {activeTab === 'pending' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Quote Price</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="number" 
                          value={quotePrice}
                          onChange={(e) => setQuotePrice(Number(e.target.value))}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Terms & Conditions</label>
                      <textarea 
                        value={quoteTerms}
                        onChange={(e) => setQuoteTerms(e.target.value)}
                        rows={4}
                        className="w-full p-4 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        placeholder="e.g. 50% advance required, sound system provided by venue..."
                      />
                    </div>

                    <button 
                      onClick={handleSendQuote}
                      disabled={sending}
                      className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                      Send Quotation
                    </button>
                  </>
                ) : (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
                      <CheckCircle className="w-4 h-4" />
                      {activeTab === 'quoted' ? 'Quotation Sent' : 'Booking Confirmed'}
                    </div>
                    <p className="text-sm text-emerald-600">
                      {activeTab === 'quoted' 
                        ? 'Waiting for venue to review your quote.' 
                        : 'This booking is confirmed. Check your calendar for details.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
