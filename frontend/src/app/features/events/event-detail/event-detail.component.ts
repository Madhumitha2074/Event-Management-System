import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EventService } from '../../../core/services/event.service';
import { BookingService } from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';
import { Event } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-event-detail',
  template: `
    <div *ngIf="loading" class="text-center py-5">
      <div class="spinner-border text-primary"></div>
    </div>

    <div *ngIf="event && !loading">
      <!-- Hero -->
      <div class="position-relative" style="height: 400px; overflow: hidden;">
        <img [src]="event.imageUrl || 'https://via.placeholder.com/1200x400?text=' + event.title"
             style="width:100%; height:100%; object-fit:cover;" alt="">
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
                <div class="text-center mb-3">
                  <div class="display-6 fw-bold text-primary">{{ event.ticketPrice === 0 ? 'Free' : ('$' + event.ticketPrice) }}</div>
                  <small class="text-muted">per ticket</small>
                </div>
                <hr>
                <div class="d-flex justify-content-between mb-3">
                  <span class="text-muted">Available</span>
                  <span class="fw-bold {{ event.availableTickets < 10 ? 'text-danger' : 'text-success' }}">
                    {{ event.availableTickets }} tickets
                  </span>
                </div>

                <div *ngIf="event.availableTickets === 0" class="alert alert-danger text-center">Sold Out</div>

                <form *ngIf="event.availableTickets > 0 && isLoggedIn" [formGroup]="bookingForm" (ngSubmit)="book()">
                  <div class="mb-3">
                    <label class="form-label fw-semibold">Number of Tickets</label>
                    <select class="form-select" formControlName="ticketCount" (change)="updateAttendees()">
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
                    <span class="text-primary">\${{ (event.ticketPrice * bookingForm.get('ticketCount')?.value) | number:'1.2-2' }}</span>
                  </div>

                  <button class="btn btn-primary w-100 py-2" type="submit" [disabled]="bookingLoading">
                    <span *ngIf="bookingLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <i *ngIf="!bookingLoading" class="fas fa-ticket-alt me-2"></i>Book Now
                  </button>
                </form>

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
  event: Event | null = null;
  loading = true;
  bookingForm!: FormGroup;
  bookingLoading = false;
  isLoggedIn = false;
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
        next: (ev) => { this.event = ev; this.loading = false; },
        error: () => { this.loading = false; this.router.navigate(['/']); }
      });
    }
  }

  get attendeesArray(): FormArray { return this.bookingForm.get('attendees') as FormArray; }

  createAttendee(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  updateAttendees(): void {
    const count = +this.bookingForm.get('ticketCount')!.value;
    while (this.attendeesArray.length < count) this.attendeesArray.push(this.createAttendee());
    while (this.attendeesArray.length > count) this.attendeesArray.removeAt(this.attendeesArray.length - 1);
  }

  book(): void {
    if (this.bookingForm.invalid) { this.bookingForm.markAllAsTouched(); return; }
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
}
