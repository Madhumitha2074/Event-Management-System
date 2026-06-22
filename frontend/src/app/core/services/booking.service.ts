import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { 
  map, 
  catchError, 
  tap, 
  timeout, 
  retry,
  mergeMap,
  concatMap,
  finalize,
  shareReplay,
  delay,
  retryWhen,
  take,
  scan
} from 'rxjs/operators';
import { Booking, CreateBookingRequest, CreateBookingWithSeatsRequest, EventSeat } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly API = `${environment.apiUrl}/bookings`;
  private readonly EVENTS = `${environment.apiUrl}/events`;

  // ✅ Cache for seat maps
  private seatCache = new Map<number, { seats: EventSeat[]; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(private http: HttpClient) {}

  /**
   * ✅ UPDATED: Get event seats with caching and retryWhen
   */
  getEventSeats(eventId: number): Observable<EventSeat[]> {
    // Check cache
    const cached = this.seatCache.get(eventId);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log(`📦 Using cached seats for event ${eventId}`);
      return new Observable<EventSeat[]>(observer => {
        observer.next(cached.seats);
        observer.complete();
      });
    }

    return this.http.get<EventSeat[]>(`${this.EVENTS}/${eventId}/seats`).pipe(
      timeout(15000),
      retryWhen(errors => 
        errors.pipe(
          delay(1000),
          scan((acc, error) => {
            if (acc >= 2) throw error;
            console.log(`🔄 Retry attempt ${acc + 1} for seats`);
            return acc + 1;
          }, 0)
        )
      ),
      map(seats => seats || []),
      tap(seats => {
        this.seatCache.set(eventId, { seats, timestamp: Date.now() });
        console.log(`📦 Cached ${seats.length} seats for event ${eventId}`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Create booking with retryWhen and finalize
   */
  createBooking(data: CreateBookingRequest): Observable<Booking> {
    return this.http.post<Booking>(this.API, data).pipe(
      timeout(30000),
      retryWhen(errors => 
        errors.pipe(
          delay(2000),
          take(2),
          concatMap((_, i) => {
            if (i === 1) throw new Error('Booking failed after retries');
            return [0];
          })
        )
      ),
      tap(booking => {
        console.log('✅ Booking created:', booking.bookingReference);
        // Clear seat cache for this event
        this.seatCache.delete(booking.eventId);
      }),
      finalize(() => {
        console.log('📋 Booking creation request completed');
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Create booking with seats using retryWhen
   */
  createBookingWithSeats(data: CreateBookingWithSeatsRequest): Observable<Booking> {
    return this.http.post<Booking>(`${this.API}/with-seats`, data).pipe(
      timeout(30000),
      retryWhen(errors => 
        errors.pipe(
          delay(2000),
          take(2),
          concatMap((_, i) => {
            if (i === 1) throw new Error('Seat booking failed after retries');
            return [0];
          })
        )
      ),
      tap(booking => {
        console.log('✅ Seat booking created:', booking.bookingReference);
        // Clear seat cache for this event
        this.seatCache.delete(data.eventId);
      }),
      finalize(() => {
        console.log('📋 Seat booking request completed');
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Get my bookings with map and distinct
   */
  getMyBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(this.API).pipe(
      timeout(15000),
      retry(2),
      map(bookings => bookings || []),
      tap(bookings => {
        console.log(`📋 ${bookings.length} bookings loaded`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Get booking by ID with mergeMap
   */
  getBookingById(id: number): Observable<Booking> {
    return this.http.get<Booking>(`${this.API}/${id}`).pipe(
      timeout(15000),
      retry(2),
      // ✅ Use mergeMap for sequential operations
      mergeMap(booking => {
        // Ensure tickets array exists
        if (!booking.tickets) {
          booking.tickets = [];
        }
        return [booking];
      }),
      tap(booking => {
        console.log(`📋 Booking ${id} loaded with ${booking.tickets?.length || 0} tickets`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Cancel booking with finalize
   */
  cancelBooking(id: number): Observable<any> {
    return this.http.post(`${this.API}/${id}/cancel`, {}).pipe(
      timeout(15000),
      retry(2),
      tap(() => {
        console.log(`✅ Booking ${id} cancelled successfully`);
        // Clear seat cache when booking is cancelled
        this.seatCache.clear();
      }),
      finalize(() => {
        console.log(`📋 Cancellation request for booking ${id} completed`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Download PDF with error handling
   */
  downloadBookingPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.API}/${id}/download`, {
      responseType: 'blob'
    }).pipe(
      timeout(30000),
      retry(2),
      tap(() => {
        console.log(`📥 PDF downloaded successfully for booking ${id}`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ NEW: Clear seat cache
   */
  clearSeatCache(eventId?: number): void {
    if (eventId) {
      this.seatCache.delete(eventId);
      console.log(`🧹 Seat cache cleared for event ${eventId}`);
    } else {
      this.seatCache.clear();
      console.log('🧹 All seat cache cleared');
    }
  }

  /**
   * ✅ NEW: Get cache stats for debugging
   */
  getCacheStats(): { size: number; keys: number[] } {
    const keys = Array.from(this.seatCache.keys());
    return {
      size: this.seatCache.size,
      keys: keys
    };
  }

  /**
   * ✅ NEW: Check if event seats are cached
   */
  isSeatsCached(eventId: number): boolean {
    const cached = this.seatCache.get(eventId);
    if (!cached) return false;
    return (Date.now() - cached.timestamp) < this.CACHE_TTL;
  }

  /**
   * ✅ NEW: Get cached seats without making API call
   */
  getCachedSeats(eventId: number): EventSeat[] | null {
    const cached = this.seatCache.get(eventId);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.seats;
    }
    return null;
  }

  /**
   * ✅ UPDATED: Handle errors with detailed logging
   */
  private handleError(error: any): Observable<never> {
    console.error('❌ Booking Service API Error:', error);
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else if (error.status) {
      // Server-side error
      errorMessage = error.error?.message || error.message || `Error ${error.status}`;
      
      switch (error.status) {
        case 400:
          errorMessage = error.error?.message || 'Bad request. Please check your input.';
          break;
        case 401:
          errorMessage = 'Unauthorized. Please login again.';
          break;
        case 403:
          errorMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          errorMessage = 'Resource not found.';
          break;
        case 409:
          errorMessage = 'Conflict. The resource may have been modified.';
          break;
        case 500:
          errorMessage = 'Server error. Please try again later.';
          break;
        default:
          errorMessage = error.error?.message || error.message || `Error ${error.status}`;
          break;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }
}