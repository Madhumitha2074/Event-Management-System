// src/app/core/models/models.ts

export interface User {
  id: string;
  email: string;
  name: string;
  fullName?: string;
  role: string;
  phoneNumber?: string;
  createdAt?: string;
  userId?: string;
}

export interface AuthResponse {
  token: string;
  name: string;
  email: string;
  role: string;
  userId: number;
  autoLogin?: boolean;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phoneNumber?: string;
  password: string;
  role: string;
  acceptedTerms: boolean;
  acceptedTermsAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ============================================================
// UPDATED: Event Interface with Expiry Properties
// ============================================================
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
  contactEmail?: string;
  googleMapsUrl?: string;
  ticketPrice: number;
  minPrice?: number;
  maxPrice?: number; 
  totalTickets: number;
  bookedTickets: number;
  availableTickets: number;
  organizerName: string;
  organizerId: number;
  createdAt: string;
  seatConfig?: string; 
  hasSeatMap?: boolean;
  
  // ✅ Expired event properties
  isActive: boolean;
  timeRemaining?: string;
  isEndingSoon?: boolean;
}

// ============================================================
// UPDATED: EventFilter Interface with Expiry & Live Filters
// ============================================================
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
  
  // ✅ Expiry filter options
  includeExpired?: boolean;
  onlyActive?: boolean;
  showEndingSoon?: boolean;
  endingSoonThresholdMinutes?: number;
  
  // ✅ NEW: Live events filter
  showLive?: boolean;
}

// ============================================================
// UPDATED: PagedResult Interface with Metadata
// ============================================================
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  
  // ✅ Additional metadata
  activeCount?: number;
  expiredCount?: number;
  lastUpdated?: string;
}

// ── Seat types ───────────────────────────────────────────────
 
export type SeatTier = 'Premium' | 'Standard' | 'Economy';

export interface EventSeat {
  id: number;
  seatNumber: string;
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
  contactEmail?: string;
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
  seatNumber?: string;
  tier?: string;
  seatPrice?: number;
  seatId?: number;
}

// NEW — booking request with seats
export interface CreateBookingWithSeatsRequest {
  eventId: number;
  seatIds: number[];
  attendees: { name: string; email: string }[];
}
 
// ── Legacy flat booking ──────────────────────────────────────
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
  Standard: { bg: '#4f9eff', text: '#ffffff', border: '#2563eb' },
  Economy:  { bg: '#6ee7b7', text: '#064e3b', border: '#059669' }
};

// ============================================================
// ✅ NEW: Expired Event Related Interfaces
// ============================================================

/**
 * Response from the cleanup endpoint
 */
export interface CleanupResponse {
  updatedCount: number;
  eventIds?: number[];
  cleanupTime: string;
  message: string;
}

/**
 * Response for events ending soon
 */
export interface EventsEndingSoonResponse {
  events: Event[];
  thresholdMinutes: number;
  checkedAt: string;
}

/**
 * Event status summary for dashboard
 */
export interface EventStatusSummary {
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  ongoingEvents: number;
  endedEvents: number;
  cancelledEvents: number;
  eventsEndingSoon: number;
  lastUpdated: string;
}

/**
 * Result of expired events cleanup
 */
export interface ExpiredEventsCleanupResult {
  updatedCount: number;
  eventIds: number[];
  cleanupTime: string;
  message: string;
}