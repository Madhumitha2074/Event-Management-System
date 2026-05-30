import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateEventRequest, Event, EventFilter, PagedResult } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly API = `${environment.apiUrl}/events`;

  constructor(private http: HttpClient) {}

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
    return this.http.get<PagedResult<Event>>(this.API, { params });
  }

  getEventById(id: number): Observable<Event> {
    return this.http.get<Event>(`${this.API}/${id}`);
  }

  createEvent(data: CreateEventRequest): Observable<Event> {
    return this.http.post<Event>(this.API, data);
  }

  updateEvent(id: number, data: any): Observable<Event> {
    return this.http.put<Event>(`${this.API}/${id}`, data);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }

  getMyEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.API}/my-events`);
  }

  getEventAttendees(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/${id}/attendees`);
  }
}
