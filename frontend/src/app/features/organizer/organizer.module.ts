import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// Import SharedModule to access shared components
import { SharedModule } from '../../shared/shared.module';  // ← ADD THIS

// Organizer Components
import { OrganizerDashboardComponent } from './organizer-dashboard/organizer-dashboard.component';
import { EventFormComponent } from './event-form/event-form.component';
import { AttendeesComponent } from './attendees/attendees.component';
import { ScannerComponent } from './Scanner/Scanner.component';

const routes: Routes = [
  { path: '', component: OrganizerDashboardComponent },
  { path: 'events/new', component: EventFormComponent },
  { path: 'events/:id/edit', component: EventFormComponent },
  { path: 'events/:id/attendees', component: AttendeesComponent },
  { path: 'scanner', component: ScannerComponent }
];

@NgModule({
  declarations: [
    OrganizerDashboardComponent,
    EventFormComponent,
    AttendeesComponent,
    ScannerComponent
    // NOTE: ImageUploadComponent and SeatConfigComponent are NOT declared here
    // They come from SharedModule
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule,  // ← ADD THIS - Provides ImageUploadComponent, SeatConfigComponent, etc.
    RouterModule.forChild(routes)
  ]
})
export class OrganizerModule { }