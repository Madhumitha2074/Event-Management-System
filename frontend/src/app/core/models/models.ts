export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  name: string;
  email: string;
  role: string;
  userId: number;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  category: string;
  categoryIndex: number;
  status: string;
  startDateTime: string;
  endDateTime: string;
  venue: string;
  city: string;
  address?: string;
  imageUrl?: string;
  ticketPrice: number;
  minPrice?: number;      // NEW
  maxPrice?: number; 
  totalTickets: number;
  bookedTickets: number;
  availableTickets: number;
  organizerName: string;
  organizerId: number;
  createdAt: string;
  seatConfig?: string; 
  hasSeatMap?: boolean;
  googleMapsUrl?: string;
}

export interface EventFilter {
  search?: string;
  city?: string;
  category?: number;
  startDate?: string;
  endDate?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Seat types ───────────────────────────────────────────────
 
export type SeatTier = 'Premium' | 'Ordinary' | 'Economy';
 
export interface EventSeat {
  id: number;
  seatNumber: string;   // e.g. "P-A1"
  tier: SeatTier;
  price: number;
  isBooked: boolean;
}
 
export interface SeatTierConfig {
  tier: SeatTier;
  rows: number;
  seatsPerRow: number;
  price: number;
}
 
// Grouped seats for the seat map display
export interface SeatRow {
  rowLabel: string;
  tier: SeatTier;
  seats: EventSeat[];
}
 
export interface SeatSection {
  tier: SeatTier;
  rows: SeatRow[];
  pricePerSeat: number;
}

export interface CreateEventRequest {
  title: string;
  description: string;
  category: number;
  startDateTime: string;
  endDateTime: string;
  venue: string;
  city: string;
  address?: string;
  imageUrl?: string;
  ticketPrice: number;
  totalTickets: number;
  seatTiers?: SeatTierConfig[];
}

export interface Booking {
  id: number;
  bookingReference: string;
  eventId: number;
  eventTitle: string;
  eventVenue: string;
  eventStartDateTime: string;
  ticketCount: number;
  totalAmount: number;
  status: string;
  bookedAt: string;
  tickets: Ticket[];
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  attendeeName: string;
  attendeeEmail: string;
  isUsed: boolean;
  seatNumber?: string;   // NEW
  tier?: string;         // NEW
  seatPrice?: number;    // NEW
  seatId?: number;
}

// NEW — booking request with seats
export interface CreateBookingWithSeatsRequest {
  eventId: number;
  seatIds: number[];
  attendees: { name: string; email: string }[];
}
 
// ── Legacy flat booking (keep for backward compat) ───────────
export interface CreateBookingRequest {
  eventId: number;
  ticketCount: number;
  attendees: { name: string; email: string }[];
}

export const EVENT_CATEGORIES = [
  { value: 0, label: 'Music' },
  { value: 1, label: 'Sports' },
  { value: 2, label: 'Technology' },
  { value: 3, label: 'Food' },
  { value: 4, label: 'Art' },
  { value: 5, label: 'Business' },
  { value: 6, label: 'Health' },
  { value: 7, label: 'Other' }
];


export const SEAT_TIER_COLORS: Record<SeatTier, { bg: string; text: string; border: string }> = {
  Premium:  { bg: '#ffd700', text: '#1a1200', border: '#b8960c' },
  Ordinary: { bg: '#4f9eff', text: '#ffffff', border: '#2563eb' },
  Economy:  { bg: '#6ee7b7', text: '#064e3b', border: '#059669' }
};