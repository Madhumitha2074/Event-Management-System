import { Component, OnInit } from '@angular/core';
import { EventService } from '../../../core/services/event.service';
import { AuthService } from '../../../core/services/auth.service';
import { Event, EventFilter, PagedResult, EVENT_CATEGORIES } from '../../../core/models/models';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-event-list',
  template: `
    <div class="page-hero">
      <div class="container text-center">
        <h1 class="display-5 fw-bold">
          <i class="fas fa-calendar-star me-3"></i>Discover Events
        </h1>
        <p class="lead">Find and book amazing local events near you</p>
        <div class="row justify-content-center mt-4">
          <div class="col-md-6">
            <div class="input-group input-group-lg shadow">
              <input
                class="form-control border-0"
                placeholder="Search events, cities..."
                [(ngModel)]="filter.search"
                (ngModelChange)="onSearch()"
              />
              <button class="btn btn-light px-4">
                <i class="fas fa-search"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container pb-5">
      <div class="row">

        <!-- ── Filters Sidebar ── -->
        <div class="col-lg-3 mb-4">
          <div class="filter-sidebar">
            <h5 class="fw-bold mb-3">
              <i class="fas fa-filter me-2"></i>Filters
            </h5>

            <!-- City filter with clear button -->
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="form-label small fw-semibold mb-0">City</label>
                <button 
                  *ngIf="filter.city" 
                  class="btn btn-link btn-sm p-0 text-muted" 
                  (click)="clearCityFilter()">
                  <i class="fas fa-times"></i> Clear
                </button>
              </div>
              <input
                class="form-control form-control-sm"
                placeholder="Any city"
                [(ngModel)]="pendingFilter.city"
              />
            </div>

            <div class="mb-3">
              <label class="form-label small fw-semibold">Category</label>
              <select
                class="form-select form-select-sm"
                [(ngModel)]="pendingFilter.category"
              >
                <option [ngValue]="undefined">All Categories</option>
                <option *ngFor="let cat of categories" [ngValue]="cat.value">
                  {{ cat.label }}
                </option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label small fw-semibold">Date From</label>
              <input
                type="date"
                class="form-control form-control-sm"
                [(ngModel)]="pendingFilter.startDate"
              />
            </div>

            <div class="mb-3">
              <label class="form-label small fw-semibold">Date To</label>
              <input
                type="date"
                class="form-control form-control-sm"
                [(ngModel)]="pendingFilter.endDate"
              />
            </div>

            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label small fw-semibold">Min Price</label>
                <input
                  type="number"
                  class="form-control form-control-sm"
                  placeholder="0"
                  [(ngModel)]="pendingFilter.minPrice"
                />
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold">Max Price</label>
                <input
                  type="number"
                  class="form-control form-control-sm"
                  placeholder="Any"
                  [(ngModel)]="pendingFilter.maxPrice"
                />
              </div>
            </div>

            <!-- Apply + Clear buttons -->
            <div class="d-grid gap-2">
              <button
                class="btn btn-primary btn-sm"
                (click)="applyFilters()">
                <i class="fas fa-search me-1"></i>Apply Filters
              </button>
              <button
                class="btn btn-outline-secondary btn-sm"
                (click)="resetFilters()">
                <i class="fas fa-times me-1"></i>Clear Filters
              </button>
            </div>

          </div>
        </div>

        <!-- ── Event Grid ── -->
        <div class="col-lg-9">

          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="text-muted">
              {{ result?.totalCount || 0 }} events found
            </span>
            <div *ngIf="filter.city" class="badge bg-primary">
              <i class="fas fa-map-marker-alt me-1"></i>
              {{ filter.city }}
              <button class="btn-close-white ms-2" style="font-size: 0.6rem;" (click)="clearCityFilter()">✕</button>
            </div>
          </div>

          <div *ngIf="loading" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>

          <div *ngIf="!loading && events.length === 0" class="text-center py-5">
            <i class="fas fa-calendar-times fa-4x text-muted mb-3"></i>
            <h5 class="text-muted">No events found</h5>
            <p class="text-muted">Try adjusting your filters</p>
            <button *ngIf="filter.city" class="btn btn-outline-primary mt-2" (click)="clearCityFilter()">
              <i class="fas fa-globe me-1"></i>View all cities
            </button>
          </div>

          <div class="row g-4" *ngIf="!loading && events.length > 0">
            <div class="col-md-4" *ngFor="let event of events">
              <div class="card event-card h-100">
                <img
                  [src]="event.imageUrl || 'https://placehold.co/400x200?text=No+Image'"
                  (error)="onImageError($event)"
                  class="card-img-top"
                  alt="{{ event.title }}"
                />
                <div class="card-body d-flex flex-column">
                  
                  <!-- Price and Category - Updated with safe navigation -->
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge-category">{{ event.category }}</span>
                    <div class="price text-end">
                      <!-- Check if event has seat map with different prices -->
                      <ng-container *ngIf="event.hasSeatMap && event.minPrice && event.maxPrice && event.minPrice !== event.maxPrice">
                        <div class="fw-bold text-primary">From ₹{{ event.minPrice }}</div>
                        <small class="text-muted">/seat</small>
                      </ng-container>
                      <!-- For events without seat map or same prices -->
                      <ng-container *ngIf="!event.hasSeatMap || !event.minPrice || event.minPrice === event.maxPrice">
                        <div class="fw-bold text-primary">
                          {{ event.ticketPrice === 0 ? 'FREE' : (event.ticketPrice | currency:'INR':'symbol':'1.2-2') }}
                        </div>
                        <small class="text-muted">/ticket</small>
                      </ng-container>
                    </div>
                  </div>
                  
                  <!-- Title -->
                  <h6 class="fw-bold mb-1">{{ event.title }}</h6>
                  
                  <!-- Location -->
                  <p class="text-muted small mb-1">
                    <i class="fas fa-map-marker-alt me-1"></i>{{ event.city }}
                  </p>
                  
                  <!-- Date -->
                  <p class="text-muted small mb-2">
                    <i class="fas fa-calendar me-1"></i>
                    {{ event.startDateTime | date:'MMM d, y, h:mm a' }}
                  </p>
                  
                  <!-- Description -->
                  <p class="text-muted small flex-grow-1">
                    {{ event.description | slice:0:80 }}...
                  </p>
                  
                  <!-- Footer with availability and button -->
                  <div class="d-flex justify-content-between align-items-center mt-auto">
                    <small class="text-muted">
                      <i class="fas fa-ticket-alt me-1"></i>
                      {{ event.availableTickets }} left
                    </small>
                    <a [routerLink]="['/events', event.id]"
                       class="btn btn-primary btn-sm px-3">
                      View <i class="fas fa-arrow-right ms-1"></i>
                    </a>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <nav *ngIf="result && result.totalPages > 1" class="mt-4">
            <ul class="pagination justify-content-center">
              <li class="page-item" [class.disabled]="filter.page === 1">
                <button class="page-link"
                  (click)="changePage((filter.page || 1) - 1)">
                  Previous
                </button>
              </li>
              <li
                class="page-item"
                *ngFor="let p of getPages()"
                [class.active]="p === filter.page"
              >
                <button class="page-link" (click)="changePage(p)">{{ p }}</button>
              </li>
              <li class="page-item"
                  [class.disabled]="filter.page === result.totalPages">
                <button class="page-link"
                  (click)="changePage((filter.page || 1) + 1)">
                  Next
                </button>
              </li>
            </ul>
          </nav>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-hero {
      background: linear-gradient(135deg, #6c5ce7, #a29bfe);
      color: white;
      padding: 60px 0;
      margin-bottom: 40px;
      border-radius: 0 0 30px 30px;
    }
    .filter-sidebar {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    }
    .event-card {
      border: none;
      border-radius: 12px;
      box-shadow: 0 2px 15px rgba(0,0,0,0.08);
      transition: transform 0.2s, box-shadow 0.2s;
      overflow: hidden;
    }
    .event-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    }
    .event-card .card-img-top {
      height: 200px;
      object-fit: cover;
    }
    .badge-category {
      background: linear-gradient(135deg, #6c5ce7, #a29bfe);
      color: white;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    .price {
      .fw-bold {
        font-size: 1rem;
        line-height: 1.2;
      }
      small {
        font-size: 0.6rem;
      }
    }
    .btn-primary {
      background-color: #6c5ce7;
      border-color: #6c5ce7;
    }
    .btn-primary:hover {
      background-color: #5a4ad1;
      border-color: #5a4ad1;
    }
    .btn-close-white {
      background: none;
      border: none;
      color: white;
      opacity: 0.7;
      cursor: pointer;
    }
    .btn-close-white:hover {
      opacity: 1;
    }
  `]
})
export class EventListComponent implements OnInit {

  events: Event[] = [];
  result: PagedResult<Event> | null = null;
  loading = false;
  categories = EVENT_CATEGORIES;

  // Two separate filter objects:
  // filter = what was last sent to the API (committed)
  // pendingFilter = what the user is currently typing (not yet applied)
  filter: EventFilter = { page: 1, pageSize: 9 };
  pendingFilter: EventFilter = { page: 1, pageSize: 9 };

  private searchSubject = new Subject<string>();

  constructor(
    private eventService: EventService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // Check if there's a selected city from location popup
    this.authService.selectedCity$.subscribe(city => {
      if (city && !this.filter.city) {
        this.filter.city = city;
        this.pendingFilter.city = city;
        this.loadEvents();
        this.toastr.info(`Showing events in ${city}`, 'Local Events', {
          timeOut: 3000,
          positionClass: 'toast-top-right'
        });
      }
    });
    
    this.loadEvents();

    // Search bar uses debounce for live search
    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => {
        this.filter.page = 1;
        this.loadEvents();
      });
  }

  // Apply button — copy pendingFilter into filter and reload
  applyFilters(): void {
    const categoryValue = this.pendingFilter.category;

    this.filter = {
      search: this.filter.search,
      city: this.pendingFilter.city || undefined,
      category: (categoryValue !== undefined && categoryValue !== null)
                 ? Number(categoryValue)
                 : undefined,
      startDate: this.pendingFilter.startDate || undefined,
      endDate: this.pendingFilter.endDate || undefined,
      minPrice: this.pendingFilter.minPrice || undefined,
      maxPrice: this.pendingFilter.maxPrice || undefined,
      page: 1,
      pageSize: 9
    };

    this.loadEvents();
    
    if (this.filter.city) {
      this.toastr.info(`Showing events in ${this.filter.city}`);
    }
  }

  // Clear button — reset both filters completely
  resetFilters(): void {
    this.filter = { page: 1, pageSize: 9 };
    this.pendingFilter = { page: 1, pageSize: 9 };
    this.loadEvents();
    this.toastr.info('All filters cleared');
  }
  
  // Clear only the city filter
  clearCityFilter(): void {
    this.filter.city = undefined;
    this.pendingFilter.city = undefined;
    this.loadEvents();
    this.toastr.info('Showing events from all cities');
  }

  loadEvents(): void {
    this.loading = true;
    this.eventService.getEvents(this.filter).subscribe({
      next: (res) => {
        this.result = res;
        this.events = res.items;
        this.loading = false;
      },
      error: () => { 
        this.loading = false; 
      }
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.filter.search || '');
  }

  onImageError(event: any): void {
    event.target.src = 'https://placehold.co/400x200?text=No+Image';
  }

  changePage(page: number): void {
    if (!this.result || page < 1 || page > this.result.totalPages) return;
    this.filter.page = page;
    this.loadEvents();
    window.scrollTo(0, 0);
  }

  getPages(): number[] {
    if (!this.result) return [];
    return Array.from({ length: this.result.totalPages }, (_, i) => i + 1);
  }
}