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
      <!-- ⚠️ EXPIRED EVENT BANNER -->
      <div *ngIf="isExpired" class="container mt-3">
        <div class="alert alert-danger text-center shadow-sm">
          <i class="fas fa-clock me-2 fa-lg"></i>
          <strong>This event has ended!</strong> 
          It was held on {{ event.endDateTime | date:'EEEE, MMMM d, y - h:mm a' }}
        </div>
      </div>

      <!-- Hero Section with Gradient Overlay -->
      <div class="hero-section position-relative" style="height: 450px; overflow: hidden;">
        <img [src]="event.imageUrl || 'https://placehold.co/1600x450?text=Event+Image'"
            (error)="onImageError($event)"
            style="width:100%; height:100%; object-fit:cover;"
            alt="">
        <div class="hero-overlay position-absolute w-100 h-100" 
             style="background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%); top:0; left:0;">
        </div>
        <div class="position-absolute bottom-0 start-0 p-5 text-white">
          <span class="badge-event-category mb-3 d-inline-block">{{ event.category }}</span>
          <h1 class="display-4 fw-bold mb-2">{{ event.title }}</h1>
          <p class="mb-2"><i class="fas fa-user-circle me-2"></i>Hosted by {{ event.organizerName }}</p>
          <div class="d-flex gap-4 mt-3 flex-wrap">
            <span><i class="fas fa-calendar-alt me-2"></i>{{ event.startDateTime | date:'fullDate' }}</span>
            <span><i class="fas fa-clock me-2"></i>{{ event.startDateTime | date:'h:mm a' }} - {{ event.endDateTime | date:'h:mm a' }}</span>
            <span><i class="fas fa-location-dot me-2"></i>{{ event.venue }}, {{ event.city }}</span>
          </div>
        </div>
      </div>

      <div class="container py-5">
        <div class="row">
          <!-- Left Column - Event Details -->
          <div class="col-lg-7" [class.col-lg-12]="enableSeatSelection && hasSeatMap">
            
            <!-- About Section - Card Design -->
            <div class="detail-card mb-4">
              <div class="detail-card-header">
                <i class="fas fa-info-circle me-2 text-primary"></i>
                <h4 class="fw-bold mb-0">About this Event</h4>
              </div>
              <div class="detail-card-body">
                <p class="event-description">{{ event.description }}</p>
              </div>
            </div>

            <!-- Event Details Grid -->
            <div class="detail-card mb-4">
              <div class="detail-card-header">
                <i class="fas fa-calendar-check me-2 text-primary"></i>
                <h4 class="fw-bold mb-0">Event Details</h4>
              </div>
              <div class="detail-card-body">
                <div class="row g-4">
                  <div class="col-md-6">
                    <div class="info-item">
                      <div class="info-icon">
                        <i class="fas fa-calendar-alt fa-2x text-primary"></i>
                      </div>
                      <div class="info-content">
                        <div class="info-label">Date & Time</div>
                        <div class="info-value">{{ event.startDateTime | date:'EEEE, MMMM d, y' }}</div>
                        <div class="info-small">{{ event.startDateTime | date:'h:mm a' }} – {{ event.endDateTime | date:'h:mm a' }}</div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Location with Google Maps Link -->
                  <div class="col-md-6">
                    <div class="info-item">
                      <div class="info-icon">
                        <i class="fas fa-map-marker-alt fa-2x text-primary"></i>
                      </div>
                      <div class="info-content">
                        <div class="info-label">Location</div>
                        <div class="info-value">
                          <a [href]="getGoogleMapsUrl()" 
                             target="_blank" 
                             rel="noopener noreferrer"
                             class="text-decoration-none">
                            {{ event.venue }}, {{ event.city }}
                            <i class="fas fa-external-link-alt ms-1 small"></i>
                          </a>
                        </div>
                        <div class="info-small">{{ event.address }}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="col-md-6">
                    <div class="info-item">
                      <div class="info-icon">
                        <i class="fas fa-ticket-alt fa-2x text-primary"></i>
                      </div>
                      <div class="info-content">
                        <div class="info-label">Tickets Available</div>
                        <div class="info-value" [class.text-danger]="event.availableTickets < 50">
                          {{ event.availableTickets }} / {{ event.totalTickets }}
                        </div>
                        <div class="progress mt-2" style="height: 6px;">
                          <div class="progress-bar bg-primary" 
                               [style.width.%]="(event.bookedTickets / event.totalTickets) * 100">
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="col-md-6">
                    <div class="info-item">
                      <div class="info-icon">
                        <i class="fas fa-tag fa-2x text-primary"></i>
                      </div>
                      <div class="info-content">
                        <div class="info-label">Price Range</div>
                        <div class="info-value fw-bold text-primary">
                          <ng-container *ngIf="hasSeatMap && event.minPrice && event.maxPrice && event.minPrice !== event.maxPrice">
                            ₹{{ event.minPrice }} - ₹{{ event.maxPrice }}
                            <span class="info-small d-block">per seat (varies by tier)</span>
                          </ng-container>
                          <ng-container *ngIf="!hasSeatMap || (event.minPrice === event.maxPrice)">
                            {{ event.ticketPrice === 0 ? 'FREE' : (event.ticketPrice | currency:'INR':'symbol':'1.2-2') }}
                            <span class="info-small d-block">per person</span>
                          </ng-container>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- ✅ NEW: Event Status -->
                  <div class="col-md-6">
                    <div class="info-item">
                      <div class="info-icon">
                        <i class="fas fa-info-circle fa-2x" [class.text-success]="!isExpired" [class.text-danger]="isExpired"></i>
                      </div>
                      <div class="info-content">
                        <div class="info-label">Event Status</div>
                        <div class="info-value" [class.text-success]="!isExpired" [class.text-danger]="isExpired">
                          <span *ngIf="!isExpired">
                            <i class="fas fa-check-circle me-1"></i> Active
                          </span>
                          <span *ngIf="isExpired">
                            <i class="fas fa-clock me-1"></i> Ended
                          </span>
                        </div>
                        <div class="info-small" *ngIf="!isExpired">
                          {{ getTimeRemaining() }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Booking Panel - Right Column -->
          <div class="col-lg-5" [class.col-lg-12]="enableSeatSelection && hasSeatMap">
            
            <!-- For Regular Users - Show Booking Options -->
            <ng-container *ngIf="!isOrganizer">
              
              <!-- Seat Map Toggle Card -->
              <div class="booking-card" *ngIf="hasSeatMap && !isExpired">
                <div class="booking-card-body">
                  <div class="d-flex justify-content-between align-items-center">
                    <div>
                      <i class="fas fa-chair me-2 text-primary"></i>
                      <span class="fw-semibold">Select Specific Seats</span>
                    </div>
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" 
                             id="seatSelectionToggle" 
                             [(ngModel)]="enableSeatSelection"
                             (ngModelChange)="onSeatToggleChange($event)"
                             [disabled]="selectionDisabled || isExpired"
                             style="width: 50px; height: 25px; cursor: pointer;">
                    </div>
                  </div>
                  <div class="text-muted small mt-2" *ngIf="!enableSeatSelection">
                    <i class="fas fa-info-circle me-1"></i>Toggle on to choose your specific seats
                  </div>
                </div>
              </div>

              <!-- Seat Map Component -->
              <div *ngIf="enableSeatSelection && hasSeatMap && seats.length > 0 && !isExpired" class="mt-3">
                <app-seat-map
                  #seatMapRef
                  [seats]="seats"
                  [maxSelectable]="10"
                  [selectionDisabled]="selectionDisabled || isExpired"
                  [loading]="loadingSeats"
                  (selectionChange)="onSeatSelectionChange($event)">
                </app-seat-map>
              </div>

              <!-- Loading seats indicator -->
              <div *ngIf="enableSeatSelection && hasSeatMap && seats.length === 0 && loadingSeats" 
                   class="booking-card mt-3 text-center py-4">
                <div class="spinner-border text-primary mb-2"></div>
                <p class="text-muted mb-0">Loading seat map...</p>
              </div>

              <!-- Expired Event Message -->
              <div *ngIf="isExpired" class="booking-card mt-3">
                <div class="booking-card-header" style="background: #dc3545;">
                  <i class="fas fa-clock me-2"></i>
                  <span class="fw-bold">Event Ended</span>
                </div>
                <div class="booking-card-body text-center py-4">
                  <i class="fas fa-calendar-times fa-4x text-muted mb-3"></i>
                  <h5 class="text-muted">This event has ended</h5>
                  <p class="text-muted">Bookings are no longer available for this event.</p>
                  <p class="text-muted small">Ended on {{ event.endDateTime | date:'EEEE, MMMM d, y - h:mm a' }}</p>
                </div>
              </div>

              <!-- Traditional Booking Card -->
              <div class="booking-card mt-3" *ngIf="!enableSeatSelection || !hasSeatMap">
                <div class="booking-card-header">
                  <i class="fas fa-ticket-alt me-2"></i>
                  <span class="fw-bold">Book Your Tickets</span>
                </div>
                <div class="booking-card-body">
                  <div class="price-display text-center mb-4">
                    <ng-container *ngIf="hasSeatMap && event.minPrice && event.maxPrice && event.minPrice !== event.maxPrice">
                      <div class="price-amount">₹{{ event.minPrice }} - ₹{{ event.maxPrice }}</div>
                      <div class="price-label">per seat (by tier)</div>
                    </ng-container>
                    <ng-container *ngIf="!hasSeatMap || (event.minPrice === event.maxPrice)">
                      <div class="price-amount">
                        {{ event.ticketPrice === 0 ? 'FREE' : (event.ticketPrice | currency:'INR':'symbol':'1.2-2') }}
                      </div>
                      <div class="price-label">per ticket</div>
                    </ng-container>
                  </div>

                  <div class="availability-info mb-3">
                    <div class="d-flex justify-content-between">
                      <span class="text-muted">Available Tickets</span>
                      <span class="fw-bold" [class.text-warning]="event.availableTickets < 50" 
                            [class.text-danger]="event.availableTickets < 20">
                        {{ event.availableTickets }} left
                      </span>
                    </div>
                    <div class="progress mt-1" style="height: 4px;">
                      <div class="progress-bar bg-primary" 
                           [style.width.%]="(event.bookedTickets / event.totalTickets) * 100">
                      </div>
                    </div>
                  </div>

                  <div *ngIf="event.availableTickets === 0" class="alert alert-danger text-center mb-0">
                    <i class="fas fa-times-circle me-2"></i>Sold Out
                  </div>

                  <form *ngIf="event.availableTickets > 0 && isLoggedIn && !isExpired" 
                        [formGroup]="bookingForm" (ngSubmit)="book()">
                    <div class="mb-3">
                      <label class="form-label fw-semibold">Number of Tickets</label>
                      <select class="form-select" formControlName="ticketCount" (change)="updateAttendees()" 
                              [disabled]="bookingLoading">
                        <option *ngFor="let n of ticketOptions" [value]="n">{{ n }} ticket(s)</option>
                      </select>
                    </div>

                    <div formArrayName="attendees">
                      <div *ngFor="let attendee of attendeesArray.controls; let i = index" 
                           [formGroupName]="i" class="attendee-card mb-3">
                        <div class="attendee-header">
                          <i class="fas fa-user me-2"></i>
                          <span>Attendee {{ i + 1 }}</span>
                        </div>
                        <div class="attendee-body">
                          <input class="form-control form-control-sm mb-2" 
                                 formControlName="name" 
                                 placeholder="Full Name">
                          <input class="form-control form-control-sm" 
                                 formControlName="email" 
                                 placeholder="Email Address" 
                                 type="email">
                        </div>
                      </div>
                    </div>

                    <div class="total-amount mt-3">
                      <span>Total Amount</span>
                      <span class="amount">{{ getTotalAmount() | currency:'INR':'symbol':'1.2-2' }}</span>
                    </div>

                    <button class="btn-book w-100 mt-3" type="submit" [disabled]="bookingLoading">
                      <span *ngIf="bookingLoading" class="spinner-border spinner-border-sm me-2"></span>
                      <i *ngIf="!bookingLoading" class="fas fa-check-circle me-2"></i>
                      {{ bookingLoading ? 'Processing...' : 'Confirm Booking' }}
                    </button>
                  </form>

                  <div *ngIf="!isLoggedIn && !isExpired" class="text-center py-3">
                    <p class="text-muted mb-2">Sign in to book tickets</p>
                    <a routerLink="/auth/login" class="btn btn-primary w-100">Sign In</a>
                  </div>

                  <div *ngIf="isExpired" class="text-center py-3">
                    <p class="text-muted mb-0">
                      <i class="fas fa-lock me-2"></i>
                      Booking is disabled for this event
                    </p>
                  </div>
                </div>
              </div>

              <!-- Seat-based booking summary -->
              <div *ngIf="enableSeatSelection && hasSeatMap && selectedSeats.length > 0 && !isExpired" 
                   class="booking-card mt-3">
                <div class="booking-card-header">
                  <i class="fas fa-shopping-cart me-2"></i>
                  <span class="fw-bold">Booking Summary</span>
                  <span class="ms-auto badge bg-primary rounded-pill">{{ selectedSeats.length }} seat(s)</span>
                </div>
                <div class="booking-card-body">
                  <div class="selected-seats-grid">
                    <div *ngFor="let seat of selectedSeats; let i = index" class="selected-seat-item">
                      <div class="seat-info">
                        <span class="seat-number">{{ seat.seatNumber }}</span>
                        <span class="seat-tier">{{ seat.tier }}</span>
                        <span class="seat-price">₹{{ seat.price }}</span>
                      </div>
                      <div class="attendee-inputs">
                        <input type="text" class="form-control form-control-sm" 
                               placeholder="Full Name" [(ngModel)]="seatAttendees[i].name" 
                               [ngModelOptions]="{standalone: true}"
                               [disabled]="bookingLoading || selectionDisabled || isExpired">
                        <input type="email" class="form-control form-control-sm mt-1" 
                               placeholder="Email" [(ngModel)]="seatAttendees[i].email"
                               [ngModelOptions]="{standalone: true}"
                               [disabled]="bookingLoading || selectionDisabled || isExpired">
                      </div>
                    </div>
                  </div>

                  <div class="total-amount mt-3">
                    <span>Total Amount</span>
                    <span class="amount">₹{{ seatTotalAmount | number:'1.2-2' }}</span>
                  </div>

                  <button class="btn-book w-100 mt-3" (click)="bookWithSeats()" 
                          [disabled]="bookingLoading || !isSeatAttendeesValid() || selectionDisabled || isExpired">
                    <span *ngIf="bookingLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <i *ngIf="!bookingLoading" class="fas fa-check-circle me-2"></i>
                    {{ bookingLoading ? 'Processing...' : 'Confirm & Book' }}
                  </button>
                </div>
              </div>

            </ng-container>

            <!-- For Organizers - Show info message instead of booking panel -->
            <ng-container *ngIf="isOrganizer">
              <div class="card border-0 shadow rounded-4">
                <div class="card-body text-center py-5">
                  <i class="fas fa-chalkboard-user fa-4x text-muted mb-3"></i>
                  <h5 class="text-muted">Organizer View</h5>
                  <p class="text-muted">You are viewing this event as an organizer.</p>
                  <p class="text-muted small">Booking is only available for regular users.</p>
                  <a routerLink="/organizer" class="btn btn-primary mt-2">
                    <i class="fas fa-tachometer-alt me-2"></i>Go to Dashboard
                  </a>
                </div>
              </div>
            </ng-container>

          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hero-section {
      position: relative;
    }
    .hero-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 100%);
    }
    .badge-event-category {
      background: linear-gradient(135deg, #6c5ce7, #a29bfe);
      padding: 6px 16px;
      border-radius: 25px;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .detail-card {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .detail-card-header {
      padding: 18px 24px;
      border-bottom: 1px solid #eef2f6;
      background: #fafbfc;
    }
    .detail-card-body {
      padding: 24px;
    }
    .event-description {
      line-height: 1.8;
      color: #4a5568;
      font-size: 1rem;
    }
    .info-item {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .info-icon {
      flex-shrink: 0;
    }
    .info-content {
      flex: 1;
    }
    .info-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #718096;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 1rem;
      font-weight: 600;
      color: #2d3748;
    }
    .info-value a {
      color: #2d3748;
      transition: color 0.2s;
    }
    .info-value a:hover {
      color: #6c5ce7;
      text-decoration: underline;
    }
    .info-small {
      font-size: 0.8rem;
      color: #a0aec0;
      margin-top: 2px;
    }
    .booking-card {
      background: white;
      border-radius: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      overflow: hidden;
      position: sticky;
      top: 20px;
    }
    .booking-card-header {
      padding: 16px 20px;
      background: linear-gradient(135deg, #6c5ce7, #8b74f0);
      color: white;
    }
    .booking-card-body {
      padding: 20px;
    }
    .price-display {
      border-bottom: 2px solid #eef2f6;
      padding-bottom: 16px;
    }
    .price-amount {
      font-size: 2rem;
      font-weight: 800;
      color: #6c5ce7;
    }
    .price-label {
      font-size: 0.8rem;
      color: #718096;
    }
    .availability-info {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 12px;
    }
    .attendee-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .attendee-header {
      background: #f8f9fa;
      padding: 10px 12px;
      font-size: 0.85rem;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
    }
    .attendee-body {
      padding: 12px;
    }
    .total-amount {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-top: 2px solid #eef2f6;
      font-weight: 600;
      font-size: 1.1rem;
    }
    .total-amount .amount {
      font-size: 1.3rem;
      font-weight: 800;
      color: #6c5ce7;
    }
    .btn-book {
      background: linear-gradient(135deg, #6c5ce7, #8b74f0);
      border: none;
      padding: 12px;
      border-radius: 12px;
      color: white;
      font-weight: 700;
      font-size: 1rem;
      transition: all 0.3s ease;
    }
    .btn-book:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(108,92,231,0.4);
    }
    .btn-book:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .selected-seats-grid {
      max-height: 400px;
      overflow-y: auto;
    }
    .selected-seat-item {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .seat-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eef2f6;
    }
    .seat-number {
      font-weight: 800;
      font-size: 1rem;
      color: #6c5ce7;
    }
    .seat-tier {
      font-size: 0.7rem;
      padding: 2px 8px;
      background: #eef2f6;
      border-radius: 20px;
      color: #4a5568;
    }
    .seat-price {
      font-weight: 700;
      color: #2d3748;
    }
    .form-control:focus {
      border-color: #6c5ce7;
      box-shadow: 0 0 0 0.2rem rgba(108,92,231,0.25);
    }
    .alert-danger {
      background-color: #f8d7da;
      border-color: #f5c6cb;
      color: #721c24;
    }
    @media (max-width: 768px) {
      .hero-section { height: 350px; }
      .detail-card-header, .detail-card-body { padding: 16px; }
      .booking-card { position: relative; top: 0; margin-top: 20px; }
      .info-item { flex-direction: column; text-align: center; }
      .info-icon { margin: 0 auto; }
    }
  `]
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
  isOrganizer = false;
  enableSeatSelection = false;
  hasSeatMap = false;
  selectionDisabled = false;
  ticketOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  // ✅ NEW: Expired event tracking
  isExpired = false;

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
    // Subscribe to auth state to check user role
    this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user;
      this.isOrganizer = user?.role === 'Organizer' || user?.role === 'Admin';
    });
    
    this.bookingForm = this.fb.group({
      ticketCount: [1],
      attendees: this.fb.array([this.createAttendee()])
    });
    
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadEvent(+id);
    }
  }

  /**
   * ✅ UPDATED: Load event with expiry check
   */
  loadEvent(id: number): void {
    this.loading = true;
    this.eventService.getEventById(id).subscribe({
      next: (event) => {
        this.event = event;
        this.hasSeatMap = event.seatConfig ? true : false;
        
        // ✅ CHECK IF EVENT IS EXPIRED
        const now = new Date();
        const endDate = new Date(event.endDateTime);
        
        if (endDate < now || event.status === 'Completed' || event.status === 'Cancelled') {
          this.isExpired = true;
          this.toastr.warning('This event has already ended', 'Event Expired', {
            timeOut: 5000,
            positionClass: 'toast-top-right'
          });
        } else {
          this.isExpired = false;
        }
        
        this.loading = false;
        
        if (this.hasSeatMap && !this.isExpired) {
          this.loadSeats();
        }
      },
      error: () => { 
        this.loading = false; 
        this.toastr.error('Event not found', 'Error');
        this.router.navigate(['/']); 
      }
    });
  }

  /**
   * ✅ NEW: Get time remaining for display
   */
  getTimeRemaining(): string {
    if (!this.event || this.isExpired) return 'Ended';
    
    const end = new Date(this.event.endDateTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Ended';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${minutes % 60}m remaining`;
    if (minutes > 0) return `${minutes}m remaining`;
    return `${Math.floor(diff / 1000)}s remaining`;
  }

  /**
   * Helper method to generate Google Maps URL with proper error handling
   */
  getGoogleMapsUrl(): string {
    if (!this.event) return '#';
    
    if (this.event.googleMapsUrl && this.event.googleMapsUrl.startsWith('http')) {
      return this.event.googleMapsUrl;
    }
    
    const searchQuery = `${this.event.venue}, ${this.event.city}`.trim();
    
    if (!searchQuery || searchQuery.length < 3) {
      console.warn('Incomplete location data for event:', this.event.id);
      return '#';
    }
    
    const encodedQuery = encodeURIComponent(searchQuery);
    return `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  }

  /**
   * Method to handle seat toggle change
   */
  onSeatToggleChange(enabled: boolean): void {
    if (this.isExpired) {
      this.toastr.warning('This event has ended. Seat selection is disabled.');
      this.enableSeatSelection = false;
      return;
    }
    this.enableSeatSelection = enabled;
    if (enabled) {
      this.loadSeats();
    }
  }

  loadSeats(): void {
    if (!this.event || this.isExpired) return;
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
    event.target.src = 'https://placehold.co/1600x450?text=Event+Image';
  }

  isSeatAttendeesValid(): boolean {
    return this.seatAttendees.every(attendee => 
      attendee.name.trim() !== '' && 
      attendee.email.trim() !== '' && 
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email)
    );
  }

  book(): void {
    if (this.isExpired) {
      this.toastr.error('This event has ended and cannot be booked.');
      return;
    }
    
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

  bookWithSeats(): void {
    if (this.isExpired) {
      this.toastr.error('This event has ended and cannot be booked.');
      return;
    }
    
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
        console.error('Booking error details:', err);
        
        let errorMsg = '';
        if (err.error?.message) {
          errorMsg = err.error.message;
        } else if (err.message) {
          errorMsg = err.message;
        } else {
          errorMsg = 'Booking failed.';
        }
        
        console.log('Error message:', errorMsg);
        
        const isConcurrencyError = 
          errorMsg.includes('already booked') || 
          errorMsg.includes('no longer available') ||
          errorMsg.includes('50001');
        
        if (isConcurrencyError) {
          this.toastr.error('Some seats were just booked by another user. Please refresh and try again.');
          this.loadSeats();
          this.selectedSeats = [];
          this.seatAttendees = [];
        } else {
          this.toastr.error(errorMsg);
        }
        
        this.bookingLoading = false;
        this.selectionDisabled = false;
        this.enableSeatSelection = true;
      }
    });
  }
}