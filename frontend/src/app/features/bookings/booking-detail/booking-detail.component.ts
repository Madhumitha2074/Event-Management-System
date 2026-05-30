import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { Booking } from '../../../core/models/models';

@Component({
  selector: 'app-booking-detail',
  template: `
    <div class="container py-5">
      <a routerLink="/bookings" class="btn btn-outline-secondary btn-sm mb-4">
        <i class="fas fa-arrow-left me-1"></i>Back to Bookings
      </a>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="booking && !loading">
        <div class="card border-0 shadow-sm rounded-4 mb-4">
          <div class="card-body p-4">

            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h3 class="fw-bold">{{ booking.eventTitle }}</h3>
                <p class="text-muted font-monospace">
                  {{ booking.bookingReference }}
                </p>
              </div>

              <span
                class="badge fs-6"
                [ngClass]="{
                  'bg-success': booking.status === 'Confirmed',
                  'bg-danger': booking.status === 'Cancelled'
                }"
              >
                {{ booking.status }}
              </span>
            </div>

            <div class="row g-3">

              <div class="col-sm-6 col-md-3">
                <div class="text-muted small">Venue</div>
                <div class="fw-semibold">
                  {{ booking.eventVenue }}
                </div>
              </div>

              <div class="col-sm-6 col-md-3">
                <div class="text-muted small">Date</div>
                <div class="fw-semibold">
                  {{ booking.eventStartDateTime | date:'MMM d, y' }}
                </div>
                <div class="small">
                  {{ booking.eventStartDateTime | date:'h:mm a' }}
                </div>
              </div>

              <div class="col-sm-6 col-md-3">
                <div class="text-muted small">Tickets</div>
                <div class="fw-semibold">
                  {{ booking.ticketCount }}
                </div>
              </div>

              <div class="col-sm-6 col-md-3">
                <div class="text-muted small">Total Paid</div>

                <!-- FIXED LINE -->
                <div class="fw-bold text-primary fs-5">
                  ₹{{ booking.totalAmount | number:'1.2-2' }}
                </div>
              </div>

            </div>
          </div>
        </div>

        <h5 class="fw-bold mb-3">Your Tickets</h5>

        <div class="row g-3">

          <div
            class="col-md-6"
            *ngFor="let ticket of booking.tickets"
          >
            <div class="ticket-item">

              <div class="d-flex justify-content-between">

                <div>
                  <div class="fw-bold">
                    {{ ticket.attendeeName }}
                  </div>

                  <div class="small opacity-75">
                    {{ ticket.attendeeEmail }}
                  </div>
                </div>

                <div class="text-end">

                  <div class="font-monospace small">
                    {{ ticket.ticketNumber }}
                  </div>

                  <span
                    class="badge bg-success"
                    *ngIf="!ticket.isUsed"
                  >
                    Valid
                  </span>

                  <span
                    class="badge bg-secondary"
                    *ngIf="ticket.isUsed"
                  >
                    Used
                  </span>

                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class BookingDetailComponent implements OnInit {

  booking: Booking | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private bookingService: BookingService
  ) {}

  ngOnInit(): void {

    const id = this.route.snapshot.paramMap.get('id');

    if (id) {

      this.bookingService.getBookingById(+id).subscribe({

        next: (b) => {
          this.booking = b;
          this.loading = false;
        },

        error: () => {
          this.loading = false;
        }

      });
    }
  }
}