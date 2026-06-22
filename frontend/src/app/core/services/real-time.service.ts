import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class RealTimeService {
  private eventUpdates = new Subject<any>();
  
  constructor(private http: HttpClient) {
    // Poll for updates every 30 seconds (fallback to polling)
    setInterval(() => this.checkForUpdates(), 30000);
  }

  private checkForUpdates(): void {
    this.http.get('https://localhost:5001/api/events/active').subscribe({
      next: (events) => this.eventUpdates.next(events),
      error: () => {}
    });
  }

  getEventUpdates(): Observable<any> {
    return this.eventUpdates.asObservable();
  }
}