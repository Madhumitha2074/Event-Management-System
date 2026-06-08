import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { Booking } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-booking-detail',
  template: `
    <div class="container py-5">

      <!-- Back Button -->
      <a routerLink="/bookings" class="btn btn-outline-secondary btn-sm mb-4">
        <i class="fas fa-arrow-left me-1"></i>Back to Bookings
      </a>

      <!-- Loading -->
      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <!-- Booking Detail -->
      <div *ngIf="booking && !loading">

        <div class="card border-0 shadow-sm rounded-4 mb-4">
          <div class="card-body p-4">

            <!-- Header Row -->
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h3 class="fw-bold">{{ booking.eventTitle }}</h3>
                <p class="text-muted font-monospace mb-0">
                  {{ booking.bookingReference }}
                </p>
              </div>

              <span class="badge fs-6"
                [ngClass]="{
                  'bg-success': booking.status === 'Confirmed',
                  'bg-danger':  booking.status === 'Cancelled'
                }">
                {{ booking.status }}
              </span>
            </div>

            <!-- Booking Info Grid -->
            <div class="row g-3 mb-4">
              <div class="col-sm-6 col-md-3">
                <div class="text-muted small">Venue</div>
                <div class="fw-semibold">{{ booking.eventVenue }}</div>
              </div>
              <div class="col-sm-6 col-md-3">
                <div class="text-muted small">Date</div>
                <div class="fw-semibold">{{ booking.eventStartDateTime | date:'MMM d, y' }}</div>
                <div class="small">{{ booking.eventStartDateTime | date:'h:mm a' }}</div>
              </div>
              <div class="col-sm-6 col-md-3">
                <div class="text-muted small">Tickets</div>
                <div class="fw-semibold">{{ booking.ticketCount }}</div>
              </div>
              <div class="col-sm-6 col-md-3">
                <div class="text-muted small">Total Paid</div>
                <div class="fw-bold text-primary fs-5">
                  ₹{{ booking.totalAmount | number:'1.2-2' }}
                </div>
              </div>
            </div>

            <!-- ✅ Action Buttons Row -->
            <div class="d-flex gap-2 flex-wrap">

              <!-- Download PDF Button -->
              <button
                class="btn btn-primary btn-sm"
                (click)="downloadPdf()"
                [disabled]="pdfLoading">
                <span *ngIf="pdfLoading"
                      class="spinner-border spinner-border-sm me-1">
                </span>
                <i *ngIf="!pdfLoading"
                   class="fas fa-download me-1">
                </i>
                {{ pdfLoading ? 'Generating...' : 'Download PDF' }}
              </button>

              <!-- Cancel Button — only show if Confirmed -->
              <button
                *ngIf="booking.status === 'Confirmed'"
                class="btn btn-outline-danger btn-sm"
                (click)="cancelBooking()"
                [disabled]="cancelLoading">
                <span *ngIf="cancelLoading"
                      class="spinner-border spinner-border-sm me-1">
                </span>
                <i *ngIf="!cancelLoading"
                   class="fas fa-times me-1">
                </i>
                {{ cancelLoading ? 'Cancelling...' : 'Cancel Booking' }}
              </button>

            </div>

          </div>
        </div>

        <!-- Tickets Section -->
        <h5 class="fw-bold mb-3">Your Tickets</h5>

        <div class="row g-3">
          <div class="col-md-6" *ngFor="let ticket of booking.tickets">
            <div class="ticket-item">
              <div class="d-flex justify-content-between">
                <div>
                  <div class="fw-bold">{{ ticket.attendeeName }}</div>
                  <div class="small opacity-75">{{ ticket.attendeeEmail }}</div>
                </div>
                <div class="text-end">
                  <div class="font-monospace small">{{ ticket.ticketNumber }}</div>
                  <span class="badge bg-success" *ngIf="!ticket.isUsed">Valid</span>
                  <span class="badge bg-secondary" *ngIf="ticket.isUsed">Used</span>
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

  booking:      Booking | null = null;
  loading       = true;
  pdfLoading    = false;   // ✅ loading state for PDF button
  cancelLoading = false;   // ✅ loading state for cancel button

  constructor(
    private route:          ActivatedRoute,
    private bookingService: BookingService,
    private toastr:         ToastrService   // ✅ inject ToastrService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.bookingService.getBookingById(+id).subscribe({
        next:  (b) => { this.booking = b; this.loading = false; },
        error: ()  => { this.loading = false; }
      });
    }
  }

  // ✅ Download PDF
  downloadPdf(): void {
    if (!this.booking) return;
    this.pdfLoading = true;

    this.bookingService.downloadBookingPdf(this.booking.id).subscribe({
      next: (blob: Blob) => {
        // Create a temporary link and trigger download
        const url  = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href     = url;
        link.download = `Booking-${this.booking!.bookingReference}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.pdfLoading = false;
        this.toastr.success('PDF downloaded successfully!');
      },
      error: () => {
        this.toastr.error('Failed to download PDF.');
        this.pdfLoading = false;
      }
    });
  }

  // ✅ Cancel Booking
  cancelBooking(): void {
    if (!this.booking) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    this.cancelLoading = true;

    this.bookingService.cancelBooking(this.booking.id).subscribe({
      next: () => {
        this.toastr.success('Booking cancelled successfully.');
        // Reload booking to show updated status
        this.bookingService.getBookingById(this.booking!.id).subscribe({
          next:  (b) => { this.booking = b; this.cancelLoading = false; },
          error: ()  => { this.cancelLoading = false; }
        });
      },
      error: (err: any) => {
        this.toastr.error(err.error?.message || 'Cancellation failed.');
        this.cancelLoading = false;
      }
    });
  }
}