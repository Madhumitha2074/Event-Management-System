import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService } from '../../../core/services/event.service';
import { EVENT_CATEGORIES, SeatTierConfig } from '../../../core/models/models';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-event-form',
  templateUrl: './event-form.component.html',
  styleUrls: ['./event-form.component.css']
})
export class EventFormComponent implements OnInit {
  form!: FormGroup;
  categories = EVENT_CATEGORIES;
  isEdit = false;
  loading = false;
  eventId: number | null = null;
  enableSeatConfig = false;
  formSubmitted = false;

  // ✅ Date validation properties
  minDate: string = '';
  maxDate: string = '';

  // ✅ Read-only mode properties
  isEventCompleted = false;
  isEventCancelled = false;
  isEventStarted = false;
  eventStatus = '';
  isReadOnly = false;

  private readonly categoryMap: Record<string, number> = {
    'Music': 0, 'Sports': 1, 'Technology': 2, 'Food': 3,
    'Art': 4, 'Business': 5, 'Health': 6, 'Other': 7
  };

  static dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const start = control.get('startDateTime')?.value;
    const end = control.get('endDateTime')?.value;
    if (start && end && new Date(start) >= new Date(end)) {
      return { dateRange: true };
    }
    return null;
  }

  static pastDateValidator(control: AbstractControl): ValidationErrors | null {
    const start = control.get('startDateTime')?.value;
    if (start) {
      const startDate = new Date(start);
      const now = new Date();
      startDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      if (startDate < now) {
        return { pastDate: true };
      }
    }
    return null;
  }

  static imageValidator(control: AbstractControl): ValidationErrors | null {
    const url = control.value;
    if (url && !url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i)) {
      return { invalidImageUrl: true };
    }
    return null;
  }

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // ✅ Set min date to current time (prevent past dates)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    this.minDate = `${year}-${month}-${day}T${hours}:${minutes}`;

    // ✅ Set max date to 1 year from now
    const maxYear = now.getFullYear() + 1;
    this.maxDate = `${maxYear}-${month}-${day}T${hours}:${minutes}`;

    this.initializeForm();
    this.loadEventIfEditing();
  }

  shouldShowError(control: AbstractControl | null): boolean {
    if (!control) return false;
    return this.formSubmitted && control.invalid;
  }

  // ─────────────────────────────────────────────
  // ✅ DATE VALIDATION METHODS
  // ─────────────────────────────────────────────

  /**
   * Validate dates and set errors
   */
  validateDates(): void {
    const startDate = this.form.get('startDateTime')?.value;
    const endDate = this.form.get('endDateTime')?.value;
    const now = new Date();

    if (startDate) {
      const start = new Date(startDate);
      if (start < now) {
        this.form.get('startDateTime')?.setErrors({ pastDate: true });
      } else {
        // Clear past date error if valid
        const errors = this.form.get('startDateTime')?.errors;
        if (errors) {
          delete errors['pastDate'];
          if (Object.keys(errors).length === 0) {
            this.form.get('startDateTime')?.setErrors(null);
          }
        }
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (end < now) {
        this.form.get('endDateTime')?.setErrors({ pastDate: true });
      } else {
        const errors = this.form.get('endDateTime')?.errors;
        if (errors) {
          delete errors['pastDate'];
          if (Object.keys(errors).length === 0) {
            this.form.get('endDateTime')?.setErrors(null);
          }
        }
      }
    }

    // Check if end date is after start date
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        this.form.get('endDateTime')?.setErrors({ beforeStart: true });
      } else {
        const errors = this.form.get('endDateTime')?.errors;
        if (errors) {
          delete errors['beforeStart'];
          if (Object.keys(errors).length === 0) {
            this.form.get('endDateTime')?.setErrors(null);
          }
        }
      }
    }
  }

  /**
   * Check if start date is in past
   */
  isStartDateInPast(): boolean {
    const startDate = this.form.get('startDateTime')?.value;
    if (!startDate) return false;
    return new Date(startDate) < new Date();
  }

  /**
   * Check if end date is in past
   */
  isEndDateInPast(): boolean {
    const endDate = this.form.get('endDateTime')?.value;
    if (!endDate) return false;
    return new Date(endDate) <= new Date();
  }

  /**
   * Check if end date is before start date
   */
  isEndDateBeforeStart(): boolean {
    const startDate = this.form.get('startDateTime')?.value;
    const endDate = this.form.get('endDateTime')?.value;
    if (!startDate || !endDate) return false;
    return new Date(endDate) <= new Date(startDate);
  }

  // ─────────────────────────────────────────────
  // FORM INITIALIZATION
  // ─────────────────────────────────────────────

  initializeForm(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
      category: [0, Validators.required],
      contactEmail: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      startDateTime: ['', Validators.required],
      endDateTime: ['', Validators.required],
      venue: ['', [Validators.required, Validators.minLength(2)]],
      city: ['', [Validators.required, Validators.minLength(2)]],
      address: [''],
      imageUrl: ['', [EventFormComponent.imageValidator]],
      googleMapsUrl: [''],
      ticketPrice: [0, [Validators.required, Validators.min(0)]],
      totalTickets: ['', [Validators.required, Validators.min(1)]],
      status: ['Draft'],
      seatTiers: this.fb.array([])
    }, { 
      validators: [
        EventFormComponent.dateRangeValidator,
        EventFormComponent.pastDateValidator
      ] 
    });

    // ✅ Add value change listeners for date validation
    this.form.get('startDateTime')?.valueChanges.subscribe(() => {
      this.validateDates();
    });

    this.form.get('endDateTime')?.valueChanges.subscribe(() => {
      this.validateDates();
    });
  }

  loadEventIfEditing(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.eventId = +id;

      this.eventService.getEventById(+id).subscribe({
        next: (ev) => {
          console.log('📋 Loading event data:', ev);
          
          // ✅ Check event status
          this.eventStatus = ev.status || '';
          this.isEventCompleted = ev.status === 'Completed';
          this.isEventCancelled = ev.status === 'Cancelled';
          
          // ✅ Check if event has already started
          const startDate = new Date(ev.startDateTime);
          const now = new Date();
          this.isEventStarted = startDate <= now;

          // ✅ Determine if form should be read-only
          this.isReadOnly = this.isEventCompleted || this.isEventCancelled || this.isEventStarted;

          // ✅ If event is completed, cancelled, or started, disable the form
          if (this.isReadOnly) {
            this.form.disable();
            
            let message = '';
            if (this.isEventCompleted) {
              message = 'This event has been completed and cannot be edited.';
            } else if (this.isEventCancelled) {
              message = 'This event has been cancelled and cannot be edited.';
            } else if (this.isEventStarted) {
              message = 'This event has already started and cannot be edited.';
            }
            
            this.toastr.warning(message, 'Read-Only Mode', {
              timeOut: 5000,
              positionClass: 'toast-top-right'
            });
          }

          this.form.patchValue({
            title: ev.title || '',
            description: ev.description || '',
            category: this.categoryMap[ev.category] ?? 0,
            contactEmail: ev.contactEmail || '',
            startDateTime: ev.startDateTime ? ev.startDateTime.slice(0, 16) : '',
            endDateTime: ev.endDateTime ? ev.endDateTime.slice(0, 16) : '',
            venue: ev.venue || '',
            city: ev.city || '',
            address: ev.address || '',
            imageUrl: ev.imageUrl || '',
            googleMapsUrl: ev.googleMapsUrl || '',
            ticketPrice: ev.ticketPrice || 0,
            totalTickets: ev.totalTickets || '',
            status: ev.status || 'Draft'
          });

          // Mark all fields as untouched and pristine after loading
          Object.keys(this.form.controls).forEach(key => {
            const control = this.form.get(key);
            if (control) {
              control.markAsUntouched();
              control.markAsPristine();
              control.updateValueAndValidity();
            }
          });

          if (ev.seatConfig) {
            this.enableSeatConfig = true;
            console.log('📋 Raw seat config from DB:', ev.seatConfig);
            
            try {
              let config = JSON.parse(ev.seatConfig);
              console.log('📋 Parsed config:', config);
              
              if (config.seatTiers) {
                config = config.seatTiers;
              }
              
              if (!Array.isArray(config)) {
                config = [config];
              }
              
              console.log('📋 Final config array:', config);
              
              while (this.seatTiersArray.length) {
                this.seatTiersArray.removeAt(0);
              }
              
              config.forEach((tier: any) => {
                this.addTier({
                  tier: tier.tier || 'Standard',
                  rows: tier.rows || 10,
                  seatsPerRow: tier.seatsPerRow || 10,
                  price: tier.price || 100
                });
              });
              
              console.log('✅ Loaded tiers:', this.seatTiersArray.length);
              console.log('📋 Tier values:', this.seatTiersArray.value);
            } catch (error) {
              console.error('❌ Error parsing seat config:', error);
              this.addTier();
            }
          }
        },
        error: (err) => {
          this.toastr.error('Failed to load event details');
          console.error(err);
        }
      });
    }
  }

  // ============= FORM CONTROL GETTERS =============

  get title() { return this.form.get('title'); }
  get description() { return this.form.get('description'); }
  get category() { return this.form.get('category'); }
  get contactEmail() { return this.form.get('contactEmail'); }
  get startDateTime() { return this.form.get('startDateTime'); }
  get endDateTime() { return this.form.get('endDateTime'); }
  get venue() { return this.form.get('venue'); }
  get city() { return this.form.get('city'); }
  get imageUrl() { return this.form.get('imageUrl'); }
  get ticketPrice() { return this.form.get('ticketPrice'); }
  get totalTickets() { return this.form.get('totalTickets'); }
  get googleMapsUrl() { return this.form.get('googleMapsUrl'); }
  
  get seatTiersArray(): FormArray {
    return this.form.get('seatTiers') as FormArray;
  }

  // ============= SEAT TIER METHODS =============

  addTier(existingTier?: SeatTierConfig): void {
    console.log('➕ Adding tier with data:', existingTier);
    
    const tierType = existingTier?.tier || 'Standard';
    const rows = existingTier?.rows || 10;
    const seatsPerRow = existingTier?.seatsPerRow || 10;
    const price = existingTier?.price || 100;
    
    console.log(`📋 Creating tier: ${tierType}, ${rows}x${seatsPerRow}, ₹${price}`);
    
    const tierForm = this.fb.group({
      tier: [tierType, Validators.required],
      rows: [rows, [Validators.required, Validators.min(1), Validators.max(50)]],
      seatsPerRow: [seatsPerRow, [Validators.required, Validators.min(1), Validators.max(50)]],
      price: [price, [Validators.required, Validators.min(0)]]
    });
    
    this.seatTiersArray.push(tierForm);
    console.log('✅ Tier added. Total:', this.seatTiersArray.length);
    console.log('📋 Tier value:', tierForm.value);
  }

  removeTier(index: number): void {
    console.log('🗑️ Removing tier at index:', index);
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

  // ============= TOGGLE SEAT CONFIG =============

  toggleSeatConfig(event: any): void {
    const checked = event.target.checked;
    console.log('🔄 Toggle seat config:', checked);
    this.enableSeatConfig = checked;
    if (!checked) {
      this.seatTiersArray.clear();
      console.log('🗑️ Cleared all tiers');
    }
  }

  // ============= EVENT HANDLERS FROM CHILD COMPONENTS =============

  onImageUploaded(imageData: { url: string; file?: File }): void {
    this.form.patchValue({ imageUrl: imageData.url });
    if (imageData.file) {
      // Additional logic if needed
    }
  }

  onImageRemoved(): void {
    this.form.patchValue({ imageUrl: '' });
    this.toastr.info('Image removed');
  }

  // ============= NAVIGATION METHODS =============

  goToOrganizer(): void {
    this.router.navigate(['/organizer']);
  }

  // ============= GOOGLE MAPS HELP =============

  openGoogleMapsHelp(): void {
    window.open('https://support.google.com/maps/answer/144361?co=GENIE.Platform%3DDesktop&hl=en', '_blank');
  }

  // ============= FORM SUBMISSION =============

  onSubmit(): void {
    // ✅ Prevent submission if read-only
    if (this.isReadOnly) {
      this.toastr.warning('This event cannot be edited.', 'Read-Only');
      return;
    }

    this.formSubmitted = true;
    
    // ✅ Validate dates before submitting
    if (this.isStartDateInPast()) {
      this.toastr.error('Start date cannot be in the past. Please select a future date.', 'Invalid Date');
      return;
    }

    if (this.isEndDateInPast()) {
      this.toastr.error('End date must be in the future.', 'Invalid Date');
      return;
    }

    if (this.isEndDateBeforeStart()) {
      this.toastr.error('End date must be after the start date.', 'Invalid Date');
      return;
    }
    
    if (this.form.invalid) {
      // Mark all fields as touched on submit
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
      
      if (this.form.hasError('pastDate')) {
        this.toastr.error('Start date must be in the future!', 'Invalid Date');
        return;
      }
      
      this.toastr.warning('Please fix all validation errors');
      return;
    }
    
    this.loading = true;

    const startDate = new Date(this.form.value.startDateTime);
    const endDate = new Date(this.form.value.endDateTime);

    const data: any = {
      title: this.form.value.title,
      description: this.form.value.description,
      category: this.form.value.category,
      contactEmail: this.form.value.contactEmail,
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      venue: this.form.value.venue,
      city: this.form.value.city,
      address: this.form.value.address || '',
      imageUrl: this.form.value.imageUrl || '',
      googleMapsUrl: this.form.value.googleMapsUrl || ''
    };

    if (this.enableSeatConfig && this.seatTiersArray.length > 0) {
      const seatTiers = this.form.value.seatTiers.map((tier: any) => ({
        tier: tier.tier,
        rows: Number(tier.rows),
        seatsPerRow: Number(tier.seatsPerRow),
        price: Number(tier.price)
      }));
      
      data.seatTiers = seatTiers;
      data.totalTickets = this.getTotalSeats();
      data.ticketPrice = this.getMinPrice();
      data.hasSeatMap = true;
    } else {
      data.ticketPrice = Number(this.form.value.ticketPrice);
      data.totalTickets = Number(this.form.value.totalTickets);
      data.seatTiers = null;
      data.hasSeatMap = false;
    }

    if (this.isEdit) {
      data.status = this.form.value.status;
    }

    console.log('📤 Sending data to backend:', JSON.stringify(data, null, 2));

    const obs = this.isEdit
      ? this.eventService.updateEvent(this.eventId!, data)
      : this.eventService.createEvent(data);

    obs.subscribe({
      next: () => {
        this.toastr.success(`Event ${this.isEdit ? 'updated' : 'created'} successfully!`);
        this.router.navigate(['/organizer']);
      },
      error: (err) => {
        console.error('❌ Error response:', err);
        this.toastr.error(err.error?.message || 'Failed to save event.');
        this.loading = false;
      }
    });
  }
}