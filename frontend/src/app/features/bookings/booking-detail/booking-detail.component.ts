import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { Booking } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { finalize } from 'rxjs/operators';

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

            <!-- Action Buttons Row -->
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
  `,
  styles: [`
    .ticket-item {
      background: linear-gradient(135deg, #6c5ce7, #a29bfe);
      color: white;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 10px;
    }
    .btn-outline-danger:hover {
      background-color: #dc3545;
      color: white;
    }
  `]
})
export class BookingDetailComponent implements OnInit {

  booking: Booking | null = null;
  loading = true;
  pdfLoading = false;
  cancelLoading = false;

  constructor(
    private route: ActivatedRoute,
    private bookingService: BookingService,
    private toastr: ToastrService,
    private confirmationService: ConfirmationService
  ) {
    console.log('✅ BookingDetailComponent initialized with ConfirmationService');
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    console.log('📋 Booking ID from route:', id);
    
    if (id) {
      this.bookingService.getBookingById(+id).subscribe({
        next: (b) => {
          console.log('✅ Booking loaded:', b);
          this.booking = b;
          this.loading = false;
        },
        error: (err) => {
          console.error('❌ Failed to load booking:', err);
          this.loading = false;
          this.toastr.error('Failed to load booking details');
        }
      });
    }
  }

  // ✅ Download PDF
  downloadPdf(): void {
    if (!this.booking) return;
    console.log('📥 Downloading PDF for booking:', this.booking.id);
    
    this.pdfLoading = true;

    this.bookingService.downloadBookingPdf(this.booking.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Booking-${this.booking!.bookingReference}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.pdfLoading = false;
        this.toastr.success('PDF downloaded successfully!');
      },
      error: (err) => {
        console.error('❌ PDF download failed:', err);
        this.toastr.error('Failed to download PDF.');
        this.pdfLoading = false;
      }
    });
  }

  /**
   * ✅ Cancel Booking with Custom Confirmation Dialog
   */
  cancelBooking(): void {
    console.log('🔄 cancelBooking() called');
    
    if (!this.booking) {
      console.warn('⚠️ No booking found');
      return;
    }

    if (this.booking.status !== 'Confirmed') {
      console.warn('⚠️ Booking is not confirmed, status:', this.booking.status);
      this.toastr.warning('This booking cannot be cancelled');
      return;
    }

    console.log('📋 Showing confirmation dialog for booking:', this.booking.id);

    this.confirmationService.confirm({
      title: 'Cancel Booking',
      message: `Are you sure you want to cancel this booking for "${this.booking.eventTitle}"?\n\nThis action cannot be undone.`,
      confirmText: 'Yes, Cancel Booking',
      cancelText: 'No, Keep It',
      confirmButtonClass: 'btn-danger',
      icon: 'fas fa-exclamation-triangle'
    }).subscribe({
      next: (confirmed) => {
        console.log('📋 Confirmation result:', confirmed);
        if (confirmed) {
          console.log('✅ User confirmed, processing cancellation...');
          this.processCancellation();
        } else {
          console.log('❌ User cancelled the action');
        }
      },
      error: (err) => {
        console.error('❌ Confirmation dialog error:', err);
      }
    });
  }

  /**
   * Process the actual cancellation
   */
  private processCancellation(): void {
    if (!this.booking) return;

    console.log('🔄 Processing cancellation for booking:', this.booking.id);
    this.cancelLoading = true;

    this.bookingService.cancelBooking(this.booking.id).pipe(
      finalize(() => {
        console.log('✅ Cancellation request completed');
        this.cancelLoading = false;
      })
    ).subscribe({
      next: (response) => {
        console.log('✅ Booking cancelled successfully:', response);
        this.toastr.success('Booking cancelled successfully.');
        
        // Reload booking to show updated status
        this.bookingService.getBookingById(this.booking!.id).subscribe({
          next: (b) => {
            console.log('✅ Reloaded booking after cancellation:', b);
            this.booking = b;
          },
          error: (err) => {
            console.error('❌ Failed to reload booking:', err);
          }
        });
      },
      error: (err) => {
        console.error('❌ Cancellation failed:', err);
        const errorMsg = err.error?.message || err.message || 'Cancellation failed.';
        this.toastr.error(errorMsg);
      }
    });
  }
}