import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService } from '../../../core/services/event.service';
import { EVENT_CATEGORIES } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-event-form',
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-8">
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
                    <input class="form-control" formControlName="title" placeholder="Amazing Summer Concert">
                  </div>
                  <div class="col-12">
                    <label class="form-label">Description *</label>
                    <textarea class="form-control" formControlName="description" rows="4" placeholder="Describe your event..."></textarea>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Category *</label>
                    <select class="form-select" formControlName="category">
                      <option *ngFor="let cat of categories" [value]="cat.value">{{ cat.label }}</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Image URL</label>
                    <input class="form-control" formControlName="imageUrl" placeholder="https://...">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Start Date & Time *</label>
                    <input type="datetime-local" class="form-control" formControlName="startDateTime">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">End Date & Time *</label>
                    <input type="datetime-local" class="form-control" formControlName="endDateTime">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Venue *</label>
                    <input class="form-control" formControlName="venue" placeholder="Madison Square Garden">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">City *</label>
                    <input class="form-control" formControlName="city" placeholder="New York">
                  </div>
                  <div class="col-12">
                    <label class="form-label">Full Address</label>
                    <input class="form-control" formControlName="address" placeholder="4 Pennsylvania Plaza, New York, NY">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Ticket Price (₹) *</label>
                    <input type="number" class="form-control" formControlName="ticketPrice" placeholder="0 for free" min="0">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Total Tickets *</label>
                    <input type="number" class="form-control" formControlName="totalTickets" placeholder="100" min="1">
                  </div>
                  <div *ngIf="isEdit" class="col-12">
                    <label class="form-label">Status</label>
                    <select class="form-select" formControlName="status">
                      <option value="0">Draft</option>
                      <option value="1">Published</option>
                      <option value="2">Cancelled</option>
                      <option value="3">Completed</option>
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

  constructor(private fb: FormBuilder, private eventService: EventService,
              private route: ActivatedRoute, private router: Router,
              private toastr: ToastrService) {}

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
      ticketPrice: [0, [Validators.required, Validators.min(0)]],
      totalTickets: [100, [Validators.required, Validators.min(1)]],
      status: [1]
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.eventId = +id;
      this.eventService.getEventById(+id).subscribe(ev => {
        this.form.patchValue({
          ...ev,
          startDateTime: ev.startDateTime.slice(0, 16),
          endDateTime: ev.endDateTime.slice(0, 16)
        });
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const data = this.form.value;

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
