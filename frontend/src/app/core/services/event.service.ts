import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, tap, timeout, finalize, map } from 'rxjs/operators';
import { CreateEventRequest, Event, EventFilter, PagedResult } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly API = `${environment.apiUrl}/events`;

  constructor(private http: HttpClient) {}

  // ============= EXISTING METHODS =============

  getEvents(filter: EventFilter = {}): Observable<PagedResult<Event>> {
    let params = new HttpParams();
    if (filter.search) params = params.set('search', filter.search);
    if (filter.city) params = params.set('city', filter.city);
    if (filter.category !== undefined) params = params.set('category', filter.category);
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);
    if (filter.minPrice !== undefined) params = params.set('minPrice', filter.minPrice);
    if (filter.maxPrice !== undefined) params = params.set('maxPrice', filter.maxPrice);
    params = params.set('page', filter.page ?? 1);
    params = params.set('pageSize', filter.pageSize ?? 9);
    
    return this.http.get<PagedResult<Event>>(this.API, { params }).pipe(
      timeout(30000),
      retry(2),
      catchError(this.handleError)
    );
  }

  getEventById(id: number): Observable<Event> {
    return this.http.get<Event>(`${this.API}/${id}`).pipe(
      timeout(30000),
      retry(2),
      map(response => {
        // Ensure contactEmail exists (fallback for old events)
        if (!response.contactEmail) {
          (response as any).contactEmail = '';
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  createEvent(data: CreateEventRequest): Observable<Event> {
    return this.http.post<Event>(this.API, data).pipe(
      timeout(30000),
      retry(3),
      tap(response => {
        console.log('Event created successfully:', response);
      }),
      catchError(this.handleError),
      finalize(() => {
        console.log('Create event request completed');
      })
    );
  }

  updateEvent(id: number, data: any): Observable<Event> {
    return this.http.put<Event>(`${this.API}/${id}`, data).pipe(
      timeout(30000),
      retry(2),
      tap(response => {
        console.log('Event updated successfully:', response);
      }),
      catchError(this.handleError)
    );
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`).pipe(
      timeout(30000),
      retry(2),
      catchError(this.handleError)
    );
  }

  getMyEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.API}/my-events`).pipe(
      timeout(30000),
      retry(2),
      catchError(this.handleError)
    );
  }

  getEventAttendees(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/${id}/attendees`).pipe(
      timeout(30000),
      retry(2),
      catchError(this.handleError)
    );
  }

  // ============= IMAGE UPLOAD =============

  /**
   * Upload an image for an event
   * @param formData - FormData containing the image file
   * @returns Observable with image URL, filename, and file size
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
      timeout(60000), // 60 seconds for file upload
      retry(2),
      tap(response => {
        console.log('Image uploaded successfully:', response);
      }),
      catchError(this.handleError),
      finalize(() => {
        console.log('Upload request completed');
      })
    );
  }

  /**
   * Delete an uploaded image
   * @param imageUrl - The URL of the image to delete
   * @returns Observable with success message
   */
  deleteImage(imageUrl: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API}/delete-image`, {
      body: { imageUrl }
    }).pipe(
      timeout(30000),
      retry(2),
      tap(response => {
        console.log('Image deleted successfully:', response);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Upload image using base64 (alternative method)
   * @param base64Data - The base64 encoded image data
   * @returns Observable with image URL, filename, and file size
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
        console.log('Base64 image uploaded successfully:', response);
      }),
      catchError(this.handleError)
    );
  }

  // ============= ERROR HANDLER =============

  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else if (error.status) {
      // Server-side error
      errorMessage = error.error?.message || error.message || `Error ${error.status}`;
      
      // Handle specific status codes
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
}