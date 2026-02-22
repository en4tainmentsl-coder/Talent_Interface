import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { format, addDays, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Clock, MapPin, Loader2, ExternalLink } from 'lucide-react';

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  htmlLink: string;
}

export default function CalendarPreview() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCalendarEvents();
  }, []);

  async function fetchCalendarEvents() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.provider_token;

      if (!token) {
        setError('Google Calendar access not authorized. Please sign out and sign in again.');
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();
      const sevenDaysFromNow = addDays(new Date(), 7).toISOString();

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${sevenDaysFromNow}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error('Failed to fetch calendar events');
      }

      const data = await response.json();
      setEvents(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border rounded-[2rem] p-12 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-gray-500 font-medium">Syncing with Google Calendar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border rounded-[2rem] p-12 text-center space-y-4">
        <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
          <CalendarIcon className="w-8 h-8 text-red-500" />
        </div>
        <div className="max-w-xs mx-auto">
          <h3 className="text-lg font-bold text-gray-900">Calendar Sync Error</h3>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
        <button 
          onClick={() => supabase.auth.signOut()}
          className="px-6 py-2 bg-black text-white rounded-full text-sm font-bold"
        >
          Sign Out & Re-authorize
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
      <div className="p-8 border-b flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <CalendarIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Next 7 Days</h2>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Google Calendar Preview</p>
          </div>
        </div>
        <a 
          href="https://calendar.google.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-1"
        >
          Open Calendar <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="divide-y">
        {events.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-gray-400 font-medium">No events scheduled for the next 7 days.</p>
            <p className="text-xs text-gray-300">Time to book some gigs!</p>
          </div>
        ) : (
          events.map((event) => {
            const start = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date!);
            const isAllDay = !event.start.dateTime;

            return (
              <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors flex items-start gap-6 group">
                <div className="flex flex-col items-center min-w-[60px] py-1 bg-gray-50 rounded-2xl border border-gray-100 group-hover:bg-white group-hover:border-emerald-100 transition-colors">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">
                    {format(start, 'MMM')}
                  </span>
                  <span className="text-2xl font-black text-gray-900 leading-none">
                    {format(start, 'dd')}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">
                    {format(start, 'EEE')}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  <h3 className="font-bold text-gray-900 leading-tight group-hover:text-emerald-600 transition-colors">
                    {event.summary}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {isAllDay ? 'All Day' : format(start, 'h:mm a')}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[200px]">{event.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <a 
                  href={event.htmlLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-gray-300 hover:text-emerald-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
