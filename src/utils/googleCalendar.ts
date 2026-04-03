import { BookingRequest } from '../supabase';

export async function createCalendarEvent(providerToken: string, booking: any): Promise<string> {
  const startTime = new Date(`${booking.event_date}T${booking.event_time}`);
  
  // Infer 2-hour duration if not available or not in a simple format
  let durationHours = 2;
  if (booking.duration) {
    const match = booking.duration.match(/(\d+)/);
    if (match) durationHours = parseInt(match[1]);
  }
  
  const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

  const event = {
    summary: `Gig: ${booking.venue_name}`,
    description: booking.details || 'No additional details provided.',
    start: {
      dateTime: startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${providerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (response.status === 401) {
    throw new Error('REAUTH_REQUIRED');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create calendar event');
  }

  const data = await response.json();
  return data.htmlLink;
}

export async function deleteCalendarEvent(providerToken: string, eventId: string): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${providerToken}`,
    },
  });

  if (response.status === 401) {
    throw new Error('REAUTH_REQUIRED');
  }

  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to delete calendar event');
  }
}
