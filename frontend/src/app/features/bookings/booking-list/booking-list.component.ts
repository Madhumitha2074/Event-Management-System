import { Component, OnInit } from '@angular/core';
import { BookingService } from '../../../core/services/booking.service';
import { Booking } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-booking-list',
  template: `
    <div class="container py-5">

      <h2 class="fw-bold mb-4">
        <i class="fas fa-ticket-alt text-primary me-3"></i>
        My Bookings
      </h2>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && bookings.length === 0" class="text-center py-5">

        <i class="fas fa-calendar-times fa-4x text-muted mb-3"></i>

        <h5 class="text-muted">
          No bookings yet
        </h5>

        <a routerLink="/events" class="btn btn-primary mt-3">
          Browse Events
        </a>

      </div>

      <div class="row g-4" *ngIf="!loading">

        <div class="col-12" *ngFor="let booking of bookings">

          <div class="card booking-card border-0 shadow-sm">

            <div class="card-body p-4">

              <div class="row align-items-center">

                <div class="col-md-8">

                  <div class="d-flex align-items-center mb-2">

                    <h5 class="fw-bold mb-0 me-3">
                      {{ booking.eventTitle }}
                    </h5>

                    <span
                      class="badge"
                      [ngClass]="{
                        'bg-success': booking.status === 'Confirmed',
                        'bg-danger': booking.status === 'Cancelled',
                        'bg-warning text-dark': booking.status === 'Pending'
                      }"
                    >
                      {{ booking.status }}
                    </span>

                  </div>

                  <p class="text-muted mb-1">
                    <i class="fas fa-map-marker-alt me-2"></i>
                    {{ booking.eventVenue }}
                  </p>

                  <p class="text-muted mb-1">
                    <i class="fas fa-calendar me-2"></i>
                    {{ booking.eventStartDateTime | date:'MMM d, y, h:mm a' }}
                  </p>

                  <p class="text-muted mb-0">

                    <i class="fas fa-ticket-alt me-2"></i>

                    {{ booking.ticketCount }} ticket(s)
                    &nbsp;|&nbsp;

                    <strong>
                      ₹{{ booking.totalAmount | number:'1.2-2' }}
                    </strong>

                    &nbsp;|&nbsp;

                    <small class="font-monospace">
                      {{ booking.bookingReference }}
                    </small>

                  </p>

                </div>

                <div class="col-md-4 text-md-end mt-3 mt-md-0">

                  <a
                    [routerLink]="['/bookings', booking.id]"
                    class="btn btn-outline-primary btn-sm me-2"
                  >
                    <i class="fas fa-eye me-1"></i>
                    View
                  </a>

                  <button
                    *ngIf="booking.status === 'Confirmed'"
                    class="btn btn-outline-danger btn-sm"
                    (click)="cancel(booking.id)"
                  >
                    <i class="fas fa-times me-1"></i>
                    Cancel
                  </button>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  `
})
export class BookingListComponent implements OnInit {

  bookings: Booking[] = [];
  loading = true;

  constructor(
    private bookingService: BookingService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadBookings();
  }

  loadBookings(): void {

    this.loading = true;

    this.bookingService.getMyBookings().subscribe({

      next: (b) => {
        this.bookings = b;
        this.loading = false;
      },

      error: () => {
        this.loading = false;
      }

    });
  }

  cancel(id: number): void {

    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    this.bookingService.cancelBooking(id).subscribe({

      next: () => {
        this.toastr.success('Booking cancelled.');
        this.loadBookings();
      },

      error: (err: any) => {
        this.toastr.error(
          err.error?.message || 'Cancellation failed.'
        );
      }

    });
  }
}