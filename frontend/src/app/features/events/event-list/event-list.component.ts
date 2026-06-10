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
              <i class="fas fa-sliders-h me-2 text-primary"></i>Filters
            </h5>

            <!-- City filter with clear button -->
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="form-label small fw-semibold mb-0">
                  <i class="fas fa-city me-1 text-muted"></i>City
                </label>
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
              <label class="form-label small fw-semibold mb-1">
                <i class="fas fa-tag me-1 text-muted"></i>Category
              </label>
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
              <label class="form-label small fw-semibold mb-1">
                <i class="fas fa-calendar me-1 text-muted"></i>Date From
              </label>
              <input
                type="date"
                class="form-control form-control-sm"
                [(ngModel)]="pendingFilter.startDate"
              />
            </div>

            <div class="mb-3">
              <label class="form-label small fw-semibold mb-1">
                <i class="fas fa-calendar-alt me-1 text-muted"></i>Date To
              </label>
              <input
                type="date"
                class="form-control form-control-sm"
                [(ngModel)]="pendingFilter.endDate"
              />
            </div>

            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">
                  <i class="fas fa-rupee-sign me-1 text-muted"></i>Min Price
                </label>
                <input
                  type="number"
                  class="form-control form-control-sm"
                  placeholder="0"
                  [(ngModel)]="pendingFilter.minPrice"
                />
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">
                  <i class="fas fa-rupee-sign me-1 text-muted"></i>Max Price
                </label>
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
                <i class="fas fa-redo-alt me-1"></i>Reset Filters
              </button>
            </div>

          </div>
        </div>

        <!-- ── Event Grid ── -->
        <div class="col-lg-9">

          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="text-muted">
              <i class="fas fa-list me-1"></i>{{ result?.totalCount || 0 }} events found
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
                <div class="card-img-wrapper">
                  <img
                    [src]="event.imageUrl || 'https://placehold.co/400x200?text=No+Image'"
                    (error)="onImageError($event)"
                    class="card-img-top"
                    alt="{{ event.title }}"
                  />
                  <span class="category-badge">{{ event.category }}</span>
                </div>
                <div class="card-body d-flex flex-column">
                  
                  <!-- Price -->
                  <div class="price-tag">
                    <ng-container *ngIf="event.hasSeatMap && event.minPrice && event.maxPrice && event.minPrice !== event.maxPrice">
                      <span class="price-amount">From ₹{{ event.minPrice }}</span>
                      <span class="price-unit">/seat</span>
                    </ng-container>
                    <ng-container *ngIf="!event.hasSeatMap || !event.minPrice || event.minPrice === event.maxPrice">
                      <span class="price-amount">{{ event.ticketPrice === 0 ? 'FREE' : (event.ticketPrice | currency:'INR':'symbol':'1.2-2') }}</span>
                      <span class="price-unit">/ticket</span>
                    </ng-container>
                  </div>
                  
                  <!-- Title -->
                  <h6 class="event-title">{{ event.title }}</h6>
                  
                  <!-- Location with Google Maps Link -->
                  <p class="event-location">
                    <a [href]="event.googleMapsUrl || getGoogleMapsUrl(event)" 
                       target="_blank" 
                       class="text-decoration-none"
                       title="Open in Google Maps">
                      <i class="fas fa-map-marker-alt me-1"></i>
                      {{ event.venue }}, {{ event.city }}
                    </a>
                  </p>
                  
                  <!-- Date -->
                  <p class="event-date">
                    <i class="fas fa-calendar me-1"></i>
                    {{ event.startDateTime | date:'MMM d, y, h:mm a' }}
                  </p>
                  
                  <!-- Description -->
                  <p class="event-description">
                    {{ event.description | slice:0:80 }}...
                  </p>
                  
                  <!-- Footer -->
                  <div class="event-footer">
                    <div class="tickets-left">
                      <i class="fas fa-ticket-alt me-1"></i>
                      {{ event.availableTickets }} left
                    </div>
                    <a [routerLink]="['/events', event.id]"
                       class="btn-view">
                      View Details <i class="fas fa-arrow-right ms-1"></i>
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
                  <i class="fas fa-chevron-left"></i> Previous
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
                  Next <i class="fas fa-chevron-right"></i>
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 80px 0;
      margin-bottom: 40px;
      border-radius: 0 0 40px 40px;
    }
    .page-hero h1 {
      font-size: 3rem;
    }
    .page-hero .lead {
      font-size: 1.2rem;
      opacity: 0.9;
    }
    .filter-sidebar {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      position: sticky;
      top: 20px;
    }
    .event-card {
      border: none;
      border-radius: 16px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      overflow: hidden;
      background: white;
    }
    .event-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 30px rgba(0,0,0,0.15);
    }
    .card-img-wrapper {
      position: relative;
      overflow: hidden;
      height: 200px;
    }
    .card-img-top {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
    .event-card:hover .card-img-top {
      transform: scale(1.05);
    }
    .category-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .card-body {
      padding: 20px;
    }
    .price-tag {
      margin-bottom: 12px;
    }
    .price-amount {
      font-size: 1.3rem;
      font-weight: 800;
      color: #667eea;
    }
    .price-unit {
      font-size: 0.7rem;
      color: #a0aec0;
      margin-left: 2px;
    }
    .event-title {
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 8px;
      color: #2d3748;
      line-height: 1.4;
    }
    .event-location {
      font-size: 0.75rem;
      color: #718096;
      margin-bottom: 8px;
    }
    .event-location a {
      color: #718096;
      transition: color 0.2s;
    }
    .event-location a:hover {
      color: #667eea;
    }
    .event-date {
      font-size: 0.7rem;
      color: #a0aec0;
      margin-bottom: 12px;
    }
    .event-description {
      font-size: 0.75rem;
      color: #718096;
      line-height: 1.5;
      margin-bottom: 16px;
      flex-grow: 1;
    }
    .event-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }
    .tickets-left {
      font-size: 0.7rem;
      color: #48bb78;
      font-weight: 600;
    }
    .btn-view {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 25px;
      font-size: 0.7rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
    }
    .btn-view:hover {
      transform: translateX(3px);
      color: white;
      background: linear-gradient(135deg, #5a67d8, #6b46c1);
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border: none;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #5a67d8, #6b46c1);
      transform: translateY(-1px);
    }
    .btn-outline-secondary:hover {
      background: #e2e8f0;
      transform: translateY(-1px);
    }
    .badge.bg-primary {
      background: linear-gradient(135deg, #667eea, #764ba2) !important;
      padding: 6px 12px;
      border-radius: 30px;
    }
    .pagination .page-item.active .page-link {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-color: #667eea;
    }
    .pagination .page-link {
      color: #667eea;
      border-radius: 8px;
      margin: 0 3px;
    }
    .pagination .page-link:hover {
      background: #f0f0f0;
      color: #5a67d8;
    }
    .form-control:focus, .form-select:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 0.2rem rgba(102,126,234,0.25);
    }
    @media (max-width: 768px) {
      .page-hero {
        padding: 50px 0;
      }
      .page-hero h1 {
        font-size: 2rem;
      }
      .filter-sidebar {
        position: relative;
        top: 0;
      }
    }
  `]
})
export class EventListComponent implements OnInit {

  events: Event[] = [];
  result: PagedResult<Event> | null = null;
  loading = false;
  categories = EVENT_CATEGORIES;

  filter: EventFilter = { page: 1, pageSize: 9 };
  pendingFilter: EventFilter = { page: 1, pageSize: 9 };

  private searchSubject = new Subject<string>();

  constructor(
    private eventService: EventService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
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

    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => {
        this.filter.page = 1;
        this.loadEvents();
      });
  }

  getGoogleMapsUrl(event: any): string {
    if (event.googleMapsUrl) {
      return event.googleMapsUrl;
    }
    const query = encodeURIComponent(`${event.venue}, ${event.city}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

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

  resetFilters(): void {
    this.filter = { page: 1, pageSize: 9 };
    this.pendingFilter = { page: 1, pageSize: 9 };
    this.loadEvents();
    this.toastr.info('All filters cleared');
  }
  
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