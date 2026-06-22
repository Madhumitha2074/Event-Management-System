import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Regular Components (not standalone)
import { FooterComponent } from './footer/footer.component';
import { NavbarComponent } from './navbar/navbar.component';

// New Regular Components (not standalone)
import { ImageUploadComponent } from './components/image-upload/image-upload.component';
import { SeatConfigComponent } from './components/seat-config/seat-config.component';

// Standalone Component - IMPORT not DECLARE
import { LocationSelectorComponent } from './location-selector/location-selector.component';

@NgModule({
  declarations: [
    // Regular components (not standalone)
    FooterComponent,
    NavbarComponent,
    ImageUploadComponent,
    SeatConfigComponent
    
    // ❌ LocationSelectorComponent is NOT here - it's standalone
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    LocationSelectorComponent  // ← Standalone component goes in imports
  ],
  exports: [
    // Export everything so other modules can use them
    FooterComponent,
    NavbarComponent,
    ImageUploadComponent,
    SeatConfigComponent,
    LocationSelectorComponent,  // ← Export standalone component
    
    // Export common modules
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class SharedModule { }