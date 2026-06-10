import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-location-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="location-modal-overlay" (click)="close()">
      <div class="location-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h4 class="modal-title">
            <i class="fas fa-map-marker-alt text-primary me-2"></i>
            Select Your City
          </h4>
          <button class="btn-close" (click)="close()">&times;</button>
        </div>
        
        <div class="modal-body">
          <p class="text-muted mb-3">Find events happening near you in Tamil Nadu!</p>
          
          <!-- Current selected city display -->
          <div class="selected-city-info mb-3" *ngIf="currentSelectedCity">
            <div class="alert alert-success alert-sm">
              <i class="fas fa-check-circle me-2"></i>
              Currently selected: <strong>{{ currentSelectedCity }}</strong>
              <button class="btn btn-link btn-sm p-0 ms-2" (click)="clearAndReopen()">
                Change
              </button>
            </div>
          </div>
          
          <!-- Search input with dropdown -->
          <div class="search-box mb-3">
            <i class="fas fa-search search-icon"></i>
            <input 
              type="text" 
              class="form-control" 
              placeholder="Search for your city..."
              [(ngModel)]="searchTerm"
              (input)="filterCities()"
              (focus)="showDropdown = true"
              autocomplete="off"
            />
            
            <!-- Search dropdown suggestions -->
            <div class="search-dropdown" *ngIf="showDropdown && filteredCities.length > 0 && searchTerm">
              <div 
                *ngFor="let city of filteredCities" 
                class="dropdown-item"
                [class.active-city]="city === currentSelectedCity"
                (click)="selectCity(city)">
                <i class="fas fa-map-marker-alt me-2 text-primary" *ngIf="city === currentSelectedCity"></i>
                <i class="fas fa-map-marker-alt me-2 text-muted" *ngIf="city !== currentSelectedCity"></i>
                {{ city }}
                <span *ngIf="city === currentSelectedCity" class="badge bg-success ms-2">Selected</span>
              </div>
            </div>
          </div>
          
          <!-- Detect location button -->
          <button class="btn btn-location w-100 mb-4" (click)="detectLocation()">
            <i class="fas fa-location-dot me-2"></i>
            Detect my location
          </button>
          
          <!-- Popular Search - Only 8 cities -->
          <div class="popular-cities">
            <p class="fw-semibold mb-3">
              <i class="fas fa-fire text-danger me-1"></i>
              Popular Search
            </p>
            <div class="city-grid">
              <button 
                *ngFor="let city of popularCities" 
                class="city-btn"
                [class.city-btn-active]="city === currentSelectedCity"
                (click)="selectCity(city)"
              >
                {{ city }}
                <span *ngIf="city === currentSelectedCity" class="check-mark">✓</span>
              </button>
            </div>
          </div>
          
          <!-- Recently Viewed - Only last 3 cities -->
          <div class="recent-cities mt-4" *ngIf="recentCities.length > 0">
            <p class="fw-semibold mb-2 small text-muted">
              <i class="fas fa-history me-1"></i>
              Recently Viewed
            </p>
            <div class="recent-grid">
              <button 
                *ngFor="let city of recentCities" 
                class="city-btn-recent"
                [class.city-btn-active]="city === currentSelectedCity"
                (click)="selectCity(city)"
              >
                {{ city }}
                <span *ngIf="city === currentSelectedCity" class="check-mark">✓</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-outline-secondary btn-sm" (click)="close()">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .location-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .location-modal {
      background: white;
      border-radius: 20px;
      width: 90%;
      max-width: 500px;
      max-height: 85vh;
      overflow: hidden;
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from {
        transform: translateY(-50px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #eef2f6;
    }
    .modal-title {
      margin: 0;
      font-size: 1.3rem;
    }
    .btn-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.2s;
    }
    .btn-close:hover {
      opacity: 1;
    }
    .modal-body {
      padding: 24px;
      max-height: 65vh;
      overflow-y: auto;
    }
    .selected-city-info {
      margin-bottom: 16px;
    }
    .alert-success {
      background-color: #d4edda;
      border-color: #c3e6cb;
      color: #155724;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
    }
    .search-box {
      position: relative;
    }
    .search-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: #adb5bd;
      z-index: 1;
      pointer-events: none;
      font-size: 16px;
    }
    .search-box input {
      padding-left: 48px;
      padding-right: 16px;
      border-radius: 30px;
      border: 1px solid #dee2e6;
      width: 100%;
      height: 46px;
      font-size: 14px;
    }
    .search-box input:focus {
      border-color: #6c5ce7;
      box-shadow: 0 0 0 3px rgba(108,92,231,0.1);
      outline: none;
    }
    .search-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 12px;
      margin-top: 8px;
      max-height: 250px;
      overflow-y: auto;
      z-index: 10;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .dropdown-item {
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;
      border-bottom: 1px solid #f0f0f0;
      font-size: 14px;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .dropdown-item:last-child {
      border-bottom: none;
    }
    .dropdown-item:hover {
      background: #f8f9fa;
    }
    .dropdown-item.active-city {
      background: #e8f0fe;
      border-left: 3px solid #6c5ce7;
    }
    .btn-location {
      background: linear-gradient(135deg, #6c5ce7, #a29bfe);
      color: white;
      border: none;
      padding: 12px;
      border-radius: 30px;
      font-weight: 600;
      transition: transform 0.2s;
      cursor: pointer;
    }
    .btn-location:hover {
      transform: translateY(-2px);
    }
    .popular-cities {
      margin-top: 8px;
    }
    .city-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 12px;
    }
    .city-btn {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 30px;
      padding: 10px 8px;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;
      cursor: pointer;
      text-align: center;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .city-btn:hover {
      background: #6c5ce7;
      color: white;
      border-color: #6c5ce7;
      transform: translateY(-2px);
    }
    .city-btn-active {
      background: #6c5ce7;
      color: white;
      border-color: #6c5ce7;
    }
    .check-mark {
      font-size: 12px;
      font-weight: bold;
    }
    .recent-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 12px;
    }
    .city-btn-recent {
      background: #e8f4f8;
      border: 1px solid #b8dbe8;
      border-radius: 30px;
      padding: 8px 16px;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;
      cursor: pointer;
      text-align: center;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .city-btn-recent:hover {
      background: #6c5ce7;
      color: white;
      border-color: #6c5ce7;
    }
    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid #eef2f6;
      text-align: center;
    }
    
    @media (max-width: 600px) {
      .location-modal {
        max-width: 95%;
      }
      .city-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .city-btn {
        padding: 8px 12px;
        font-size: 0.8rem;
        white-space: normal;
        word-break: keep-all;
      }
      .recent-grid {
        gap: 8px;
      }
      .city-btn-recent {
        padding: 6px 12px;
        font-size: 0.75rem;
      }
    }
    
    @media (max-width: 480px) {
      .location-modal {
        width: 95%;
        margin: 16px;
      }
      .city-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .city-btn {
        padding: 8px 10px;
        font-size: 0.75rem;
      }
      .city-btn-recent {
        white-space: normal;
        word-break: break-word;
        padding: 6px 10px;
      }
      .dropdown-item {
        padding: 10px 16px;
        font-size: 13px;
      }
    }
  `]
})
export class LocationSelectorComponent {
  @Output() citySelected = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();
  
  searchTerm = '';
  showDropdown = false;
  currentSelectedCity: string | null = null;
  
  // Popular cities for quick selection (only 8)
  popularCities: string[] = [
    'Chennai',
    'Madurai',
    'Trichy',
    'Hosur',
    'Coimbatore',
    'Thanjavur',
    'Tiruppur',
    'Tirunelveli'
  ];
  
  // Complete list of Tamil Nadu cities for search
  allCities: string[] = [
    'Chennai',
    'Coimbatore',
    'Madurai',
    'Trichy',
    'Salem',
    'Erode',
    'Tirunelveli',
    'Vellore',
    'Thanjavur',
    'Thoothukudi',
    'Kanchipuram',
    'Rameshwaram',
    'Tiruppur',
    'Nagercoil',
    'Dindigul',
    'Cuddalore',
    'Hosur',
    'Krishnagiri',
    'Dharmapuri',
    'Namakkal',
    'Karur',
    'Nagapattinam',
    'Tiruvarur',
    'Pudukkottai',
    'Sivaganga',
    'Ramanathapuram',
    'Virudhunagar',
    'Theni',
    'Kanniyakumari',
    'Tenkasi',
    'Ranipet',
    'Tirupathur',
    'Kallakurichi',
    'Mayiladuthurai'
  ];
  
  filteredCities: string[] = [];
  recentCities: string[] = [];
  
  constructor() {
    const stored = localStorage.getItem('recent_cities');
    if (stored) {
      this.recentCities = JSON.parse(stored).slice(0, 3);
    }
    // Get currently selected city from localStorage
    this.currentSelectedCity = localStorage.getItem('selected_city');
  }
  
  filterCities(): void {
    if (!this.searchTerm) {
      this.filteredCities = [];
      this.showDropdown = false;
    } else {
      const searchLower = this.searchTerm.toLowerCase();
      this.filteredCities = this.allCities.filter(city => 
        city.toLowerCase().startsWith(searchLower)
      );
      this.showDropdown = this.filteredCities.length > 0;
    }
  }
  
  detectLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.getCityFromCoordinates(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Location error:', error);
          alert('Unable to detect location. Please select a city manually.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser. Please select a city manually.');
    }
  }
  
  getCityFromCoordinates(lat: number, lng: number): void {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`)
      .then(response => response.json())
      .then(data => {
        const address = data.address;
        const city = address.city || address.town || address.village || address.state_district;
        const isInTamilNadu = address.state === 'Tamil Nadu' || address.state === 'Tamilnadu';
        
        if (city && isInTamilNadu) {
          const matchedCity = this.allCities.find(c => 
            c.toLowerCase().includes(city.toLowerCase()) || 
            city.toLowerCase().includes(c.toLowerCase().split(' ')[0])
          );
          
          if (matchedCity) {
            this.selectCity(matchedCity);
          } else {
            alert(`Detected city "${city}" is in Tamil Nadu, but not in our list. Please select manually.`);
          }
        } else {
          alert('Please select a city in Tamil Nadu for local events.');
        }
      })
      .catch(() => {
        alert('Could not detect your city. Please select manually.');
      });
  }
  
  // Updated selectCity method - saves to localStorage and emits
  selectCity(city: string): void {
    // Add to recent cities
    this.addToRecentCities(city);
    
    // Update current selected city
    this.currentSelectedCity = city;
    
    // Save to localStorage
    localStorage.setItem('selected_city', city);
    
    // Emit the selected city to parent component
    this.citySelected.emit(city);
  }
  
  clearAndReopen(): void {
    // Clear the selected city
    this.currentSelectedCity = null;
    localStorage.removeItem('selected_city');
    // Refresh the view
    this.searchTerm = '';
    this.filteredCities = [];
  }
  
  addToRecentCities(city: string): void {
    this.recentCities = this.recentCities.filter(c => c !== city);
    this.recentCities.unshift(city);
    this.recentCities = this.recentCities.slice(0, 3);
    localStorage.setItem('recent_cities', JSON.stringify(this.recentCities));
  }
  
  close(): void {
    this.closed.emit();
  }
}