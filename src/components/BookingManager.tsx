import React, { useState, useEffect } from 'react';
import { supabase, BookingRequest } from '../supabase';
import { Calendar, Clock, MapPin, Send, CheckCircle, XCircle, Loader2, DollarSign, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn, formatCurrency } from '../utils';
import { motion } from 'motion/react';
import { createCalendarEvent } from '../utils/googleCalendar';

export default function BookingManager() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [quotePrice, setQuotePrice] = useState<number>(0);
  const [quoteTerms, setQuoteTerms] = useState('');
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'completed'>('pending');

  useEffect(() => {
    fetchBookings();
  }, []);

  async function fetchBookings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('talent_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setBookings(data);
    setLoading(false);
  }

  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'pending') return b.status === 'pending';
    if (activeTab === 'confirmed') return b.status === 'confirmed' || b.status === 'in_progress';
    if (activeTab === 'completed') return b.status === 'completed';
    return false;
  });

  const handleSendQuote = async () => {
    if (!selectedBooking) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // In this new schema, we might just update the booking with the quote info
      // or use a separate quotations table. Assuming we update the booking for now
      // or if the user wants a separate table, we'll follow the previous logic but with new names.
      
      const { error: quoteError } = await supabase
        .from('quotations')
        .insert({
          booking_id: selectedBooking.id,
          talent_id: user?.id,
          price: quotePrice,
          terms: quoteTerms,
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (quoteError) throw quoteError;

      // Update status to 'pending' (or 'quoted' if that was a status, but user said 'pending' | 'confirmed' | ...)
      // Let's assume 'pending' means it's still in negotiation/waiting.
      // Actually, let's keep it as is but use 'booking_status' column.
      
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'pending' }) // Or whatever status represents "quoted"
        .eq('id', selectedBooking.id);

      if (updateError) throw updateError;

      alert('Quotation sent successfully!');
      setSelectedBooking(null);
      fetchBookings();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSending(false);
    }
  };

  const handleSyncToCalendar = async (booking: BookingRequest) => {
    setSyncing(booking.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        throw new Error('Google Calendar access not authorized. Please sign out and sign in again.');
      }

      const calendarLink = await createCalendarEvent(session.provider_token, booking);
      
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ google_calendar_event_link: calendarLink })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, google_calendar_event_link: calendarLink } : b));
      alert('Synced to Google Calendar!');
    } catch (error: any) {
      if (error.message === 'REAUTH_REQUIRED') {
        alert('Your Google session has expired. Please sign out and sign in again.');
      } else {
        alert(error.message);
      }
    } finally {
      setSyncing(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Bookings</h1>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-4 mb-8 border-b overflow-x-auto no-scrollbar">
        {(['pending', 'confirmed', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedBooking(null);
            }}
            className={cn(
              "pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-all relative whitespace-nowrap",
              activeTab === tab ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            {tab}
            <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">
              {bookings.filter(b => {
                if (tab === 'pending') return b.status === 'pending';
                if (tab === 'confirmed') return b.status === 'confirmed' || b.status === 'in_progress';
                if (tab === 'completed') return b.status === 'completed';
                return false;
              }).length}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed">
              <p className="text-gray-500">No {activeTab} bookings yet.</p>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <div 
                key={booking.id}
                onClick={() => setSelectedBooking(booking)}
                className={cn(
                  "p-6 rounded-2xl border transition-all cursor-pointer hover:shadow-lg",
                  selectedBooking?.id === booking.id ? "border-emerald-500 bg-emerald-50/30" : "bg-white"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{booking.venue_name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{booking.venue_type} • {booking.details.substring(0, 50)}...</p>
                  </div>
                  {booking.status === 'confirmed' && (
                    <div className="flex items-center gap-2">
                      {booking.google_calendar_event_link ? (
                        <a 
                          href={booking.google_calendar_event_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-colors"
                          title="View in Google Calendar"
                        >
                          <Calendar className="w-5 h-5" />
                        </a>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSyncToCalendar(booking);
                          }}
                          disabled={syncing === booking.id}
                          className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                          title="Sync to Google Calendar"
                        >
                          {syncing === booking.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(booking.event_date), 'MMM dd, yyyy')}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    {booking.event_time} ({booking.duration})
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
          {selectedBooking ? (
            <div className="bg-white p-6 rounded-3xl shadow-xl border sticky top-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {selectedBooking.status === 'pending' ? 'Send Quotation' : 'Booking Details'}
                </h2>
                <button 
                  onClick={() => setSelectedBooking(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">Venue Details</p>
                  <p className="font-medium">{selectedBooking.venue_name}</p>
                  <p className="text-sm text-gray-600">{selectedBooking.details}</p>
                </div>

                {selectedBooking.status === 'pending' ? (
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
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
                        <CheckCircle className="w-4 h-4" />
                        {selectedBooking.status === 'confirmed' ? 'Booking Confirmed' : 'Booking Completed'}
                      </div>
                      <p className="text-sm text-emerald-600">
                        {selectedBooking.status === 'confirmed' 
                          ? 'This booking is confirmed. Check your calendar for details.' 
                          : 'This booking has been completed. Thank you!'}
                      </p>
                    </div>

                    {selectedBooking.google_calendar_event_link && (
                      <a 
                        href={selectedBooking.google_calendar_event_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-4 bg-white border-2 border-gray-100 text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                      >
                        <ExternalLink className="w-5 h-5" />
                        View in Calendar
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50 rounded-3xl border-2 border-dashed">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">Select a booking to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
