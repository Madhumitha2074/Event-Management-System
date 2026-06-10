import { Component, OnInit } from '@angular/core';
import { EventService } from '../../../core/services/event.service';
import { Event } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-organizer-dashboard',
  template: `
    <div class="container py-5">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold">
          <i class="fas fa-tachometer-alt text-primary me-3"></i>Organizer Dashboard
        </h2>
        <div>
          <a routerLink="/organizer/scanner" class="btn btn-success me-2">
            <i class="fas fa-qrcode me-2"></i>Scan Tickets
          </a>
          <a routerLink="/organizer/events/new" class="btn btn-primary">
            <i class="fas fa-plus me-2"></i>Create Event
          </a>
        </div>
      </div>

      <!-- Stats Cards - Clickable -->
      <div class="row g-4 mb-5">
        <div class="col-md-3">
          <div class="stat-card clickable" (click)="showAllEvents()">
            <div class="stat-icon bg-primary bg-opacity-10">
              <i class="fas fa-calendar-alt text-primary"></i>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ events.length }}</div>
              <div class="stat-label">Total Events</div>
            </div>
            <div class="stat-arrow">
              <i class="fas fa-arrow-right"></i>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card clickable" (click)="showPublishedEvents()">
            <div class="stat-icon bg-success bg-opacity-10">
              <i class="fas fa-check-circle text-success"></i>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ publishedCount }}</div>
              <div class="stat-label">Published</div>
            </div>
            <div class="stat-arrow">
              <i class="fas fa-arrow-right"></i>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card clickable" (click)="showBookingsDetails()">
            <div class="stat-icon bg-info bg-opacity-10">
              <i class="fas fa-ticket-alt text-info"></i>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ totalBookings }}</div>
              <div class="stat-label">Total Bookings</div>
            </div>
            <div class="stat-arrow">
              <i class="fas fa-arrow-right"></i>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card clickable" (click)="showRevenueDetails()">
            <div class="stat-icon bg-warning bg-opacity-10">
              <i class="fas fa-rupee-sign text-warning"></i>
            </div>
            <div class="stat-info">
              <div class="stat-value">₹{{ totalRevenue | number:'1.0-0' }}</div>
              <div class="stat-label">Revenue</div>
            </div>
            <div class="stat-arrow">
              <i class="fas fa-arrow-right"></i>
            </div>
          </div>
        </div>
      </div>

      <h4 class="fw-bold mb-3">
        Your Events
        <span class="badge bg-secondary ms-2" *ngIf="filterType">{{ filterType }}</span>
      </h4>

      <div *ngIf="loading" class="text-center py-4">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && filteredEvents.length === 0" class="text-center py-5">
        <i class="fas fa-calendar-times fa-4x text-muted mb-3"></i>
        <h5 class="text-muted">No events found</h5>
        <p class="text-muted" *ngIf="filterType === 'Published'">You don't have any published events yet.</p>
        <p class="text-muted" *ngIf="filterType === 'All Events'">Create your first event to get started.</p>
        <a routerLink="/organizer/events/new" class="btn btn-primary mt-3">Create Event</a>
      </div>

      <div class="table-responsive" *ngIf="!loading && filteredEvents.length > 0">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>Event</th>
              <th>Date</th>
              <th>Status</th>
              <th>Tickets</th>
              <th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let event of filteredEvents">
              <td>
                <div class="fw-semibold">{{ event.title }}</div>
                <small class="text-muted">
                  <i class="fas fa-map-marker-alt me-1"></i>{{ event.city }}
                </small>
              </td>
              <td>
                <div>{{ event.startDateTime | date:'MMM d, y' }}</div>
                <small class="text-muted">{{ event.startDateTime | date:'h:mm a' }}</small>
              </td>
              <td>
                <span class="status-badge" [ngClass]="{
                  'status-published': event.status === 'Published',
                  'status-draft': event.status === 'Draft',
                  'status-completed': event.status === 'Completed',
                  'status-cancelled': event.status === 'Cancelled'
                }">
                  <i class="status-icon" [ngClass]="{
                    'fas fa-check-circle': event.status === 'Published',
                    'fas fa-pencil-alt': event.status === 'Draft',
                    'fas fa-flag-checkered': event.status === 'Completed',
                    'fas fa-ban': event.status === 'Cancelled'
                  }"></i>
                  {{ event.status }}
                </span>
              </td>
              <td>
                <div class="ticket-progress">
                  <div class="d-flex justify-content-between small mb-1">
                    <span>{{ event.bookedTickets }}/{{ event.totalTickets }} booked</span>
                    <span class="text-muted">{{ ((event.bookedTickets / event.totalTickets) * 100) | number:'1.0-0' }}%</span>
                  </div>
                  <div class="progress" style="height: 6px;">
                    <div class="progress-bar" 
                         [ngClass]="{
                           'bg-success': (event.bookedTickets / event.totalTickets) >= 0.7,
                           'bg-warning': (event.bookedTickets / event.totalTickets) >= 0.3 && (event.bookedTickets / event.totalTickets) < 0.7,
                           'bg-secondary': (event.bookedTickets / event.totalTickets) < 0.3
                         }"
                         [style.width.%]="(event.bookedTickets / event.totalTickets) * 100">
                    </div>
                  </div>
                </div>
              </td>
              <td class="text-center">
                <div class="btn-group btn-group-sm" role="group">
                  <a [routerLink]="['/organizer/events', event.id, 'attendees']" 
                     class="btn btn-outline-info" 
                     title="View Attendees">
                    <i class="fas fa-users"></i>
                  </a>
                  <a [routerLink]="['/organizer/events', event.id, 'edit']" 
                     class="btn btn-outline-primary" 
                     title="Edit Event">
                    <i class="fas fa-edit"></i>
                  </a>
                  <button class="btn btn-outline-danger" 
                          (click)="deleteEvent(event.id)" 
                          title="Delete Event">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Revenue Details Modal -->
    <div class="modal-overlay" *ngIf="showRevenueModal" (click)="closeRevenueModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="fas fa-chart-line text-warning me-2"></i>Revenue Details
          </h5>
          <button class="btn-close" (click)="closeRevenueModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="revenue-summary">
            <div class="revenue-total">
              <span>Total Revenue</span>
              <strong>₹{{ totalRevenue | number:'1.2-2' }}</strong>
            </div>
            <div class="revenue-breakdown">
              <h6>Revenue by Event</h6>
              <div class="revenue-list">
                <div *ngFor="let event of events" class="revenue-item">
                  <div class="revenue-event-title">{{ event.title }}</div>
                  <div class="revenue-amount">₹{{ (event.bookedTickets * event.ticketPrice) | number:'1.2-2' }}</div>
                  <div class="revenue-booking-count">{{ event.bookedTickets }} ticket(s)</div>
                </div>
                <div *ngIf="events.length === 0" class="text-muted text-center">
                  No revenue data available
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary btn-sm" (click)="closeRevenueModal()">Close</button>
        </div>
      </div>
    </div>

    <!-- Bookings Details Modal -->
    <div class="modal-overlay" *ngIf="showBookingsModal" (click)="closeBookingsModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="fas fa-ticket-alt text-info me-2"></i>Bookings Details
          </h5>
          <button class="btn-close" (click)="closeBookingsModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="bookings-summary">
            <div class="bookings-total">
              <span>Total Bookings</span>
              <strong>{{ totalBookings }}</strong>
            </div>
            <div class="bookings-breakdown">
              <h6>Bookings by Event</h6>
              <div class="bookings-list">
                <div *ngFor="let event of events" class="bookings-item">
                  <div class="bookings-event-title">{{ event.title }}</div>
                  <div class="bookings-count">{{ event.bookedTickets }} / {{ event.totalTickets }} booked</div>
                  <div class="bookings-percent">{{ ((event.bookedTickets / event.totalTickets) * 100) | number:'1.0-0' }}%</div>
                </div>
                <div *ngIf="events.length === 0" class="text-muted text-center">
                  No booking data available
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary btn-sm" (click)="closeBookingsModal()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stat-card {
      background: white;
      border-radius: 20px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 15px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
    }
    .stat-card.clickable {
      cursor: pointer;
    }
    .stat-card.clickable:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 30px rgba(0,0,0,0.15);
    }
    .stat-card.clickable:active {
      transform: translateY(-2px);
    }
    .stat-icon {
      width: 55px;
      height: 55px;
      border-radius: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    .stat-info {
      flex: 1;
    }
    .stat-value {
      font-size: 1.8rem;
      font-weight: 800;
      color: #2d3748;
      line-height: 1.2;
    }
    .stat-label {
      font-size: 0.75rem;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-arrow {
      opacity: 0;
      transition: opacity 0.2s, transform 0.2s;
      color: #667eea;
    }
    .stat-card:hover .stat-arrow {
      opacity: 1;
      transform: translateX(3px);
    }
    .table {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .table thead th {
      background: #f8f9fa;
      border-bottom: 2px solid #e2e8f0;
      font-weight: 600;
      font-size: 0.85rem;
      padding: 15px;
    }
    .table tbody td {
      padding: 15px;
      vertical-align: middle;
    }
    .table tbody tr:hover {
      background-color: #f8f9fa;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 30px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .status-published {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .status-draft {
      background: #e2e3e5;
      color: #383d41;
      border: 1px solid #d6d8db;
    }
    .status-completed {
      background: #cce5ff;
      color: #004085;
      border: 1px solid #b8daff;
    }
    .status-cancelled {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .status-icon {
      font-size: 0.7rem;
    }
    .ticket-progress {
      min-width: 120px;
    }
    .btn-group .btn {
      padding: 5px 10px;
      border-radius: 8px;
      margin: 0 2px;
    }
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-content {
      background: white;
      border-radius: 20px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow: hidden;
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from {
        transform: translateY(-30px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #eef2f6;
      background: #f8f9fa;
    }
    .modal-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .btn-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.2s;
    }
    .btn-close:hover {
      opacity: 1;
    }
    .modal-body {
      padding: 20px;
      max-height: 60vh;
      overflow-y: auto;
    }
    .modal-footer {
      padding: 12px 20px;
      border-top: 1px solid #eef2f6;
      text-align: right;
    }
    .revenue-summary, .bookings-summary {
      text-align: center;
    }
    .revenue-total, .bookings-total {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 15px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .revenue-total span, .bookings-total span {
      display: block;
      font-size: 0.8rem;
      opacity: 0.9;
    }
    .revenue-total strong, .bookings-total strong {
      font-size: 2rem;
      display: block;
      margin-top: 5px;
    }
    .revenue-breakdown h6, .bookings-breakdown h6 {
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 12px;
      text-align: left;
      color: #4a5568;
    }
    .revenue-list, .bookings-list {
      max-height: 300px;
      overflow-y: auto;
    }
    .revenue-item, .bookings-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #eef2f6;
    }
    .revenue-event-title, .bookings-event-title {
      flex: 2;
      font-size: 0.8rem;
      font-weight: 500;
      text-align: left;
    }
    .revenue-amount {
      font-weight: 700;
      color: #f59e0b;
    }
    .revenue-booking-count {
      font-size: 0.7rem;
      color: #718096;
      width: 80px;
      text-align: right;
    }
    .bookings-count {
      flex: 1;
      font-size: 0.8rem;
      text-align: center;
    }
    .bookings-percent {
      width: 50px;
      font-size: 0.8rem;
      font-weight: 600;
      text-align: right;
      color: #48bb78;
    }
    @media (max-width: 768px) {
      .stat-card {
        padding: 15px;
      }
      .stat-value {
        font-size: 1.3rem;
      }
      .stat-icon {
        width: 45px;
        height: 45px;
        font-size: 1.2rem;
      }
      .table {
        font-size: 0.75rem;
      }
      .status-badge {
        padding: 3px 8px;
        font-size: 0.6rem;
      }
    }
  `]
})
export class OrganizerDashboardComponent implements OnInit {
  events: Event[] = [];
  filteredEvents: Event[] = [];
  loading = true;
  filterType: string = 'All Events';
  showRevenueModal = false;
  showBookingsModal = false;

  constructor(private eventService: EventService, private toastr: ToastrService) {}

  ngOnInit(): void { 
    this.loadEvents(); 
  }

  loadEvents(): void {
    this.loading = true;
    this.eventService.getMyEvents().subscribe({
      next: (e) => { 
        this.events = e; 
        this.filteredEvents = e;
        this.loading = false; 
      },
      error: () => { 
        this.loading = false; 
        this.toastr.error('Failed to load events');
      }
    });
  }

  showAllEvents(): void {
    this.filteredEvents = [...this.events];
    this.filterType = 'All Events';
    this.toastr.info(`Showing all ${this.events.length} events`, 'Total Events');
    setTimeout(() => {
      document.querySelector('.table-responsive')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  showPublishedEvents(): void {
    this.filteredEvents = this.events.filter(e => e.status === 'Published');
    this.filterType = 'Published';
    this.toastr.success(`Showing ${this.filteredEvents.length} published events`, 'Published Events');
    setTimeout(() => {
      document.querySelector('.table-responsive')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  showBookingsDetails(): void {
    this.showBookingsModal = true;
  }

  closeBookingsModal(): void {
    this.showBookingsModal = false;
  }

  showRevenueDetails(): void {
    this.showRevenueModal = true;
  }

  closeRevenueModal(): void {
    this.showRevenueModal = false;
  }

  get publishedCount(): number { 
    return this.events.filter(e => e.status === 'Published').length; 
  }
  
  get totalBookings(): number { 
    return this.events.reduce((s, e) => s + e.bookedTickets, 0); 
  }
  
  get totalRevenue(): number { 
    return this.events.reduce((s, e) => s + (e.bookedTickets * e.ticketPrice), 0); 
  }

  deleteEvent(id: number): void {
    const eventToDelete = this.events.find(e => e.id === id);
    const eventTitle = eventToDelete?.title || 'this event';
    
    const confirmMessage = `⚠️ DELETE EVENT: "${eventTitle}"\n\n` +
      `This will permanently delete:\n` +
      `• All seat configurations\n` +
      `• All bookings and tickets\n` +
      `• All event data\n\n` +
      `This action cannot be undone!\n\n` +
      `Are you sure you want to delete this event?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    this.eventService.deleteEvent(id).subscribe({
      next: () => { 
        this.toastr.success(`Event "${eventTitle}" deleted successfully!`, 'Success');
        this.loadEvents(); 
      },
      error: (err) => { 
        console.error('Delete error:', err);
        let errorMsg = 'Could not delete event.';
        
        if (err.error?.message) {
          errorMsg = err.error.message;
        } else if (err.message) {
          errorMsg = err.message;
        }
        
        this.toastr.error(errorMsg, 'Delete Failed');
      }
    });
  }
}