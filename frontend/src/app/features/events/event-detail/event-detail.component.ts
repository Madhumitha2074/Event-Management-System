import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EventService } from '../../../core/services/event.service';
import { BookingService } from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';
import { Event, EventSeat } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';
import { SeatMapComponent } from '../seat-map/seat-map.component';

@Component({
  selector: 'app-event-detail',
  template: `
    <div *ngIf="loading" class="text-center py-5">
      <div class="spinner-border text-primary"></div>
    </div>

    <div *ngIf="event && !loading">
      <!-- Hero -->
      <div class="position-relative" style="height: 400px; overflow: hidden;">
        <img [src]="event.imageUrl || 'https://placehold.co/1200x400?text=No+Image'"
            (error)="onImageError($event)"
            style="width:100%; height:100%; object-fit:cover;"
            alt="">
        <div class="position-absolute inset-0 w-100 h-100" style="background:rgba(0,0,0,0.5); top:0;"></div>
        <div class="position-absolute bottom-0 start-0 p-4 text-white">
          <span class="badge bg-primary mb-2">{{ event.category }}</span>
          <h1 class="fw-bold">{{ event.title }}</h1>
          <p><i class="fas fa-user me-1"></i>{{ event.organizerName }}</p>
        </div>
      </div>

      <div class="container py-5">
        <div class="row">
          <div class="col-lg-8">
            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-body p-4">
                <h4 class="fw-bold mb-3">About this Event</h4>
                <p class="text-muted">{{ event.description }}</p>
              </div>
            </div>

            <div class="card border-0 shadow-sm rounded-4">
              <div class="card-body p-4">
                <h4 class="fw-bold mb-3">Event Details</h4>
                <div class="row g-3">
                  <div class="col-sm-6">
                    <div class="d-flex align-items-center">
                      <i class="fas fa-calendar-alt fa-2x text-primary me-3"></i>
                      <div>
                        <div class="small text-muted">Date & Time</div>
                        <div class="fw-semibold">{{ event.startDateTime | date:'MMM d, y' }}</div>
                        <div class="small">{{ event.startDateTime | date:'h:mm a' }} – {{ event.endDateTime | date:'h:mm a' }}</div>
                      </div>
                    </div>
                  </div>
                  <div class="col-sm-6">
                    <div class="d-flex align-items-center">
                      <i class="fas fa-map-marker-alt fa-2x text-primary me-3"></i>
                      <div>
                        <div class="small text-muted">Location</div>
                        <div class="fw-semibold">{{ event.venue }}</div>
                        <div class="small">{{ event.city }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Booking Panel -->
          <div class="col-lg-4">
            <div class="card border-0 shadow rounded-4 sticky-top" style="top: 80px;">
              <div class="card-body p-4">
                <!-- Seat Map Toggle - Only show if event has seat configuration -->
                <div class="form-check form-switch mb-3" *ngIf="hasSeatMap">
                  <input class="form-check-input" type="checkbox" 
                         id="seatSelectionToggle" [(ngModel)]="enableSeatSelection"
                         [disabled]="selectionDisabled">
                  <label class="form-check-label fw-semibold" for="seatSelectionToggle">
                    <i class="fas fa-chair me-1"></i>Select Specific Seats
                  </label>
                </div>

                <!-- Seat Map Component -->
                <div *ngIf="enableSeatSelection && hasSeatMap && seats.length > 0">
                  <app-seat-map
                    #seatMapRef
                    [seats]="seats"
                    [maxSelectable]="10"
                    [selectionDisabled]="selectionDisabled"
                    (selectionChange)="onSeatSelectionChange($event)">
                  </app-seat-map>
                </div>

                <!-- Loading seats indicator -->
                <div *ngIf="enableSeatSelection && hasSeatMap && seats.length === 0 && !loadingSeats" 
                     class="text-center py-3">
                  <div class="spinner-border spinner-border-sm text-primary"></div>
                  <p class="small text-muted mt-2">Loading seat map...</p>
                </div>

                <!-- Traditional Booking Form (shown when seat selection is disabled or no seat map) -->
                <div *ngIf="!enableSeatSelection || !hasSeatMap">
                  <div class="text-center mb-3">
                    <div class="display-6 fw-bold text-primary">
                      {{ event.ticketPrice === 0 ? 'Free' : (event.ticketPrice | currency:'INR':'symbol':'1.2-2') }}
                    </div>
                    <small class="text-muted">per ticket</small>
                  </div>
                  <hr>
                  <div class="d-flex justify-content-between mb-3">
                    <span class="text-muted">Available</span>
                    <span class="fw-bold" [class.text-danger]="event.availableTickets < 10" [class.text-success]="event.availableTickets >= 10">
                      {{ event.availableTickets }} tickets
                    </span>
                  </div>

                  <div *ngIf="event.availableTickets === 0" class="alert alert-danger text-center">Sold Out</div>

                  <form *ngIf="event.availableTickets > 0 && isLoggedIn" [formGroup]="bookingForm" (ngSubmit)="book()">
                    <div class="mb-3">
                      <label class="form-label fw-semibold">Number of Tickets</label>
                      <select class="form-select" formControlName="ticketCount" (change)="updateAttendees()" [disabled]="bookingLoading">
                        <option *ngFor="let n of ticketOptions" [value]="n">{{ n }}</option>
                      </select>
                    </div>

                    <div formArrayName="attendees">
                      <div *ngFor="let attendee of attendeesArray.controls; let i = index" [formGroupName]="i" class="mb-3 p-3 bg-light rounded">
                        <div class="fw-semibold small mb-2">Attendee {{ i + 1 }}</div>
                        <input class="form-control form-control-sm mb-2" formControlName="name" placeholder="Full Name">
                        <input class="form-control form-control-sm" formControlName="email" placeholder="Email" type="email">
                      </div>
                    </div>

                    <div class="d-flex justify-content-between fw-bold mb-3">
                      <span>Total:</span>
                      <span class="text-primary">{{ getTotalAmount() | currency:'INR':'symbol':'1.2-2' }}</span>
                    </div>

                    <button class="btn btn-primary w-100 py-2" type="submit" [disabled]="bookingLoading">
                      <span *ngIf="bookingLoading" class="spinner-border spinner-border-sm me-2"></span>
                      <i *ngIf="!bookingLoading" class="fas fa-ticket-alt me-2"></i>Book Now
                    </button>
                  </form>
                </div>

                <!-- Seat-based booking button -->
                <div *ngIf="enableSeatSelection && hasSeatMap && selectedSeats.length > 0 && isLoggedIn">
                  <div class="alert alert-info small mb-3">
                    <i class="fas fa-info-circle me-1"></i>
                    You've selected <strong>{{ selectedSeats.length }}</strong> seat(s)
                  </div>
                  
                  <div class="mb-3">
                    <label class="form-label fw-semibold">Attendee Details</label>
                    <div *ngFor="let seat of selectedSeats; let i = index" class="mb-2 p-2 bg-light rounded">
                      <div class="small fw-bold">{{ seat.seatNumber }} ({{ seat.tier }}) - ₹{{ seat.price }}</div>
                      <input type="text" class="form-control form-control-sm mb-1" 
                             placeholder="Full Name" [(ngModel)]="seatAttendees[i].name" 
                             [ngModelOptions]="{standalone: true}"
                             [disabled]="bookingLoading || selectionDisabled">
                      <input type="email" class="form-control form-control-sm" 
                             placeholder="Email" [(ngModel)]="seatAttendees[i].email"
                             [ngModelOptions]="{standalone: true}"
                             [disabled]="bookingLoading || selectionDisabled">
                    </div>
                  </div>

                  <div class="d-flex justify-content-between fw-bold mb-3">
                    <span>Total:</span>
                    <span class="text-primary">{{ seatTotalAmount | currency:'INR':'symbol':'1.2-2' }}</span>
                  </div>

                  <button class="btn btn-primary w-100 py-2" (click)="bookWithSeats()" [disabled]="bookingLoading || !isSeatAttendeesValid() || selectionDisabled">
                    <span *ngIf="bookingLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <i *ngIf="!bookingLoading" class="fas fa-ticket-alt me-2"></i>
                    {{ bookingLoading ? 'Processing...' : 'Book Selected Seats' }}
                  </button>
                </div>

                <div *ngIf="!isLoggedIn" class="text-center">
                  <p class="text-muted">Sign in to book tickets</p>
                  <a routerLink="/auth/login" class="btn btn-primary w-100">Sign In</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class EventDetailComponent implements OnInit {
  @ViewChild('seatMapRef') seatMapComponent!: SeatMapComponent;

  event: Event | null = null;
  seats: EventSeat[] = [];
  selectedSeats: EventSeat[] = [];
  seatAttendees: { name: string; email: string }[] = [];
  loading = true;
  loadingSeats = false;
  bookingForm!: FormGroup;
  bookingLoading = false;
  isLoggedIn = false;
  enableSeatSelection = false;
  hasSeatMap = false;
  selectionDisabled = false;
  ticketOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private bookingService: BookingService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn;
    this.bookingForm = this.fb.group({
      ticketCount: [1],
      attendees: this.fb.array([this.createAttendee()])
    });
    
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.eventService.getEventById(+id).subscribe({
        next: (ev) => { 
          this.event = ev; 
          this.hasSeatMap = ev.seatConfig ? true : false;
          this.loading = false;
          
          if (this.hasSeatMap) {
            this.loadSeats();
          }
        },
        error: () => { 
          this.loading = false; 
          this.router.navigate(['/']); 
        }
      });
    }
  }

  loadSeats(): void {
    if (!this.event) return;
    this.loadingSeats = true;
    this.bookingService.getEventSeats(this.event.id).subscribe({
      next: (seats) => {
        this.seats = seats;
        this.loadingSeats = false;
      },
      error: (err) => {
        console.error('Failed to load seats:', err);
        this.loadingSeats = false;
        this.toastr.error('Failed to load seat map');
      }
    });
  }

  onSeatSelectionChange(seats: EventSeat[]): void {
    this.selectedSeats = seats;
    this.seatAttendees = seats.map(() => ({ name: '', email: '' }));
  }

  get seatTotalAmount(): number {
    return this.selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
  }

  getTotalAmount(): number {
    const ticketCount = this.bookingForm.get('ticketCount')?.value || 0;
    return (this.event?.ticketPrice || 0) * ticketCount;
  }

  get attendeesArray(): FormArray { 
    return this.bookingForm.get('attendees') as FormArray; 
  }

  createAttendee(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  updateAttendees(): void {
    const count = +this.bookingForm.get('ticketCount')!.value;
    while (this.attendeesArray.length < count) {
      this.attendeesArray.push(this.createAttendee());
    }
    while (this.attendeesArray.length > count) {
      this.attendeesArray.removeAt(this.attendeesArray.length - 1);
    }
  }

  onImageError(event: any): void {
    event.target.src = 'https://placehold.co/1200x400?text=No+Image';
  }

  isSeatAttendeesValid(): boolean {
    return this.seatAttendees.every(attendee => 
      attendee.name.trim() !== '' && 
      attendee.email.trim() !== '' && 
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email)
    );
  }

  book(): void {
    if (this.bookingForm.invalid) { 
      this.bookingForm.markAllAsTouched(); 
      return; 
    }
    this.bookingLoading = true;
    this.bookingService.createBooking({
      eventId: this.event!.id,
      ticketCount: +this.bookingForm.get('ticketCount')!.value,
      attendees: this.bookingForm.get('attendees')!.value
    }).subscribe({
      next: (booking) => {
        this.toastr.success('Booking confirmed! Check your email.');
        this.router.navigate(['/bookings', booking.id]);
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Booking failed.');
        this.bookingLoading = false;
      }
    });
  }

  // FIXED: Proper error handling without false positives
  bookWithSeats(): void {
    if (this.selectedSeats.length === 0) {
      this.toastr.warning('Please select at least one seat.');
      return;
    }

    if (!this.isSeatAttendeesValid()) {
      this.toastr.warning('Please enter name and email for all selected seats.');
      return;
    }

    this.bookingLoading = true;
    this.selectionDisabled = true;

    this.bookingService.createBookingWithSeats({
      eventId: this.event!.id,
      seatIds: this.selectedSeats.map(s => s.id),
      attendees: this.seatAttendees
    }).subscribe({
      next: (booking) => {
        this.toastr.success('Booking confirmed! Check your email for tickets.');
        this.router.navigate(['/bookings', booking.id]);
      },
      error: (err) => {
        // Log the full error for debugging
        console.error('Booking error details:', err);
        
        // Get the actual error message
        let errorMsg = '';
        if (err.error?.message) {
          errorMsg = err.error.message;
        } else if (err.message) {
          errorMsg = err.message;
        } else {
          errorMsg = 'Booking failed.';
        }
        
        console.log('Error message:', errorMsg);
        
        // Check for specific concurrency/seat conflict errors
        const isConcurrencyError = 
          errorMsg.includes('already booked') || 
          errorMsg.includes('no longer available') ||
          errorMsg.includes('50001') ||
          (errorMsg.includes('seat') && errorMsg.includes('already'));
        
        if (isConcurrencyError) {
          this.toastr.error('Some seats were just booked by another user. Please refresh and try again.');
          // Refresh seat map
          this.loadSeats();
          // Clear current selection
          this.selectedSeats = [];
          this.seatAttendees = [];
        } else {
          // Show the actual error message
          this.toastr.error(errorMsg);
        }
        
        this.bookingLoading = false;
        this.selectionDisabled = false;
        this.enableSeatSelection = true;
      }
    });
  }
}