import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-profile',
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-5">

          <div *ngIf="loading" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>

          <div *ngIf="!loading && profile" class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-5">

              <!-- Avatar Circle with first letter -->
              <div class="text-center mb-4">
                <div class="rounded-circle d-inline-flex align-items-center
                             justify-content-center mb-3"
                     style="width:80px; height:80px;
                            background: linear-gradient(135deg,#6c5ce7,#a29bfe);">
                  <span class="text-white fw-bold fs-2">
                    {{ profile.name.charAt(0).toUpperCase() }}
                  </span>
                </div>
                <h4 class="fw-bold mb-1">{{ profile.name }}</h4>
                <span class="badge rounded-pill px-3 py-2"
                      [ngClass]="{
                        'bg-primary': profile.role === 'User',
                        'bg-success': profile.role === 'Organizer',
                        'bg-danger':  profile.role === 'Admin'
                      }">
                  {{ profile.role }}
                </span>
              </div>

              <hr>

              <!-- Profile Details -->
              <div class="row g-3">

                <div class="col-12">
                  <div class="text-muted small mb-1">
                    <i class="fas fa-envelope me-2"></i>Email
                  </div>
                  <div class="fw-semibold">{{ profile.email }}</div>
                </div>

                <div class="col-12" *ngIf="profile.phone">
                  <div class="text-muted small mb-1">
                    <i class="fas fa-phone me-2"></i>Phone
                  </div>
                  <div class="fw-semibold">{{ profile.phone }}</div>
                </div>

                <div class="col-12">
                  <div class="text-muted small mb-1">
                    <i class="fas fa-calendar me-2"></i>Member Since
                  </div>
                  <div class="fw-semibold">
                    {{ profile.createdAt | date:'MMMM d, yyyy' }}
                  </div>
                </div>

              </div>

              <hr>

              <!-- Action Buttons -->
              <div class="d-grid gap-2">
                <a routerLink="/bookings" class="btn btn-outline-primary">
                  <i class="fas fa-ticket-alt me-2"></i>My Bookings
                </a>
                <button class="btn btn-outline-danger" (click)="logout()">
                  <i class="fas fa-sign-out-alt me-2"></i>Logout
                </button>
              </div>

            </div>
          </div>

          <!-- Error state -->
          <div *ngIf="!loading && !profile" class="text-center py-5">
            <i class="fas fa-exclamation-circle fa-3x text-muted mb-3"></i>
            <h5 class="text-muted">Could not load profile</h5>
            <a routerLink="/" class="btn btn-primary mt-2">Go Home</a>
          </div>

        </div>
      </div>
    </div>
  `
})
export class ProfileComponent implements OnInit {

  profile: any  = null;
  loading       = true;

  constructor(
    private authService: AuthService,
    private toastr:      ToastrService
  ) {}

  ngOnInit(): void {
    this.authService.getProfile().subscribe({
      next:  (p) => { this.profile = p; this.loading = false; },
      error: ()  => {
        this.toastr.error('Failed to load profile.');
        this.loading = false;
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}