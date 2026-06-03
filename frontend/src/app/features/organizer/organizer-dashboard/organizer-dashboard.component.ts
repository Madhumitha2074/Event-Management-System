import { Component, OnInit } from '@angular/core';
import { EventService } from '../../../core/services/event.service';
import { Event } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-organizer-dashboard',
  template: `
    <div class="container py-5">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold"><i class="fas fa-tachometer-alt text-primary me-3"></i>Organizer Dashboard</h2>
        <a routerLink="/organizer/events/new" class="btn btn-primary">
          <i class="fas fa-plus me-2"></i>Create Event
        </a>
      </div>

      <!-- Stats -->
      <div class="row g-4 mb-5">
        <div class="col-md-3">
          <div class="card border-0 shadow-sm rounded-4 text-center p-3">
            <div class="display-5 fw-bold text-primary">{{ events.length }}</div>
            <div class="text-muted">Total Events</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card border-0 shadow-sm rounded-4 text-center p-3">
            <div class="display-5 fw-bold text-success">{{ publishedCount }}</div>
            <div class="text-muted">Published</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card border-0 shadow-sm rounded-4 text-center p-3">
            <div class="display-5 fw-bold text-info">{{ totalBookings }}</div>
            <div class="text-muted">Total Bookings</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card border-0 shadow-sm rounded-4 text-center p-3">
            <div class="display-5 fw-bold text-warning">
             {{ totalRevenue | currency:'INR':'symbol':'1.0-0' }}
            </div>
            <div class="text-muted">Revenue</div>
          </div>
        </div>
      </div>

      <h4 class="fw-bold mb-3">Your Events</h4>

      <div *ngIf="loading" class="text-center py-4">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && events.length === 0" class="text-center py-5">
        <i class="fas fa-calendar-plus fa-4x text-muted mb-3"></i>
        <h5 class="text-muted">No events yet</h5>
        <a routerLink="/organizer/events/new" class="btn btn-primary mt-3">Create Your First Event</a>
      </div>

      <div class="table-responsive" *ngIf="!loading && events.length > 0">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>Event</th>
              <th>Date</th>
              <th>Status</th>
              <th>Tickets</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let event of events">
              <td>
                <div class="fw-semibold">{{ event.title }}</div>
                <small class="text-muted">{{ event.city }}</small>
              </td>
              <td>{{ event.startDateTime | date:'MMM d, y' }}</td>
              <td>
                <span class="badge" [ngClass]="{
                  'bg-success': event.status === 'Published',
                  'bg-secondary': event.status === 'Draft',
                  'bg-danger': event.status === 'Cancelled'
                }">{{ event.status }}</span>
              </td>
              <td>
                <div class="small">{{ event.bookedTickets }}/{{ event.totalTickets }} booked</div>
                <div class="progress" style="height: 4px; width: 80px;">
                  <div class="progress-bar bg-primary" [style.width.%]="(event.bookedTickets/event.totalTickets)*100"></div>
                </div>
              </td>
              <td>
                <a [routerLink]="['/organizer/events', event.id, 'attendees']" class="btn btn-sm btn-outline-info me-1">
                  <i class="fas fa-users"></i>
                </a>
                <a [routerLink]="['/organizer/events', event.id, 'edit']" class="btn btn-sm btn-outline-primary me-1">
                  <i class="fas fa-edit"></i>
                </a>
                <button class="btn btn-sm btn-outline-danger" (click)="deleteEvent(event.id)">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class OrganizerDashboardComponent implements OnInit {
  events: Event[] = [];
  loading = true;

  constructor(private eventService: EventService, private toastr: ToastrService) {}

  ngOnInit(): void { this.loadEvents(); }

  loadEvents(): void {
    this.loading = true;
    this.eventService.getMyEvents().subscribe({
      next: (e) => { this.events = e; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  get publishedCount(): number { return this.events.filter(e => e.status === 'Published').length; }
  get totalBookings(): number { return this.events.reduce((s, e) => s + e.bookedTickets, 0); }
  get totalRevenue(): number { return this.events.reduce((s, e) => s + e.bookedTickets * e.ticketPrice, 0); }

  deleteEvent(id: number): void {
    if (!confirm('Delete this event?')) return;
    this.eventService.deleteEvent(id).subscribe({
      next: () => { this.toastr.success('Event deleted.'); this.loadEvents(); },
      error: () => this.toastr.error('Could not delete event.')
    });
  }
}
