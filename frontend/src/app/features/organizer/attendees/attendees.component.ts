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
      <h3 class="fw-bold mb-4"><i class="fas fa-users text-primary me-3"></i>Attendees</h3>

      <div *ngIf="loading" class="text-center py-4"><div class="spinner-border text-primary"></div></div>

      <div *ngIf="!loading">
        <p class="text-muted">Total confirmed bookings: <strong>{{ bookings.length }}</strong></p>
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th>Reference</th>
                <th>Booked At</th>
                <th>Tickets</th>
                <th>Total</th>
                <th>Attendees</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let b of bookings">
                <td class="font-monospace small">{{ b.bookingReference }}</td>
                <td>{{ b.bookedAt | date:'MMM d, y' }}</td>
                <td>{{ b.ticketCount }}</td>
                <td>\${{ b.totalAmount | number:'1.2-2' }}</td>
                <td>
                  <div *ngFor="let t of b.tickets" class="small">
                    {{ t.attendeeName }} ({{ t.attendeeEmail }})
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AttendeesComponent implements OnInit {
  bookings: any[] = [];
  loading = true;

  constructor(private route: ActivatedRoute, private eventService: EventService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.eventService.getEventAttendees(+id).subscribe({
        next: (b) => { this.bookings = b; this.loading = false; },
        error: () => { this.loading = false; }
      });
    }
  }
}
