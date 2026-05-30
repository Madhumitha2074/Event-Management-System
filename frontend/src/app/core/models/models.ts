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
  status: string;
  startDateTime: string;
  endDateTime: string;
  venue: string;
  city: string;
  address?: string;
  imageUrl?: string;
  ticketPrice: number;
  totalTickets: number;
  bookedTickets: number;
  availableTickets: number;
  organizerName: string;
  organizerId: number;
  createdAt: string;
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
}

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
