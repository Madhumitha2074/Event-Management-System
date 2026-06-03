import { Component, OnInit } from '@angular/core';
import { EventService } from '../../../core/services/event.service';
import { Event, EventFilter, PagedResult, EVENT_CATEGORIES } from '../../../core/models/models';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-event-list',
  template: `
    <div class="page-hero">
      <div class="container text-center">
        <h1 class="display-5 fw-bold"><i class="fas fa-calendar-star me-3"></i>Discover Events</h1>
        <p class="lead">Find and book amazing local events near you</p>
        <div class="row justify-content-center mt-4">
          <div class="col-md-6">
            <div class="input-group input-group-lg shadow">
              <input class="form-control border-0" placeholder="Search events, cities..." [(ngModel)]="filter.search" (ngModelChange)="onSearch()">
              <button class="btn btn-light px-4"><i class="fas fa-search"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container pb-5">
      <div class="row">
        <!-- Filters -->
        <div class="col-lg-3 mb-4">
          <div class="filter-sidebar">
            <h5 class="fw-bold mb-3"><i class="fas fa-filter me-2"></i>Filters</h5>
            <div class="mb-3">
              <label class="form-label small fw-semibold">City</label>
              <input class="form-control form-control-sm" placeholder="Any city" [(ngModel)]="filter.city" (change)="loadEvents()">
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold">Category</label>
              <select class="form-select form-select-sm" [(ngModel)]="filter.category" (change)="loadEvents()">
                <option [ngValue]="undefined">All Categories</option>
                <option *ngFor="let cat of categories" [value]="cat.value">{{ cat.label }}</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold">Date From</label>
              <input type="date" class="form-control form-control-sm" [(ngModel)]="filter.startDate" (change)="loadEvents()">
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold">Date To</label>
              <input type="date" class="form-control form-control-sm" [(ngModel)]="filter.endDate" (change)="loadEvents()">
            </div>
            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label small fw-semibold">Min Price</label>
                <input type="number" class="form-control form-control-sm" placeholder="0" [(ngModel)]="filter.minPrice" (change)="loadEvents()">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold">Max Price</label>
                <input type="number" class="form-control form-control-sm" placeholder="Any" [(ngModel)]="filter.maxPrice" (change)="loadEvents()">
              </div>
            </div>
            <button class="btn btn-outline-secondary btn-sm w-100" (click)="resetFilters()">
              <i class="fas fa-times me-1"></i>Clear Filters
            </button>
          </div>
        </div>

        <!-- Event Grid -->
        <div class="col-lg-9">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="text-muted">{{ result?.totalCount || 0 }} events found</span>
          </div>

          <div *ngIf="loading" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>

          <div *ngIf="!loading && events.length === 0" class="text-center py-5">
            <i class="fas fa-calendar-times fa-4x text-muted mb-3"></i>
            <h5 class="text-muted">No events found</h5>
            <p class="text-muted">Try adjusting your filters</p>
          </div>

          <div class="row g-4" *ngIf="!loading">
            <div class="col-md-4" *ngFor="let event of events">
              <div class="card event-card h-100">
                <img [src]="event.imageUrl || 'https://via.placeholder.com/400x200?text=' + event.title"
                    (error)="onImageError($event)"
                    class="card-img-top"
                    alt="{{ event.title }}">
                <div class="card-body d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge-category">{{ event.category }}</span>
                      <span class="price">
                      {{ event.ticketPrice === 0 ? 'Free' : (event.ticketPrice | currency:'INR':'symbol':'1.2-2') }}
                      </span>         
                  </div>
                  <h6 class="fw-bold mb-1">{{ event.title }}</h6>
                  <p class="text-muted small mb-1"><i class="fas fa-map-marker-alt me-1"></i>{{ event.city }}</p>
                  <p class="text-muted small mb-2"><i class="fas fa-calendar me-1"></i>{{ event.startDateTime | date:'MMM d, y, h:mm a' }}</p>
                  <p class="text-muted small flex-grow-1">{{ event.description | slice:0:80 }}...</p>
                  <div class="d-flex justify-content-between align-items-center mt-auto">
                    <small class="text-muted">
                      <i class="fas fa-ticket-alt me-1"></i>{{ event.availableTickets }} left
                    </small>
                    <a [routerLink]="['/events', event.id]" class="btn btn-primary btn-sm px-3">
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
                <button class="page-link" (click)="changePage((filter.page || 1) - 1)">Previous</button>
              </li>
              <li class="page-item" *ngFor="let p of getPages()" [class.active]="p === filter.page">
                <button class="page-link" (click)="changePage(p)">{{ p }}</button>
              </li>
              <li class="page-item" [class.disabled]="filter.page === result.totalPages">
                <button class="page-link" (click)="changePage((filter.page || 1) + 1)">Next</button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  `
})
export class EventListComponent implements OnInit {
  events: Event[] = [];
  result: PagedResult<Event> | null = null;
  loading = false;
  categories = EVENT_CATEGORIES;
  filter: EventFilter = { page: 1, pageSize: 9 };
  private searchSubject = new Subject<string>();

  constructor(private eventService: EventService) {}

  ngOnInit(): void {
    this.loadEvents();
    this.searchSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(() => {
      this.filter.page = 1;
      this.loadEvents();
    });
  }

  onImageError(event: any): void {
  event.target.src =
    'https://via.placeholder.com/400x200?text=Event+Image';
  }

  loadEvents(): void {
    this.loading = true;
    this.eventService.getEvents(this.filter).subscribe({
      next: (res) => { this.result = res; this.events = res.items; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  onSearch(): void { this.searchSubject.next(this.filter.search || ''); }

  resetFilters(): void {
    this.filter = { page: 1, pageSize: 9 };
    this.loadEvents();
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
