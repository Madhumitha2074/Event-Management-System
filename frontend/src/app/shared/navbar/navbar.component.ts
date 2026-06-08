import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AuthResponse } from '../../core/models/models';

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

            <li class="nav-item" *ngIf="isLoggedIn">
              <a class="nav-link" routerLink="/bookings">My Bookings</a>
            </li>

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
                    <!-- ✅ Fixed: /auth/profile not /profile -->
                    <a class="dropdown-item" routerLink="/auth/profile">
                      <i class="fas fa-user me-2"></i>My Profile
                    </a>
                  </li>

                  <li>
                    <a class="dropdown-item" routerLink="/bookings">
                      <i class="fas fa-ticket-alt me-2"></i>My Bookings
                    </a>
                  </li>

                  <li><hr class="dropdown-divider"></li>

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
  isLoggedIn  = false;
  isOrganizer = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn  = !!user;
      this.isOrganizer = user?.role === 'Organizer' || user?.role === 'Admin';
    });
  }

  logout(): void {
    this.authService.logout();
  }
}