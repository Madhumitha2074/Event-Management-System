import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking, CreateBookingRequest } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly API = `${environment.apiUrl}/bookings`;

  constructor(private http: HttpClient) {}

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
}
