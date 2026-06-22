import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, interval, timer } from 'rxjs';
import { 
  catchError, 
  retry, 
  tap, 
  timeout, 
  finalize, 
  map, 
  switchMap, 
  shareReplay,
  distinctUntilChanged,
  filter
} from 'rxjs/operators';
import { 
  CreateEventRequest, 
  Event, 
  EventFilter, 
  PagedResult,
  CleanupResponse,
  EventsEndingSoonResponse,
  EventStatusSummary
} from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly API = `${environment.apiUrl}/events`;

  // BehaviorSubject for real-time event updates
  private eventsSubject = new BehaviorSubject<Event[]>([]);
  public events$ = this.eventsSubject.asObservable();

  // Subject for expired event notifications
  private expiredEventsSubject = new BehaviorSubject<Event[]>([]);
  public expiredEvents$ = this.expiredEventsSubject.asObservable();

  // Cache for event data
  private eventCache = new Map<number, { data: Event; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private http: HttpClient) {
    // Start auto-refresh when service is initialized
    this.startAutoRefresh();
  }

  // ============= EXISTING METHODS (UPDATED) =============

  /**
   * Get events with filtering (expired events are filtered out by default)
   */
  getEvents(filter: EventFilter = {}): Observable<PagedResult<Event>> {
    let params = new HttpParams();
    
    // Standard filters
    if (filter.search) params = params.set('search', filter.search);
    if (filter.city) params = params.set('city', filter.city);
    if (filter.category !== undefined) params = params.set('category', filter.category.toString());
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);
    if (filter.minPrice !== undefined) params = params.set('minPrice', filter.minPrice.toString());
    if (filter.maxPrice !== undefined) params = params.set('maxPrice', filter.maxPrice.toString());
    
    // Expired event filters - only add if they exist
    if (filter.includeExpired !== undefined) {
      params = params.set('includeExpired', filter.includeExpired.toString());
    }
    if (filter.onlyActive !== undefined) {
      params = params.set('onlyActive', filter.onlyActive.toString());
    }
    if (filter.showEndingSoon !== undefined) {
      params = params.set('showEndingSoon', filter.showEndingSoon.toString());
    }
    if (filter.endingSoonThresholdMinutes !== undefined) {
      params = params.set('endingSoonThresholdMinutes', filter.endingSoonThresholdMinutes.toString());
    }
    
    // ✅ NEW: Live events filter
    if (filter.showLive !== undefined) {
      params = params.set('showLive', filter.showLive.toString());
    }
    
    // Pagination
    params = params.set('page', (filter.page ?? 1).toString());
    params = params.set('pageSize', (filter.pageSize ?? 9).toString());
    
    return this.http.get<PagedResult<Event>>(this.API, { params }).pipe(
      timeout(30000),
      retry(2),
      tap(result => {
        // Safely handle the result - check if items exist
        const items = result?.items || [];
        
        // Update the events subject with active events
        const activeEvents = items.filter(e => e.isActive) ?? [];
        this.eventsSubject.next(activeEvents);
        
        // Track expired events
        const expiredEvents = items.filter(e => !e.isActive) ?? [];
        if (expiredEvents.length > 0) {
          this.expiredEventsSubject.next(expiredEvents);
        }
        
        console.log(`📊 Loaded ${items.length} events (${activeEvents.length} active, ${expiredEvents.length} expired)`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get only active events (explicitly filters out expired)
   */
  getActiveEvents(filter: EventFilter = {}): Observable<PagedResult<Event>> {
    // Force active-only filter
    const activeFilter: EventFilter = {
      ...filter,
      onlyActive: true,
      includeExpired: false
    };
    return this.getEvents(activeFilter);
  }

  /**
   * Get events ending soon
   */
  getEventsEndingSoon(thresholdMinutes: number = 15): Observable<EventsEndingSoonResponse> {
    const params = new HttpParams()
      .set('thresholdMinutes', thresholdMinutes.toString());
    
    return this.http.get<EventsEndingSoonResponse>(
      `${this.API}/ending-soon`, 
      { params }
    ).pipe(
      timeout(30000),
      retry(2),
      tap(response => {
        console.log(`⏰ ${response?.events?.length || 0} events ending within ${thresholdMinutes} minutes`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get event by ID with caching
   */
  getEventById(id: number): Observable<Event> {
    // Check cache first
    const cached = this.eventCache.get(id);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log(`📦 Using cached event ${id}`);
      return new Observable<Event>(observer => {
        observer.next(cached.data);
        observer.complete();
      });
    }

    return this.http.get<Event>(`${this.API}/${id}`).pipe(
      timeout(30000),
      retry(2),
      map(response => {
        // Ensure contactEmail exists (fallback for old events)
        if (!response.contactEmail) {
          (response as any).contactEmail = '';
        }
        // Cache the response
        this.eventCache.set(id, { data: response, timestamp: Date.now() });
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Create new event
   */
  createEvent(data: CreateEventRequest): Observable<Event> {
    return this.http.post<Event>(this.API, data).pipe(
      timeout(30000),
      retry(3),
      tap(response => {
        console.log('✅ Event created successfully:', response);
        // Invalidate cache
        this.clearCache();
        // Refresh events
        this.refreshEvents();
      }),
      catchError(this.handleError),
      finalize(() => {
        console.log('Create event request completed');
      })
    );
  }

  /**
   * Update event
   */
  updateEvent(id: number, data: any): Observable<Event> {
    return this.http.put<Event>(`${this.API}/${id}`, data).pipe(
      timeout(30000),
      retry(2),
      tap(response => {
        console.log('✅ Event updated successfully:', response);
        // Update cache
        this.eventCache.set(id, { data: response, timestamp: Date.now() });
        // Refresh events
        this.refreshEvents();
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Delete event
   */
  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`).pipe(
      timeout(30000),
      retry(2),
      tap(() => {
        console.log(`✅ Event ${id} deleted successfully`);
        // Remove from cache
        this.eventCache.delete(id);
        // Refresh events
        this.refreshEvents();
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get events created by current user (organizer)
   */
  getMyEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.API}/my-events`).pipe(
      timeout(30000),
      retry(2),
      tap(events => {
        const activeCount = events?.filter(e => e.isActive).length || 0;
        console.log(`📊 Organizer has ${events?.length || 0} events (${activeCount} active)`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get event attendees
   */
  getEventAttendees(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/${id}/attendees`).pipe(
      timeout(30000),
      retry(2),
      tap(attendees => {
        console.log(`👥 Event ${id} has ${attendees?.length || 0} attendees`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get event seats
   */
  getEventSeats(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/${id}/seats`).pipe(
      timeout(30000),
      retry(2),
      catchError(this.handleError)
    );
  }

  /**
   * Admin: Cleanup expired events
   */
  cleanupExpiredEvents(): Observable<CleanupResponse> {
    return this.http.post<CleanupResponse>(
      `${this.API}/cleanup-expired`, 
      {}
    ).pipe(
      timeout(30000),
      retry(2),
      tap(response => {
        console.log(`🧹 Cleaned up ${response?.updatedCount || 0} expired events`);
        // Refresh events after cleanup
        this.refreshEvents();
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get event status summary (Admin/Owner)
   */
  getStatusSummary(): Observable<EventStatusSummary> {
    return this.http.get<EventStatusSummary>(`${this.API}/status-summary`).pipe(
      timeout(30000),
      retry(2),
      tap(summary => {
        console.log('📊 Status summary:', summary);
      }),
      catchError(this.handleError)
    );
  }

  // ============= REAL-TIME UPDATES =============

  /**
   * Start real-time event watcher (checks every 30 seconds)
   */
  startExpiryWatcher(intervalMs: number = 30000): Observable<Event[]> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getActiveEvents({ pageSize: 100 })),
      map(result => result?.items || []),
      distinctUntilChanged((prev, curr) => {
        // Only update if the list has changed
        const prevIds = prev.map(e => e.id).join(',');
        const currIds = curr.map(e => e.id).join(',');
        return prevIds === currIds;
      }),
      tap(events => {
        // Update the events subject
        this.eventsSubject.next(events);
        
        // Check for newly expired events
        const expired = events.filter(e => !e.isActive);
        if (expired.length > 0) {
          this.expiredEventsSubject.next(expired);
          console.log(`⏰ ${expired.length} events have expired`);
        }
      }),
      shareReplay(1),
      catchError((error) => {
        console.error('Error in expiry watcher:', error);
        return [];
      })
    );
  }

  /**
   * Start auto-refresh (30 seconds)
   */
  private startAutoRefresh(): void {
    interval(30000).pipe(
      switchMap(() => this.getActiveEvents({ pageSize: 100 })),
      map(result => result?.items || []),
      filter(events => events.length > 0)
    ).subscribe({
      next: (events) => {
        this.eventsSubject.next(events);
      },
      error: (error) => {
        console.error('Auto-refresh error:', error);
      }
    });
  }

  /**
   * Refresh events manually
   */
  refreshEvents(): void {
    this.getActiveEvents({ pageSize: 100 }).subscribe({
      next: (result) => {
        this.eventsSubject.next(result?.items || []);
        console.log('🔄 Events refreshed manually');
      },
      error: (error) => {
        console.error('Failed to refresh events:', error);
      }
    });
  }

  /**
   * Check if event is still active
   */
  isEventActive(event: Event): boolean {
    if (!event) return false;
    return event.isActive !== undefined ? event.isActive : new Date(event.endDateTime) > new Date();
  }

  /**
   * Get time remaining for event
   */
  getTimeRemaining(event: Event): string {
    if (!event) return 'N/A';
    if (event.timeRemaining) return event.timeRemaining;
    
    const end = new Date(event.endDateTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Ended';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${minutes % 60}m remaining`;
    if (minutes > 0) return `${minutes}m ${Math.floor((diff % 60000) / 1000)}s remaining`;
    return `${Math.floor(diff / 1000)}s remaining`;
  }

  /**
   * Check if event is ending soon
   */
  isEventEndingSoon(event: Event, thresholdMinutes: number = 15): boolean {
    if (!event || !event.isActive) return false;
    if (event.isEndingSoon !== undefined) return event.isEndingSoon;
    
    const end = new Date(event.endDateTime);
    const now = new Date();
    const diffMinutes = (end.getTime() - now.getTime()) / 60000;
    return diffMinutes > 0 && diffMinutes <= thresholdMinutes;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.eventCache.clear();
    console.log('🧹 Event cache cleared');
  }

  // ============= IMAGE UPLOAD =============

  /**
   * Upload an image for an event
   */
  uploadImage(formData: FormData): Observable<{ 
    success: boolean;
    imageUrl: string; 
    fileName: string; 
    fileSize: number;
    message: string;
  }> {
    return this.http.post<{ 
      success: boolean;
      imageUrl: string; 
      fileName: string; 
      fileSize: number;
      message: string;
    }>(`${this.API}/upload-image`, formData).pipe(
      timeout(60000),
      retry(2),
      tap(response => {
        console.log('✅ Image uploaded successfully:', response);
      }),
      catchError(this.handleError),
      finalize(() => {
        console.log('Upload request completed');
      })
    );
  }

  /**
   * Delete an uploaded image
   */
  deleteImage(imageUrl: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API}/delete-image`, {
      body: { imageUrl }
    }).pipe(
      timeout(30000),
      retry(2),
      tap(response => {
        console.log('✅ Image deleted successfully:', response);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Upload image using base64
   */
  uploadImageBase64(base64Data: string): Observable<{ 
    success: boolean;
    imageUrl: string; 
    fileName: string; 
    fileSize: number;
    message: string;
  }> {
    return this.http.post<{ 
      success: boolean;
      imageUrl: string; 
      fileName: string; 
      fileSize: number;
      message: string;
    }>(`${this.API}/upload-image-base64`, { imageBase64: base64Data }).pipe(
      timeout(60000),
      retry(2),
      tap(response => {
        console.log('✅ Base64 image uploaded successfully:', response);
      }),
      catchError(this.handleError)
    );
  }

  // ============= ERROR HANDLER =============

  private handleError(error: any): Observable<never> {
    console.error('❌ API Error:', error);
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
        case 413:
          errorMessage = 'File too large. Maximum size is 5MB.';
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

  // ============= DEBUG METHODS =============

  /**
   * Debug: Check expired events
   */
  debugCheckExpired(): Observable<any> {
    return this.http.get(`${this.API}/debug/check-expired`).pipe(
      timeout(30000),
      tap(result => {
        console.log('🔍 Debug check:', result);
      }),
      catchError(this.handleError)
    );
  }
}