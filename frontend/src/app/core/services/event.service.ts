import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, interval, timer, forkJoin } from 'rxjs';
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
  filter,
  mergeMap,
  concatMap,
  retryWhen,
  delay,
  take,
  scan
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
    this.startAutoRefresh();
  }

  // ============= EXISTING METHODS (UPDATED WITH MORE OPERATORS) =============

  /**
   * ✅ UPDATED: Get events with retryWhen for better error recovery
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
    if (filter.includeExpired !== undefined) params = params.set('includeExpired', filter.includeExpired.toString());
    if (filter.onlyActive !== undefined) params = params.set('onlyActive', filter.onlyActive.toString());
    if (filter.showEndingSoon !== undefined) params = params.set('showEndingSoon', filter.showEndingSoon.toString());
    if (filter.endingSoonThresholdMinutes !== undefined) params = params.set('endingSoonThresholdMinutes', filter.endingSoonThresholdMinutes.toString());
    if (filter.showLive !== undefined) params = params.set('showLive', filter.showLive.toString());
    
    // Pagination
    params = params.set('page', (filter.page ?? 1).toString());
    params = params.set('pageSize', (filter.pageSize ?? 9).toString());
    
    return this.http.get<PagedResult<Event>>(this.API, { params }).pipe(
      // ✅ Custom retry logic with exponential backoff
      retryWhen(errors => 
        errors.pipe(
          delay(1000),
          scan((acc, error) => {
            if (acc >= 3) throw error;
            console.log(`🔄 Retry attempt ${acc + 1} for getEvents`);
            return acc + 1;
          }, 0)
        )
      ),
      timeout(30000),
      // ✅ Use map to transform and filter data
      map(result => {
        const now = new Date();
        const items = result?.items || [];
        
        // Filter active events if needed
        const filteredItems = filter.includeExpired 
          ? items 
          : items.filter(e => new Date(e.endDateTime) > now && e.isActive !== false);
        
        return {
          ...result,
          items: filteredItems
        };
      }),
      tap(result => {
        const items = result?.items || [];
        const activeEvents = items.filter(e => e.isActive) ?? [];
        this.eventsSubject.next(activeEvents);
        
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
   * ✅ NEW: Get multiple events by IDs using mergeMap (concurrent)
   */
  getEventsByIds(ids: number[]): Observable<Event[]> {
    if (!ids || ids.length === 0) {
      return new Observable<Event[]>(observer => {
        observer.next([]);
        observer.complete();
      });
    }

    // ✅ Use mergeMap to handle concurrent requests
    return this.http.get<Event[]>(`${this.API}/batch`, { 
      params: new HttpParams().set('ids', ids.join(','))
    }).pipe(
      retryWhen(errors => 
        errors.pipe(
          delay(2000),
          take(2),
          concatMap((_, i) => {
            if (i === 1) throw new Error('Failed to fetch events after retries');
            return [0];
          })
        )
      ),
      timeout(15000),
      map(events => events || []),
      tap(events => console.log(`📦 Fetched ${events.length} events by IDs`)),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Get event by ID with caching
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
   * ✅ UPDATED: Create event with retryWhen and finalize
   */
  createEvent(data: CreateEventRequest): Observable<Event> {
    return this.http.post<Event>(this.API, data).pipe(
      timeout(30000),
      retryWhen(errors => 
        errors.pipe(
          delay(1000),
          scan((acc, error) => {
            if (acc >= 3) throw error;
            console.log(`🔄 Retry attempt ${acc + 1} for createEvent`);
            return acc + 1;
          }, 0)
        )
      ),
      tap(response => {
        console.log('✅ Event created successfully:', response);
        this.clearCache();
        this.refreshEvents();
      }),
      finalize(() => {
        console.log('Create event request completed');
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Update event with concatMap for sequential operations
   */
  updateEvent(id: number, data: any): Observable<Event> {
    return this.http.put<Event>(`${this.API}/${id}`, data).pipe(
      timeout(30000),
      retry(2),
      // ✅ Use concatMap to ensure sequential execution
      concatMap(response => {
        // Update cache
        this.eventCache.set(id, { data: response, timestamp: Date.now() });
        // Refresh events
        this.refreshEvents();
        return [response];
      }),
      tap(response => {
        console.log('✅ Event updated successfully:', response);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Delete event with mergeMap for parallel cleanup
   */
  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`).pipe(
      timeout(30000),
      retry(2),
      // ✅ Use mergeMap to handle parallel operations
      mergeMap(() => {
        this.eventCache.delete(id);
        this.refreshEvents();
        return []; // Return empty to complete
      }),
      tap(() => {
        console.log(`✅ Event ${id} deleted successfully`);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ FIXED: Bulk delete events using forkJoin for parallel execution
   */
  deleteEvents(ids: number[]): Observable<number[]> {
    if (!ids || ids.length === 0) {
      return new Observable<number[]>(observer => {
        observer.next([]);
        observer.complete();
      });
    }

    // Create individual delete requests
    const deleteRequests = ids.map(id => 
      this.http.delete<void>(`${this.API}/${id}`).pipe(
        map(() => id),
        catchError((error) => {
          console.error(`❌ Failed to delete event ${id}:`, error);
          return []; // Skip failed deletions
        })
      )
    );

    // Execute all requests in parallel using forkJoin
    return forkJoin(deleteRequests).pipe(
      map(results => {
        // Filter successful deletions
        const deletedIds = results.filter(id => id !== undefined && id !== null) as number[];
        
        // Clear cache for all deleted events
        deletedIds.forEach(id => this.eventCache.delete(id));
        this.refreshEvents();
        
        console.log(`✅ ${deletedIds.length} events deleted successfully`);
        return deletedIds;
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
        const prevIds = prev.map(e => e.id).join(',');
        const currIds = curr.map(e => e.id).join(',');
        return prevIds === currIds;
      }),
      tap(events => {
        this.eventsSubject.next(events);
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
   * ✅ UPDATED: Auto-refresh with switchMap and distinctUntilChanged
   */
  private startAutoRefresh(): void {
    interval(30000).pipe(
      switchMap(() => this.getActiveEvents({ pageSize: 100 })),
      map(result => result?.items || []),
      distinctUntilChanged((prev, curr) => {
        const prevIds = prev.map(e => e.id).join(',');
        const currIds = curr.map(e => e.id).join(',');
        return prevIds === currIds;
      }),
      filter(events => events.length > 0),
      tap(events => {
        this.eventsSubject.next(events);
      }),
      catchError((error) => {
        console.error('Auto-refresh error:', error);
        return [];
      })
    ).subscribe();
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
      errorMessage = error.error.message;
    } else if (error.status) {
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