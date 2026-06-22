import { Component, OnInit } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { LocationPopupService } from './core/services/location-popup.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  template: `
    <app-navbar></app-navbar>
    <main>
      <router-outlet></router-outlet>
    </main>
    <app-footer></app-footer>
    
    <!-- Location Selector Popup -->
    <app-location-selector 
      *ngIf="showLocationPopup"
      (citySelected)="onCitySelected($event)"
      (closed)="onLocationPopupClosed()">
    </app-location-selector>

    <!-- ✅ Confirmation Dialog - Always rendered -->
    <app-confirmation-dialog></app-confirmation-dialog>
  `
})
export class AppComponent implements OnInit {
  showLocationPopup = false;

  constructor(
    private authService: AuthService,
    private locationPopupService: LocationPopupService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to popup visibility from service
    // This allows the navbar to trigger the popup
    this.locationPopupService.showPopup$.subscribe(show => {
      this.showLocationPopup = show;
    });

    // Check when user logs in - show popup only if no city selected
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        const selectedCity = this.authService.getSelectedCity();
        if (!selectedCity) {
          // Show popup after a short delay for better UX
          setTimeout(() => {
            this.locationPopupService.show();
          }, 500);
        }
      }
    });
  }

  onCitySelected(city: string): void {
    // Save the selected city
    this.authService.setSelectedCity(city);
    
    // Hide the popup
    this.locationPopupService.hide();
    
    // Navigate to events page to show filtered events
    this.router.navigate(['/events']);
  }

  onLocationPopupClosed(): void {
    // Just hide the popup without saving
    this.locationPopupService.hide();
  }
}