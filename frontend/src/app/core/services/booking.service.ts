import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking, CreateBookingRequest, CreateBookingWithSeatsRequest, EventSeat } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly API = `${environment.apiUrl}/bookings`;
  private readonly EVENTS   = `${environment.apiUrl}/events`;

  constructor(private http: HttpClient) {}


    // ── Seat map ─────────────────────────────────────────────
  getEventSeats(eventId: number): Observable<EventSeat[]> {
    return this.http.get<EventSeat[]>(`${this.EVENTS}/${eventId}/seats`);
  }
 
  // ── New seat-based booking ───────────────────────────────
  createBookingWithSeats(data: CreateBookingWithSeatsRequest): Observable<Booking> {
    return this.http.post<Booking>(`${this.API}/with-seats`, data);
  }

  // ── Legacy flat booking (kept for backward compat) ───────
  createBooking(data: CreateBookingRequest): Observable<Booking> {
    return this.http.post<Booking>(this.API, data);
  }

  getMyBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(this.API);
  }

  getBookingById(id: number): Observable<Booking> {
    return this.http.get<Booking>(`${this.API}/${id}`);
  }

  cancelBooking(id: number): Observable<any> {
    return this.http.post(`${this.API}/${id}/cancel`, {});
  }

  downloadBookingPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.API}/${id}/download`, {
      responseType: 'blob'
    });
  }
}
