import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AuthResponse } from '../../core/models/models';
import { LocationPopupService } from '../../core/services/location-popup.service';
import { ConfirmationService } from '../../core/services/confirmation.service';

@Component({
  selector: 'app-navbar',
  template: `
    <nav class="navbar navbar-expand-lg navbar-dark" style="background: #6c5ce7;">
      <div class="container">
        <a class="navbar-brand" routerLink="/">
          <i class="fas fa-ticket-alt me-2"></i>EventBook
        </a>

        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navMenu">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navMenu">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <a class="nav-link"
                 routerLink="/"
                 routerLinkActive="active"
                 [routerLinkActiveOptions]="{ exact: true }">
                Events
              </a>
            </li>

            <!-- Only show My Bookings for regular Users (not Organizer or Admin) -->
            <li class="nav-item" *ngIf="isLoggedIn && isRegularUser">
              <a class="nav-link" routerLink="/bookings">My Bookings</a>
            </li>

            <!-- Show Dashboard for Organizer and Admin -->
            <li class="nav-item" *ngIf="isOrganizer">
              <a class="nav-link" routerLink="/organizer">Dashboard</a>
            </li>
          </ul>

          <ul class="navbar-nav ms-auto">

            <!-- Not logged in -->
            <ng-container *ngIf="!isLoggedIn">
              <li class="nav-item">
                <a class="nav-link" routerLink="/auth/login">Login</a>
              </li>
              <li class="nav-item">
                <a class="btn btn-light btn-sm ms-2" routerLink="/auth/register">
                  Register
                </a>
              </li>
            </ng-container>

            <!-- Logged in -->
            <ng-container *ngIf="isLoggedIn">
              <!-- City Selector Button -->
              <li class="nav-item me-2">
                <button class="btn btn-outline-light btn-sm" (click)="openLocationPopup()">
                  <i class="fas fa-map-marker-alt me-1"></i>
                  {{ selectedCity || 'Select City' }}
                  <i class="fas fa-chevron-down ms-1"></i>
                </button>
              </li>

              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle"
                   href="#"
                   id="userMenu"
                   role="button"
                   data-bs-toggle="dropdown">
                  <i class="fas fa-user-circle me-1"></i>
                  {{ currentUser?.name }}
                </a>

                <ul class="dropdown-menu dropdown-menu-end">

                  <li>
                    <a class="dropdown-item" routerLink="/auth/profile">
                      <i class="fas fa-user me-2"></i>My Profile
                    </a>
                  </li>

                  <!-- Only show My Bookings in dropdown for regular Users -->
                  <li *ngIf="isRegularUser">
                    <a class="dropdown-item" routerLink="/bookings">
                      <i class="fas fa-ticket-alt me-2"></i>My Bookings
                    </a>
                  </li>

                  <!-- Show Dashboard in dropdown for Organizer/Admin -->
                  <li *ngIf="isOrganizer">
                    <a class="dropdown-item" routerLink="/organizer">
                      <i class="fas fa-tachometer-alt me-2"></i>Dashboard
                    </a>
                  </li>

                  <li><hr class="dropdown-divider"></li>

                  <!-- Change City option in dropdown -->
                  <li>
                    <a class="dropdown-item" (click)="openLocationPopup()">
                      <i class="fas fa-map-marker-alt me-2"></i>Change City
                    </a>
                  </li>

                  <li><hr class="dropdown-divider"></li>

                  <!-- ✅ UPDATED: Logout with confirmation -->
                  <li>
                    <a class="dropdown-item text-danger" (click)="logout()">
                      <i class="fas fa-sign-out-alt me-2"></i>Logout
                    </a>
                  </li>

                </ul>
              </li>
            </ng-container>

          </ul>
        </div>
      </div>
    </nav>
  `
})
export class NavbarComponent implements OnInit {
  currentUser: AuthResponse | null = null;
  isLoggedIn = false;
  isOrganizer = false;
  isRegularUser = false;
  selectedCity: string | null = null;

  constructor(
    private authService: AuthService,
    private locationPopupService: LocationPopupService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
      this.isOrganizer = user?.role === 'Organizer' || user?.role === 'Admin';
      this.isRegularUser = user?.role === 'User';
      console.log('🔐 Navbar: User role updated:', user?.role);
    });

    // Subscribe to selected city changes
    this.authService.selectedCity$.subscribe(city => {
      this.selectedCity = city;
      console.log('📍 Navbar: City updated:', city);
    });
  }

  /**
   * Open location popup for city selection
   */
  openLocationPopup(): void {
    this.locationPopupService.show();
  }

  /**
   * Change city (alias for openLocationPopup)
   */
  changeCity(): void {
    this.openLocationPopup();
  }

  /**
   * ✅ UPDATED: Logout with custom confirmation dialog
   * Uses the enhanced logoutWithConfirmation method from AuthService
   */
  logout(): void {
    console.log('🔄 Navbar: Logout initiated');
    
    this.authService.logoutWithConfirmation(this.confirmationService).subscribe({
      next: (result) => {
        if (result === true) {
          console.log('✅ Navbar: User logged out successfully');
        } else {
          console.log('❌ Navbar: User cancelled logout');
        }
      },
      error: (err) => {
        console.error('❌ Navbar: Logout error:', err);
      }
    });
  }
}