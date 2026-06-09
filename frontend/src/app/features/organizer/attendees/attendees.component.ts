import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EventService } from '../../../core/services/event.service';

@Component({
  selector: 'app-attendees',
  template: `
    <div class="container py-5">
      <a routerLink="/organizer" class="btn btn-outline-secondary btn-sm mb-4">
        <i class="fas fa-arrow-left me-1"></i>Back to Dashboard
      </a>
      
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h3 class="fw-bold">
          <i class="fas fa-users text-primary me-3"></i>Attendees List
        </h3>
        <div class="badge bg-primary fs-6 p-2">
          Total: {{ totalBookings }} booking(s) | {{ totalAttendees }} attendee(s)
        </div>
      </div>

      <div *ngIf="loading" class="text-center py-4">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && bookings.length === 0" class="text-center py-5">
        <i class="fas fa-users-slash fa-4x text-muted mb-3"></i>
        <h5 class="text-muted">No attendees yet</h5>
        <p class="text-muted">When someone books tickets, you'll see them here.</p>
      </div>

      <div *ngIf="!loading && bookings.length > 0" class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>Booking Ref</th>
              <th>Booked At</th>
              <th>Tickets</th>
              <th>Total</th>
              <th>Attendee Name</th>
              <th>Attendee Email</th>
              <th>Ticket #</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let booking of bookings">
              <tr *ngFor="let ticket of booking.tickets; let i = index">
                <td *ngIf="i === 0" [attr.rowspan]="booking.tickets.length" class="align-middle">
                  <span class="font-monospace small">{{ booking.bookingReference }}</span>
                </td>
                <td *ngIf="i === 0" [attr.rowspan]="booking.tickets.length" class="align-middle">
                  {{ booking.bookedAt | date:'MMM d, y, h:mm a' }}
                </td>
                <td *ngIf="i === 0" [attr.rowspan]="booking.tickets.length" class="align-middle text-center">
                  {{ booking.ticketCount }}
                </td>
                <td *ngIf="i === 0" [attr.rowspan]="booking.tickets.length" class="align-middle">
                  <strong class="text-primary">₹{{ booking.totalAmount | number:'1.2-2' }}</strong>
                </td>
                <td class="align-middle">
                  <i class="fas fa-user-circle me-1 text-muted"></i>
                  {{ ticket.attendeeName }}
                </td>
                <td class="align-middle">
                  <i class="fas fa-envelope me-1 text-muted"></i>
                  {{ ticket.attendeeEmail }}
                </td>
                <td class="align-middle">
                  <code class="small">{{ ticket.ticketNumber }}</code>
                </td>
                <td class="align-middle">
                  <span class="badge" [ngClass]="ticket.isUsed ? 'bg-secondary' : 'bg-success'">
                    {{ ticket.isUsed ? 'Used' : 'Valid' }}
                  </span>
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </div>

      <!-- Export Button -->
      <div class="mt-4" *ngIf="bookings.length > 0">
        <button class="btn btn-outline-primary btn-sm" (click)="exportToCSV()">
          <i class="fas fa-download me-1"></i>Export to CSV
        </button>
      </div>
    </div>
  `,
  styles: [`
    .table {
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .table thead th {
      background: #f8f9fa;
      border-bottom: 2px solid #dee2e6;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .table tbody tr:hover {
      background-color: #f8f9fa;
    }
    code {
      background: #f1f3f4;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-family: 'Courier New', monospace;
    }
    .badge {
      font-size: 0.7rem;
      padding: 4px 8px;
    }
    @media (max-width: 768px) {
      .table {
        font-size: 0.75rem;
      }
      .table thead th {
        font-size: 0.7rem;
      }
      code {
        font-size: 0.6rem;
      }
    }
  `]
})
export class AttendeesComponent implements OnInit {
  bookings: any[] = [];
  loading = true;

  constructor(private route: ActivatedRoute, private eventService: EventService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.eventService.getEventAttendees(+id).subscribe({
        next: (bookings) => {
          this.bookings = bookings;
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load attendees:', err);
          this.loading = false;
        }
      });
    }
  }

  get totalBookings(): number {
    return this.bookings.length;
  }

  get totalAttendees(): number {
    return this.bookings.reduce((sum, booking) => sum + (booking.tickets?.length || 0), 0);
  }

  exportToCSV(): void {
    if (this.bookings.length === 0) return;
    
    const csvData: any[] = [];
    
    this.bookings.forEach(booking => {
      booking.tickets.forEach((ticket: any) => {
        csvData.push({
          'Booking Reference': booking.bookingReference,
          'Booked Date': new Date(booking.bookedAt).toLocaleString(),
          'Ticket Number': ticket.ticketNumber,
          'Attendee Name': ticket.attendeeName,
          'Attendee Email': ticket.attendeeEmail,
          'Ticket Status': ticket.isUsed ? 'Used' : 'Valid',
          'Total Amount': `₹${booking.totalAmount}`
        });
      });
    });

    // Convert to CSV
    const headers = Object.keys(csvData[0]);
    const csvRows = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => {
        const value = row[h] || '';
        // Wrap in quotes if contains comma
        return value.toString().includes(',') ? `"${value}"` : value;
      }).join(','))
    ];
    const csvString = csvRows.join('\n');
    
    // Add BOM for UTF-8 to handle special characters
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendees_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}