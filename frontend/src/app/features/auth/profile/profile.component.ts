import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { EventService } from '../../../core/services/event.service';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from '../../../core/services/confirmation.service';

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
                  <i class="fas" [ngClass]="{
                    'fa-user': profile.role === 'User',
                    'fa-chalkboard-user': profile.role === 'Organizer',
                    'fa-shield-alt': profile.role === 'Admin'
                  }"></i>
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

                <!-- Organizer Stats Section -->
                <div class="col-12 mt-3" *ngIf="profile.role === 'Organizer' || profile.role === 'Admin'">
                  <hr>
                  <h6 class="fw-bold mb-3">
                    <i class="fas fa-chart-line text-primary me-2"></i>Organizer Dashboard
                  </h6>
                  
                  <div class="row g-2 mb-3">
                    <div class="col-6">
                      <div class="card bg-light border-0 text-center p-2">
                        <div class="small text-muted">Total Events</div>
                        <div class="fs-4 fw-bold text-primary">{{ organizerStats.totalEvents }}</div>
                      </div>
                    </div>
                    <div class="col-6">
                      <div class="card bg-light border-0 text-center p-2">
                        <div class="small text-muted">Published</div>
                        <div class="fs-4 fw-bold text-success">{{ organizerStats.publishedEvents }}</div>
                      </div>
                    </div>
                    <div class="col-6">
                      <div class="card bg-light border-0 text-center p-2">
                        <div class="small text-muted">Total Bookings</div>
                        <div class="fs-4 fw-bold text-info">{{ organizerStats.totalBookings }}</div>
                      </div>
                    </div>
                    <div class="col-6">
                      <div class="card bg-light border-0 text-center p-2">
                        <div class="small text-muted">Revenue</div>
                        <div class="fs-4 fw-bold text-warning">₹{{ organizerStats.totalRevenue | number:'1.0-0' }}</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <hr>

              <!-- Action Buttons -->
              <div class="d-grid gap-2">
                <!-- For Regular Users -->
                <ng-container *ngIf="profile.role === 'User'">
                  <a routerLink="/bookings" class="btn btn-outline-primary">
                    <i class="fas fa-ticket-alt me-2"></i>My Bookings
                  </a>
                </ng-container>

                <!-- For Organizers and Admins -->
                <ng-container *ngIf="profile.role === 'Organizer' || profile.role === 'Admin'">
                  <a routerLink="/organizer" class="btn btn-outline-success">
                    <i class="fas fa-chalkboard-user me-2"></i>Organizer Dashboard
                  </a>
                </ng-container>

                <!-- ✅ UPDATED: Logout with confirmation -->
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

  profile: any = null;
  loading = true;
  organizerStats = {
    totalEvents: 0,
    publishedEvents: 0,
    totalBookings: 0,
    totalRevenue: 0
  };

  constructor(
    private authService: AuthService,
    private eventService: EventService,
    private toastr: ToastrService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.authService.getProfile().subscribe({
      next: (p) => { 
        this.profile = p; 
        this.loading = false;
        
        // Load organizer stats if user is organizer or admin
        if (this.profile.role === 'Organizer' || this.profile.role === 'Admin') {
          this.loadOrganizerStats();
        }
      },
      error: () => {
        this.toastr.error('Failed to load profile.');
        this.loading = false;
      }
    });
  }

  loadOrganizerStats(): void {
    this.eventService.getMyEvents().subscribe({
      next: (events) => {
        this.organizerStats.totalEvents = events.length;
        this.organizerStats.publishedEvents = events.filter(e => e.status === 'Published').length;
        this.organizerStats.totalBookings = events.reduce((sum, e) => sum + e.bookedTickets, 0);
        this.organizerStats.totalRevenue = events.reduce((sum, e) => sum + (e.bookedTickets * e.ticketPrice), 0);
      },
      error: () => {
        console.error('Failed to load organizer stats');
      }
    });
  }

  /**
   * ✅ UPDATED: Logout with custom confirmation dialog
   */
  logout(): void {
    this.confirmationService.confirm({
      title: 'Logout Confirmation',
      message: 'Are you sure you want to logout?\n\nYou will need to login again to access your bookings and profile.',
      confirmText: 'Yes, Logout',
      cancelText: 'Cancel',
      confirmButtonClass: 'btn-danger',
      icon: 'fas fa-sign-out-alt'
    }).subscribe({
      next: (confirmed) => {
        if (confirmed) {
          console.log('✅ User confirmed logout from profile');
          this.authService.performLogout();
        } else {
          console.log('❌ User cancelled logout from profile');
        }
      },
      error: (err) => {
        console.error('❌ Logout confirmation error:', err);
      }
    });
  }
}