import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService } from '../../../core/services/event.service';
import { EVENT_CATEGORIES, SeatTierConfig } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-event-form',
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-10">
          <div class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-5">
              <h3 class="fw-bold mb-4">
                <i class="fas fa-calendar-plus text-primary me-3"></i>
                {{ isEdit ? 'Edit Event' : 'Create New Event' }}
              </h3>

              <form [formGroup]="form" (ngSubmit)="onSubmit()">
                <div class="row g-3">

                  <div class="col-12">
                    <label class="form-label">Event Title *</label>
                    <input class="form-control" formControlName="title"
                           placeholder="Amazing Summer Concert">
                    <div *ngIf="form.get('title')?.touched && form.get('title')?.invalid"
                         class="text-danger small">Title is required.</div>
                  </div>

                  <div class="col-12">
                    <label class="form-label">Description *</label>
                    <textarea class="form-control" formControlName="description"
                              rows="4" placeholder="Describe your event..."></textarea>
                    <div *ngIf="form.get('description')?.touched && form.get('description')?.invalid"
                         class="text-danger small">Description is required.</div>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label">Category *</label>
                    <select class="form-select" formControlName="category">
                      <option *ngFor="let cat of categories" [value]="cat.value">
                        {{ cat.label }}
                      </option>
                    </select>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label">Image URL</label>
                    <input class="form-control" formControlName="imageUrl"
                           placeholder="https://...">
                  </div>

                  <div class="col-md-6">
                    <label class="form-label">Start Date & Time *</label>
                    <input type="datetime-local" class="form-control"
                           formControlName="startDateTime">
                    <div *ngIf="form.get('startDateTime')?.touched && form.get('startDateTime')?.invalid"
                         class="text-danger small">Start date is required.</div>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label">End Date & Time *</label>
                    <input type="datetime-local" class="form-control"
                           formControlName="endDateTime">
                    <div *ngIf="form.get('endDateTime')?.touched && form.get('endDateTime')?.invalid"
                         class="text-danger small">End date is required.</div>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label">Venue *</label>
                    <input class="form-control" formControlName="venue"
                           placeholder="Madison Square Garden">
                  </div>

                  <div class="col-md-6">
                    <label class="form-label">City *</label>
                    <input class="form-control" formControlName="city"
                           placeholder="Chennai">
                  </div>

                  <div class="col-12">
                    <label class="form-label">Full Address</label>
                    <input class="form-control" formControlName="address"
                           placeholder="123 Main Street, Chennai">
                  </div>

                  <!-- Google Maps Location Link Field -->
                  <div class="col-12">
                    <label class="form-label">
                      <i class="fab fa-google me-1 text-danger"></i>
                      Google Maps Location Link 
                      <small class="text-muted">(Optional)</small>
                    </label>
                    <div class="input-group">
                      <span class="input-group-text bg-white">
                        <i class="fas fa-map-marker-alt text-danger"></i>
                      </span>
                      <input type="url" class="form-control" formControlName="googleMapsUrl" 
                             placeholder="https://maps.google.com/?q=YMCA+Nandanam+Chennai">
                      <button class="btn btn-outline-secondary" type="button" 
                              (click)="openGoogleMapsHelp()" title="How to get Google Maps link">
                        <i class="fas fa-question"></i>
                      </button>
                    </div>
                    <small class="text-muted d-block mt-1">
                      <i class="fas fa-info-circle me-1"></i>
                      How to get link: 
                      <strong>1.</strong> Open Google Maps → <strong>2.</strong> Search for venue → 
                      <strong>3.</strong> Click "Share" → <strong>4.</strong> Copy link
                    </small>
                    <small class="text-muted d-block">
                      Example: <code>https://maps.google.com/?q=YMCA+Nandanam+Chennai</code>
                    </small>
                  </div>

                  <!-- Seat Configuration Section -->
                  <div class="col-12 mt-3">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                      <h5 class="fw-bold mb-0">
                        <i class="fas fa-chair me-2"></i>Seat Configuration
                      </h5>
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" 
                               id="enableSeatConfig" [(ngModel)]="enableSeatConfig"
                               [ngModelOptions]="{standalone: true}">
                        <label class="form-check-label" for="enableSeatConfig">
                          Enable Seat Map
                        </label>
                      </div>
                    </div>
                    
                    <div *ngIf="enableSeatConfig" class="alert alert-info small">
                      <i class="fas fa-info-circle me-1"></i>
                      Configure different seating tiers. Total tickets will be calculated automatically.
                      Ticket price will be set to the lowest tier price.
                    </div>

                    <div *ngIf="enableSeatConfig">
                      <div formArrayName="seatTiers">
                        <div *ngFor="let tier of seatTiersArray.controls; let i = index" 
                             [formGroupName]="i" class="card mb-3 bg-light">
                          <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                              <h6 class="fw-bold mb-0">Tier {{ i + 1 }}</h6>
                              <button type="button" class="btn btn-sm btn-outline-danger"
                                      (click)="removeTier(i)">
                                <i class="fas fa-trash"></i>
                              </button>
                            </div>

                            <div class="row g-2">
                              <div class="col-md-3">
                                <label class="form-label small fw-semibold">Tier Type</label>
                                <select class="form-select form-select-sm" formControlName="tier">
                                  <option value="Premium">Premium ⭐</option>
                                  <option value="Ordinary">Ordinary 🪑</option>
                                  <option value="Economy">Economy 💺</option>
                                </select>
                              </div>
                              <div class="col-md-3">
                                <label class="form-label small fw-semibold">Rows</label>
                                <input type="number" class="form-control form-control-sm" 
                                       formControlName="rows" min="1" max="50">
                              </div>
                              <div class="col-md-3">
                                <label class="form-label small fw-semibold">Seats Per Row</label>
                                <input type="number" class="form-control form-control-sm" 
                                       formControlName="seatsPerRow" min="1" max="50">
                              </div>
                              <div class="col-md-3">
                                <label class="form-label small fw-semibold">Price (₹)</label>
                                <input type="number" class="form-control form-control-sm" 
                                       formControlName="price" min="0" step="10">
                              </div>
                            </div>
                            
                            <div class="text-muted small mt-2">
                              <i class="fas fa-calculator me-1"></i>
                              This tier will have {{ getTierSeatCount(i) }} seats
                              ({{ tier.get('rows')?.value || 0 }} rows × {{ tier.get('seatsPerRow')?.value || 0 }} seats)
                            </div>
                          </div>
                        </div>
                      </div>

                      <button type="button" class="btn btn-sm btn-outline-primary mt-2"
                              (click)="addTier()">
                        <i class="fas fa-plus me-1"></i>Add Tier
                      </button>
                      
                      <!-- Summary -->
                      <div class="alert alert-secondary mt-3" *ngIf="seatTiersArray.length > 0">
                        <div class="d-flex justify-content-between">
                          <span><strong>Total Seats:</strong></span>
                          <span>{{ getTotalSeats() }}</span>
                        </div>
                        <div class="d-flex justify-content-between">
                          <span><strong>Price Range:</strong></span>
                          <span>₹{{ getMinPrice() }} - ₹{{ getMaxPrice() }}</span>
                        </div>
                        <div class="d-flex justify-content-between text-success">
                          <span><strong>Base Ticket Price:</strong></span>
                          <span>₹{{ getMinPrice() }} (lowest tier)</span>
                        </div>
                      </div>
                    </div>

                    <!-- Traditional fields (hidden when seat config is enabled) -->
                    <div *ngIf="!enableSeatConfig" class="row">
                      <div class="col-md-6">
                        <label class="form-label">Ticket Price (₹) *</label>
                        <input type="number" class="form-control" formControlName="ticketPrice"
                               placeholder="0 for free" min="0">
                      </div>

                      <div class="col-md-6">
                        <label class="form-label">Total Tickets *</label>
                        <input type="number" class="form-control" formControlName="totalTickets"
                               placeholder="100" min="1">
                      </div>
                    </div>
                  </div>

                  <!-- Status only shown on Edit -->
                  <div *ngIf="isEdit" class="col-12">
                    <label class="form-label">Status</label>
                    <select class="form-select" formControlName="status">
                      <option value="Draft">Draft</option>
                      <option value="Published">Published</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                </div>

                <div class="d-flex gap-3 mt-4">
                  <button class="btn btn-primary px-4" type="submit" [disabled]="loading">
                    <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                    {{ isEdit ? 'Update Event' : 'Create Event' }}
                  </button>
                  <a routerLink="/organizer" class="btn btn-outline-secondary px-4">Cancel</a>
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class EventFormComponent implements OnInit {
  form!: FormGroup;
  categories = EVENT_CATEGORIES;
  isEdit = false;
  loading = false;
  eventId: number | null = null;
  enableSeatConfig = false;

  private readonly categoryMap: Record<string, number> = {
    'Music': 0, 'Sports': 1, 'Technology': 2, 'Food': 3,
    'Art': 4, 'Business': 5, 'Health': 6, 'Other': 7
  };

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      category: [0, Validators.required],
      startDateTime: ['', Validators.required],
      endDateTime: ['', Validators.required],
      venue: ['', Validators.required],
      city: ['', Validators.required],
      address: [''],
      imageUrl: [''],
      googleMapsUrl: [''], // NEW: Google Maps location link
      ticketPrice: [0, [Validators.required, Validators.min(0)]],
      totalTickets: [100, [Validators.required, Validators.min(1)]],
      status: ['Draft'],
      seatTiers: this.fb.array([])
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.eventId = +id;

      this.eventService.getEventById(+id).subscribe(ev => {
        this.form.patchValue({
          title: ev.title,
          description: ev.description,
          category: this.categoryMap[ev.category] ?? 0,
          startDateTime: ev.startDateTime.slice(0, 16),
          endDateTime: ev.endDateTime.slice(0, 16),
          venue: ev.venue,
          city: ev.city,
          address: ev.address ?? '',
          imageUrl: ev.imageUrl ?? '',
          googleMapsUrl: ev.googleMapsUrl ?? '', // NEW
          ticketPrice: ev.ticketPrice,
          totalTickets: ev.totalTickets,
          status: ev.status
        });

        // Load existing seat configuration if any
        if (ev.seatConfig) {
          this.enableSeatConfig = true;
          const config = JSON.parse(ev.seatConfig);
          config.forEach((tier: SeatTierConfig) => this.addTier(tier));
        }
      });
    }
  }

  // Helper method to open Google Maps help
  openGoogleMapsHelp(): void {
    window.open('https://support.google.com/maps/answer/144361?co=GENIE.Platform%3DDesktop&hl=en', '_blank');
  }

  get seatTiersArray(): FormArray {
    return this.form.get('seatTiers') as FormArray;
  }

  addTier(existingTier?: SeatTierConfig): void {
    const tierForm = this.fb.group({
      tier: [existingTier?.tier || 'Ordinary', Validators.required],
      rows: [existingTier?.rows || 10, [Validators.required, Validators.min(1), Validators.max(50)]],
      seatsPerRow: [existingTier?.seatsPerRow || 10, [Validators.required, Validators.min(1), Validators.max(50)]],
      price: [existingTier?.price || 100, [Validators.required, Validators.min(0)]]
    });
    this.seatTiersArray.push(tierForm);
  }

  removeTier(index: number): void {
    this.seatTiersArray.removeAt(index);
  }

  getTierSeatCount(index: number): number {
    const tier = this.seatTiersArray.at(index);
    const rows = tier.get('rows')?.value || 0;
    const seatsPerRow = tier.get('seatsPerRow')?.value || 0;
    return rows * seatsPerRow;
  }

  getTotalSeats(): number {
    let total = 0;
    for (let i = 0; i < this.seatTiersArray.length; i++) {
      total += this.getTierSeatCount(i);
    }
    return total;
  }

  getMinPrice(): number {
    let min = Infinity;
    for (let i = 0; i < this.seatTiersArray.length; i++) {
      const price = this.seatTiersArray.at(i).get('price')?.value || 0;
      if (price < min) min = price;
    }
    return min === Infinity ? 0 : min;
  }

  getMaxPrice(): number {
    let max = 0;
    for (let i = 0; i < this.seatTiersArray.length; i++) {
      const price = this.seatTiersArray.at(i).get('price')?.value || 0;
      if (price > max) max = price;
    }
    return max;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    this.loading = true;

    const data: any = {
      title: this.form.value.title,
      description: this.form.value.description,
      category: this.form.value.category,
      startDateTime: this.form.value.startDateTime,
      endDateTime: this.form.value.endDateTime,
      venue: this.form.value.venue,
      city: this.form.value.city,
      address: this.form.value.address,
      imageUrl: this.form.value.imageUrl,
      googleMapsUrl: this.form.value.googleMapsUrl // NEW: Include Google Maps URL
    };

    if (this.enableSeatConfig && this.seatTiersArray.length > 0) {
      const seatTiers = this.form.value.seatTiers;
      data.seatTiers = seatTiers;
      data.totalTickets = this.getTotalSeats();
      data.ticketPrice = this.getMinPrice();
    } else {
      data.ticketPrice = this.form.value.ticketPrice;
      data.totalTickets = this.form.value.totalTickets;
      data.seatTiers = null;
    }

    if (this.isEdit) {
      data.status = this.form.value.status;
    }

    const obs = this.isEdit
      ? this.eventService.updateEvent(this.eventId!, data)
      : this.eventService.createEvent(data);

    obs.subscribe({
      next: () => {
        this.toastr.success(`Event ${this.isEdit ? 'updated' : 'created'} successfully!`);
        this.router.navigate(['/organizer']);
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to save event.');
        this.loading = false;
      }
    });
  }
}