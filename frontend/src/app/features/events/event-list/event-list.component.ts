import { Component, OnInit, OnDestroy } from '@angular/core';
import { EventService } from '../../../core/services/event.service';
import { AuthService } from '../../../core/services/auth.service';
import { Event, EventFilter, PagedResult, EVENT_CATEGORIES } from '../../../core/models/models';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-event-list',
  template: `
    <!-- ════════════════════════════════════════════════════════════ -->
    <!-- HERO SECTION WITH WAVE PATTERN                             -->
    <!-- ════════════════════════════════════════════════════════════ -->
    <div class="page-hero">
      <div class="deco-circle d1"></div>
      <div class="deco-circle d2"></div>
      <div class="deco-circle d3"></div>
      
      <div class="container text-center">
        <h1 class="display-5 fw-bold">
          <i class="fas fa-calendar-star me-3"></i>Discover Events
        </h1>
        <p class="lead">Find and book amazing local events near you</p>
        
        <div class="row justify-content-center mt-4 search-wrapper">
          <div class="col-md-8">
            <div class="input-group input-group-lg shadow-lg">
              <input
                class="form-control border-0"
                placeholder="🔍 Search events, cities..."
                [(ngModel)]="filter.search"
                (ngModelChange)="onSearch()"
              />
              <button class="btn btn-light px-4" (click)="onSearchSubmit()">
                <i class="fas fa-search"></i> Search
              </button>
            </div>
          </div>
        </div>
        
        <div class="popular-cities mt-4">
          <span class="text-white-50 me-2"><i class="fas fa-location-dot"></i> Popular:</span>
          <span class="city-chip" (click)="quickFilterCity('Chennai')">
            <i class="fas fa-city"></i> Chennai
          </span>
          <span class="city-chip" (click)="quickFilterCity('Coimbatore')">
            <i class="fas fa-city"></i> Coimbatore
          </span>
          <span class="city-chip" (click)="quickFilterCity('Madurai')">
            <i class="fas fa-city"></i> Madurai
          </span>
          <span class="city-chip" (click)="quickFilterCity('Trichy')">
            <i class="fas fa-city"></i> Trichy
          </span>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════ -->
    <!-- MAIN CONTENT                                               -->
    <!-- ════════════════════════════════════════════════════════════ -->
    <div class="container pb-5">
      <div class="row">

        <!-- ── Filters Sidebar ── -->
        <div class="col-lg-3 mb-4">
          <div class="filter-sidebar">
            
            <!-- Filter Header -->
            <div class="filter-header">
              <i class="fas fa-sliders-h me-2 text-primary"></i>
              <h5 class="fw-bold mb-0">Filters</h5>
              <button 
                *ngIf="hasActiveFilters()" 
                class="btn btn-link btn-sm text-muted p-0 ms-auto" 
                (click)="resetFilters()">
                <i class="fas fa-times"></i> Clear All
              </button>
            </div>

            <!-- ── City Filter ── -->
            <div class="filter-group">
              <label class="filter-label">
                <i class="fas fa-city me-1"></i>City
              </label>
              <div class="input-with-icon">
                <i class="fas fa-map-marker-alt input-icon"></i>
                <input
                  class="form-control form-control-sm filter-input"
                  placeholder="Any city"
                  [(ngModel)]="pendingFilter.city"
                />
                <button 
                  *ngIf="pendingFilter.city" 
                  class="btn btn-link btn-sm p-0 text-muted clear-btn" 
                  (click)="clearCityFilter()">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>

            <!-- ── Category Filter ── -->
            <div class="filter-group">
              <label class="filter-label">
                <i class="fas fa-tag me-1"></i>Category
              </label>
              <select
                class="form-select form-select-sm filter-select"
                [(ngModel)]="pendingFilter.category"
              >
                <option [ngValue]="undefined">All Categories</option>
                <option *ngFor="let cat of categories" [ngValue]="cat.value">
                  {{ cat.label }}
                </option>
              </select>
            </div>

            <!-- ── Date Range ── -->
            <div class="filter-group">
              <label class="filter-label">
                <i class="fas fa-calendar-alt me-1"></i>Date Range
              </label>
              <div class="row g-2">
                <div class="col-6">
                  <input
                    type="date"
                    class="form-control form-control-sm filter-input"
                    placeholder="From"
                    [(ngModel)]="pendingFilter.startDate"
                  />
                </div>
                <div class="col-6">
                  <input
                    type="date"
                    class="form-control form-control-sm filter-input"
                    placeholder="To"
                    [(ngModel)]="pendingFilter.endDate"
                  />
                </div>
              </div>
            </div>

            <!-- ── Price Range ── -->
            <div class="filter-group">
              <label class="filter-label">
                <i class="fas fa-rupee-sign me-1"></i>Price Range
              </label>
              <div class="row g-2">
                <div class="col-6">
                  <div class="input-with-icon">
                    <span class="input-prefix">₹</span>
                    <input
                      type="number"
                      class="form-control form-control-sm filter-input with-prefix"
                      placeholder="Min"
                      [(ngModel)]="pendingFilter.minPrice"
                    />
                  </div>
                </div>
                <div class="col-6">
                  <div class="input-with-icon">
                    <span class="input-prefix">₹</span>
                    <input
                      type="number"
                      class="form-control form-control-sm filter-input with-prefix"
                      placeholder="Max"
                      [(ngModel)]="pendingFilter.maxPrice"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- ── Toggle Filters ── -->
            <div class="filter-group toggle-group">
              <!-- Expired Events Toggle -->
              <div class="toggle-item">
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    [(ngModel)]="pendingFilter.includeExpired"
                    (change)="applyFilters()"
                  />
                  <span class="toggle-slider"></span>
                </label>
                <div class="toggle-label">
                  <span class="toggle-title">
                    <i class="fas fa-clock text-muted me-1"></i>
                    Show Expired Events
                  </span>
                  <span class="toggle-sub">View events that have ended</span>
                </div>
              </div>

              <!-- Live Events Toggle -->
              <div class="toggle-item">
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    [(ngModel)]="pendingFilter.showLive"
                    (change)="applyFilters()"
                  />
                  <span class="toggle-slider toggle-slider-live"></span>
                </label>
                <div class="toggle-label">
                  <span class="toggle-title">
                    <i class="fas fa-broadcast text-danger me-1"></i>
                    Show Live Events
                  </span>
                  <span class="toggle-sub">
                    <span class="live-dot"></span>
                    Events happening right now
                  </span>
                </div>
              </div>
            </div>

            <!-- ── Action Buttons ── -->
            <div class="filter-actions">
              <button
                class="btn btn-primary btn-sm w-100 apply-btn"
                (click)="applyFilters()">
                <i class="fas fa-search me-2"></i>Apply Filters
              </button>
              <button
                class="btn btn-outline-secondary btn-sm w-100 reset-btn"
                (click)="resetFilters()">
                <i class="fas fa-redo-alt me-2"></i>Reset Filters
              </button>
            </div>

            <!-- ── Active Filters Display ── -->
            <div *ngIf="hasActiveFilters()" class="active-filters">
              <span class="active-filters-label">Active Filters:</span>
              <div class="active-filter-tags">
                <span *ngIf="filter.search" class="filter-tag" (click)="clearSearch()">
                  <i class="fas fa-search me-1"></i>{{ filter.search }}
                  <i class="fas fa-times ms-1"></i>
                </span>
                <span *ngIf="filter.city" class="filter-tag" (click)="clearCityFilter()">
                  <i class="fas fa-city me-1"></i>{{ filter.city }}
                  <i class="fas fa-times ms-1"></i>
                </span>
                <span *ngIf="filter.category !== undefined" class="filter-tag" (click)="clearCategoryFilter()">
                  <i class="fas fa-tag me-1"></i>{{ getCategoryLabel(filter.category) }}
                  <i class="fas fa-times ms-1"></i>
                </span>
                <span *ngIf="filter.includeExpired" class="filter-tag expired-tag" (click)="toggleExpiredFilter()">
                  <i class="fas fa-clock me-1"></i>Expired
                  <i class="fas fa-times ms-1"></i>
                </span>
                <span *ngIf="filter.showLive" class="filter-tag live-tag" (click)="toggleLiveFilter()">
                  <i class="fas fa-broadcast me-1"></i>Live
                  <i class="fas fa-times ms-1"></i>
                </span>
              </div>
            </div>

          </div>
        </div>

        <!-- ── Event Grid ── -->
        <div class="col-lg-9">

          <!-- ✅ Simple event count -->
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="results-count">
              <i class="fas fa-list me-1"></i>
              {{ events.length }} event{{ events.length !== 1 ? 's' : '' }}
              <span *ngIf="filter.search" class="text-muted ms-2">
                (search: "{{ filter.search }}")
              </span>
              <span *ngIf="filter.includeExpired" class="text-warning ms-2">
                (including expired)
              </span>
            </span>
            <div *ngIf="filter.city" class="badge bg-primary">
              <i class="fas fa-map-marker-alt me-1"></i>
              {{ filter.city }}
              <button class="btn-close-white ms-2" style="font-size: 0.6rem;" (click)="clearCityFilter()">✕</button>
            </div>
          </div>

          <!-- ✅ Clean status bar - only timestamp -->
          <div *ngIf="lastUpdated" class="text-muted small mb-3">
            <i class="fas fa-sync-alt me-1" [class.spin]="loading"></i>
            Last updated: {{ lastUpdated | date:'h:mm:ss a' }}
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
              <!-- ✅ Event Card - shows expired status properly -->
              <div class="card event-card h-100" [class.expired]="!event.isActive">
                <div class="card-img-wrapper">
                  <img
                    [src]="event.imageUrl || 'https://placehold.co/400x200?text=No+Image'"
                    (error)="onImageError($event)"
                    class="card-img-top"
                    alt="{{ event.title }}"
                  />
                  <span class="category-badge">{{ event.category }}</span>
                  <div class="tickets-badge">
                    <i class="fas fa-ticket-alt"></i>
                    {{ event.availableTickets }}
                  </div>
                  
                  <!-- ✅ LIVE badge for ongoing events -->
                  <div *ngIf="event.isActive && isEventLive(event)" class="status-overlay live">
                    <i class="fas fa-broadcast"></i> LIVE
                  </div>
                  
                  <!-- ✅ EXPIRED overlay for expired events -->
                  <div *ngIf="!event.isActive" class="status-overlay expired">
                    <i class="fas fa-clock"></i> ENDED
                  </div>
                </div>
                <div class="card-body d-flex flex-column">
                  
                  <!-- Price -->
                  <div class="price-tag">
                    <ng-container *ngIf="event.hasSeatMap && event.minPrice && event.maxPrice && event.minPrice !== event.maxPrice">
                      <span class="price-from">From</span>
                      <span class="price-amount">₹{{ event.minPrice }}</span>
                      <span class="price-unit">/seat</span>
                    </ng-container>
                    
                    <ng-container *ngIf="event.hasSeatMap && event.minPrice && event.minPrice === event.maxPrice">
                      <span class="price-amount">₹{{ event.minPrice }}</span>
                      <span class="price-unit">/seat</span>
                    </ng-container>
                    
                    <ng-container *ngIf="!event.hasSeatMap">
                      <span class="price-amount" [class.free]="event.ticketPrice === 0">
                        {{ event.ticketPrice === 0 ? 'FREE' : ('₹' + event.ticketPrice) }}
                      </span>
                      <span class="price-unit" *ngIf="event.ticketPrice !== 0">/ticket</span>
                    </ng-container>
                  </div>
                  
                  <!-- Title -->
                  <h6 class="event-title">{{ event.title }}</h6>
                  
                  <!-- Location -->
                  <p class="event-location">
                    <i class="fas fa-map-marker-alt me-1"></i>
                    {{ event.venue }}, {{ event.city }}
                  </p>
                  
                  <!-- ✅ Date only - NO time remaining -->
                  <p class="event-date">
                    <i class="far fa-calendar-alt me-1"></i>
                    <strong>{{ event.startDateTime | date:'EEE, MMM d, y' }}</strong>
                    <span class="date-separator">•</span>
                    <strong>{{ event.startDateTime | date:'h:mm a' }}</strong>
                    <span *ngIf="!event.isActive" class="badge-end-date">
                      (Ended)
                    </span>
                  </p>
                  
                  <!-- Description -->
                  <p class="event-description">
                    {{ event.description | slice:0:70 }}...
                  </p>
                  
                  <!-- Footer -->
                  <div class="event-footer">
                    <div class="tickets-left">
                      <span class="dot" [class.sold-out]="event.availableTickets === 0" [class.expired-dot]="!event.isActive"></span>
                      <span *ngIf="event.isActive">
                        {{ event.availableTickets === 0 ? 'Sold Out' : (event.availableTickets + ' left') }}
                      </span>
                      <span *ngIf="!event.isActive" class="text-muted">
                        Event Ended
                      </span>
                    </div>
                    <!-- ✅ Disabled "Book Now" for expired events -->
                    <a 
                      [routerLink]="event.isActive ? ['/events', event.id] : '#'" 
                      class="btn-book-now" 
                      [class.disabled]="!event.isActive"
                      (click)="!event.isActive && $event.preventDefault()">
                      <i class="fas fa-ticket-alt me-1"></i> 
                      {{ event.isActive ? 'Book Now' : 'Ended' }}
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
                  [class.disabled]="result && filter.page === result.totalPages">
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
      background: linear-gradient(135deg, #6C5CE7 0%, #A29BFE 50%, #FDCB6E 100%);
      color: white;
      padding: 80px 0 120px 0;
      margin-bottom: 40px;
      position: relative;
      overflow: hidden;
    }
    .page-hero::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 80px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z' fill='%23ffffff' opacity='0.3'/%3E%3C/svg%3E");
      background-size: cover;
      background-position: bottom;
    }
    .page-hero::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 600px;
      height: 600px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 50%;
      animation: float-bubble 8s ease-in-out infinite;
    }
    @keyframes float-bubble {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-30px, -20px) scale(1.1); }
    }
    .page-hero h1 {
      font-size: 3.5rem;
      font-weight: 800;
      text-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
      animation: fade-up 0.8s ease-out;
    }
    .page-hero .lead {
      font-size: 1.3rem;
      opacity: 0.95;
      text-shadow: 0 1px 10px rgba(0, 0, 0, 0.1);
      animation: fade-up 1s ease-out;
    }
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .search-wrapper { animation: fade-up 1.2s ease-out; }
    .search-wrapper .input-group {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 50px !important;
      padding: 4px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .search-wrapper .form-control {
      background: transparent;
      border: none;
      padding: 16px 24px;
      font-size: 1rem;
      color: white;
    }
    .search-wrapper .form-control::placeholder { color: rgba(255, 255, 255, 0.7); }
    .search-wrapper .form-control:focus { box-shadow: none; background: transparent; }
    .search-wrapper .btn-light {
      border-radius: 50px !important;
      padding: 12px 28px;
      background: white;
      color: #6C5CE7;
      font-weight: 600;
      transition: all 0.3s ease;
      border: none;
    }
    .search-wrapper .btn-light:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    .popular-cities { animation: fade-up 1.4s ease-out; }
    .popular-cities .city-chip {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      padding: 6px 18px;
      border-radius: 50px;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    .popular-cities .city-chip:hover {
      background: white;
      color: #6C5CE7;
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }
    .popular-cities .city-chip i { margin-right: 6px; }
    .deco-circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      pointer-events: none;
    }
    .deco-circle.d1 { width: 200px; height: 200px; bottom: -50px; left: -50px; }
    .deco-circle.d2 { width: 150px; height: 150px; top: -30px; right: 20%; }
    .deco-circle.d3 { width: 100px; height: 100px; bottom: 20%; right: 10%; }

    /* ════════════════════════════════════════════════════════════════
       FILTER SIDEBAR - MODERN REDESIGN
       ════════════════════════════════════════════════════════════════ */
    .filter-sidebar {
      background: #ffffff;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      position: sticky;
      top: 20px;
      border: 1px solid rgba(0, 0, 0, 0.04);
      transition: all 0.3s ease;
    }

    .filter-sidebar:hover {
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
    }

    .filter-header {
      display: flex;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 2px solid #f0f2f5;
      margin-bottom: 20px;
    }

    .filter-header h5 {
      font-weight: 700;
      color: #1a1a2e;
      font-size: 1rem;
    }

    .filter-header .btn-link {
      font-size: 0.75rem;
      text-decoration: none;
      color: #6c757d;
      font-weight: 500;
    }

    .filter-header .btn-link:hover {
      color: #dc3545;
    }

    /* ── Filter Groups ── */
    .filter-group {
      margin-bottom: 18px;
    }

    .filter-group:last-of-type {
      margin-bottom: 20px;
    }

    .filter-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #4a5568;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .filter-label i {
      color: #6c5ce7;
      width: 16px;
    }

    /* ── Input Styles ── */
    .filter-input {
      border-radius: 10px;
      border: 1.5px solid #e2e8f0;
      padding: 8px 12px;
      font-size: 0.85rem;
      transition: all 0.3s ease;
      background: #f8fafc;
    }

    .filter-input:focus {
      border-color: #6c5ce7;
      box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.12);
      background: #ffffff;
    }

    .filter-input::placeholder {
      color: #a0aec0;
      font-size: 0.8rem;
    }

    .filter-select {
      border-radius: 10px;
      border: 1.5px solid #e2e8f0;
      padding: 8px 12px;
      font-size: 0.85rem;
      background: #f8fafc;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .filter-select:focus {
      border-color: #6c5ce7;
      box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.12);
      background: #ffffff;
    }

    /* ── Input with Icon ── */
    .input-with-icon {
      position: relative;
    }

    .input-with-icon .input-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #a0aec0;
      font-size: 0.8rem;
    }

    .input-with-icon .filter-input {
      padding-left: 34px;
    }

    .input-with-icon .clear-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.7rem;
      color: #a0aec0;
    }

    .input-with-icon .clear-btn:hover {
      color: #dc3545;
    }

    /* ── Price Input with Prefix ── */
    .input-prefix {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #4a5568;
      font-weight: 600;
      font-size: 0.85rem;
      z-index: 2;
    }

    .filter-input.with-prefix {
      padding-left: 28px;
    }

    /* ── Toggle Switches ── */
    .toggle-group {
      background: #f8fafc;
      border-radius: 12px;
      padding: 14px 16px;
      border: 1px solid #e2e8f0;
    }

    .toggle-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
    }

    .toggle-item:not(:last-child) {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #cbd5e0;
      transition: 0.4s;
      border-radius: 24px;
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      transition: 0.4s;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }

    .toggle-switch input:checked + .toggle-slider {
      background: #6c5ce7;
    }

    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(20px);
    }

    .toggle-slider-live {
      background: #cbd5e0;
    }

    .toggle-switch input:checked + .toggle-slider-live {
      background: #dc3545;
    }

    .toggle-label {
      flex: 1;
      min-width: 0;
    }

    .toggle-title {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: #2d3748;
    }

    .toggle-title i {
      font-size: 0.8rem;
    }

    .toggle-sub {
      display: block;
      font-size: 0.7rem;
      color: #a0aec0;
      margin-top: 1px;
    }

    .live-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      background: #dc3545;
      border-radius: 50%;
      margin-right: 4px;
      animation: pulse-dot-live 1.2s ease-in-out infinite;
    }

    @keyframes pulse-dot-live {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }

    /* ── Action Buttons ── */
    .filter-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }

    .apply-btn {
      background: linear-gradient(135deg, #6c5ce7, #8b74f0);
      border: none;
      padding: 10px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.85rem;
      transition: all 0.3s ease;
    }

    .apply-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(108, 92, 231, 0.35);
    }

    .reset-btn {
      border-radius: 12px;
      padding: 10px;
      font-weight: 500;
      font-size: 0.85rem;
      border-color: #e2e8f0;
      color: #4a5568;
      transition: all 0.3s ease;
    }

    .reset-btn:hover {
      background: #f8f9fa;
      border-color: #cbd5e0;
    }

    /* ── Active Filters Tags ── */
    .active-filters {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
    }

    .active-filters-label {
      display: block;
      font-size: 0.7rem;
      font-weight: 600;
      color: #a0aec0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .active-filter-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .filter-tag {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 500;
      background: #f0f2f5;
      color: #4a5568;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .filter-tag:hover {
      background: #e2e8f0;
      color: #dc3545;
    }

    .filter-tag i {
      font-size: 0.6rem;
    }

    .filter-tag.expired-tag {
      background: #fed7d7;
      color: #9b2c2c;
    }

    .filter-tag.expired-tag:hover {
      background: #feb2b2;
    }

    .filter-tag.live-tag {
      background: #feb2b2;
      color: #9b2c2c;
      animation: pulse-tag 1.5s ease-in-out infinite;
    }

    @keyframes pulse-tag {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    /* ════════════════════════════════════════════════════════════════
       EVENT CARDS
       ════════════════════════════════════════════════════════════════ */
    .event-card {
      border: none;
      border-radius: 16px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      overflow: hidden;
      background: white;
    }

    .event-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
    
    /* ✅ Expired card styles */
    .event-card.expired {
      opacity: 0.7;
      filter: grayscale(0.2);
      border: 1px solid #e5e7eb;
    }
    .event-card.expired:hover { transform: translateY(-4px); }
    
    .card-img-wrapper { position: relative; overflow: hidden; height: 200px; }
    .card-img-top { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
    .event-card:hover .card-img-top { transform: scale(1.05); }
    
    .category-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    .tickets-badge {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 0.7rem;
      font-weight: 600;
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .status-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 8px 24px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      backdrop-filter: blur(4px);
      z-index: 5;
      pointer-events: none;
    }
    
    .status-overlay.live {
      background: rgba(220, 53, 69, 0.9);
      color: white;
      animation: pulse-live 1.5s ease-in-out infinite;
    }
    
    @keyframes pulse-live {
      0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.05); }
    }
    
    .status-overlay.expired {
      background: rgba(108, 117, 125, 0.9);
      color: white;
    }
    
    .card-body { padding: 20px; }
    .price-tag { margin-bottom: 10px; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px; }
    .price-from { font-size: 0.8rem; font-weight: 500; color: #a0aec0; margin-right: 2px; }
    .price-amount { font-size: 1.5rem; font-weight: 800; color: #667eea; }
    .price-unit { font-size: 0.75rem; color: #a0aec0; font-weight: 500; }
    .price-amount.free { color: #48bb78; }
    .event-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 8px; color: #2d3748; line-height: 1.3; }
    .event-location { font-size: 0.8rem; color: #718096; margin-bottom: 6px; }
    .event-location i { color: #667eea; width: 16px; }
    .event-date { font-size: 0.85rem; color: #444; margin-bottom: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .event-date i { color: #667eea; width: 16px; }
    .event-date strong { color: #667eea; font-weight: 700; }
    .event-date .date-separator { color: #ccc; font-weight: 300; margin: 0 2px; }
    .event-date .badge-end-date { 
      font-size: 0.7rem; 
      color: #dc3545; 
      font-weight: 600;
      background: #f8d7da;
      padding: 2px 10px;
      border-radius: 20px;
      margin-left: 4px;
    }
    .event-description { font-size: 0.8rem; color: #a0aec0; line-height: 1.5; margin-bottom: 14px; flex-grow: 1; }
    
    .event-footer { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding-top: 12px; 
      border-top: 1px solid #e2e8f0; 
    }
    
    .tickets-left { 
      font-size: 0.75rem; 
      color: #48bb78; 
      font-weight: 600; 
      display: flex; 
      align-items: center; 
      gap: 6px; 
    }
    
    .tickets-left .dot { 
      display: inline-block; 
      width: 8px; 
      height: 8px; 
      border-radius: 50%; 
      background: #48bb78; 
      animation: pulse-dot 2s infinite; 
    }
    
    .tickets-left .dot.sold-out { 
      background: #e74c3c; 
      animation: none; 
    }
    
    .tickets-left .dot.expired-dot {
      background: #adb5bd;
      animation: none;
    }
    
    @keyframes pulse-dot { 
      0%, 100% { opacity: 1; } 
      50% { opacity: 0.4; } 
    }
    
    .btn-book-now {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 25px;
      font-size: 0.75rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .btn-book-now:hover:not(.disabled) { 
      transform: translateX(4px) scale(1.05); 
      color: white; 
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); 
    }
    .btn-book-now.disabled { 
      background: #adb5bd; 
      cursor: not-allowed; 
      opacity: 0.7; 
    }
    .btn-book-now.disabled:hover { 
      transform: none; 
      box-shadow: none; 
    }
    
    .results-count { font-size: 0.9rem; color: #2d3748; }
    .results-count strong { color: #2d3748; }
    .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); border: none; }
    .btn-primary:hover { background: linear-gradient(135deg, #5a67d8, #6b46c1); transform: translateY(-1px); }
    .btn-outline-secondary:hover { background: #e2e8f0; transform: translateY(-1px); }
    .badge.bg-primary { background: linear-gradient(135deg, #667eea, #764ba2) !important; padding: 6px 12px; border-radius: 30px; }
    .pagination .page-item.active .page-link { background: linear-gradient(135deg, #667eea, #764ba2); border-color: #667eea; }
    .pagination .page-link { color: #667eea; border-radius: 8px; margin: 0 3px; }
    .pagination .page-link:hover { background: #f0f0f0; color: #5a67d8; }
    .form-control:focus, .form-select:focus { border-color: #667eea; box-shadow: 0 0 0 0.2rem rgba(102,126,234,0.25); }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    
    @media (max-width: 768px) {
      .page-hero { padding: 50px 0 80px 0; }
      .page-hero h1 { font-size: 2.2rem; }
      .page-hero .lead { font-size: 1rem; }
      .search-wrapper .form-control { font-size: 0.9rem; padding: 12px 16px; }
      .search-wrapper .btn-light { padding: 10px 18px; font-size: 0.9rem; }
      .popular-cities .city-chip { font-size: 0.75rem; padding: 4px 12px; }
      .page-hero::after { height: 40px; }
      .filter-sidebar { position: relative; top: 0; }
      .btn-book-now { padding: 6px 14px; font-size: 0.7rem; }
      .price-amount { font-size: 1.2rem; }
    }
    @media (max-width: 576px) {
      .page-hero h1 { font-size: 1.8rem; }
      .popular-cities { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
      .event-card .card-body { padding: 16px; }
      .event-title { font-size: 0.95rem; }
      .event-date { font-size: 0.75rem; gap: 4px; }
    }
  `]
})
export class EventListComponent implements OnInit, OnDestroy {

  // ─────────────────────────────────────────────
  // PROPERTIES
  // ─────────────────────────────────────────────

  events: Event[] = [];
  result: PagedResult<Event> | null = null;
  loading = false;
  isCleaningUp = false;
  lastUpdated: Date | null = null;
  expiredCount = 0;
  
  categories = EVENT_CATEGORIES;
  filter: EventFilter = { page: 1, pageSize: 9, showLive: false };
  pendingFilter: EventFilter = { page: 1, pageSize: 9, showLive: false };

  // ✅ Only keep searchSubject - removed expiry and auto-refresh subscriptions
  private searchSubject = new Subject<string>();

  // Admin check
  get isAdmin(): boolean {
    return this.authService.getRole() === 'Admin';
  }

  constructor(
    private eventService: EventService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  // ─────────────────────────────────────────────
  // LIFECYCLE HOOKS
  // ─────────────────────────────────────────────

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

    // ✅ NO auto-refresh - removed startExpiryWatcher() and startAutoRefresh()
  }

  ngOnDestroy(): void {
    // ✅ Only cleanup search subject
    this.searchSubject.complete();
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  /**
   * Check if event is currently live (ongoing)
   */
  isEventLive(event: Event): boolean {
    if (!event || !event.isActive) return false;
    const now = new Date();
    const start = new Date(event.startDateTime);
    const end = new Date(event.endDateTime);
    return start <= now && end >= now;
  }

  /**
   * Check if any filters are active
   */
  hasActiveFilters(): boolean {
    return !!(this.filter.search ||
              this.filter.city || 
              this.filter.category !== undefined || 
              this.filter.minPrice || 
              this.filter.maxPrice ||
              this.filter.includeExpired ||
              this.filter.showLive);
  }

  /**
   * Get category label by value
   */
  getCategoryLabel(value: number): string {
    const category = this.categories.find(c => c.value === value);
    return category ? category.label : '';
  }

  /**
   * Clear search filter
   */
  clearSearch(): void {
    this.filter.search = '';
    this.loadEvents();
    this.toastr.info('Search cleared');
  }

  /**
   * Clear category filter
   */
  clearCategoryFilter(): void {
    this.pendingFilter.category = undefined;
    this.filter.category = undefined;
    this.applyFilters();
  }

  /**
   * Toggle expired filter
   */
  toggleExpiredFilter(): void {
    this.pendingFilter.includeExpired = !this.pendingFilter.includeExpired;
    this.applyFilters();
  }

  /**
   * Toggle live filter
   */
  toggleLiveFilter(): void {
    this.pendingFilter.showLive = !this.pendingFilter.showLive;
    this.applyFilters();
  }

  /**
   * Handle search submit
   */
  onSearchSubmit(): void {
    this.filter.page = 1;
    this.loadEvents();
  }

  // ─────────────────────────────────────────────
  // EVENT LOADING
  // ─────────────────────────────────────────────

  loadEvents(): void {
    this.loading = true;
    
    const filterToUse: EventFilter = {
      page: this.filter.page,
      pageSize: this.filter.pageSize,
      search: this.filter.search || '',
      city: this.filter.city,
      category: this.filter.category,
      startDate: this.filter.startDate,
      endDate: this.filter.endDate,
      minPrice: this.filter.minPrice,
      maxPrice: this.filter.maxPrice,
      includeExpired: this.filter.includeExpired || false,
      showLive: this.filter.showLive || false
    };

    this.eventService.getEvents(filterToUse).subscribe({
      next: (res) => {
        const now = new Date();
        let allEvents = res.items || [];
        
        if (!this.filter.includeExpired) {
          allEvents = allEvents.filter(e => {
            const endDate = new Date(e.endDateTime);
            return endDate > now && e.isActive !== false;
          });
        }
        
        if (this.filter.showLive) {
          allEvents = allEvents.filter(e => {
            const start = new Date(e.startDateTime);
            const end = new Date(e.endDateTime);
            return start <= now && end >= now;
          });
        }
        
        this.events = allEvents;
        
        this.expiredCount = res.items?.filter(e => {
          const endDate = new Date(e.endDateTime);
          return endDate <= now || e.isActive === false;
        }).length || 0;
        
        this.result = res;
        this.lastUpdated = new Date();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.toastr.error('Failed to load events', 'Error');
        console.error('Error loading events:', error);
      }
    });
  }

  // ─────────────────────────────────────────────
  // FILTERS
  // ─────────────────────────────────────────────

  quickFilterCity(city: string): void {
    this.filter.city = city;
    this.pendingFilter.city = city;
    this.filter.page = 1;
    this.loadEvents();
    this.toastr.info(`🎯 Showing events in ${city}`);
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
      includeExpired: this.pendingFilter.includeExpired || false,
      showLive: this.pendingFilter.showLive || false,
      page: 1,
      pageSize: 9
    };

    this.loadEvents();
    
    if (this.filter.city) {
      this.toastr.info(`Showing events in ${this.filter.city}`);
    }
  }

  resetFilters(): void {
    this.filter = { page: 1, pageSize: 9, showLive: false };
    this.pendingFilter = { page: 1, pageSize: 9, showLive: false };
    this.loadEvents();
    this.toastr.info('All filters cleared');
  }
  
  clearCityFilter(): void {
    this.filter.city = undefined;
    this.pendingFilter.city = undefined;
    this.loadEvents();
    this.toastr.info('Showing events from all cities');
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

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

  getTimeRemaining(event: Event): string {
    if (!event) return 'N/A';
    if (event.timeRemaining) return event.timeRemaining;
    
    const end = new Date(event.endDateTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Ended';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${minutes % 60}m remaining`;
    if (minutes > 0) return `${minutes}m ${Math.floor((diff % 60000) / 1000)}s remaining`;
    return `${Math.floor(diff / 1000)}s remaining`;
  }

  isEventEndingSoon(event: Event): boolean {
    if (!event || !event.isActive) return false;
    if (event.isEndingSoon !== undefined) return event.isEndingSoon;
    
    const end = new Date(event.endDateTime);
    const now = new Date();
    const diffMinutes = (end.getTime() - now.getTime()) / 60000;
    return diffMinutes > 0 && diffMinutes <= 15;
  }

  /**
   * ✅ Check if event can be edited
   */
  canEditEvent(event: Event): boolean {
    // Can't edit if status is Completed or Cancelled
    if (event.status === 'Completed' || event.status === 'Cancelled') {
      return false;
    }
    
    // Can't edit if event has already started
    const startDate = new Date(event.startDateTime);
    const now = new Date();
    if (startDate <= now) {
      return false;
    }
    
    return true;
  }

  /**
   * ✅ Get tooltip message for disabled edit button
   */
  getEditDisabledReason(event: Event): string {
    if (event.status === 'Completed') {
      return 'This event is completed and cannot be edited.';
    }
    if (event.status === 'Cancelled') {
      return 'This event is cancelled and cannot be edited.';
    }
    const startDate = new Date(event.startDateTime);
    const now = new Date();
    if (startDate <= now) {
      return 'This event has already started and cannot be edited.';
    }
    return '';
  }

  /**
   * ✅ Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Published':
        return 'bg-success';
      case 'Draft':
        return 'bg-secondary';
      case 'Completed':
        return 'bg-dark';
      case 'Cancelled':
        return 'bg-danger';
      default:
        return 'bg-info';
    }
  }

  cleanupExpiredEvents(): void {
    if (!this.isAdmin) {
      this.toastr.warning('Admin access required', 'Permission Denied');
      return;
    }

    this.isCleaningUp = true;
    this.eventService.cleanupExpiredEvents().subscribe({
      next: (response) => {
        this.isCleaningUp = false;
        this.loadEvents();
        this.toastr.success(
          `${response.updatedCount} expired events cleaned up`,
          'Cleanup Complete'
        );
      },
      error: (error) => {
        this.isCleaningUp = false;
        this.toastr.error('Failed to cleanup expired events', 'Error');
        console.error('Cleanup error:', error);
      }
    });
  }

  refreshEvents(): void {
    this.loadEvents();
    this.toastr.info('Refreshing events...', 'Refresh');
  }
}