import React, { useState, useEffect } from 'react';
import { supabase, BookingRequest, Quotation } from '../supabase';
import { Calendar, Clock, MapPin, Send, CheckCircle, XCircle, Loader2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { cn, formatCurrency } from '../utils';

export default function BookingManager() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [quotePrice, setQuotePrice] = useState<number>(0);
  const [quoteTerms, setQuoteTerms] = useState('');
  const [sending, setSending] = useState(false);

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
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Pending: {requests.filter(r => r.status === 'pending').length}</span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Quoted: {requests.filter(r => r.status === 'quoted').length}</span>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Confirmed: {requests.filter(r => r.status === 'confirmed').length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {requests.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed">
              <p className="text-gray-500">No booking requests yet.</p>
            </div>
          ) : (
            requests.map((request) => (
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
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                    request.status === 'pending' && "bg-yellow-100 text-yellow-700",
                    request.status === 'quoted' && "bg-blue-100 text-blue-700",
                    request.status === 'confirmed' && "bg-green-100 text-green-700",
                    request.status === 'rejected' && "bg-red-100 text-red-700"
                  )}>
                    {request.status}
                  </span>
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
          {selectedRequest ? (
            <div className="bg-white p-6 rounded-3xl shadow-xl border sticky top-8">
              <h2 className="text-2xl font-bold mb-4">Send Quotation</h2>
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">Venue Details</p>
                  <p className="font-medium">{selectedRequest.venue_name}</p>
                  <p className="text-sm text-gray-600">{selectedRequest.details}</p>
                </div>

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
                  disabled={sending || selectedRequest.status !== 'pending'}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                  {selectedRequest.status === 'pending' ? 'Send Quotation' : 'Already Quoted'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-12 rounded-3xl border-2 border-dashed text-center">
              <p className="text-gray-400">Select a request to view details and send a quote.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
